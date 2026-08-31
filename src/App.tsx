import { useEffect } from 'react';
import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import InboxScreen from './pages/InboxScreen';
import EntryDetailScreen from './pages/EntryDetailScreen';
import SettingsScreen from './pages/SettingsScreen';
import ManualCreateScreen from './pages/ManualCreateScreen';
import CardEditorScreen from './pages/CardEditorScreen';
import TemplateSelectScreen from './pages/TemplateSelectScreen';
import { LLMService } from './lib/llm/service';
import { getDefaultContext } from './lib/plugins/context';

setupIonicReact();

/**
 * 应用启动：初始化 LLMService（注册全部 Provider，恢复活跃项）。
 * Web 环境使用 localStorage 降级上下文；原生环境后续接 Capacitor 插件上下文。
 */
let appInit: Promise<void> | null = null;
function ensureAppInit(): Promise<void> {
  if (!appInit) {
    const ctx = getDefaultContext();
    appInit = LLMService.getInstance(ctx).init(ctx);
  }
  return appInit;
}

const App: React.FC = () => {
  useEffect(() => {
    void ensureAppInit();
  }, []);

  return (
    <IonApp>
      <IonReactRouter>
        <IonRouterOutlet>
          <Route exact path="/inbox" component={InboxScreen} />
          <Route exact path="/entry/:id" component={EntryDetailScreen} />
          <Route exact path="/settings" component={SettingsScreen} />
          <Route exact path="/create" component={ManualCreateScreen} />
          <Route exact path="/entry/:id/edit/:cardId" component={CardEditorScreen} />
          <Route exact path="/template/:entryId" component={TemplateSelectScreen} />
          <Route exact path="/" render={() => <Redirect to="/inbox" />} />
        </IonRouterOutlet>
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
export { ensureAppInit };
