import React, { useState, useEffect } from "react";
import axios from "axios";
import { API, fmt, fmtDate, today, T, Badge, Alert } from "./boqUtils";
import { FaPlus, FaEdit, FaTrash, FaEye, FaSyncAlt, FaTimes, FaPaperPlane, FaCheckCircle, FaBan, FaSave } from "react-icons/fa";

const ProgressClaimList = ({ project, onViewSummary }) => {
  const [claims, setClaims]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState("");
  const [ok, setOk]             = useState("");
  const [editClaim, setEditClaim] = useState(null);   // full claim with claimItems
  const [showNew, setShowNew]   = useState(false);
  const [newForm, setNewForm]   = useState({ claimDate: today(), periodFrom: "", periodTo: "", retentionPct: 5, gstPct: 9, notes: "" });
  const [saving, setSaving]     = useState(false);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const actor = user.full_name || user.name || "Manager";

  useEffect(() => { load(); }, [project.id]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/boq/projects/${project.id}/claims`);
      setClaims(r.data || []);
    } catch { setErr("Failed to load claims"); }
    finally { setLoading(false); }
  };

  const notify = (msg, isErr = false) => {
    if (isErr) { setErr(msg); setTimeout(() => setErr(""), 4000); }
    else { setOk(msg); setTimeout(() => setOk(""), 3000); }
  };

  // ── Create new claim ──────────────────────────────────────────────────────
  const createClaim = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await axios.post(`${API}/api/boq/projects/${project.id}/claims`, newForm);
      notify("Claim created");
      setShowNew(false);
      setEditClaim(r.data.claim);
      load();
    } catch (ex) { notify(ex.response?.data?.error || "Failed to create claim", true); }
    finally { setSaving(false); }
  };

  // ── Open claim for editing ────────────────────────────────────────────────
  const openEdit = async (cid) => {
    try {
      const r = await axios.get(`${API}/api/boq/claims/${cid}`);
      setEditClaim(r.data);
    } catch { notify("Failed to load claim", true); }
  };

  // ── Save claim quantities ─────────────────────────────────────────────────
  const saveClaim = async () => {
    setSaving(true);
    try {
      const payload = {
        claimDate: editClaim.claimDate,
        periodFrom: editClaim.periodFrom,
        periodTo: editClaim.periodTo,
        retentionPct: editClaim.retentionPct,
        gstPct: editClaim.gstPct,
        notes: editClaim.notes,
        claimItems: editClaim.claimItems.map(i => ({ id: i.id, currentQty: i.currentQty })),
      };
      const r = await axios.put(`${API}/api/boq/claims/${editClaim.id}`, payload);
      setEditClaim(r.data.claim);
      notify("Claim saved");
      load();
    } catch (ex) { notify(ex.response?.data?.error || "Save failed", true); }
    finally { setSaving(false); }
  };

  // ── Workflow ──────────────────────────────────────────────────────────────
  const submit = async (cid) => {
    try {
      await axios.post(`${API}/api/boq/claims/${cid}/submit`, { actor });
      notify("Submitted for approval"); load();
      if (editClaim?.id === cid) setEditClaim(null);
    } catch (ex) { notify(ex.response?.data?.error || "Submit failed", true); }
  };

  const approve = async (cid) => {
    if (!window.confirm("Approve this claim?")) return;
    try {
      await axios.post(`${API}/api/boq/claims/${cid}/approve`, { approvedBy: actor });
      notify("Claim approved"); load();
      if (editClaim?.id === cid) setEditClaim(null);
    } catch (ex) { notify(ex.response?.data?.error || "Approve failed", true); }
  };

  const confirmReject = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/api/boq/claims/${rejectModal}/reject`, { approvedBy: actor, rejectionReason: rejectReason });
      notify("Claim rejected"); setRejectModal(null); load();
      if (editClaim?.id === rejectModal) setEditClaim(null);
    } catch (ex) { notify(ex.response?.data?.error || "Reject failed", true); }
  };

  const deleteClaim = async (cid) => {
    if (!window.confirm("Delete this draft claim?")) return;
    try {
      await axios.delete(`${API}/api/boq/claims/${cid}`);
      notify("Deleted"); load();
    } catch (ex) { notify(ex.response?.data?.error || "Delete failed", true); }
  };

  const updateItemQty = (itemId, val) => {
    setEditClaim(prev => ({
      ...prev,
      claimItems: prev.claimItems.map(i => {
        if (i.id !== itemId) return i;
        const currentQty = parseFloat(val) || 0;
        const cumQty = (i.prevQty || 0) + currentQty;
        const balQty = (i.contractQty || 0) - cumQty;
        return {
          ...i, currentQty,
          cumulativeQty: cumQty,
          balanceQty: balQty,
          completionPct: i.contractQty ? (cumQty / i.contractQty * 100) : 0,
          currentAmount: currentQty * (i.rate || 0),
          cumulativeAmount: cumQty * (i.rate || 0),
        };
      }),
    }));
  };

  // ── Render claim editor ───────────────────────────────────────────────────
  if (editClaim) {
    const currentTotal = (editClaim.claimItems || []).reduce((a, i) => a + (i.currentAmount || 0), 0);
    const retention = currentTotal * (editClaim.retentionPct || 0) / 100;
    const gst = (currentTotal - retention) * (editClaim.gstPct || 0) / 100;
    const payable = currentTotal - retention + gst;
    const canEdit = editClaim.status === "draft" || editClaim.status === "rejected";

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Claim: {editClaim.claimNumber}</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>{project.projectName} · <Badge status={editClaim.status} /></div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={T.btn("#334155")} onClick={() => setEditClaim(null)}>← Back</button>
            {canEdit && <button style={T.btn("#2563eb")} onClick={saveClaim} disabled={saving}><FaSave /> {saving ? "Saving..." : "Save"}</button>}
            {canEdit && <button style={T.btn("#0891b2")} onClick={() => submit(editClaim.id)}><FaPaperPlane /> Submit</button>}
            {(editClaim.status === "draft" || editClaim.status === "submitted") && (
              <>
                <button style={T.btn("#10b981")} onClick={() => approve(editClaim.id)}><FaCheckCircle /> Approve</button>
                <button style={T.btn("#dc2626")} onClick={() => { setRejectModal(editClaim.id); setRejectReason(""); }}><FaBan /> Reject</button>
              </>
            )}
            {editClaim.status === "approved" && (
              <button style={T.btn("#7c3aed")} onClick={() => onViewSummary(editClaim)}>Payment Summary / PDF</button>
            )}
          </div>
        </div>

        <Alert msg={err} type="error" />
        <Alert msg={ok}  type="success" />

        {/* Claim header fields */}
        {canEdit && (
          <div style={{ ...T.card, padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {[["Claim Date", "claimDate", "date"], ["Period From", "periodFrom", "date"], ["Period To", "periodTo", "date"]].map(([lbl, key, type]) => (
              <div key={key}>
                <label style={T.label}>{lbl}</label>
                <input type={type} style={T.input} value={editClaim[key] || ""} onChange={e => setEditClaim(p => ({ ...p, [key]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label style={T.label}>Retention %</label>
              <input type="number" style={T.input} value={editClaim.retentionPct} onChange={e => setEditClaim(p => ({ ...p, retentionPct: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label style={T.label}>GST %</label>
              <input type="number" style={T.input} value={editClaim.gstPct} onChange={e => setEditClaim(p => ({ ...p, gstPct: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>
        )}

        {/* Progress items table */}
        <div style={{ ...T.card, overflowX: "auto", marginBottom: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                {["#", "Description", "Unit", "Contract Qty", "Prev Qty", "Current Qty", "Cumulative", "Balance", "%", "Rate", "Prev Amt", "Current Amt", "Cumulative Amt"].map(h => (
                  <th key={h} style={{ ...T.th, fontSize: 10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(editClaim.claimItems || []).map(item => (
                <tr key={item.id}>
                  <td style={{ ...T.td, color: "#94a3b8" }}>{item.itemNumber}</td>
                  <td style={{ ...T.td, maxWidth: 200 }}>{item.description}</td>
                  <td style={{ ...T.td, color: "#94a3b8" }}>{item.unit}</td>
                  <td style={{ ...T.td, textAlign: "right" }}>{item.contractQty}</td>
                  <td style={{ ...T.td, textAlign: "right", color: "#94a3b8" }}>{item.prevQty}</td>
                  <td style={T.td}>
                    {canEdit ? (
                      <input type="number" min="0" style={{ ...T.input, width: 90, textAlign: "right" }}
                        value={item.currentQty} onChange={e => updateItemQty(item.id, e.target.value)} />
                    ) : <span style={{ textAlign: "right", display: "block" }}>{item.currentQty}</span>}
                  </td>
                  <td style={{ ...T.td, textAlign: "right", color: "#38bdf8" }}>{(item.cumulativeQty || 0).toFixed(2)}</td>
                  <td style={{ ...T.td, textAlign: "right", color: item.balanceQty < 0 ? "#f87171" : "#94a3b8" }}>{(item.balanceQty || 0).toFixed(2)}</td>
                  <td style={{ ...T.td, textAlign: "right", color: "#a78bfa" }}>{(item.completionPct || 0).toFixed(1)}%</td>
                  <td style={{ ...T.td, textAlign: "right" }}>{item.rate?.toFixed(2)}</td>
                  <td style={{ ...T.td, textAlign: "right", color: "#94a3b8" }}>${(item.prevAmount || 0).toFixed(2)}</td>
                  <td style={{ ...T.td, textAlign: "right", fontWeight: 700, color: "#10b981" }}>${(item.currentAmount || 0).toFixed(2)}</td>
                  <td style={{ ...T.td, textAlign: "right", fontWeight: 700, color: "#38bdf8" }}>${(item.cumulativeAmount || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mini payment summary */}
        <div style={{ ...T.card, padding: 16, maxWidth: 400, marginLeft: "auto" }}>
          {[
            ["Current Claim Amount", currentTotal, "#10b981"],
            [`Retention (${editClaim.retentionPct}%)`, -retention, "#f59e0b"],
            [`GST (${editClaim.gstPct}%)`, gst, "#38bdf8"],
            ["Final Payable", payable, "#a78bfa"],
          ].map(([lbl, val, color]) => (
            <div key={lbl} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #334155", fontSize: 13 }}>
              <span style={{ color: "#94a3b8" }}>{lbl}</span>
              <span style={{ fontWeight: 700, color }}>{fmt(val)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Claims list ───────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Progress Claims</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>{project.projectName}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={T.btn("#334155")} onClick={load}><FaSyncAlt /></button>
          <button style={T.btn("#2563eb")} onClick={() => setShowNew(true)}><FaPlus /> New Claim</button>
        </div>
      </div>

      <Alert msg={err} type="error" />
      <Alert msg={ok}  type="success" />

      <div style={T.card}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading...</div>
        ) : claims.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No claims yet. Create the first progress claim.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Claim #", "Date", "Current Claim", "Cumulative", "Retention", "GST", "Payable", "Status", "Actions"].map(h => (
                  <th key={h} style={T.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {claims.map(c => (
                <tr key={c.id}>
                  <td style={T.td}><span style={{ color: "#38bdf8", fontWeight: 600 }}>{c.claimNumber}</span></td>
                  <td style={T.td}>{fmtDate(c.claimDate)}</td>
                  <td style={{ ...T.td, fontWeight: 700 }}>{fmt(c.currentClaimAmount)}</td>
                  <td style={T.td}>{fmt(c.cumulativeClaimAmount)}</td>
                  <td style={{ ...T.td, color: "#f59e0b" }}>{fmt(c.retentionAmount)}</td>
                  <td style={{ ...T.td, color: "#38bdf8" }}>{fmt(c.gstAmount)}</td>
                  <td style={{ ...T.td, fontWeight: 700, color: "#10b981" }}>{fmt(c.finalPayable)}</td>
                  <td style={T.td}><Badge status={c.status} /></td>
                  <td style={T.td}>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      <button style={T.btn("#0f766e")} onClick={() => openEdit(c.id)}><FaEye /> Open</button>
                      {(c.status === "draft" || c.status === "rejected") && (
                        <>
                          <button style={T.btn("#0891b2")} onClick={() => submit(c.id)} title="Submit"><FaPaperPlane /></button>
                          <button style={T.btn("#dc2626")} onClick={() => deleteClaim(c.id)} title="Delete"><FaTrash /></button>
                        </>
                      )}
                      {(c.status === "draft" || c.status === "submitted") && (
                        <>
                          <button style={T.btn("#10b981")} onClick={() => approve(c.id)}><FaCheckCircle /></button>
                          <button style={T.btn("#dc2626")} onClick={() => { setRejectModal(c.id); setRejectReason(""); }}><FaBan /></button>
                        </>
                      )}
                      {c.status === "approved" && (
                        <button style={T.btn("#7c3aed")} onClick={() => onViewSummary(c)}>Summary</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New Claim Modal */}
      {showNew && (
        <div style={T.overlay}>
          <div style={T.modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ margin: 0, color: "#fff", fontSize: 16 }}>New Progress Claim</h3>
              <button onClick={() => setShowNew(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 18 }}><FaTimes /></button>
            </div>
            <form onSubmit={createClaim}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[["Claim Date *", "claimDate", "date"], ["Period From", "periodFrom", "date"], ["Period To", "periodTo", "date"]].map(([lbl, key, type]) => (
                  <div key={key}>
                    <label style={T.label}>{lbl}</label>
                    <input type={type} style={T.input} value={newForm[key]} onChange={e => setNewForm(p => ({ ...p, [key]: e.target.value }))} required={lbl.includes("*")} />
                  </div>
                ))}
                <div>
                  <label style={T.label}>Retention %</label>
                  <input type="number" style={T.input} value={newForm.retentionPct} onChange={e => setNewForm(p => ({ ...p, retentionPct: e.target.value }))} />
                </div>
                <div>
                  <label style={T.label}>GST %</label>
                  <input type="number" style={T.input} value={newForm.gstPct} onChange={e => setNewForm(p => ({ ...p, gstPct: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <label style={T.label}>Notes</label>
                <textarea rows={2} style={{ ...T.input, resize: "vertical" }} value={newForm.notes} onChange={e => setNewForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                <button type="button" onClick={() => setShowNew(false)} style={T.btn("#334155")}>Cancel</button>
                <button type="submit" disabled={saving} style={T.btn("#2563eb")}>{saving ? "Creating..." : "Create Claim"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div style={T.overlay}>
          <div style={{ ...T.modal, maxWidth: 420 }}>
            <h3 style={{ margin: "0 0 16px", color: "#f87171" }}>Reject Claim</h3>
            <form onSubmit={confirmReject}>
              <label style={T.label}>Reason *</label>
              <textarea required rows={3} style={{ ...T.input, resize: "vertical", marginBottom: 16 }} value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={() => setRejectModal(null)} style={T.btn("#334155")}>Cancel</button>
                <button type="submit" style={T.btn("#dc2626")}>Confirm Reject</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressClaimList;
