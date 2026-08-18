// BI_CLIENT_FLOW_v12
import { useNavigate } from "react-router-dom";
export default function BackBar({ to }: { to?: string }) {
  const navigate = useNavigate();
  return <button type="button" data-testid="back-button" onClick={() => (to ? navigate(to) : navigate(-1))} style={{ background: "none", border: "none", color: "#0B1F3A", cursor: "pointer", padding: "0 0 8px", fontSize: 16, minHeight: 56, display: "flex", alignItems: "center" }}>&#8592; Back</button>;
}
