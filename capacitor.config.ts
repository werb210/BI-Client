import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.boreal.risk.client',
  appName: 'Boreal Risk',
  webDir: 'dist',
  android: { scheme: 'https' },
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
    Keyboard: { resize: 'native', resizeOnFullScreen: true },
  },
};
export default config;
