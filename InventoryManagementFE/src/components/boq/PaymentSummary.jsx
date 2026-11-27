import React, { useState, useEffect } from "react";
import axios from "axios";
import { API, fmt, fmtDate, T, Alert } from "./boqUtils";
import { FaFilePdf, FaPrint } from "react-icons/fa";
import { generateProgressClaimPDF } from "./generateProgressClaimPDF";

/* ── Print CSS: makes window.print() match the PDF layout ── */
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #pc-print-area, #pc-print-area * { visibility: visible !important; }
  #pc-print-area { position: fixed; inset: 0; background: #fff; padding: 16px; font-family: Arial, sans-serif; font-size: 9pt; color: #000; }
  .no-print { display: none !important; }
  table { border-collapse: collapse; width: 100%; font-size: 8pt; }
  th { background: #002060 !important; color: #fff !important; padding: 4px 6px; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  td { padding: 3px 6px; border: 1px solid #ccc; }
  .sec-row td { background: #dce6f5 !important; font-weight: bold; color: #002060 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .summary-final td { background: #002060 !important; color: #fff !important; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .summary-bold td { background: #dce6f5 !important; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .section-bar { background: #002060 !important; color: #fff !important; padding: 4px 8px; font-weight: bold; font-size: 9pt; margin: 10px 0 4px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sig-box { border: 1px solid #b4c3dc; padding: 8px; width: 45%; display: inline-block; vertical-align: top; margin-right: 4%; }
}
`;

const PaymentSummary = ({ project, claim: initialClaim, onBack }) => {
  const [claim, setClaim]         = useState(initialClaim);
  const [sections, setSections]   = useState([]);
  const [variations, setVariations] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const pid = initialClaim.projectId || project.id;
        const [claimRes, secRes, voRes] = await Promise.all([
          initialClaim?.claimItems
            ? Promise.resolve({ data: initialClaim })
            : axios.get(`${API}/api/boq/claims/${initialClaim.id}`),
          axios.get(`${API}/api/boq/projects/${pid}/sections`),
          axios.get(`${API}/api/boq/projects/${pid}/variations`),
        ]);
        setClaim(claimRes.data);
        setSections(secRes.data || []);
        setVariations(voRes.data || []);
      } catch { setErr("Failed to load claim details"); }
      finally { setLoading(false); }
    };
    loadAll();
  }, [initialClaim.id]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading...</div>;

  const items   = claim?.claimItems || [];
  const orig    = claim.originalContractSum   || 0;
  const addVO   = claim.variationAddAmount    || 0;
  const omitVO  = claim.variationOmitAmount   || 0;
  const revised = claim.revisedContractSum    || (orig + addVO - omitVO);
  const prevAmt = claim.previousClaimAmount   || 0;
  const currAmt = claim.currentClaimAmount    || 0;
  const cumAmt  = claim.cumulativeClaimAmount || 0;
  const ret     = claim.retentionAmount       || 0;
  const gst     = claim.gstAmount             || 0;
  const payable = claim.finalPayable          || 0;

  const handlePDF = async () => {
    setGenerating(true); setErr("");
    try { await generateProgressClaimPDF(project, claim, sections, variations); }
    catch (e) { console.error(e); setErr("PDF failed: " + (e.message || String(e))); }
    finally { setGenerating(false); }
  };

  const handlePrint = () => window.print();

  const SummaryRow = ({ label, value, bold, final, sub }) => (
    <tr className={final ? "summary-final" : bold ? "summary-bold" : ""}>
      <td style={{ paddingLeft: sub ? 20 : 8, color: final ? "#fff" : bold ? "#002060" : "#333", fontWeight: bold || final ? 700 : 400 }}>{label}</td>
      <td style={{ textAlign: "right", fontWeight: bold || final ? 700 : 400, color: final ? "#fff" : "#000" }}>{value}</td>
    </tr>
  );

  return (
    <>
      <style>{PRINT_CSS}</style>

      {/* Screen toolbar — hidden on print */}
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Progress Claim — {claim.claimNumber}</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>{project.projectName} · {fmtDate(claim.claimDate)}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={T.btn("#334155")} onClick={onBack}>← Back</button>
          <button style={T.btn("#0f766e")} onClick={handlePrint}><FaPrint /> Print</button>
          <button style={T.btn("#dc2626")} onClick={handlePDF} disabled={generating}>
            <FaFilePdf /> {generating ? "Generating..." : "Download PDF"}
          </button>
        </div>
      </div>

      <Alert msg={err} type="error" />

      {/* ── PRINTABLE AREA ── */}
      <div id="pc-print-area">

        {/* Company Header */}
        <div style={{ background: "#002060", color: "#fff", textAlign: "center", padding: "10px 16px", borderRadius: "6px 6px 0 0" }}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 1 }}>
            {(project.companyName || "POWERQ MAX ENGINEERING PTE LTD").toUpperCase()}
          </div>
          <div style={{ fontSize: 10, color: "#b0c8f0", marginTop: 2 }}>
            Electrical • BMS • ELV & Security • Fire Alarm • Renovation • IT
          </div>
        </div>
        <div style={{ background: "#eef2fa", textAlign: "center", padding: "4px 8px", fontSize: 10, color: "#333", borderBottom: "2px solid #002060", marginBottom: 12 }}>
          {project.companyAddress || "10 Jalan Besar, #15-02, Sim Lim Tower, Singapore 208787"}
          &nbsp;|&nbsp; Tel: +65 9860 4001 &nbsp;|&nbsp; Email: powerqmaxengineering@gmail.com
        </div>

        {/* Document Title */}
        <div style={{ background: "#f0f4fc", border: "1px solid #002060", borderRadius: 4, textAlign: "center", padding: "6px 0", fontWeight: 800, fontSize: 14, color: "#002060", marginBottom: 12 }}>
          PROGRESS CLAIM — {claim.claimNumber}
        </div>

        {/* Client + Claim Info */}
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: "0 0 58%", background: "#f8faff", border: "1px solid #c8d8ee", borderRadius: 4, padding: "10px 14px", fontSize: 11 }}>
            <div style={{ fontWeight: 700, color: "#002060", marginBottom: 6, fontSize: 12 }}>TO:</div>
            {project.clientName    && <div><b>M/S</b> {project.clientName}</div>}
            {project.clientAddress && <div style={{ color: "#444", marginTop: 2 }}>{project.clientAddress}</div>}
            {project.clientTel     && <div style={{ marginTop: 2 }}>Tel: {project.clientTel}</div>}
            {project.clientEmail   && <div>Email: {project.clientEmail}</div>}
            {project.clientAttn    && <div><b>Attn.:</b> {project.clientAttn}</div>}
            <div style={{ marginTop: 6, fontStyle: "italic", color: "#555" }}>Dear Sir/Madam,</div>
          </div>
          <div style={{ flex: 1, background: "#f0f4fc", border: "1px solid #c8d8ee", borderRadius: 4, padding: "10px 14px", fontSize: 11 }}>
            {[
              ["Claim No",    claim.claimNumber],
              ["Claim Date",  fmtDate(claim.claimDate)],
              ["Period From", fmtDate(claim.periodFrom)],
              ["Period To",   fmtDate(claim.periodTo)],
              ["Project No",  project.projectNumber],
              ["Status",      (claim.status || "").toUpperCase()],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #dde6f5", padding: "2px 0" }}>
                <span style={{ color: "#002060", fontWeight: 600 }}>{k}:</span>
                <span style={{ color: "#222" }}>{v || "-"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Project Description */}
        {(project.projectDescription || project.projectName) && (
          <div style={{ fontWeight: 700, fontSize: 11, color: "#111", marginBottom: 10, textTransform: "uppercase" }}>
            {project.projectDescription || project.projectName}
          </div>
        )}

        {/* ── SECTION 1: BOQ Progress Table ── */}
        <div className="section-bar" style={{ background: "#002060", color: "#fff", padding: "5px 10px", fontWeight: 700, fontSize: 11, marginBottom: 4, borderRadius: 3 }}>
          BILL OF QUANTITIES — PROGRESS CLAIM
        </div>
        <div style={{ overflowX: "auto", marginBottom: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
            <thead>
              <tr>
                {["SN", "Description", "Unit", "Contract Qty", "Rate", "Amount", "Prev Accum %", "Claim Qty", "Unit", "Claim Amount"].map(h => (
                  <th key={h} style={{ background: "#002060", color: "#fff", padding: "5px 6px", textAlign: h === "Description" ? "left" : "center", border: "1px solid #1a3a7a", fontSize: 9 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sections.map(sec => (
                <React.Fragment key={sec.id}>
                  <tr className="sec-row">
                    <td colSpan={10} style={{ background: "#dce6f5", fontWeight: 700, color: "#002060", padding: "4px 8px", fontSize: 10, border: "1px solid #b4c3dc" }}>
                      {sec.title}
                    </td>
                  </tr>
                  {(sec.items || []).map(item => {
                    const ci = items.find(i => i.boqItemId === item.id) || {};
                    const prevPct = item.contractQty > 0
                      ? `${Math.round(((ci.prevQty || 0) / item.contractQty) * 100)}%`
                      : "-";
                    return (
                      <tr key={item.id} style={{ borderBottom: "1px solid #e0e8f0" }}>
                        <td style={{ textAlign: "center", color: "#555", border: "1px solid #dde" }}>{item.itemNumber}</td>
                        <td style={{ border: "1px solid #dde", padding: "3px 6px" }}>{item.description}</td>
                        <td style={{ textAlign: "center", border: "1px solid #dde" }}>{item.unit}</td>
                        <td style={{ textAlign: "right", border: "1px solid #dde" }}>{item.contractQty}</td>
                        <td style={{ textAlign: "right", border: "1px solid #dde" }}>${(item.rate || 0).toFixed(2)}</td>
                        <td style={{ textAlign: "right", border: "1px solid #dde" }}>${(item.amount || 0).toFixed(2)}</td>
                        <td style={{ textAlign: "center", color: "#555", border: "1px solid #dde" }}>{prevPct}</td>
                        <td style={{ textAlign: "right", fontWeight: 600, border: "1px solid #dde" }}>{ci.currentQty ?? 0}</td>
                        <td style={{ textAlign: "center", border: "1px solid #dde" }}>{item.unit}</td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: (ci.currentAmount || 0) > 0 ? "#002060" : "#999", border: "1px solid #dde" }}>
                          {(ci.currentAmount || 0) > 0 ? `$${(ci.currentAmount).toFixed(2)}` : "$ -"}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── SECTION 2: Variation Orders ── */}
        {variations.length > 0 && (
          <>
            <div className="section-bar" style={{ background: "#002060", color: "#fff", padding: "5px 10px", fontWeight: 700, fontSize: 11, marginBottom: 4, borderRadius: 3 }}>
              VARIATION ORDERS
            </div>
            <div style={{ overflowX: "auto", marginBottom: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                <thead>
                  <tr>
                    {["VO No", "Date", "Add Description", "Add Qty", "Add Rate", "Add Amount", "Omit Description", "Omit Amount", "Revised Contract", "Status"].map(h => (
                      <th key={h} style={{ background: "#1a4fa0", color: "#fff", padding: "5px 6px", border: "1px solid #1a3a7a", fontSize: 9 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {variations.map((v, i) => (
                    <tr key={v.id} style={{ background: i % 2 === 0 ? "#fff" : "#f5f8ff" }}>
                      <td style={{ border: "1px solid #dde", fontWeight: 600, color: "#002060" }}>{v.voNumber}</td>
                      <td style={{ border: "1px solid #dde" }}>{fmtDate(v.voDate)}</td>
                      <td style={{ border: "1px solid #dde" }}>{v.addDescription || "-"}</td>
                      <td style={{ textAlign: "right", border: "1px solid #dde" }}>{v.addQty || "-"}</td>
                      <td style={{ textAlign: "right", border: "1px solid #dde" }}>{v.addRate ? `$${parseFloat(v.addRate).toFixed(2)}` : "-"}</td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: "#006600", border: "1px solid #dde" }}>${(v.addAmount || 0).toFixed(2)}</td>
                      <td style={{ border: "1px solid #dde" }}>{v.omitDescription || "-"}</td>
                      <td style={{ textAlign: "right", color: "#cc0000", border: "1px solid #dde" }}>${(v.omitAmount || 0).toFixed(2)}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, border: "1px solid #dde" }}>${(v.revisedContractAmount || 0).toFixed(2)}</td>
                      <td style={{ textAlign: "center", border: "1px solid #dde", fontWeight: 600, color: v.approvalStatus === "approved" ? "#006600" : v.approvalStatus === "rejected" ? "#cc0000" : "#996600" }}>
                        {(v.approvalStatus || "pending").toUpperCase()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── SECTION 3: Payment Summary ── */}
        <div className="section-bar" style={{ background: "#002060", color: "#fff", padding: "5px 10px", fontWeight: 700, fontSize: 11, marginBottom: 4, borderRadius: 3 }}>
          PAYMENT SUMMARY
        </div>
        <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 14 }}>
          <table style={{ width: "100%", maxWidth: 500, borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ background: "#1a4fa0", color: "#fff", padding: "5px 10px", textAlign: "left", border: "1px solid #1a3a7a" }}>Description</th>
                <th style={{ background: "#1a4fa0", color: "#fff", padding: "5px 10px", textAlign: "right", border: "1px solid #1a3a7a" }}>Amount (SGD)</th>
              </tr>
            </thead>
            <tbody>
              <SummaryRow label="Original Contract Sum"                        value={fmt(orig)} />
              <SummaryRow label="  Add: Variation Order (Additional Work)"     value={fmt(addVO)} sub />
              <SummaryRow label="  Less: Variation Order (Omission)"           value={`(${fmt(omitVO)})`} sub />
              <SummaryRow label="Revised Contract Sum"                         value={fmt(revised)} bold />
              <SummaryRow label="Less: Previous Claim Amount"                  value={fmt(prevAmt)} sub />
              <SummaryRow label="Current Claim Amount (This Claim)"            value={fmt(currAmt)} bold />
              <SummaryRow label="Cumulative Claim Amount"                      value={fmt(cumAmt)} />
              <SummaryRow label={`Less: Retention @ ${claim.retentionPct || 5}%`} value={`(${fmt(ret)})`} sub />
              <SummaryRow label={`Add: GST @ ${claim.gstPct || 9}%`}          value={fmt(gst)} sub />
              <SummaryRow label="AMOUNT DUE THIS CLAIM"                        value={fmt(payable)} final />
            </tbody>
          </table>
        </div>

        {/* ── SECTION 4: Signatures ── */}
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          {[
            "For " + (project.companyName || "PowerQ Max Engineering Pte Ltd"),
            "Acknowledged by Client",
          ].map(title => (
            <div key={title} className="sig-box" style={{ flex: 1, border: "1px solid #b4c3dc", borderRadius: 4, padding: "10px 14px", background: "#f8faff" }}>
              <div style={{ fontWeight: 700, color: "#002060", fontSize: 11, marginBottom: 16 }}>{title}</div>
              <div style={{ borderBottom: "1px solid #555", marginBottom: 4 }}>&nbsp;</div>
              <div style={{ fontSize: 9, color: "#666" }}>Name / Signature / Company Stamp / Date</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: 9, color: "#aaa", marginTop: 12, fontStyle: "italic" }}>
          This is a computer-generated document. All amounts are in Singapore Dollars (SGD).
        </div>
      </div>
    </>
  );
};

export default PaymentSummary;
