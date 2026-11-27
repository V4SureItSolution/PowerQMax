import React, { useState, useEffect } from "react";
import axios from "axios";
import { API, fmt, fmtDate, today, T, Badge, Alert } from "./boqUtils";
import { FaPlus, FaEdit, FaTrash, FaSyncAlt, FaTimes, FaSave } from "react-icons/fa";

const EMPTY = {
  voDate: today(), addDescription: "", addQty: 0, addRate: 0,
  omitDescription: "", omitAmount: 0, approvalStatus: "pending", notes: "",
};

const VariationOrders = ({ project }) => {
  const [vos, setVos]         = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [ok, setOk]           = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]   = useState(null);
  const [form, setForm]       = useState(EMPTY);
  const [saving, setSaving]   = useState(false);

  useEffect(() => { load(); }, [project.id]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/boq/projects/${project.id}/variations`);
      setVos(r.data || []);
    } catch { setErr("Failed to load variation orders"); }
    finally { setLoading(false); }
  };

  const notify = (msg, isErr = false) => {
    if (isErr) { setErr(msg); setTimeout(() => setErr(""), 4000); }
    else { setOk(msg); setTimeout(() => setOk(""), 3000); }
  };

  const openCreate = () => { setEditId(null); setForm(EMPTY); setShowForm(true); };
  const openEdit   = (v) => {
    setEditId(v.id);
    setForm({
      voDate: v.voDate?.split("T")[0] || today(),
      addDescription: v.addDescription || "",
      addQty: v.addQty || 0,
      addRate: v.addRate || 0,
      omitDescription: v.omitDescription || "",
      omitAmount: v.omitAmount || 0,
      approvalStatus: v.approvalStatus || "pending",
      notes: v.notes || "",
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await axios.put(`${API}/api/boq/variations/${editId}`, form);
        notify("Variation order updated");
      } else {
        await axios.post(`${API}/api/boq/projects/${project.id}/variations`, form);
        notify("Variation order created");
      }
      setShowForm(false);
      load();
    } catch (ex) { notify(ex.response?.data?.error || "Save failed", true); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this variation order?")) return;
    try {
      await axios.delete(`${API}/api/boq/variations/${id}`);
      notify("Deleted"); load();
    } catch (ex) { notify(ex.response?.data?.error || "Delete failed", true); }
  };

  const F = (label, key, type = "text", extra = {}) => (
    <div>
      <label style={T.label}>{label}</label>
      {type === "textarea"
        ? <textarea rows={2} style={{ ...T.input, resize: "vertical" }} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} {...extra} />
        : type === "select"
          ? <select style={T.input} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} {...extra}>
              {extra.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          : <input type={type} style={T.input} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} {...extra} />
      }
    </div>
  );

  const addAmt = parseFloat(form.addQty) * parseFloat(form.addRate) || 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Variation Orders</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>{project.projectName}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={T.btn("#334155")} onClick={load}><FaSyncAlt /></button>
          <button style={T.btn("#2563eb")} onClick={openCreate}><FaPlus /> New VO</button>
        </div>
      </div>

      <Alert msg={err} type="error" />
      <Alert msg={ok}  type="success" />

      <div style={T.card}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading...</div>
        ) : vos.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No variation orders yet.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["VO #", "Date", "Add Description", "Add Qty", "Add Rate", "Add Amount", "Omit Amount", "Revised Contract", "Status", "Actions"].map(h => (
                  <th key={h} style={T.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vos.map(v => (
                <tr key={v.id}>
                  <td style={T.td}><span style={{ color: "#38bdf8", fontWeight: 600 }}>{v.voNumber}</span></td>
                  <td style={T.td}>{fmtDate(v.voDate)}</td>
                  <td style={{ ...T.td, maxWidth: 180 }}><span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={v.addDescription}>{v.addDescription || "-"}</span></td>
                  <td style={{ ...T.td, textAlign: "right" }}>{v.addQty}</td>
                  <td style={{ ...T.td, textAlign: "right" }}>{v.addRate?.toFixed(2)}</td>
                  <td style={{ ...T.td, textAlign: "right", color: "#10b981", fontWeight: 700 }}>{fmt(v.addAmount)}</td>
                  <td style={{ ...T.td, textAlign: "right", color: "#f87171" }}>{fmt(v.omitAmount)}</td>
                  <td style={{ ...T.td, textAlign: "right", fontWeight: 700 }}>{fmt(v.revisedContractAmount)}</td>
                  <td style={T.td}><Badge status={v.approvalStatus} /></td>
                  <td style={T.td}>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button style={T.btn("#1d4ed8")} onClick={() => openEdit(v)}><FaEdit /></button>
                      <button style={T.btn("#dc2626")} onClick={() => handleDelete(v.id)}><FaTrash /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={T.overlay}>
          <div style={{ ...T.modal, maxWidth: 680 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ margin: 0, color: "#fff", fontSize: 16 }}>{editId ? "Edit Variation Order" : "New Variation Order"}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 18 }}><FaTimes /></button>
            </div>
            <form onSubmit={handleSave}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                {F("VO Date", "voDate", "date")}
                {F("Approval Status", "approvalStatus", "select", {
                  options: [
                    { value: "pending", label: "Pending" },
                    { value: "approved", label: "Approved" },
                    { value: "rejected", label: "Rejected" },
                  ]
                })}
              </div>

              <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: 14, marginBottom: 12 }}>
                <div style={{ color: "#10b981", fontWeight: 600, fontSize: 12, marginBottom: 10, textTransform: "uppercase" }}>Additional Work</div>
                <div style={{ marginBottom: 10 }}>{F("Description", "addDescription", "textarea")}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  {F("Quantity", "addQty", "number")}
                  {F("Rate", "addRate", "number")}
                  <div>
                    <label style={T.label}>Amount (auto)</label>
                    <div style={{ ...T.input, color: "#10b981", fontWeight: 700 }}>${addAmt.toFixed(2)}</div>
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: 14, marginBottom: 12 }}>
                <div style={{ color: "#f87171", fontWeight: 600, fontSize: 12, marginBottom: 10, textTransform: "uppercase" }}>Omitted Work</div>
                <div style={{ marginBottom: 10 }}>{F("Description", "omitDescription", "textarea")}</div>
                {F("Omission Amount", "omitAmount", "number")}
              </div>

              {F("Notes", "notes", "textarea")}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
                <button type="button" onClick={() => setShowForm(false)} style={T.btn("#334155")}>Cancel</button>
                <button type="submit" disabled={saving} style={T.btn("#2563eb")}><FaSave /> {saving ? "Saving..." : editId ? "Update" : "Create VO"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VariationOrders;
