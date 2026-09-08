// BI_CLIENT_SCAFFOLD_v1
import { BrowserRouter } from "react-router-dom";
// BI_CLIENT_BLOCK_v095_DRAIN_ON_RESUME_v1
import { useQueueDrain } from "@/upload/useQueueDrain";
import { uploadContract } from "@/api/contract";
import { useEffect, useState } from "react";
import AppRouter from "@/router/AppRouter";
import Header from "@/components/chrome/Header"; // BI_CLIENT_CHROME_v14
import Footer from "@/components/chrome/Footer";
import { captureEntryParams } from "@/entry/entryContext"; // BI_CLIENT_INDUSTRY_v11
import { restoreToken } from "@/auth/token";
import NativeBridge from "@/native/NativeBridge";
import BiometricGate from "@/native/BiometricGate"; // BI_CLIENT_BIOMETRIC_SCANNER_WIRE_v1

captureEntryParams(typeof window === "undefined" ? "" : window.location.search);

export default function App() {
  // Drains anything stranded by an offline capture. No-op on web.
  useQueueDrain(async (item) => {
    const blob = await (await fetch(item.dataUrl)).blob();
    await uploadContract(new File([blob], item.filename, { type: item.mimeType }));
  });
  const [ready, setReady] = useState(false);
  useEffect(() => { void restoreToken().finally(() => setReady(true)); }, []);
  if (!ready) return <div className="bi-auth-loading" role="status">Loading…</div>;
  return (
    <BiometricGate>
      <BrowserRouter>
        <NativeBridge />
        <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column" }}>
          <Header />
          <main style={{ flex: 1 }}>
            <AppRouter />
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </BiometricGate>
  );
}
