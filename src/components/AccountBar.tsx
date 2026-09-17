// BI_CLIENT_ACCOUNT_BAR_v337
// Every account control the applicant owns - turning Face ID sign-in on,
// signing out, deleting the account - lived on HomePage at "/home". Nothing in
// the app ever navigated there: SignInPage sends the applicant to "/start",
// StartPage sends them to "/upload" or "/coverage/:id", and no link, button or
// redirect anywhere in the repo points at "/home". The page was orphaned, so
// those controls were invisible in the shipping app. Face ID enrollment could
// not be found, and neither could account deletion, which the App Store
// requires to be reachable.
//
// So the controls move to where the applicant already is: this bar renders
// inside the signed-in guard, which wraps every authenticated route.
import FaceIdSignInToggle from "@/components/FaceIdSignInToggle";
import { useNavigate } from "react-router-dom";

export default function AccountBar() {
  const navigate = useNavigate();
  return (
    <div
      data-testid="account-bar"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        padding: "8px 16px",
        borderBottom: "1px solid #E2E8F0",
        background: "#FFFFFF",
      }}
    >
      <FaceIdSignInToggle />
      <button
        type="button"
        onClick={() => navigate("/home")}
        style={{ background: "none", border: 0, color: "#0B1F3A", fontSize: 14, textDecoration: "underline", cursor: "pointer", padding: 0 }}
      >
        Account
      </button>
    </div>
  );
}
