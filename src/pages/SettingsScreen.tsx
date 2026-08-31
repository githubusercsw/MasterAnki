import React, { useCallback, useEffect, useState } from 'react';
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
  IonSelect,
  IonSelectOption,
  IonInput,
  IonButton,
  IonText,
  IonCard,
  IonCardContent,
  IonIcon,
  IonSpinner,
  IonAccordion,
  IonAccordionGroup,
  IonButtons,
  IonBackButton,
} from '@ionic/react';
import {
  keyOutline,
  sparklesOutline,
  trashOutline,
  checkmarkCircleOutline,
  documentTextOutline,
  moonOutline,
  sunnyOutline,
  contrastOutline,
  languageOutline,
} from 'ionicons/icons';
import { LLMService } from '../lib/llm/service';
import {
  getProviderApiKey,
  setProviderApiKey,
  getProviderModel,
  setProviderModel,
  getActiveProviderId,
  clearProviderSettings,
} from '../lib/settings/secureStorage';
import {
  GEMINI_PROVIDER_ID,
  DEFAULT_GEMINI_MODEL,
  PROVIDER_META,
  type ProviderMeta,
} from '../lib/llm/providers';
import { useTheme, type ThemeMode } from '../lib/theme/ThemeContext';
import { getDefaultContext } from '../lib/plugins/context';
import { setLanguage, SUPPORTED_LANGUAGES, type Language } from '../lib/i18n';
import { useTranslation } from 'react-i18next';
import i18n from '../lib/i18n';

const PROVIDERS: ProviderMeta[] = PROVIDER_META;

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; icon: string }> = [
  { value: 'light', label: 'settings.themeLight', icon: sunnyOutline },
  { value: 'dark', label: 'settings.themeDark', icon: moonOutline },
  { value: 'system', label: 'settings.themeSystem', icon: contrastOutline },
];

const SettingsScreen: React.FC = () => {
  const history = useHistory();
  const { t } = useTranslation();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const [activeProvider, setActiveProvider] = useState<string>(GEMINI_PROVIDER_ID);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const active = (await getActiveProviderId()) ?? GEMINI_PROVIDER_ID;
      setActiveProvider(active);
      const key = await getProviderApiKey(active);
      const model = await getProviderModel(active);
      setApiKey(key ?? '');
      setModel(model ?? '');
    } catch (e) {
      console.error('Failed to load settings:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [activeProvider, load]);

  const onProviderChange = async (id: string) => {
    // 保存当前 provider 已填内容后切换
    setActiveProvider(id);
    const key = await getProviderApiKey(id);
    const model = await getProviderModel(id);
    setApiKey(key ?? '');
    setModel(model ?? '');
    setSaved(false);
    setError('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      // 同步 LLMService 内存注册表，使后续管线立即使用新 Provider
      await LLMService.getInstance().setActive(activeProvider, true);
      await setProviderApiKey(activeProvider, apiKey.trim());
      await setProviderModel(activeProvider, model.trim() || DEFAULT_GEMINI_MODEL);
      setSaved(true);
      setTimeout(() => history.goBack(), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    await clearProviderSettings(activeProvider);
    setApiKey('');
    setModel('');
    setEndpoint('');
    setSaved(false);
  };

  const meta = PROVIDERS.find((p) => p.id === activeProvider) ?? PROVIDERS[0];

  /** 切换语言并持久化 */
  const onLanguageChange = async (lang: string) => {
    if (SUPPORTED_LANGUAGES.includes(lang as Language)) {
      await setLanguage(getDefaultContext(), lang as Language);
      // 强制重新渲染（useTranslation 会自动响应）
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/inbox" />
          </IonButtons>
          <IonTitle>{t('settings.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
            <IonSpinner />
          </div>
        ) : (
          <>
            <IonCard>
              <IonCardContent>
                <IonText>
                  <h2 style={{ marginTop: 0 }}>{t('settings.providerTitle')}</h2>
                  <p>{t('settings.providerDesc')}</p>
                </IonText>
              </IonCardContent>
            </IonCard>

            <IonList>
              <IonItem>
                <IonLabel>{t('settings.provider')}</IonLabel>
                <IonSelect
                  value={activeProvider}
                  onIonChange={(e) => onProviderChange(String(e.detail.value))}
                >
                  {PROVIDERS.map((p) => (
                    <IonSelectOption key={p.id} value={p.id}>
                      {p.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>

              <IonItem>
                <IonIcon icon={keyOutline} slot="start" />
                <IonLabel position="stacked">{t('settings.apiKey')}</IonLabel>
                <IonInput
                  type="password"
                  value={apiKey}
                  placeholder={`${meta.name} API key`}
                  onIonInput={(e) => {
                    setApiKey(String(e.detail.value ?? ''));
                    setSaved(false);
                  }}
                />
              </IonItem>

              <IonItem>
                <IonIcon icon={sparklesOutline} slot="start" />
                <IonLabel position="stacked">{t('settings.model')}</IonLabel>
                <IonInput
                  type="text"
                  value={model}
                  placeholder={DEFAULT_GEMINI_MODEL}
                  onIonInput={(e) => {
                    setModel(String(e.detail.value ?? ''));
                    setSaved(false);
                  }}
                />
              </IonItem>

              {meta.needsEndpoint && (
                <IonItem>
                  <IonLabel position="stacked">{t('settings.endpoint')}</IonLabel>
                  <IonInput
                    type="text"
                    value={endpoint}
                    placeholder="http://localhost:11434"
                    onIonInput={(e) => {
                      setEndpoint(String(e.detail.value ?? ''));
                      setSaved(false);
                    }}
                  />
                </IonItem>
              )}
            </IonList>

            {/* 外观：主题 + 语言 */}
            <IonCard style={{ marginTop: '1rem' }}>
              <IonCardContent>
                <IonText>
                  <h2 style={{ marginTop: 0 }}>{t('settings.appearance')}</h2>
                </IonText>
              </IonCardContent>
            </IonCard>
            <IonList>
              <IonItem>
                <IonLabel>{t('settings.theme')}</IonLabel>
                <IonSelect
                  value={themeMode}
                  onIonChange={(e) => setThemeMode(String(e.detail.value) as ThemeMode)}
                >
                  {THEME_OPTIONS.map((opt) => (
                    <IonSelectOption key={opt.value} value={opt.value}>
                      <IonIcon icon={opt.icon} slot="start" /> {t(opt.label)}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              <IonItem>
                <IonIcon icon={languageOutline} slot="start" />
                <IonLabel>{t('settings.language')}</IonLabel>
                <IonSelect
                  value={
                    i18n.language?.startsWith('zh')
                      ? 'zh'
                      : i18n.language?.startsWith('ja')
                        ? 'ja'
                        : 'en'
                  }
                  onIonChange={(e) => onLanguageChange(String(e.detail.value))}
                >
                  <IonSelectOption value="en">{t('settings.languageEn')}</IonSelectOption>
                  <IonSelectOption value="zh">{t('settings.languageZh')}</IonSelectOption>
                  <IonSelectOption value="ja">{t('settings.languageJa')}</IonSelectOption>
                </IonSelect>
              </IonItem>
            </IonList>

            {/* 自定义提示词 */}
            <IonAccordionGroup style={{ marginTop: '1rem' }}>
              <IonAccordion value="prompts">
                <IonItem slot="header" color="light">
                  <IonIcon icon={documentTextOutline} slot="start" />
                  <IonLabel>{t('settings.customPrompts')}</IonLabel>
                </IonItem>
                <div className="ion-padding" slot="content">
                  <IonText>
                    <p>{t('settings.customPromptsNote')}</p>
                  </IonText>
                </div>
              </IonAccordion>
            </IonAccordionGroup>

            {error && (
              <IonCard color="danger" style={{ marginTop: '1rem' }}>
                <IonCardContent>
                  <IonText color="light">{error}</IonText>
                </IonCardContent>
              </IonCard>
            )}
            {saved && (
              <IonCard color="success" style={{ marginTop: '1rem' }}>
                <IonCardContent>
                  <IonText color="light">
                    <IonIcon icon={checkmarkCircleOutline} /> {t('settings.saved')}
                  </IonText>
                </IonCardContent>
              </IonCard>
            )}

            <div style={{ marginTop: '1.5rem' }}>
              <IonButton expand="block" onClick={save} disabled={saving}>
                {saving ? <IonSpinner name="crescent" /> : t('settings.saveSettings')}
              </IonButton>
              {apiKey && (
                <IonButton
                  expand="block"
                  fill="outline"
                  color="danger"
                  onClick={clear}
                  style={{ marginTop: '0.5rem' }}
                >
                  <IonIcon icon={trashOutline} slot="start" />
                  {t('settings.clearKey')}
                </IonButton>
              )}
            </div>
          </>
        )}
      </IonContent>
    </IonPage>
  );
};

export default SettingsScreen;
