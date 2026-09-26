import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { App as NativeApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { StatusBar, Style } from "@capacitor/status-bar";
import { getCachedToken } from "@/auth/token";
import { parseNativeUrl, retainNativeDestination } from "@/native/deepLinks";
import { initializePushNotifications } from "@/native/pushNotifications";
import { collectAndroidShares, holdSharedUrl, isSharedFileUrl } from "@/native/sharedFiles"; // BI_CLIENT_BLOCK_v554_SHARE_TO_BOREAL

export default function NativeBridge() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handles: Array<{ remove: () => Promise<void> }> = [];
    const add = async () => {
      // BI_CLIENT_BLOCK_v554_SHARE_TO_BOREAL - a shared file goes to the upload page
      // (after sign-in if needed), never to the router as a link.
      const openUpload = () => {
        const authed = Boolean(getCachedToken());
        if (!authed) retainNativeDestination("/upload");
        navigate(authed ? "/upload" : "/");
      };
      const collectShares = () => void collectAndroidShares().then((n) => { if (n > 0) openUpload(); });
      const openUrl = (url: string) => {
        if (isSharedFileUrl(url)) { holdSharedUrl(url); openUpload(); return; }
        const authenticated = Boolean(getCachedToken());
        const destination = parseNativeUrl(url, authenticated);
        if (!authenticated && destination !== "/") retainNativeDestination(destination);
        navigate(authenticated ? destination : "/");
      };
      // BI_CLIENT_COLD_LAUNCH_DEEPLINK_v427 - iOS hands the launching URL to a
      // terminated app through launch options, never through appUrlOpen. Read it
      // BEFORE attaching the listener, so a real appUrlOpen arriving during
      // startup wins over the stale launch URL rather than being overwritten by it.
      try {
        const launch = await NativeApp.getLaunchUrl();
        if (launch?.url) openUrl(launch.url);
      } catch {
        /* ordinary start - no launch URL */
      }
      handles.push(await NativeApp.addListener("appUrlOpen", ({ url }) => openUrl(url)));
      collectShares();
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
      handles.push(await NativeApp.addListener("pause", () => { window.dispatchEvent(new Event("boreal:native-pause")); })); // BI_CLIENT_LOCK_SESSION_v313
      handles.push(await NativeApp.addListener("resume", () => {
        window.dispatchEvent(new Event("boreal:native-resume"));
        collectShares(); // BI_CLIENT_BLOCK_v554_SHARE_TO_BOREAL
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
