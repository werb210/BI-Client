// BI_CLIENT_BLOCK_v095_DRAIN_ON_RESUME_v1
// Block v094 enqueues an offline capture but only drains on the applicant's
// next manual upload. If they never upload again the subcontract sits in
// Preferences forever and the file looks sent to them and missing to us.
// NativeBridge already dispatches boreal:native-resume; this is a second
// consumer alongside useBiometricLock.
import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";
import { drain, readQueue, type QueuedUpload } from "@/upload/queue";

export function useQueueDrain(send: (item: QueuedUpload) => Promise<void>): void {
  const running = useRef(false);
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    async function attempt() {
      // Resume fires on every foreground; a second pass mid-upload double-sends.
      if (running.current) return;
      if ((await readQueue()).length === 0) return;
      if (!(await Network.getStatus()).connected) return;
      running.current = true;
      try { await drain((item) => sendRef.current(item)); }
      finally { running.current = false; }
    }

    const onResume = () => { void attempt(); };
    window.addEventListener("boreal:native-resume", onResume);
    // Also try once at mount: the app may have been cold-started back online.
    void attempt();

    const networkHandle = Network.addListener("networkStatusChange", (status) => {
      if (status.connected) void attempt();
    });

    return () => {
      window.removeEventListener("boreal:native-resume", onResume);
      void networkHandle.then((h) => h.remove()).catch(() => undefined);
    };
  }, []);
}
