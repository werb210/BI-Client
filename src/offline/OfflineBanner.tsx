// BI_CLIENT_OFFLINE_v302 - tells the applicant they are offline and what is waiting to send.
import { useEffect, useState } from "react";
import { Network } from "@capacitor/network";
import { OUTBOX_CHANGED, readOutbox } from "./offlineStore";

export function bannerText(online: boolean, waiting: number): string | null {
  if (!online) return waiting > 0
    ? `You're offline. ${waiting} change${waiting === 1 ? " is" : "s are"} saved on this phone and will send when you reconnect.`
    : "You're offline. You can keep reading; changes will be saved on this phone.";
  if (waiting > 0) return `Sending ${waiting} saved change${waiting === 1 ? "" : "s"}…`;
  return null;
}

export default function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    let alive = true;
    void Network.getStatus().then((s: { connected: boolean }) => { if (alive) setOnline(s.connected); }).catch((): void => undefined);
    void readOutbox().then((items) => { if (alive) setWaiting(items.length); });
    const handle = Network.addListener("networkStatusChange", (s: { connected: boolean }) => setOnline(s.connected));
    const onChange = (e: Event) => setWaiting(Number((e as CustomEvent).detail ?? 0));
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener(OUTBOX_CHANGED, onChange);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      alive = false;
      window.removeEventListener(OUTBOX_CHANGED, onChange);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      void Promise.resolve(handle).then((h: any) => h?.remove?.()).catch((): void => undefined);
    };
  }, []);
  const text = bannerText(online, waiting);
  if (!text) return null;
  return (
    <div role="status" data-testid="offline-banner" style={{ background: online ? "#E8F0FE" : "#FEF3C7", color: online ? "#0B1F3A" : "#92400E", padding: "10px 16px", fontSize: 14, textAlign: "center" }}>
      {text}
    </div>
  );
}
