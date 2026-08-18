import BackBar from "@/components/BackBar"; // BI_CLIENT_FLOW_v12
// BI_CLIENT_COVERAGE_v4 - step 2, the path taken when there is no subcontract
// to read. The list is whatever bi_products holds for the applicant's country,
// in sort_order, so PGI leads and the ordering is data rather than code.
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSelection, listProducts, saveSelection, type Product, type Selected } from "@/api/products";
import { getChosenIndustry } from "@/entry/entryContext";

// BI_CLIENT_SHELL_v21 - width, ground and padding come from chrome.css. The
// 104px bottom padding stays because the CTA bar below is position:fixed and
// would otherwise sit over the last control.
const wrap: React.CSSProperties = { paddingBottom: 104 };
const card: React.CSSProperties = {
  border: "1px solid #E4EAF2", borderRadius: 8, padding: 16, marginBottom: 12,
  background: "#fff", display: "flex", gap: 12, alignItems: "flex-start",
  minHeight: 56, cursor: "pointer",
};
const picked: React.CSSProperties = { ...card, border: "2px solid #0B1F3A", background: "#F5F8FC" };
const bar: React.CSSProperties = {
  position: "fixed", left: 0, right: 0, bottom: 0, padding: 16,
  background: "#fff", borderTop: "1px solid #E4EAF2",
};
// BI_CLIENT_CTA_v23 - the primary button is .bi-cta in chrome.css now.
const tag: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: "#0B1F3A", background: "#e0e7ff",
  borderRadius: 8, padding: "2px 8px", marginLeft: 8, whiteSpace: "nowrap",
};

export default function CoveragePage() {
  const { applicationId = "" } = useParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  // The route may carry the literal "me"; the server hands back the real id.
  const [resolvedId, setResolvedId] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  // A coverage the subcontract demands is not the applicant's to untick, so it
  // renders locked rather than as a checkbox they can clear.
  const [required, setRequired] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const sel = await getSelection(applicationId);
      const rows: Selected[] = sel.selected ?? [];
      setResolvedId(sel.applicationId || applicationId);
      const list = await listProducts(sel.country === "US" ? "US" : "CA", getChosenIndustry() || undefined);
      setCategories(list.kind === "categories");
      setProducts(list.products ?? []);
      setRequired(new Set(rows.filter((r) => r.source === "contract").map((r) => r.code)));
      setChosen(new Set(rows.filter((r) => r.source !== "contract").map((r) => r.code)));
    } catch {
      setError("We could not load the coverage list. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => { void load(); }, [load]);

  function toggle(code: string) {
    if (required.has(code)) return;
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const id = resolvedId || applicationId;
      await saveSelection(id, Array.from(chosen));
      // BI_CLIENT_QUESTIONS_v5 - step 2 leads into step 3, not back to the
      // requirements summary.
      navigate(`/questions/${encodeURIComponent(id)}`);
    } catch {
      setError("That did not save. Please try again.");
      setBusy(false);
    }
  }

  const total = chosen.size + required.size;

  if (loading) return <div className="bi-page" style={wrap}>Loading…</div>;

  return (
    <div className="bi-page" style={wrap}>
      <BackBar />
      <h1>What do you need covered?</h1>
      <p style={{ color: "#51617D", fontSize: 14, marginTop: 0, marginBottom: 20 }}>
        Pick everything that applies. You can change this later.
      </p>

      {categories && (
        <div style={{ fontSize: 14, color: "#51617D", margin: "4px 0 16px" }}>
          These are the coverages we most often place for your industry. If a lease, supplier agreement or other contract sets out what you must carry,{" "}
          <button type="button" data-testid="upload-other-contract" onClick={() => navigate("/upload")} style={{ background: "none", border: "none", color: "#0B1F3A", cursor: "pointer", padding: 0, fontSize: 14, textDecoration: "underline", minHeight: 44 }}>
            upload it and we will read it
          </button>.
        </div>
      )}

      {error && <div style={{ color: "#b91c1c", fontSize: 14, marginBottom: 12 }}>{error}</div>}

      {products.map((p) => {
        const isRequired = required.has(p.code);
        const isOn = isRequired || chosen.has(p.code);
        return (
          <div key={p.code} style={isOn ? picked : card} onClick={() => toggle(p.code)}
            role="checkbox" aria-checked={isOn} aria-disabled={isRequired} tabIndex={0}
            onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(p.code); } }}>
            <input type="checkbox" checked={isOn} readOnly disabled={isRequired}
              style={{ width: 22, height: 22, marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                {p.display_name}
                {isRequired && <span style={tag}>Required by your contract</span>}
              </div>
              {p.description && (
                <div style={{ color: "#51617D", fontSize: 13, marginTop: 4 }}>{p.description}</div>
              )}
            </div>
          </div>
        );
      })}

      <div style={bar}>
        <button type="button" className="bi-cta"
          disabled={total === 0 || busy} onClick={() => void submit()}>
          {busy ? "Saving..." : total === 0 ? "Select at least one" : `Continue with ${total}`}
        </button>
      </div>
    </div>
  );
}
