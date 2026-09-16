// BI_CLIENT_OFFLINE_v302 - send saved-offline changes as soon as the app is back online.
import { useEffect, useRef } from "react";
import { Network } from "@capacitor/network";
import { apiRequest } from "@/api/client";
import { drainOutbox } from "./offlineStore";

export function useOutboxDrain(): void {
  const running = useRef(false);
  useEffect(() => {
    async function attempt() {
      if (running.current) return;
      running.current = true;
      try {
        await drainOutbox((item) => apiRequest(item.path, { method: "POST", body: item.body, headers: { "X-Boreal-Outbox": "1" } }).then(() => undefined));
      } finally {
        running.current = false;
      }
    }
    void attempt();
    const onOnline = () => { void attempt(); };
    window.addEventListener("online", onOnline);
    window.addEventListener("boreal:native-resume", onOnline);
    const handle = Network.addListener("networkStatusChange", (s: { connected: boolean }) => { if (s.connected) void attempt(); });
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("boreal:native-resume", onOnline);
      void Promise.resolve(handle).then((h: any) => h?.remove?.()).catch((): void => undefined);
    };
  }, []);
}
