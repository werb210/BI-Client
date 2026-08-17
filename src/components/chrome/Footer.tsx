// BI_CLIENT_CHROME_v14 - built to the BF-Website footer template.
import "./chrome.css";

const SUPPORT_EMAIL = "info@boreal.financial";

export default function Footer() {
  return (
    <footer className="bi-chrome-footer">
      <div className="bi-chrome-footer__inner">
        <div className="bi-chrome-footer__grid">
          <div><div className="bi-chrome-footer__brand"><span>Boreal Risk Management</span></div><p>Personal Guarantee Insurance for Canadian and United States Business Owners.</p></div>
          <div><h2>Help</h2><ul><li><a href="https://www.boreal.insure/faq" target="_blank" rel="noopener noreferrer">FAQ</a></li><li><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></li></ul></div>
          <div><h2>Legal</h2><ul><li><a href="https://www.boreal.insure/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a></li><li><a href="https://www.boreal.insure/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a></li></ul></div>
        </div>
        <p style={{ fontSize: 12, lineHeight: 1.6, color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>
          Boreal Risk Management is a referral and risk advisory partner. We are not a licensed
          insurance broker, agent, or adviser. Coverage is arranged only through appropriately
          licensed entities and is subject to underwriting, eligibility, policy terms, conditions
          and exclusions. Not available to Quebec residents.
        </p>
        <div className="bi-chrome-footer__bar">
          <div><a href="https://www.boreal.insure/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a><a href="https://www.boreal.insure/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a></div>
          <div>&copy; {new Date().getFullYear()} Boreal Risk Management</div>
        </div>
      </div>
    </footer>
  );
}
