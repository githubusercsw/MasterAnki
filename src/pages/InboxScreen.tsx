import React, { useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonNote,
  IonIcon,
  IonButton,
  IonFab,
  IonFabButton,
  IonRefresher,
  IonRefresherContent,
  IonButtons,
  IonCheckbox,
  IonSpinner,
  IonText,
  IonActionSheet,
} from '@ionic/react';
import {
  addOutline,
  settingsOutline,
  lockClosedOutline,
  trashOutline,
  downloadOutline,
  checkmarkDoneOutline,
  checkmarkOutline,
  refreshOutline,
  shareSocialOutline,
} from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import Inbox, { type SaveEntryInput } from '../plugins/Inbox';
import { parseIncomingShare } from '../lib/share/parseIncoming';
import ShareReceiver from '../plugins/ShareReceiver';
import type { InboxEntry, Flashcard } from '../lib/anki/types';
import { downloadJson, downloadCsv, type ExportRecord } from '../lib/anki/export';
import ConfirmGate from '../components/ConfirmGate';

const InboxScreen: React.FC = () => {
  const history = useHistory();
  const { t } = useTranslation();
  const [entries, setEntries] = useState<InboxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  // 批量选择状态
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // 确认门状态
  const [deleteGateOpen, setDeleteGateOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  // 长按快捷操作
  const [actionEntry, setActionEntry] = useState<InboxEntry | null>(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const longPressTimer = useRef<number | null>(null);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const res = await Inbox.getAllEntries();
      setEntries(res.entries ?? []);
    } catch (e) {
      console.error('Failed to load inbox:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, []);

  /** 静默处理来自其他应用的分享：入库但不打开 UI */
  const handlePendingShare = async () => {
    try {
      const pending = await ShareReceiver.hasPending();
      if (!pending.pending) return;
      const shared = await parseIncomingShare();
      if (!shared) return;

      const entry: SaveEntryInput = {
        id: crypto.randomUUID(),
        contentType: shared.mode === 'url' ? 'url' : 'text',
        content: shared.content,
        preview:
          shared.content.length > 120
            ? shared.content.slice(0, 120) + '…'
            : shared.content,
        isLocked: false,
      };
      await Inbox.saveEntry({ entry });
      await ShareReceiver.clear();
      await loadEntries();
    } catch (e) {
      console.warn('Share handling skipped:', e);
    }
  };

  useEffect(() => {
    handlePendingShare();
  }, []);

  const onRefresh = async (ev: CustomEvent) => {
    await loadEntries();
    (ev.detail as { complete(): void }).complete();
  };

  const selectedEntries = entries.filter((e) => selectedIds.has(e.id));

  /** 全选/反选当前列表 */
  const toggleSelectAll = () => {
    if (selectedIds.size === entries.length && entries.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entries.map((e) => e.id)));
    }
  };

  /** 批量导出所选条目（JSON/CSV） */
  const exportSelected = async (format: 'json' | 'csv') => {
    setExporting(true);
    try {
      const records: ExportRecord[] = [];
      for (const entry of selectedEntries) {
        let cards: Flashcard[] = [];
        try {
          const res = await Inbox.getEntry({ id: entry.id });
          cards = res.cards ?? [];
        } catch {
          cards = [];
        }
        records.push({ entry, cards });
      }
      if (format === 'json') {
        downloadJson(records);
      } else {
        downloadCsv(records);
      }
      setSelectMode(false);
      setSelectedIds(new Set());
    } catch (e) {
      console.error('Export failed:', e);
    } finally {
      setExporting(false);
    }
  };

  /** 批量删除所选条目（二次确认） */
  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await Inbox.deleteEntries({ ids: Array.from(selectedIds) });
      setSelectedIds(new Set());
      setSelectMode(false);
      setDeleteGateOpen(false);
      await loadEntries();
    } catch (e) {
      console.error('Delete failed:', e);
    } finally {
      setDeleting(false);
    }
  };

  /* ---------- 长按快捷操作（3d） ---------- */
  const startLongPress = (entry: InboxEntry) => {
    longPressTimer.current = window.setTimeout(() => {
      setActionEntry(entry);
      setActionSheetOpen(true);
    }, 500);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  /** 长按菜单动作 */
  const runAction = async (action: 'regenerate' | 'delete' | 'share') => {
    setActionSheetOpen(false);
    if (!actionEntry) return;
    if (action === 'regenerate') {
      history.push(`/entry/${actionEntry.id}`);
    } else if (action === 'delete') {
      setSelectedIds(new Set([actionEntry.id]));
      setDeleteGateOpen(true);
    } else if (action === 'share') {
      try {
        const text = actionEntry.title ?? actionEntry.preview;
        await ShareReceiver.shareText({ text, title: actionEntry.title });
      } catch {
        // 分享失败静默
      }
    }
    setActionEntry(null);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('app.title')}</IonTitle>
          <IonButtons slot="end">
            <IonButton routerLink="/settings">
              <IonIcon icon={settingsOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={onRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {/* 批量工具栏：选择模式开启后显示 */}
        {selectMode ? (
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              padding: '0.5rem 1rem',
              borderBottom: '1px solid var(--ion-color-light-shade)',
            }}
          >
            <IonButton size="small" fill="outline" onClick={toggleSelectAll}>
              <IonIcon
                icon={selectedIds.size === entries.length ? checkmarkDoneOutline : checkmarkOutline}
                slot="start"
              />
              {selectedIds.size === entries.length ? t('common.deselectAll') : t('common.selectAll')}
            </IonButton>
            <IonButton
              size="small"
              fill="outline"
              disabled={selectedIds.size === 0}
              onClick={() => exportSelected('json')}
            >
              <IonIcon icon={downloadOutline} slot="start" />
              {t('common.exportJson')}
            </IonButton>
            <IonButton
              size="small"
              fill="outline"
              disabled={selectedIds.size === 0}
              onClick={() => exportSelected('csv')}
            >
              {t('common.exportCsv')}
            </IonButton>
            <IonButton
              size="small"
              color="danger"
              fill="outline"
              disabled={selectedIds.size === 0}
              onClick={() => setDeleteGateOpen(true)}
            >
              <IonIcon icon={trashOutline} slot="start" />
              {t('common.delete')} ({selectedIds.size})
            </IonButton>
            <IonButton
              size="small"
              fill="clear"
              onClick={() => {
                setSelectMode(false);
                setSelectedIds(new Set());
              }}
            >
              {t('common.done')}
            </IonButton>
          </div>
        ) : null}

        {!loading && entries.length === 0 ? (
          <div className="ion-padding ion-text-center" style={{ marginTop: '3rem' }}>
            <p>{t('inbox.empty')}</p>
          </div>
        ) : (
          <>
            {!selectMode && (
              <IonButton
                expand="block"
                fill="clear"
                onClick={() => setSelectMode(true)}
                disabled={entries.length === 0}
              >
                {t('inbox.manage')}
              </IonButton>
            )}
            <IonList>
              {entries.map((entry) => {
                const checked = selectedIds.has(entry.id);
                return (
                  <IonItem
                    key={entry.id}
                    button
                    onClick={() => {
                      if (selectMode) {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(entry.id)) next.delete(entry.id);
                          else next.add(entry.id);
                          return next;
                        });
                      } else {
                        history.push(`/entry/${entry.id}`);
                      }
                    }}
                    onContextMenu={(e) => {
                      // 桌面端右键即弹快捷菜单
                      e.preventDefault();
                      setActionEntry(entry);
                      setActionSheetOpen(true);
                    }}
                    onTouchStart={() => startLongPress(entry)}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                    onTouchCancel={cancelLongPress}
                  >
                    {selectMode && <IonCheckbox slot="start" checked={checked} />}
                    {entry.isLocked && (
                      <IonIcon icon={lockClosedOutline} slot="start" color="medium" />
                    )}
                    <IonLabel>
                      <h2>{entry.title ?? entry.preview}</h2>
                      <p>{entry.contentType.toUpperCase()}</p>
                    </IonLabel>
                    <IonNote slot="end">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </IonNote>
                  </IonItem>
                );
              })}
            </IonList>
          </>
        )}

        {exporting && (
          <div className="ion-padding ion-text-center">
            <IonSpinner name="crescent" />
            <IonText color="medium">{t('inbox.exporting')}</IonText>
          </div>
        )}

        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={() => history.push('/create')}>
            <IonIcon icon={addOutline} />
          </IonFabButton>
        </IonFab>

        <ConfirmGate
          open={deleteGateOpen}
          title={t('inbox.deleteTitle')}
          description={t('inbox.deleteDesc', { count: selectedIds.size })}
          confirmLabel={t('common.delete')}
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteGateOpen(false)}
        />

        {/* 长按快捷菜单 */}
        <IonActionSheet
          isOpen={actionSheetOpen}
          onDidDismiss={() => setActionSheetOpen(false)}
          header={actionEntry?.title ?? actionEntry?.preview}
          buttons={[
            {
              text: t('actions.regenerate'),
              icon: refreshOutline,
              handler: () => void runAction('regenerate'),
            },
            {
              text: t('actions.delete'),
              icon: trashOutline,
              role: 'destructive',
              handler: () => void runAction('delete'),
            },
            {
              text: t('actions.share'),
              icon: shareSocialOutline,
              handler: () => void runAction('share'),
            },
            {
              text: t('common.cancel'),
              role: 'cancel',
            },
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default InboxScreen;
