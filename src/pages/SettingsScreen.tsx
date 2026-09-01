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
  closeCircleOutline,
  moonOutline,
  sunnyOutline,
  contrastOutline,
  languageOutline,
  listOutline,
  downloadOutline,
  refreshOutline,
} from 'ionicons/icons';
import { LLMService } from '../lib/llm/service';
import type { TestConnectionResult } from '../lib/llm/provider';
import {
  getProviderApiKey,
  setProviderApiKey,
  getProviderModel,
  setProviderModel,
  getActiveProviderId,
  clearProviderSettings,
} from '../lib/settings/secureStorage';
import { GEMINI_PROVIDER_ID, PROVIDER_META, type ProviderMeta } from '../lib/llm/providers';
import { useTheme, type ThemeMode } from '../lib/theme/ThemeContext';
import { getDefaultContext } from '../lib/plugins/context';
import { setLanguage, SUPPORTED_LANGUAGES, type Language } from '../lib/i18n';
import { useTranslation } from 'react-i18next';
import i18n from '../lib/i18n';
import { LogService } from '../lib/log/logger';
import type { LogRecord } from '../plugins/Log';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const PROVIDERS: ProviderMeta[] = PROVIDER_META;

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; icon: string }> = [
  { value: 'light', label: 'settings.themeLight', icon: sunnyOutline },
  { value: 'dark', label: 'settings.themeDark', icon: moonOutline },
  { value: 'system', label: 'settings.themeSystem', icon: contrastOutline },
];

/** 日志级别 → 颜色（用于列表内联样式） */
function levelColor(level: string): string {
  switch (level) {
    case 'error':
      return '#eb445a';
    case 'warn':
      return '#ffc409';
    case 'debug':
      return '#92949c';
    default:
      return '#3880ff';
  }
}

const SettingsScreen: React.FC = () => {
  const history = useHistory();
  const { t } = useTranslation();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const [activeProvider, setActiveProvider] = useState<string>(GEMINI_PROVIDER_ID);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  // 日志区状态
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logMsg, setLogMsg] = useState('');

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
      // 检查写入返回值：任一失败必须报错，不许弹「已保存」
      const keyOk = await setProviderApiKey(activeProvider, apiKey.trim());
      const modelOk = await setProviderModel(
        activeProvider,
        model.trim() || (meta?.defaultModel ?? '')
      );
      if (!keyOk || !modelOk) {
        setError(t('settings.saveFailed'));
        return;
      }
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
    setSaved(false);
  };

  /** 测试连接：先把当前表单配置落盘（不跳转），再真实发起最小请求，区分四类失败原因 */
  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setError('');
    try {
      // 先落盘当前表单值，保证测试的就是屏幕上的配置（active 仅在内存切换，不持久化）
      await LLMService.getInstance().setActive(activeProvider, false);
      await setProviderApiKey(activeProvider, apiKey.trim());
      await setProviderModel(activeProvider, model.trim() || (meta?.defaultModel ?? ''));
      const provider = await LLMService.getInstance().getActiveProvider();
      const result = await provider.testConnection();
      setTestResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  const meta = PROVIDERS.find((p) => p.id === activeProvider) ?? PROVIDERS[0];

  /** 刷新日志列表 */
  const refreshLogs = useCallback(async () => {
    setLogLoading(true);
    try {
      setLogs(await LogService.getInstance().getRecent(200));
    } catch (e) {
      setLogMsg(e instanceof Error ? e.message : 'Failed to load logs');
    } finally {
      setLogLoading(false);
    }
  }, []);

  /** 导出日志（复制到剪贴板） */
  const exportLogs = async () => {
    setLogMsg('');
    try {
      const text = await LogService.getInstance().exportText();
      const fileName = `masteranki-logs-${new Date().toISOString().slice(0, 10)}.txt`;
      // 写入应用缓存目录（无需存储权限），再通过系统分享导出
      const res = await Filesystem.writeFile({
        path: fileName,
        data: text,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      await Share.share({
        title: 'MasterAnki logs',
        text: 'MasterAnki 运行日志',
        files: [res.uri],
        dialogTitle: t('settings.logExport'),
      });
      setLogMsg(t('settings.logExported'));
    } catch {
      // 文件分享不可用（Web 等）时回退剪贴板
      try {
        const text = await LogService.getInstance().exportText();
        await navigator.clipboard.writeText(text);
        setLogMsg(t('settings.logExported'));
      } catch (e) {
        setLogMsg(`${t('settings.logExportFailed')} ${e instanceof Error ? e.message : ''}`);
      }
    }
  };

  /** 清空日志 */
  const clearLogs = async () => {
    if (!window.confirm(t('settings.logClearConfirm'))) return;
    await LogService.getInstance().clear();
    setLogs([]);
    setLogMsg(t('settings.logCleared'));
  };

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
                  placeholder={meta.defaultModel}
                  onIonInput={(e) => {
                    setModel(String(e.detail.value ?? ''));
                    setSaved(false);
                  }}
                />
              </IonItem>
            </IonList>

            <IonButton
              expand="block"
              fill="outline"
              onClick={() => void testConnection()}
              disabled={testing}
              style={{ marginTop: '0.5rem' }}
            >
              {testing ? (
                <IonSpinner name="crescent" />
              ) : (
                <IonIcon icon={refreshOutline} slot="start" />
              )}
              {testing ? t('settings.testing') : t('settings.testConnection')}
            </IonButton>

            {testResult && (
              <IonCard color={testResult.ok ? 'success' : 'danger'} style={{ marginTop: '0.5rem' }}>
                <IonCardContent>
                  <IonText color="light">
                    {testResult.ok ? (
                      <>
                        <IonIcon icon={checkmarkCircleOutline} /> {t('settings.testOk')}
                      </>
                    ) : (
                      <>
                        <IonIcon icon={closeCircleOutline} /> {t('settings.testFail')}
                        <div style={{ fontSize: '0.85rem', marginTop: '0.3rem', opacity: 0.9 }}>
                          {testResult.message}
                        </div>
                      </>
                    )}
                  </IonText>
                </IonCardContent>
              </IonCard>
            )}

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

            {/* 日志区 */}
            <IonAccordionGroup
              style={{ marginTop: '1rem' }}
              onIonChange={(e) => {
                if (e.detail.value === 'logs') void refreshLogs();
              }}
            >
              <IonAccordion value="logs">
                <IonItem slot="header" color="light">
                  <IonIcon icon={listOutline} slot="start" />
                  <IonLabel>{t('settings.log')}</IonLabel>
                </IonItem>
                <div className="ion-padding" slot="content">
                  <IonText>
                    <p>{t('settings.logDesc')}</p>
                  </IonText>
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      margin: '0.75rem 0',
                      flexWrap: 'wrap',
                    }}
                  >
                    <IonButton
                      size="small"
                      onClick={() => void refreshLogs()}
                      disabled={logLoading}
                    >
                      <IonIcon icon={refreshOutline} slot="start" />
                      {t('settings.logView')}
                    </IonButton>
                    <IonButton size="small" fill="outline" onClick={() => void exportLogs()}>
                      <IonIcon icon={downloadOutline} slot="start" />
                      {t('settings.logExport')}
                    </IonButton>
                    <IonButton
                      size="small"
                      fill="outline"
                      color="danger"
                      onClick={() => void clearLogs()}
                    >
                      <IonIcon icon={trashOutline} slot="start" />
                      {t('settings.logClear')}
                    </IonButton>
                  </div>

                  {logLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                      <IonSpinner />
                    </div>
                  ) : logs.length === 0 ? (
                    <IonText color="medium">
                      <p>{t('settings.logEmpty')}</p>
                    </IonText>
                  ) : (
                    <IonList
                      style={{
                        maxHeight: '16rem',
                        overflowY: 'auto',
                        border: '1px solid var(--ion-color-step-200)',
                        borderRadius: '8px',
                      }}
                    >
                      {logs.map((l) => (
                        <IonItem key={l.id} lines="inset">
                          <IonLabel>
                            <div
                              style={{
                                fontSize: '0.7rem',
                                color: levelColor(l.level),
                                textTransform: 'uppercase',
                                fontFamily: 'monospace',
                              }}
                            >
                              {new Date(l.createdAt).toLocaleString()} · [{l.level}] · {l.tag}
                            </div>
                            <div
                              style={{
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                fontSize: '0.85rem',
                                marginTop: '0.2rem',
                              }}
                            >
                              {l.message}
                              {l.stack && (
                                <pre
                                  style={{
                                    fontSize: '0.7rem',
                                    whiteSpace: 'pre-wrap',
                                    margin: '0.3rem 0 0',
                                    color: 'var(--ion-color-medium)',
                                  }}
                                >
                                  {l.stack}
                                </pre>
                              )}
                            </div>
                          </IonLabel>
                        </IonItem>
                      ))}
                    </IonList>
                  )}

                  {logMsg && (
                    <IonText color="medium">
                      <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>{logMsg}</p>
                    </IonText>
                  )}
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
