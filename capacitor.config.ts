import type { CapacitorConfig } from '@capacitor/cli';
// BI_CLIENT_CONFIG_TYPES_v1 - resize takes the enum, not a string literal.
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.boreal.risk.client',
  appName: 'Boreal Risk',
  webDir: 'dist',
  // BI_CLIENT_CONFIG_TYPES_v1 - was `android: { scheme: 'https' }`, which is
  // not a valid key: androidScheme lives under `server`. The setting had never
  // taken effect. https is the default, so behaviour is unchanged -- it is now
  // simply declared where Capacitor reads it.
  server: { androidScheme: 'https' },
  plugins: {
    Keyboard: { resize: KeyboardResize.Native, resizeOnFullScreen: true },
  },
};
export default config;
