import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API, UNITS, T, Alert } from "./boqUtils";
import { FaPlus, FaTrash, FaEdit, FaSave, FaTimes, FaFileExcel, FaDownload, FaChevronDown, FaChevronRight } from "react-icons/fa";

const num = (v) => (parseFloat(v) || 0).toFixed(2);

const BOQEditor = ({ project, onBack }) => {
  const [sections, setSections] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState("");
  const [ok, setOk]             = useState("");
  const [collapsed, setCollapsed] = useState({});
  const [editingSection, setEditingSection] = useState(null); // {id, title}
  const [editingItem, setEditingItem]       = useState(null); // item object being edited inline
  const fileRef = useRef();

  useEffect(() => { load(); }, [project.id]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/boq/projects/${project.id}/sections`);
      setSections(r.data || []);
    } catch { setErr("Failed to load BOQ"); }
    finally { setLoading(false); }
  };

  const notify = (msg, isErr = false) => {
    if (isErr) { setErr(msg); setTimeout(() => setErr(""), 4000); }
    else { setOk(msg); setTimeout(() => setOk(""), 3000); }
  };

  // ── Sections ──────────────────────────────────────────────────────────────
  const addSection = async () => {
    try {
      const r = await axios.post(`${API}/api/boq/projects/${project.id}/sections`, { title: "New Section" });
      setSections(prev => [...prev, { ...r.data.section, items: [] }]);
      setEditingSection({ id: r.data.section.id, title: r.data.section.title });
    } catch { notify("Failed to add section", true); }
  };

  const saveSection = async () => {
    if (!editingSection) return;
    try {
      await axios.put(`${API}/api/boq/sections/${editingSection.id}`, { title: editingSection.title });
      setSections(prev => prev.map(s => s.id === editingSection.id ? { ...s, title: editingSection.title } : s));
      setEditingSection(null);
    } catch { notify("Failed to save section", true); }
  };

  const deleteSection = async (sid) => {
    if (!window.confirm("Delete this section and all its items?")) return;
    try {
      await axios.delete(`${API}/api/boq/sections/${sid}`);
      setSections(prev => prev.filter(s => s.id !== sid));
      notify("Section deleted");
    } catch { notify("Failed to delete section", true); }
  };

  // ── Items ─────────────────────────────────────────────────────────────────
  const addItem = async (sid) => {
    try {
      const r = await axios.post(`${API}/api/boq/sections/${sid}/items`, {
        itemNumber: "", description: "New Item", unit: "NOS", contractQty: 0, rate: 0,
      });
      setSections(prev => prev.map(s => s.id === sid ? { ...s, items: [...(s.items || []), r.data.item] } : s));
      setEditingItem({ ...r.data.item });
    } catch { notify("Failed to add item", true); }
  };

  const saveItem = async () => {
    if (!editingItem) return;
    try {
      const r = await axios.put(`${API}/api/boq/items/${editingItem.id}`, editingItem);
      setSections(prev => prev.map(s => ({
        ...s,
        items: (s.items || []).map(i => i.id === editingItem.id ? r.data.item : i),
        sectionTotal: s.items?.reduce((acc, i) => acc + (i.id === editingItem.id ? r.data.item.amount : i.amount), 0),
      })));
      setEditingItem(null);
      notify("Item saved");
    } catch { notify("Failed to save item", true); }
  };

  const deleteItem = async (sid, iid) => {
    if (!window.confirm("Delete this item?")) return;
    try {
      await axios.delete(`${API}/api/boq/items/${iid}`);
      setSections(prev => prev.map(s => s.id === sid ? { ...s, items: (s.items || []).filter(i => i.id !== iid) } : s));
      notify("Item deleted");
    } catch { notify("Failed to delete item", true); }
  };

  // ── Excel Export ──────────────────────────────────────────────────────────
  const exportExcel = () => {
    let csv = "Section,Item No,Description,Unit,Contract Qty,Rate,Amount\n";
    sections.forEach(s => {
      (s.items || []).forEach(i => {
        csv += `"${s.title}","${i.itemNumber}","${i.description}","${i.unit}",${i.contractQty},${i.rate},${i.amount}\n`;
      });
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `BOQ_${project.projectNumber}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Excel Import ──────────────────────────────────────────────────────────
  const importExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split("\n").slice(1).filter(l => l.trim());
    const sectionMap = {};
    lines.forEach((line, idx) => {
      const cols = line.split(",").map(c => c.replace(/^"|"$/g, "").trim());
      const [secTitle, itemNumber, description, unit, contractQty, rate] = cols;
      if (!sectionMap[secTitle]) sectionMap[secTitle] = { title: secTitle, sortOrder: Object.keys(sectionMap).length, items: [] };
      sectionMap[secTitle].items.push({ itemNumber, description, unit: unit || "NOS", contractQty: parseFloat(contractQty) || 0, rate: parseFloat(rate) || 0 });
    });
    try {
      await axios.post(`${API}/api/boq/projects/${project.id}/items/bulk`, { sections: Object.values(sectionMap) });
      notify("Import successful");
      load();
    } catch { notify("Import failed", true); }
    e.target.value = "";
  };

  const contractSum = sections.reduce((acc, s) => acc + (s.items || []).reduce((a, i) => a + (i.amount || 0), 0), 0);

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>BOQ — {project.projectName}</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>{project.projectNumber} · {project.clientName}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={T.btn("#334155")} onClick={onBack}>← Back</button>
          <button style={T.btn("#0f766e")} onClick={exportExcel}><FaDownload /> Export CSV</button>
          <button style={T.btn("#7c3aed")} onClick={() => fileRef.current.click()}><FaFileExcel /> Import CSV</button>
          <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={importExcel} />
          <button style={T.btn("#2563eb")} onClick={addSection}><FaPlus /> Add Section</button>
        </div>
      </div>

      <Alert msg={err} type="error" />
      <Alert msg={ok}  type="success" />

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading BOQ...</div>
      ) : sections.length === 0 ? (
        <div style={{ ...T.card, padding: 40, textAlign: "center", color: "#94a3b8" }}>
          No sections yet. Click "Add Section" to start building your BOQ.
        </div>
      ) : (
        sections.map(section => (
          <div key={section.id} style={{ ...T.card, marginBottom: 16 }}>
            {/* Section Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", backgroundColor: "#111827", borderBottom: "1px solid #334155" }}>
              <button style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 0 }}
                onClick={() => setCollapsed(p => ({ ...p, [section.id]: !p[section.id] }))}>
                {collapsed[section.id] ? <FaChevronRight /> : <FaChevronDown />}
              </button>
              {editingSection?.id === section.id ? (
                <>
                  <input style={{ ...T.input, flex: 1, maxWidth: 320 }} value={editingSection.title}
                    onChange={e => setEditingSection({ ...editingSection, title: e.target.value })}
                    onKeyDown={e => e.key === "Enter" && saveSection()} autoFocus />
                  <button style={T.btn("#10b981")} onClick={saveSection}><FaSave /></button>
                  <button style={T.btn("#334155")} onClick={() => setEditingSection(null)}><FaTimes /></button>
                </>
              ) : (
                <>
                  <span style={{ fontWeight: 700, color: "#fff", flex: 1 }}>{section.title}</span>
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>
                    {(section.items || []).length} items · ${(section.items || []).reduce((a, i) => a + (i.amount || 0), 0).toLocaleString("en-SG", { minimumFractionDigits: 2 })}
                  </span>
                  <button style={T.btn("#1d4ed8")} onClick={() => setEditingSection({ id: section.id, title: section.title })}><FaEdit /></button>
                  <button style={T.btn("#dc2626")} onClick={() => deleteSection(section.id)}><FaTrash /></button>
                </>
              )}
            </div>

            {/* Items Table */}
            {!collapsed[section.id] && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {["Item No", "Description", "Unit", "Qty", "Rate", "Amount", ""].map(h => (
                        <th key={h} style={{ ...T.th, fontSize: 10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(section.items || []).map(item => (
                      <tr key={item.id}>
                        {editingItem?.id === item.id ? (
                          <>
                            <td style={T.td}><input style={{ ...T.input, width: 70 }} value={editingItem.itemNumber} onChange={e => setEditingItem({ ...editingItem, itemNumber: e.target.value })} /></td>
                            <td style={T.td}><input style={T.input} value={editingItem.description} onChange={e => setEditingItem({ ...editingItem, description: e.target.value })} /></td>
                            <td style={T.td}>
                              <select style={{ ...T.input, width: 80 }} value={editingItem.unit} onChange={e => setEditingItem({ ...editingItem, unit: e.target.value })}>
                                {UNITS.map(u => <option key={u}>{u}</option>)}
                              </select>
                            </td>
                            <td style={T.td}><input type="number" style={{ ...T.input, width: 90 }} value={editingItem.contractQty}
                              onChange={e => setEditingItem({ ...editingItem, contractQty: e.target.value, amount: num(e.target.value * editingItem.rate) })} /></td>
                            <td style={T.td}><input type="number" style={{ ...T.input, width: 100 }} value={editingItem.rate}
                              onChange={e => setEditingItem({ ...editingItem, rate: e.target.value, amount: num(editingItem.contractQty * e.target.value) })} /></td>
                            <td style={{ ...T.td, fontWeight: 700, color: "#38bdf8" }}>${num(editingItem.contractQty * editingItem.rate)}</td>
                            <td style={T.td}>
                              <div style={{ display: "flex", gap: 4 }}>
                                <button style={T.btn("#10b981")} onClick={saveItem}><FaSave /></button>
                                <button style={T.btn("#334155")} onClick={() => setEditingItem(null)}><FaTimes /></button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ ...T.td, color: "#94a3b8" }}>{item.itemNumber}</td>
                            <td style={T.td}>{item.description}</td>
                            <td style={{ ...T.td, color: "#94a3b8" }}>{item.unit}</td>
                            <td style={{ ...T.td, textAlign: "right" }}>{item.contractQty}</td>
                            <td style={{ ...T.td, textAlign: "right" }}>{item.rate?.toFixed(2)}</td>
                            <td style={{ ...T.td, textAlign: "right", fontWeight: 700, color: "#38bdf8" }}>${item.amount?.toFixed(2)}</td>
                            <td style={T.td}>
                              <div style={{ display: "flex", gap: 4 }}>
                                <button style={T.btn("#1d4ed8")} onClick={() => setEditingItem({ ...item })}><FaEdit /></button>
                                <button style={T.btn("#dc2626")} onClick={() => deleteItem(section.id, item.id)}><FaTrash /></button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: "8px 14px" }}>
                  <button style={T.btn("#1e3a5f", "#60a5fa")} onClick={() => addItem(section.id)}><FaPlus /> Add Item</button>
                </div>
              </div>
            )}
          </div>
        ))
      )}

      {/* Contract Sum Footer */}
      {sections.length > 0 && (
        <div style={{ ...T.card, padding: "12px 20px", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 16 }}>
          <span style={{ color: "#94a3b8", fontSize: 13 }}>Original Contract Sum:</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: "#10b981" }}>
            ${contractSum.toLocaleString("en-SG", { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}
    </div>
  );
};

export default BOQEditor;
