import React, { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonText,
  IonNote,
  IonCard,
  IonCardContent,
  IonSpinner,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonButton,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { documentTextOutline, ellipsisHorizontalOutline, imageOutline } from 'ionicons/icons';
import AnkiDroid, { type AnkiModelInfo, type AnkiDeckInfo } from '../plugins/AnkiDroid';
import { isImageOcclusionAvailable } from '../lib/anki/ioDependency';
import { getSelectedAnkiModel, setSelectedAnkiModel } from '../lib/anki/modelSelection';
import { getSelectedAnkiDeck, setSelectedAnkiDeck } from '../lib/anki/deckSelection';

/**
 * 卡片模板选择页
 *
 * 优先通过 AnkiDroid API 读取用户实际使用的模板（模型），供用户选择；
 * API 不可用（Web / 未授权）时回退到内置 Basic/Cloze/Image Occlusion。
 * 选择后持久化所选模型名，返回条目页（入库链路按所选真实模板写入）。
 */
const TemplateSelectScreen: React.FC = () => {
  const { entryId } = useParams<{ entryId: string }>();
  const history = useHistory();
  const { t } = useTranslation();
  const [realModels, setRealModels] = useState<AnkiModelInfo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [ioAvailable, setIoAvailable] = useState<boolean | null>(null);
  // 牌组联动：真实牌组列表 + 当前所选 + 是否新建自定义
  const [realDecks, setRealDecks] = useState<AnkiDeckInfo[]>([]);
  const [deckName, setDeckName] = useState('MasterAnki');
  const [useCustomDeck, setUseCustomDeck] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [current, currentDeck] = await Promise.all([
        getSelectedAnkiModel(),
        getSelectedAnkiDeck(),
      ]);
      if (!cancelled) setSelectedModel(current);
      if (!cancelled && currentDeck) setDeckName(currentDeck);
      // 尝试读取 AnkiDroid 真实模板 + 牌组
      try {
        const [modelRes, deckRes] = await Promise.all([
          AnkiDroid.getModels(),
          AnkiDroid.getDecks(),
        ]);
        if (!cancelled && modelRes.models && modelRes.models.length > 0) {
          setRealModels(modelRes.models);
        }
        if (!cancelled && deckRes.decks && deckRes.decks.length > 0) {
          setRealDecks(deckRes.decks);
        }
      } catch {
        // API 不可用 → 保持 null（回退内置）
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 派生判断：当前 deckName 是否匹配真实牌组列表
  const showDeckSelector =
    !useCustomDeck && realDecks.length > 0 && realDecks.some((d) => d.name === deckName);

  /** 选择真实牌组：持久化 */
  const pickRealDeck = async (name: string) => {
    await setSelectedAnkiDeck(name);
    setDeckName(name);
    setUseCustomDeck(false);
  };

  /** 新建自定义牌组 */
  const pickCustomDeck = () => {
    setUseCustomDeck(true);
  };

  useEffect(() => {
    void isImageOcclusionAvailable().then(setIoAvailable);
  }, []);

  /** 选中一个真实模板：持久化并返回条目页 */
  const pickRealModel = async (m: AnkiModelInfo) => {
    await setSelectedAnkiModel(m.name);
    await setSelectedAnkiDeck(deckName);
    history.replace(`/entry/${entryId}`);
  };

  /** 回退内置模板 */
  const pickBuiltin = async (name: string) => {
    await setSelectedAnkiModel(name);
    await setSelectedAnkiDeck(deckName);
    history.replace(`/entry/${entryId}`);
  };

  const builtinTemplates: Array<{ name: string; key: string; icon: string; requiresIO?: boolean }> =
    [
      { name: t('template.basicName'), key: 'Basic', icon: documentTextOutline },
      { name: t('template.clozeName'), key: 'Cloze', icon: ellipsisHorizontalOutline },
      {
        name: t('template.ioName'),
        key: 'Image Occlusion',
        icon: imageOutline,
        requiresIO: true,
      },
    ];

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton />
          </IonButtons>
          <IonTitle>{t('template.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonText>
          <h2>{t('template.choose')}</h2>
          <p>{t('template.desc')}</p>
        </IonText>

        {/* 牌组联动：选模板前先选牌组（读真实列表/可新建） */}
        <IonCard style={{ marginTop: '1rem' }}>
          <IonCardContent>
            <IonItem lines="none" style={{ paddingLeft: 0 }}>
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
          </IonCardContent>
        </IonCard>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
            <IonSpinner />
          </div>
        ) : (
          <>
            {/* AnkiDroid 真实模板（API 可用时优先展示） */}
            {realModels && realModels.length > 0 && (
              <IonCard style={{ marginTop: '1rem' }}>
                <IonCardContent>
                  <IonText>
                    <h3 style={{ marginTop: 0 }}>{t('template.ankiModels')}</h3>
                    <p>{t('template.ankiModelsNote')}</p>
                  </IonText>
                </IonCardContent>
              </IonCard>
            )}
            {realModels && realModels.length > 0 && (
              <IonList>
                {realModels.map((m) => (
                  <IonItem key={m.id} button onClick={() => void pickRealModel(m)} detail>
                    <IonIcon icon={documentTextOutline} slot="start" />
                    <IonLabel>
                      <h3>{m.name}</h3>
                      <p>{(m.fields ?? []).join(' · ') || t('template.noFields')}</p>
                    </IonLabel>
                    {selectedModel === m.name && <IonNote slot="end">✓</IonNote>}
                  </IonItem>
                ))}
              </IonList>
            )}

            {/* 内置模板（回退） */}
            {(!realModels || realModels.length === 0) && (
              <>
                <IonList style={{ marginTop: '1rem' }}>
                  {builtinTemplates.map((tpl) => {
                    const enabled = !tpl.requiresIO || ioAvailable === true;
                    return (
                      <IonItem
                        key={tpl.key}
                        button
                        disabled={!enabled}
                        onClick={() => void pickBuiltin(tpl.key)}
                      >
                        <IonIcon icon={tpl.icon} slot="start" />
                        <IonLabel>
                          <h3>{tpl.name}</h3>
                          <p>{tpl.key}</p>
                        </IonLabel>
                        {selectedModel === tpl.key && <IonNote slot="end">✓</IonNote>}
                      </IonItem>
                    );
                  })}
                </IonList>
                <IonCard style={{ marginTop: '1rem' }}>
                  <IonCardContent>
                    <IonNote>
                      {ioAvailable === false
                        ? t('template.ioNoteAvailable')
                        : t('template.ioNoteMissing')}
                    </IonNote>
                  </IonCardContent>
                </IonCard>
              </>
            )}
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default TemplateSelectScreen;
