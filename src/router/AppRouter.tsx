// BI_CLIENT_SCAFFOLD_v1
import { Navigate, Route, Routes } from "react-router-dom";
import SignInPage from "@/pages/SignInPage";
import HomePage from "@/pages/HomePage";
import { getToken } from "@/auth/token";

function RequireApplicant({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/" replace />;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<SignInPage />} />
      <Route path="/home" element={<RequireApplicant><HomePage /></RequireApplicant>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
