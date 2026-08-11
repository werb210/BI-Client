// BI_CLIENT_SCAFFOLD_v1
import { BrowserRouter } from "react-router-dom";
import AppRouter from "@/router/AppRouter";
import { captureEntryParams } from "@/entry/entryContext"; // BI_CLIENT_INDUSTRY_v11

captureEntryParams(typeof window === "undefined" ? "" : window.location.search);

export default function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}
