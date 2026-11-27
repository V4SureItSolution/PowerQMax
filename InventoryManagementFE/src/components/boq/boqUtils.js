// boqUtils.js - shared helpers
export const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

export const fmt = (n) =>
  `$${(parseFloat(n) || 0).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDate = (d) => {
  if (!d) return "-";
  try { return new Date(d).toLocaleDateString("en-SG", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
};

export const today = () => new Date().toISOString().split("T")[0];

export const UNITS = ["M", "M2", "M3", "NOS", "LOT", "ITEM", "KG", "L", "SET", "PCS", "HR", "DAY"];

export const STATUS_COLORS = {
  draft:     { bg: "rgba(100,116,139,0.15)", color: "#94a3b8", border: "rgba(100,116,139,0.3)" },
  submitted: { bg: "rgba(245,158,11,0.15)",  color: "#f59e0b", border: "rgba(245,158,11,0.3)" },
  approved:  { bg: "rgba(16,185,129,0.15)",  color: "#10b981", border: "rgba(16,185,129,0.3)" },
  rejected:  { bg: "rgba(239,68,68,0.15)",   color: "#ef4444", border: "rgba(239,68,68,0.3)" },
  pending:   { bg: "rgba(245,158,11,0.15)",  color: "#f59e0b", border: "rgba(245,158,11,0.3)" },
  active:    { bg: "rgba(16,185,129,0.15)",  color: "#10b981", border: "rgba(16,185,129,0.3)" },
  completed: { bg: "rgba(139,92,246,0.15)",  color: "#a78bfa", border: "rgba(139,92,246,0.3)" },
};

export const Badge = ({ status }) => {
  const s = STATUS_COLORS[status] || STATUS_COLORS.draft;
  return (
    <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600,
      backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`,
      textTransform: "capitalize", display: "inline-block" }}>
      {status}
    </span>
  );
};

export const T = {
  page:    { padding: 24, backgroundColor: "#0f172a", minHeight: "100vh", color: "#e2e8f0", fontFamily: "Inter, system-ui, sans-serif" },
  card:    { backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 12, overflow: "hidden" },
  th:      { padding: "10px 12px", backgroundColor: "#111827", color: "#94a3b8", fontSize: 11, fontWeight: 600, textTransform: "uppercase", borderBottom: "1px solid #334155", whiteSpace: "nowrap" },
  td:      { padding: "10px 12px", borderBottom: "1px solid #334155", color: "#e2e8f0", fontSize: 13 },
  input:   { width: "100%", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "7px 10px", color: "#fff", fontSize: 13, boxSizing: "border-box", outline: "none" },
  label:   { display: "block", fontSize: 11, color: "#94a3b8", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" },
  overlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 },
  modal:   { backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: 14, width: "100%", maxWidth: 640, maxHeight: "92vh", overflowY: "auto", padding: 24 },
  btn:     (bg, color = "#fff") => ({ padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", backgroundColor: bg, color, display: "inline-flex", alignItems: "center", gap: 5 }),
  tab:     (active) => ({ padding: "7px 16px", borderRadius: 8, border: active ? "1px solid #3b82f6" : "1px solid #334155", backgroundColor: active ? "#2563eb" : "#1e293b", color: active ? "#fff" : "#94a3b8", cursor: "pointer", fontSize: 12, fontWeight: 600 }),
};

export const Alert = ({ msg, type }) => {
  if (!msg) return null;
  const isErr = type === "error";
  return (
    <div style={{ backgroundColor: isErr ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
      border: `1px solid ${isErr ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`,
      color: isErr ? "#f87171" : "#34d399", padding: "10px 16px", borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
      {msg}
    </div>
  );
};
