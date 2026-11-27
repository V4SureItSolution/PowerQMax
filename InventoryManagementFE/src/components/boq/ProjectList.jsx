import React, { useState, useEffect } from "react";
import axios from "axios";
import { API, fmt, fmtDate, today, T, Badge, Alert } from "./boqUtils";
import { FaPlus, FaEdit, FaTrash, FaEye, FaSyncAlt, FaTimes } from "react-icons/fa";

const EMPTY = {
  projectNumber: "", projectName: "", clientName: "", clientAddress: "",
  clientTel: "", clientEmail: "", clientAttn: "",
  companyName: "", companyAddress: "", projectDate: today(),
  projectDescription: "", notes: "",
};

const ProjectList = ({ onSelectProject }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState("");
  const [ok, setOk]             = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState(null);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/boq/projects`);
      setProjects(r.data || []);
    } catch { setErr("Failed to load projects"); }
    finally { setLoading(false); }
  };

  const notify = (msg, isErr = false) => {
    if (isErr) { setErr(msg); setTimeout(() => setErr(""), 4000); }
    else { setOk(msg); setTimeout(() => setOk(""), 3000); }
  };

  const openCreate = () => { setEditId(null); setForm(EMPTY); setShowForm(true); };
  const openEdit   = (p) => {
    setEditId(p.id);
    setForm({
      projectNumber: p.projectNumber || "",
      projectName:   p.projectName   || "",
      clientName:    p.clientName    || "",
      clientAddress: p.clientAddress || "",
      clientTel:     p.clientTel     || "",
      clientEmail:   p.clientEmail   || "",
      clientAttn:    p.clientAttn    || "",
      companyName:   p.companyName   || "",
      companyAddress:p.companyAddress|| "",
      projectDate:   p.projectDate   ? p.projectDate.split("T")[0] : today(),
      projectDescription: p.projectDescription || "",
      notes:         p.notes         || "",
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.projectName.trim()) return notify("Project name is required", true);
    if (!form.clientName.trim())  return notify("Client name is required", true);
    setSaving(true);
    try {
      if (editId) {
        await axios.put(`${API}/api/boq/projects/${editId}`, form);
        notify("Project updated");
      } else {
        await axios.post(`${API}/api/boq/projects`, form);
        notify("Project created");
      }
      setShowForm(false);
      load();
    } catch (ex) { notify(ex.response?.data?.error || "Save failed", true); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this project and all its BOQ/claims?")) return;
    try {
      await axios.delete(`${API}/api/boq/projects/${id}`);
      notify("Project deleted");
      load();
    } catch (ex) { notify(ex.response?.data?.error || "Delete failed", true); }
  };

  const F = (label, key, type = "text", extra = {}) => (
    <div style={{ marginBottom: 12 }}>
      <label style={T.label}>{label}</label>
      {type === "textarea"
        ? <textarea rows={2} style={{ ...T.input, resize: "vertical" }}
            value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} {...extra} />
        : <input type={type} style={T.input}
            value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} {...extra} />
      }
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Projects</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Manage BOQ projects</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={T.btn("#334155")} onClick={load}><FaSyncAlt /></button>
          <button style={T.btn("#2563eb")} onClick={openCreate}><FaPlus /> New Project</button>
        </div>
      </div>

      <Alert msg={err} type="error" />
      <Alert msg={ok}  type="success" />

      <div style={T.card}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading...</div>
        ) : projects.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No projects yet. Create one to get started.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Project #", "Project Name", "Client", "Date", "Contract Sum", "Status", "Actions"].map(h => (
                  <th key={h} style={T.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.id} style={{ cursor: "pointer" }}>
                  <td style={T.td}><span style={{ color: "#38bdf8", fontWeight: 600 }}>{p.projectNumber}</span></td>
                  <td style={T.td}><span style={{ fontWeight: 600, color: "#fff" }}>{p.projectName}</span></td>
                  <td style={T.td}>{p.clientName}</td>
                  <td style={T.td}>{fmtDate(p.projectDate)}</td>
                  <td style={{ ...T.td, fontWeight: 700 }}>{fmt(p.originalContractSum)}</td>
                  <td style={T.td}><Badge status={p.status} /></td>
                  <td style={T.td}>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button style={T.btn("#0f766e")} onClick={() => onSelectProject(p)} title="Open BOQ"><FaEye /> Open</button>
                      <button style={T.btn("#1d4ed8")} onClick={() => openEdit(p)} title="Edit"><FaEdit /></button>
                      <button style={T.btn("#dc2626")} onClick={() => handleDelete(p.id)} title="Delete"><FaTrash /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div style={T.overlay}>
          <div style={T.modal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ margin: 0, color: "#fff", fontSize: 16 }}>{editId ? "Edit Project" : "New Project"}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 18 }}><FaTimes /></button>
            </div>
            <form onSubmit={handleSave}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {F("Project Number", "projectNumber")}
                {F("Project Date", "projectDate", "date")}
                {F("Project Name *", "projectName")}
                {F("Client Name *", "clientName")}
              </div>
              {F("Project Description (for PDF header)", "projectDescription", "textarea")}
              {F("Client Address", "clientAddress", "textarea")}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {F("Client Tel", "clientTel")}
                {F("Client Email", "clientEmail")}
                {F("Client Attn (Contact Person)", "clientAttn")}
                {F("Company Name", "companyName")}
              </div>
              {F("Company Address", "companyAddress", "textarea")}
              {F("Notes", "notes", "textarea")}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setShowForm(false)} style={T.btn("#334155")}>Cancel</button>
                <button type="submit" disabled={saving} style={T.btn("#2563eb")}>{saving ? "Saving..." : editId ? "Update" : "Create Project"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectList;
