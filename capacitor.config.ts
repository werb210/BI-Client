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
    // BI_CLIENT_SPLASH_RECURSION_v1
    // @capacitor/splash-screen 8.0.2 observes the parent view's frame/bounds
    // (SplashScreen.swift:97) and then assigns viewController.view.frame
    // (line 131), which fires those observers and re-enters
    // updateSplashImageBounds(). On iOS 26 it never settles: infinite
    // recursion, stack overflow, dark screen on every launch.
    // showOnLaunch() returns before registering anything when the duration is
    // 0, so this is the supported way out. autoHide stays true so dismissal
    // never depends on NativeBridge mounting -- it cannot mount if the plugin
    // has already blown the stack.
    SplashScreen: { launchAutoHide: true, launchShowDuration: 0 },
    Keyboard: { resize: KeyboardResize.Native, resizeOnFullScreen: true },
  },
};
export default config;
