// BI_CLIENT_STEP1_PROFILE_v3 - step 1. Three fields, because the fourth (the
// mobile number) is already known from the OTP and asking for it again is the
// fastest way to make someone think the sign-in did not work.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listIndustries, saveProfile, type Industry } from "@/api/profile";
import { getPhone } from "@/auth/token";
import { getEntryIndustry, getEntrySource, setChosenIndustry } from "@/entry/entryContext";
import BackBar from "@/components/BackBar";
import { clearDraft, loadDraft, saveDraft } from "@/entry/draft";

const DRAFT = { businessName: "", applicantName: "", email: "", country: "CA", industry: "" };

// Mobile-first: one field per row, 56px targets, sticky CTA. 88% of applicants
// are on a phone.
const wrap: React.CSSProperties = { maxWidth: 560, margin: "0 auto", padding: 24, paddingBottom: 104 };
const label: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#0B1F3A", marginBottom: 6 };
const input: React.CSSProperties = {
  width: "100%", minHeight: 56, fontSize: 16, padding: "0 14px",
  border: "1px solid #E4EAF2", borderRadius: 10, background: "#fff",
  color: "#0B1F3A", boxSizing: "border-box",
};
const field: React.CSSProperties = { marginBottom: 18 };
const readOnly: React.CSSProperties = { ...input, background: "#f1f5f9", color: "#51617D", lineHeight: "56px" };
const bar: React.CSSProperties = {
  position: "fixed", left: 0, right: 0, bottom: 0, padding: 16,
  background: "#fff", borderTop: "1px solid #E4EAF2",
};
const cta: React.CSSProperties = {
  width: "100%", minHeight: 56, fontSize: 16, fontWeight: 600, borderRadius: 10,
  border: "none", background: "#BF9B49", color: "#0B1F3A", cursor: "pointer",
};

const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export default function StartPage() {
  const navigate = useNavigate();
  const phone = getPhone();
  const initial = loadDraft(DRAFT);
  const [businessName, setBusinessName] = useState(initial.businessName);
  const [applicantName, setApplicantName] = useState(initial.applicantName);
  const [email, setEmail] = useState(initial.email);
  const [country, setCountry] = useState<"CA" | "US">(initial.country === "US" ? "US" : "CA");
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [industry, setIndustry] = useState(getEntryIndustry() || initial.industry);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void listIndustries().then((r) => { if (alive) setIndustries(r.industries ?? []); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    saveDraft({ businessName, applicantName, email, country, industry });
  }, [businessName, applicantName, email, country, industry]);

  const ready = industry.trim().length > 0 && businessName.trim().length > 1 && applicantName.trim().length > 1 && looksLikeEmail(email);

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await saveProfile({ businessName: businessName.trim(), applicantName: applicantName.trim(), email: email.trim(), country, industry, src: getEntrySource() || undefined });
      setChosenIndustry(result.industry || industry);
      clearDraft();
      navigate(result.wantsContract ? "/upload" : "/coverage/me");
    } catch {
      setError("That did not save. Please check your details and try again.");
      setBusy(false);
    }
  }

  return (
    <div style={wrap}>
      <BackBar to="/" />
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Tell us who you are</h1>
      <p style={{ color: "#51617D", fontSize: 14, marginTop: 0, marginBottom: 24 }}>A few details and we can tell you what cover you need.</p>
      <div style={field}>
        <label style={label} htmlFor="industry">What industry are you in?</label>
        <select id="industry" data-testid="industry-select" autoComplete="organization-title" style={input} value={industry} onChange={(e) => setIndustry(e.target.value)}>
          <option value="">Choose your industry</option>
          {industries.map((item) => <option key={item.code} value={item.code}>{item.display_name}</option>)}
        </select>
      </div>
      <div style={field}>
        <label style={label} htmlFor="businessName">Business name</label>
        <input id="businessName" name="organization" style={input} value={businessName} autoComplete="organization" onChange={(e) => setBusinessName(e.target.value)} placeholder="Legal name of your company" />
      </div>
      <div style={field}>
        <label style={label} htmlFor="applicantName">Your name</label>
        <input id="applicantName" name="name" style={input} value={applicantName} autoComplete="name" onChange={(e) => setApplicantName(e.target.value)} placeholder="First and last name" />
      </div>
      <div style={field}>
        <label style={label} htmlFor="email">Email</label>
        <input id="email" name="email" style={input} value={email} type="email" inputMode="email" autoComplete="email" autoCapitalize="off" autoCorrect="off" onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
      </div>
      <div style={field}>
        <label style={label} htmlFor="country">Where do you work?</label>
        <select id="country" name="country" autoComplete="country" style={input} value={country} onChange={(e) => setCountry(e.target.value === "US" ? "US" : "CA")}>
          <option value="CA">Canada</option>
          <option value="US">United States</option>
        </select>
      </div>
      <div style={field}>
        <label style={label}>Mobile</label>
        <div style={readOnly}>{phone ?? "Verified"}</div>
        <div style={{ fontSize: 12, color: "#8593aa", marginTop: 6 }}>Already confirmed by the code you entered.</div>
      </div>
      {error && <div style={{ color: "#b91c1c", fontSize: 14, marginBottom: 12 }}>{error}</div>}
      <div style={bar}>
        <button type="button" style={{ ...cta, opacity: ready && !busy ? 1 : 0.5 }} disabled={!ready || busy} onClick={() => void submit()}>
          {busy ? "Saving..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
