import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonButton,
  IonSpinner,
  IonList,
  IonItem,
  IonLabel,
  IonText,
  IonCard,
  IonCardContent,
  IonInput,
  IonNote,
  IonCheckbox,
  IonSelect,
  IonSelectOption,
  IonIcon,
  IonReorderGroup,
  IonReorder,
} from '@ionic/react';
import {
  sparklesOutline,
  checkmarkCircleOutline,
  createOutline,
  refreshOutline,
} from 'ionicons/icons';
import Inbox from '../plugins/Inbox';
import AnkiDroid from '../plugins/AnkiDroid';
import { MODELS } from '../lib/anki/ankidroid';
import { useDeckSelector } from '../lib/anki/useDeckSelector';
import { buildAnkiNote } from '../lib/anki/noteBuilder';
import type { InboxEntry, Flashcard } from '../lib/anki/types';
import { computeSourceHash } from '../lib/anki/dedup';
import { buildChangeSummary, hasChanges } from '../lib/anki/dedupService';
import type { CardChangeSummary } from '../lib/anki/dedupService';
import { runBatch, allSucceeded } from '../lib/anki/batch';
import type { BatchResult } from '../lib/anki/batch';
import ConfirmGate from '../components/ConfirmGate';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { useTranslation } from 'react-i18next';
import { LLMService } from '../lib/llm/service';

const EntryDetailScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [entry, setEntry] = useState<InboxEntry | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [generating, setGenerating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');
  // 人工确认门状态：等待用户确认的增量更新
  const [gateOpen, setGateOpen] = useState(false);
  const [gateSummary, setGateSummary] = useState<CardChangeSummary | null>(null);
  const [pendingCards, setPendingCards] = useState<Flashcard[]>([]);
  const [pendingSourceHash, setPendingSourceHash] = useState('');
  // 批量入库状态
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);
  // 批量选中（用于批量删除）
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteGateOpen, setDeleteGateOpen] = useState(false);

  // 牌组选择器（真实列表 + 可新建，跨页面共享状态机）
  // - initialDeckName：条目已保存牌组优先；无则 hook 回退用户已选牌组
  // - onPickDeck：选择真实牌组时同步到条目，保证入库用所选真实资源
  const {
    deckName,
    setDeckName,
    realDecks,
    decksLoading,
    showDeckSelector,
    pickRealDeck,
    pickCustomDeck,
  } = useDeckSelector({
    initialDeckName: entry?.deckName,
    onPickDeck: async (name) => {
      try {
        await Inbox.updateDeckName({ entryId: id, deckName: name });
      } catch {
        // 静默：条目级同步失败不影响入库
      }
    },
  });

  const load = async () => {
    try {
      const res = await Inbox.getEntry({ id });
      setEntry(res.entry);
      // 按 sortOrder 升序展示（拖拽排序持久化后保持一致）
      const sorted = [...(res.cards ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      setCards(sorted);
      setMessage('');
    } catch {
      setMessage(t('entry.loadFailed'));
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const ensureExtracted = async (): Promise<string> => {
    if (entry?.extractedText) return entry.extractedText;
    // text 类型直接使用 content
    if (entry?.contentType === 'text') {
      const text = entry.content;
      await Inbox.updateExtractedContent({ entryId: id, extractedText: text });
      setEntry((e) => (e ? { ...e, extractedText: text } : e));
      return text;
    }
    // url/pdf 在 Web 环境提示手动粘贴（Phase 5 接入 InputSource）
    setMessage(t('entry.extractionNeedsNative'));
    return '';
  };

  /** 生成新卡片（供 generate 与确认门共用） */
  const persistCards = async (
    cardsToSave: Array<{
      front: string;
      back: string;
      type?: Flashcard['type'];
      cloze?: string;
      tags?: string[];
      sourceHash?: string;
    }>,
    removedIds: string[]
  ) => {
    if (removedIds.length > 0) {
      // 增量更新：移除被替换的旧卡
      await Inbox.deleteCards({ cardIds: removedIds });
    }
    await Inbox.saveCards({ entryId: id, cards: cardsToSave });
    await Inbox.lockEntry({ entryId: id });
    await load();
  };

  const generate = async () => {
    setGenerating(true);
    setMessage('');
    try {
      const text = await ensureExtracted();
      if (!text) {
        setMessage(t('entry.noText'));
        return;
      }
      // 来源哈希（去重/增量更新依据）
      const sourceHash = await computeSourceHash(text);
      // 构建管线：使用当前活跃 Provider（含用户自定义 prompt）
      const pipeline = await LLMService.getInstance().getPipeline();
      const result = await pipeline.run(text, entry?.title, 'basic');

      const newCards: Flashcard[] = result.cards.map((c) => ({
        ...c,
        entryId: id,
        sourceHash,
      }));

      // 已有卡片时：走增量更新，先出变更摘要，人工确认后才落库
      if (cards.length > 0) {
        const summary = buildChangeSummary(cards, newCards);
        if (hasChanges(summary)) {
          setGateSummary(summary);
          setPendingCards(newCards);
          setPendingSourceHash(sourceHash);
          setGateOpen(true);
          return; // 等待确认门（finally 会重置 generating）
        }
        // 无变化：跳过写入
        setMessage(t('entry.noChanges'));
        return;
      }

      // 首次生成：直接落库
      await persistCards(
        newCards.map((c) => ({
          front: c.front,
          back: c.back,
          type: c.type,
          cloze: c.cloze,
          tags: c.tags,
          sourceHash,
        })),
        []
      );
      setMessage(t('entry.generated', { count: newCards.length }));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('entry.generationFailed'));
    } finally {
      setGenerating(false);
    }
  };

  /** 用户确认增量更新 */
  const confirmGate = async () => {
    try {
      if (!gateSummary) return;
      const removedIds = gateSummary.removed.map((c) => c.id).filter((cid): cid is string => !!cid);
      await persistCards(
        pendingCards.map((c) => ({
          front: c.front,
          back: c.back,
          type: c.type,
          cloze: c.cloze,
          tags: c.tags,
          sourceHash: pendingSourceHash,
        })),
        removedIds
      );
      const total =
        gateSummary.added.length + gateSummary.changed.length + gateSummary.unchanged.length;
      setMessage(
        t('entry.updated', {
          count: total,
          added: gateSummary.added.length,
          changed: gateSummary.changed.length,
        })
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('entry.updateFailed'));
    } finally {
      setGateOpen(false);
      setGateSummary(null);
      setPendingCards([]);
      setPendingSourceHash('');
    }
  };

  /** 构建单卡入库任务（供单卡与批量复用） */
  const buildAddTask = (card: Flashcard) => {
    return async (): Promise<void> => {
      // 构建 note（模型解析 + 字段映射，见 noteBuilder）
      const note = await buildAnkiNote(card, deckName);
      // 确保模型存在（原生 resolveModel 会优先精确匹配真实模型名）
      await AnkiDroid.ensureModel({
        modelKey: note.modelKey,
        fields: Object.keys(note.fields),
        templates: MODELS[card.type].templates,
      });
      const result = await AnkiDroid.addNote({ note });
      await Inbox.updateCardStatus({ cardId: card.id, status: 'added', noteId: result.noteId });
    };
  };

  const addCardToAnki = async (card: Flashcard) => {
    setAdding(true);
    setMessage('');
    try {
      await buildAddTask(card)();
      await load();
      setMessage(t('entry.added'));
    } catch (e) {
      await Inbox.updateCardStatus({ cardId: card.id, status: 'error' });
      setMessage(e instanceof Error ? e.message : t('entry.addFailed'));
    } finally {
      setAdding(false);
    }
  };

  /** 批量入库：二次确认 → 串行执行 → 失败清单 */
  const confirmBatchAdd = async () => {
    setBatchRunning(true);
    setMessage('');
    try {
      const pending = cards.filter((c) => c.status !== 'added');
      const result = await runBatch(
        pending.map((c) => ({
          id: c.id,
          label: c.front.slice(0, 40),
          run: buildAddTask(c),
        }))
      );
      setBatchResult(result);
      if (allSucceeded(result)) {
        setBatchConfirmOpen(false);
        setBatchResult(null);
        setMessage(t('entry.batchAdded', { count: result.successCount }));
      }
      // 有失败：保留门展示失败清单（result 通过 batchResult state 呈现）
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('entry.batchFailed'));
    } finally {
      setBatchRunning(false);
    }
  };

  /** 批量删除选中的待处理卡片（二次确认） */
  const confirmDeleteSelected = async () => {
    try {
      const ids = Array.from(selectedIds);
      await Inbox.deleteCards({ cardIds: ids });
      setSelectedIds(new Set());
      setDeleteGateOpen(false);
      await load();
      setMessage(t('entry.deletedCards', { count: ids.length }));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('entry.deleteFailed'));
    }
  };

  /** 拖拽排序：更新本地顺序并持久化 sortOrder */
  const handleReorder = async (ev: CustomEvent) => {
    const from = ev.detail.from;
    const to = ev.detail.to;
    // 本地重排（Ionic 要求调用 complete 提交新顺序）
    const reordered = [...cards];
    const [moved] = reordered.splice(from, 1);
    if (moved) {
      reordered.splice(to, 0, moved);
    }
    ev.detail.complete(reordered);
    setCards(reordered);

    // 持久化新的 sortOrder（仅发送顺序变化的卡片）
    try {
      for (let i = 0; i < reordered.length; i++) {
        if ((reordered[i].sortOrder ?? 0) !== i) {
          await Inbox.updateCardOrder({ cardId: reordered[i].id, sortOrder: i });
        }
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('entry.persistOrderFailed'));
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/inbox" />
          </IonButtons>
          <IonTitle>{t('entry.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {!entry ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
            <IonSpinner />
          </div>
        ) : (
          <>
            <IonCard>
              <IonCardContent>
                <h2 style={{ marginTop: 0 }}>{entry.title ?? entry.preview}</h2>
                <IonNote>{entry.contentType.toUpperCase()}</IonNote>
                {entry.extractedText && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--ma-text-secondary)' }}>
                    {entry.extractedText.slice(0, 200)}…
                  </p>
                )}
              </IonCardContent>
            </IonCard>

            <IonItem>
              <IonLabel position="stacked">{t('entry.deckName')}</IonLabel>
              {showDeckSelector ? (
                <IonSelect
                  value={deckName}
                  onIonChange={(e) => void pickRealDeck(String(e.detail.value))}
                  placeholder={t('entry.chooseDeck')}
                >
                  {realDecks.map((d) => (
                    <IonSelectOption key={d.id} value={d.name}>
                      {d.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              ) : (
                <IonInput
                  value={deckName}
                  onIonInput={(e) => setDeckName(String(e.detail.value ?? ''))}
                />
              )}
              {showDeckSelector && (
                <IonButton size="small" fill="clear" slot="end" onClick={pickCustomDeck}>
                  {t('entry.newDeck')}
                </IonButton>
              )}
            </IonItem>
            {decksLoading && <IonNote color="medium">{t('entry.loadingDecks')}</IonNote>}

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <IonButton expand="block" onClick={generate} disabled={generating || entry.isLocked}>
                {generating ? (
                  <IonSpinner name="crescent" />
                ) : (
                  <>
                    <IonIcon icon={sparklesOutline} slot="start" />
                    {cards.length > 0 ? t('entry.regenerate') : t('entry.generate')}
                  </>
                )}
              </IonButton>
              <IonButton
                expand="block"
                fill="outline"
                routerLink={`/template/${entry.id}`}
                disabled={
                  !entry.extractedText && entry.contentType === 'text'
                    ? false
                    : !entry.extractedText
                }
              >
                {t('entry.template')}
              </IonButton>
              {cards.length > 0 && (
                <IonButton
                  expand="block"
                  fill="outline"
                  onClick={generate}
                  disabled={generating || entry.isLocked}
                  title={t('entry.incremental')}
                >
                  <IonIcon icon={refreshOutline} slot="icon-only" />
                </IonButton>
              )}
            </div>

            {cards.length > 0 && (
              <>
                {/* 批量工具栏 */}
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'center',
                    marginTop: '1rem',
                    padding: '0.25rem 0',
                  }}
                >
                  <IonButton
                    size="small"
                    fill="outline"
                    onClick={() => {
                      const pend = cards.filter((c) => c.status !== 'added');
                      const allSelected =
                        pend.length > 0 && pend.every((c) => selectedIds.has(c.id));
                      if (allSelected) setSelectedIds(new Set());
                      else setSelectedIds(new Set(pend.map((c) => c.id)));
                    }}
                  >
                    {t('entry.selectToggle')}
                  </IonButton>
                  {selectedIds.size > 0 && (
                    <IonButton
                      size="small"
                      color="danger"
                      fill="outline"
                      onClick={() => setDeleteGateOpen(true)}
                    >
                      {t('entry.deleteSelected', { count: selectedIds.size })}
                    </IonButton>
                  )}
                  <IonButton
                    size="small"
                    color="primary"
                    onClick={() => {
                      const pending = cards.filter((c) => c.status !== 'added');
                      if (pending.length === 0) {
                        setMessage(t('entry.noPending'));
                        return;
                      }
                      setBatchResult(null);
                      setBatchConfirmOpen(true);
                    }}
                    disabled={adding}
                  >
                    {t('entry.addAll', { count: cards.filter((c) => c.status !== 'added').length })}
                  </IonButton>
                </div>

                <IonReorderGroup disabled={false} onIonItemReorder={handleReorder}>
                  <IonList style={{ marginTop: '0.5rem' }}>
                    {cards.map((card) => (
                      <IonItem key={card.id}>
                        {card.status === 'added' ? (
                          <IonCheckbox slot="start" checked disabled />
                        ) : (
                          <IonCheckbox
                            slot="start"
                            checked={selectedIds.has(card.id)}
                            onIonChange={(e) => {
                              const checked = e.detail.checked;
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (checked) next.add(card.id);
                                else next.delete(card.id);
                                return next;
                              });
                            }}
                          />
                        )}
                        <IonLabel>
                          <MarkdownRenderer content={card.front} compact />
                          <MarkdownRenderer content={card.back} compact />
                          <IonNote>{card.type}</IonNote>
                        </IonLabel>
                        {card.status === 'added' ? (
                          <IonIcon icon={checkmarkCircleOutline} slot="end" color="success" />
                        ) : (
                          <IonButton
                            slot="end"
                            size="small"
                            onClick={() => addCardToAnki(card)}
                            disabled={adding}
                          >
                            {t('entry.add')}
                          </IonButton>
                        )}
                        <IonButton
                          slot="end"
                          size="small"
                          fill="clear"
                          routerLink={`/entry/${entry.id}/edit/${card.id}`}
                        >
                          <IonIcon icon={createOutline} />
                        </IonButton>
                        <IonReorder slot="end" />
                      </IonItem>
                    ))}
                  </IonList>
                </IonReorderGroup>
              </>
            )}

            {message && (
              <IonCard style={{ marginTop: '1rem' }}>
                <IonCardContent>
                  <IonText>{message}</IonText>
                </IonCardContent>
              </IonCard>
            )}

            <ConfirmGate
              open={gateOpen}
              title={t('entry.incrementalTitle')}
              subtitle={t('entry.incrementalSubtitle')}
              summary={gateSummary ?? undefined}
              confirmLabel={t('entry.confirmUpdate')}
              onConfirm={confirmGate}
              onCancel={() => {
                setGateOpen(false);
                setGateSummary(null);
                setPendingCards([]);
                setPendingSourceHash('');
              }}
            />

            {/* 批量入库确认门：含失败清单 */}
            <ConfirmGate
              open={batchConfirmOpen || (batchResult !== null && batchResult.failureCount > 0)}
              title={
                batchResult !== null && batchResult.failureCount > 0
                  ? t('entry.batchAddResultTitle')
                  : t('entry.batchAddTitle')
              }
              subtitle={
                batchResult
                  ? t('entry.batchAddResultDesc', {
                      success: batchResult.successCount,
                      failed: batchResult.failureCount,
                    })
                  : t('entry.batchAddConfirmDesc', {
                      count: cards.filter((c) => c.status !== 'added').length,
                    })
              }
              description={
                batchResult && batchResult.failureCount > 0
                  ? batchResult.failures.map((f) => `[${f.label}] ${f.error}`).join('\n')
                  : undefined
              }
              confirmLabel={batchResult ? t('entry.batchResultOk') : t('common.confirmExecute')}
              busy={batchRunning}
              onConfirm={async () => {
                if (batchResult) {
                  setBatchResult(null);
                  setBatchConfirmOpen(false);
                } else {
                  await confirmBatchAdd();
                }
              }}
              onCancel={() => {
                setBatchConfirmOpen(false);
                setBatchResult(null);
              }}
            />

            {/* 批量删除确认门 */}
            <ConfirmGate
              open={deleteGateOpen}
              title={t('entry.deleteCardsTitle')}
              description={t('entry.deleteCardsDesc', { count: selectedIds.size })}
              confirmLabel={t('common.delete')}
              onConfirm={confirmDeleteSelected}
              onCancel={() => setDeleteGateOpen(false)}
            />
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default EntryDetailScreen;
