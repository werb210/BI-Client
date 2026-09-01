import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { App as NativeApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { getCachedToken } from "@/auth/token";
import { parseNativeUrl } from "@/native/deepLinks";
import { initializePushNotifications } from "@/native/pushNotifications";

export default function NativeBridge() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handles: Array<{ remove: () => Promise<void> }> = [];
    const add = async () => {
      handles.push(await NativeApp.addListener("appUrlOpen", ({ url }) =>
        navigate(parseNativeUrl(url, Boolean(getCachedToken())))));
      handles.push(await NativeApp.addListener("backButton", ({ canGoBack }) => {
        const openDialog = document.querySelector<HTMLDialogElement>("dialog[open]");
        if (openDialog) return openDialog.close();
        if (canGoBack && pathRef.current !== "/") navigate(-1);
        else if (pathRef.current === "/") void NativeApp.exitApp();
      }));
      // appStateChange/resume listeners are deliberately side-effect free: they
      // establish lifecycle boundaries without restarting completed requests.
      handles.push(await NativeApp.addListener("appStateChange", () => undefined));
      handles.push(await NativeApp.addListener("resume", () => undefined));
      await Keyboard.setAccessoryBarVisible({ isVisible: true }).catch(() => undefined);
      await StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
      handles.push(...await initializePushNotifications((url) =>
        navigate(parseNativeUrl(url, Boolean(getCachedToken())))));
      await SplashScreen.hide().catch(() => undefined);
    };
    void add();
    return () => { for (const handle of handles) void handle.remove(); };
  }, [navigate]);
  return null;
}
