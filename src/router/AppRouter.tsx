// BI_CLIENT_SCAFFOLD_v1
import { Navigate, Route, Routes } from "react-router-dom";
import SignInPage from "@/pages/SignInPage";
import HomePage from "@/pages/HomePage";
// BI_CLIENT_STEP1_PROFILE_v3
import StartPage from "@/pages/StartPage";
// BI_CLIENT_COVERAGE_v4
import CoveragePage from "@/pages/CoveragePage";
// BI_CLIENT_QUESTIONS_v5
import QuestionsPage from "@/pages/QuestionsPage";
// BI_CLIENT_REVIEW_v7
import ReviewPage from "@/pages/ReviewPage";
// BI_CLIENT_CONTRACT_UPLOAD_v1
import UploadContractPage from "@/pages/UploadContractPage";
import RequirementsPage from "@/pages/RequirementsPage";
import { getCachedToken } from "@/auth/token";

function RequireApplicant({ children }: { children: React.ReactNode }) {
  return getCachedToken() ? <>{children}</> : <Navigate to="/" replace />;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<SignInPage />} />
      <Route path="/start" element={<RequireApplicant><StartPage /></RequireApplicant>} />
      <Route path="/home" element={<RequireApplicant><HomePage /></RequireApplicant>} />
      <Route path="/upload" element={<RequireApplicant><UploadContractPage /></RequireApplicant>} />
      <Route path="/coverage/:applicationId" element={<RequireApplicant><CoveragePage /></RequireApplicant>} />
      <Route path="/questions/:applicationId" element={<RequireApplicant><QuestionsPage /></RequireApplicant>} />
      <Route path="/review/:applicationId" element={<RequireApplicant><ReviewPage /></RequireApplicant>} />
      <Route path="/requirements/:applicationId" element={<RequireApplicant><RequirementsPage /></RequireApplicant>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
