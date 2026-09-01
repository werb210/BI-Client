import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.boreal.risk.client',
  appName: 'Boreal Risk Management',
  webDir: 'dist',
  android: { scheme: 'https' },
  plugins: {
    SplashScreen: { launchAutoHide: false, launchShowDuration: 3000 },
    Keyboard: { resize: 'native', resizeOnFullScreen: true },
  },
};
export default config;
