import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './lib/theme/ThemeContext';
import { getDefaultContext } from './lib/plugins/context';
import { initLanguage } from './lib/i18n';

/* Ionic core CSS */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
/* 类驱动深色（由 ThemeContext 控制 .ion-palette-dark），而非仅跟随系统 */
import '@ionic/react/css/palettes/dark.class.css';

import './index.css';

const ctx = getDefaultContext();
// 启动时恢复语言偏好（不阻塞渲染，默认 en 首帧后切换）
void initLanguage(ctx);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider ctx={ctx}>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
