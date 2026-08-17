// BI_CLIENT_CHROME_v14 - built to the BF-Website Header template.
import { Link } from "react-router-dom";
import logoUrl from "@/assets/logo-boreal-mountains-white.svg";
import "./chrome.css";

export default function Header() {
  return (
    <header className="bi-chrome-header">
      <div className="bi-chrome-header__row">
        <Link to="/" className="bi-chrome-brand">
          <img src={logoUrl} alt="Boreal Risk Management" />
          <span>Boreal Risk Management</span>
        </Link>
        <nav className="bi-chrome-nav">
          <a href="https://www.boreal.insure/faq" target="_blank" rel="noopener noreferrer">FAQ</a>
          <a href="mailto:info@boreal.financial">Contact</a>
        </nav>
      </div>
    </header>
  );
}
