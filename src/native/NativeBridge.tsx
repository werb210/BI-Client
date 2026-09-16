import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { App as NativeApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { StatusBar, Style } from "@capacitor/status-bar";
import { getCachedToken } from "@/auth/token";
import { parseNativeUrl, retainNativeDestination } from "@/native/deepLinks";
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
      const openUrl = (url: string) => {
        const authenticated = Boolean(getCachedToken());
        const destination = parseNativeUrl(url, authenticated);
        if (!authenticated && destination !== "/") retainNativeDestination(destination);
        navigate(authenticated ? destination : "/");
      };
      handles.push(await NativeApp.addListener("appUrlOpen", ({ url }) => openUrl(url)));
      handles.push(await NativeApp.addListener("backButton", ({ canGoBack }) => {
        const openDialog = document.querySelector<HTMLDialogElement>("dialog[open]");
        if (openDialog) return openDialog.close();
        if (canGoBack && pathRef.current !== "/") navigate(-1);
        else if (pathRef.current === "/") void NativeApp.exitApp();
      }));
      // Keep lifecycle handling independent from completed requests. Resume only
      // announces the boundary so security-sensitive UI can reevaluate its lock.
      handles.push(await NativeApp.addListener("appStateChange", ({ isActive }: { isActive: boolean }) => {
        // BI_CLIENT_BACKGROUND_SYNC_v308 - leaving the app hands pending sends to the phone.
        if (!isActive) void import("@/native/backgroundSync").then((m) => m.handOffToBackground()).catch((): void => undefined);
      }));
      handles.push(await NativeApp.addListener("resume", () => {
        window.dispatchEvent(new Event("boreal:native-resume"));
        void import("@/native/backgroundSync").then((m) => m.reconcileBackground()).catch((): void => undefined); // v308
      }));
      await Keyboard.setAccessoryBarVisible({ isVisible: true }).catch(() => undefined);
      await StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
      handles.push(...await initializePushNotifications(openUrl));
    };
    void add();
    return () => { for (const handle of handles) void handle.remove(); };
  }, [navigate]);
  return null;
}
