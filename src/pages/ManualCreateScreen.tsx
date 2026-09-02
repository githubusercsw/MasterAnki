import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonButton,
  IonText,
  IonCard,
  IonCardContent,
  IonSelect,
  IonSelectOption,
  IonNote,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import Inbox from '../plugins/Inbox';
import AnkiDroid, { type AnkiModelInfo } from '../plugins/AnkiDroid';
import { getSelectedAnkiModel, setSelectedAnkiModel } from '../lib/anki/modelSelection';
import { useDeckSelector } from '../lib/anki/useDeckSelector';
import type { CardType } from '../lib/anki/types';
import { getActiveProviderId } from '../lib/settings/secureStorage';

const ManualCreateScreen: React.FC = () => {
  const history = useHistory();
  const { t } = useTranslation();
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [tags, setTags] = useState('');
  const [type, setType] = useState<CardType>('basic');
  const [message, setMessage] = useState('');
  // 真实 AnkiDroid 模板（可用时优先展示）
  const [realModels, setRealModels] = useState<AnkiModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [selectedModelName, setSelectedModelName] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // 牌组选择器（真实列表 + 可新建，跨页面共享状态机）
  const {
    deckName,
    setDeckName,
    realDecks,
    decksLoading,
    showDeckSelector,
    pickRealDeck,
    pickCustomDeck,
  } = useDeckSelector();

  // 加载 AnkiDroid 真实模板列表 + 已选模型
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const current = await getSelectedAnkiModel();
      if (!cancelled) setSelectedModelName(current);
      try {
        const res = await AnkiDroid.getModels();
        if (!cancelled && res.models && res.models.length > 0) {
          setRealModels(res.models);
        }
      } catch {
        // API 不可用 → 保持内置选项
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** 选择真实模板：持久化模型名，并按名称启发式推断卡片类型 */
  const pickRealModel = async (name: string) => {
    await setSelectedAnkiModel(name);
    setSelectedModelName(name);
    const lower = name.toLowerCase();
    if (lower.includes('occlu')) setType('image_occlusion');
    else if (lower.includes('cloze')) setType('cloze');
    else setType('basic');
  };

  const save = async () => {
    if (!front.trim() || !back.trim()) {
      setIsSuccess(false);
      setMessage(t('create.required'));
      return;
    }
    setSaving(true);
    setIsSuccess(false);
    setMessage('');
    try {
      const entryId = crypto.randomUUID();
      await Inbox.saveEntry({
        entry: {
          id: entryId,
          contentType: 'text',
          content: front,
          preview: front.slice(0, 120),
          title: front.slice(0, 60),
          deckName,
          isLocked: true,
        },
      });
      // card_generated 统计需要 Provider 维度（P0-5 修复）
      const providerId = await getActiveProviderId();
      await Inbox.saveCards({
        entryId,
        cards: [
          {
            front,
            back,
            type,
            tags: tags.split(/[,，\s]+/).filter(Boolean),
          },
        ],
        providerId,
      });
      setIsSuccess(true);
      setMessage(t('create.created'));
      setTimeout(() => history.push('/inbox'), 800);
    } catch (e) {
      setIsSuccess(false);
      setMessage(e instanceof Error ? e.message : t('create.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/inbox" />
          </IonButtons>
          <IonTitle>{t('create.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardContent>
            <IonText>
              <h2 style={{ marginTop: 0 }}>{t('create.heading')}</h2>
              <p>{t('create.desc', { code: '{{c1::answer}}' })}</p>
            </IonText>
          </IonCardContent>
        </IonCard>

        <IonItem>
          <IonLabel position="stacked">{t('create.cardType')}</IonLabel>
          {realModels.length > 0 ? (
            <IonSelect
              value={selectedModelName ?? ''}
              onIonChange={(e) => void pickRealModel(String(e.detail.value))}
              placeholder={t('create.chooseTemplate')}
            >
              {realModels.map((m) => (
                <IonSelectOption key={m.id} value={m.name}>
                  {m.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          ) : (
            <IonSelect value={type} onIonChange={(e) => setType(e.detail.value as CardType)}>
              <IonSelectOption value="basic">{t('create.basic')}</IonSelectOption>
              <IonSelectOption value="cloze">{t('create.cloze')}</IonSelectOption>
              <IonSelectOption value="image_occlusion">
                {t('create.imageOcclusion')}
              </IonSelectOption>
            </IonSelect>
          )}
          {modelsLoading && <IonNote color="medium">{t('create.loadingModels')}</IonNote>}
        </IonItem>

        {type === 'cloze' ? (
          <IonItem>
            <IonLabel position="stacked">
              {t('create.textWithCloze', { code: '{{c1::...}}' })}
            </IonLabel>
            <IonTextarea
              value={front}
              rows={4}
              placeholder="The capital of France is {{c1::Paris}}."
              onIonInput={(e) => setFront(String(e.detail.value ?? ''))}
            />
          </IonItem>
        ) : (
          <IonItem>
            <IonLabel position="stacked">{t('create.front')}</IonLabel>
            <IonTextarea
              value={front}
              rows={3}
              placeholder={t('create.front')}
              onIonInput={(e) => setFront(String(e.detail.value ?? ''))}
            />
          </IonItem>
        )}

        <IonItem>
          <IonLabel position="stacked">{t('create.back')}</IonLabel>
          <IonTextarea
            value={back}
            rows={3}
            placeholder={t('create.back')}
            onIonInput={(e) => setBack(String(e.detail.value ?? ''))}
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">{t('create.tags')}</IonLabel>
          <IonInput value={tags} onIonInput={(e) => setTags(String(e.detail.value ?? ''))} />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">{t('create.deckName')}</IonLabel>
          {showDeckSelector ? (
            <IonSelect
              value={deckName}
              onIonChange={(e) => void pickRealDeck(String(e.detail.value))}
              placeholder={t('create.chooseDeck')}
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
              {t('create.newDeck')}
            </IonButton>
          )}
        </IonItem>
        {decksLoading && <IonNote color="medium">{t('create.loadingDecks')}</IonNote>}

        {message && (
          <IonNote
            color={isSuccess ? 'success' : 'danger'}
            style={{ display: 'block', marginTop: '0.75rem' }}
          >
            {message}
          </IonNote>
        )}

        <IonButton expand="block" onClick={save} disabled={saving} style={{ marginTop: '1.5rem' }}>
          {t('create.saveCard')}
        </IonButton>
      </IonContent>
    </IonPage>
  );
};

export default ManualCreateScreen;
