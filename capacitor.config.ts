import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.masteranki.app',
  appName: 'MasterAnki',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
