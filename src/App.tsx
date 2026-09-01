// BI_CLIENT_SCAFFOLD_v1
import { BrowserRouter } from "react-router-dom";
import { useEffect, useState } from "react";
import AppRouter from "@/router/AppRouter";
import Header from "@/components/chrome/Header"; // BI_CLIENT_CHROME_v14
import Footer from "@/components/chrome/Footer";
import { captureEntryParams } from "@/entry/entryContext"; // BI_CLIENT_INDUSTRY_v11
import { restoreToken } from "@/auth/token";
import NativeBridge from "@/native/NativeBridge";

captureEntryParams(typeof window === "undefined" ? "" : window.location.search);

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => { void restoreToken().finally(() => setReady(true)); }, []);
  if (!ready) return <div className="bi-auth-loading" role="status">Loading…</div>;
  return (
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
  );
}
