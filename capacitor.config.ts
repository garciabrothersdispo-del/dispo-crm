import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourcompany.dispocrm',
  appName: 'DispoCRM Pro',
  webDir: 'out',
  // For production: point to your Vercel URL
  // server: {
  //   url: 'https://your-dispo-crm.vercel.app',
  //   cleartext: false,
  // },
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
