import React, { useState, useRef, useEffect } from "react";

const fmt = (n) => {
  if (n === null) return "∞";
  return "₹" + Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const DiscountPage = () => {
  const [ranges, setRanges] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editVals, setEditVals] = useState({});
  const [calcAmt, setCalcAmt] = useState("");
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const inputRefs = useRef({});

  // API Base URL - change this to your backend URL
  const API_BASE_URL = 'http://localhost:5000/api';

  // Fetch ranges from backend on component mount
  useEffect(() => {
    loadRanges();
  }, []);

  const loadRanges = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/discounts`);
      if (!response.ok) throw new Error('Failed to load ranges');
      const data = await response.json();
      setRanges(data);
    } catch (error) {
      console.error('Error loading ranges:', error);
      notify("Failed to load discount ranges", "error");
    } finally {
      setLoading(false);
    }
  };

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2400);
  };

  const findRange = (amount) => {
    const a = parseFloat(amount);
    if (isNaN(a) || a < 0) return null;
    return ranges.find((r) => {
      if (r.isInfinite) {
        return a >= r.min;
      }
      return a >= r.min && a <= r.max;
    }) || null;
  };

  const matched = findRange(calcAmt);
  const calcAmtN = parseFloat(calcAmt) || 0;
  const discPct = matched ? matched.discount : 0;
  const discAmt = (calcAmtN * discPct) / 100;
  const finalAmt = calcAmtN - discAmt;

  const startEdit = (row) => {
    setEditId(row.id);
    setEditVals({
      min: row.min,
      max: row.max === null ? "" : row.max,
      discount: row.discount,
      isInfinite: row.isInfinite,
    });
  };

  const validateRanges = (newRange, isInfinite) => {
    const sortedRanges = [...ranges].sort((a, b) => a.min - b.min);
    
    for (let i = 0; i < sortedRanges.length; i++) {
      const current = sortedRanges[i];
      if (current.id === newRange.id) continue;
      
      if (isInfinite) {
        if (newRange.min <= current.max && current.max !== null) {
          return false;
        }
        if (current.isInfinite) {
          return false;
        }
      } else if (current.isInfinite) {
        if (newRange.max >= current.min) {
          return false;
        }
      } else {
        if (!(newRange.max < current.min || newRange.min > current.max)) {
          return false;
        }
      }
    }
    return true;
  };

  const saveEdit = async (id) => {
    const mn = parseFloat(editVals.min);
    let mx = editVals.max === "" || editVals.max === undefined ? null : parseFloat(editVals.max);
    const d = parseFloat(editVals.discount);
    const isInfinite = mx === null;

    if (isNaN(mn) || mn < 0) {
      notify("Enter a valid min amount.", "error");
      return;
    }

    if (!isInfinite && (isNaN(mx) || mx <= mn)) {
      notify("Max must be greater than min.", "error");
      return;
    }

    if (isNaN(d) || d < 0 || d > 100) {
      notify("Discount must be 0–100.", "error");
      return;
    }

    if (isInfinite && ranges.some(r => r.id !== id && r.isInfinite)) {
      notify("Only one infinite range is allowed.", "error");
      return;
    }

    const newRange = { id, min: mn, max: mx, discount: d, isInfinite };
    
    if (!validateRanges(newRange, isInfinite)) {
      notify("Ranges cannot overlap!", "error");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/discounts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          min: mn,
          max: mx,
          discount: d,
          isInfinite: isInfinite
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update range');
      }

      const result = await response.json();
      
      // Update local state
      setRanges((p) =>
        p.map((r) =>
          r.id === id ? result.range : r
        )
      );
      
      setRanges((p) => [...p].sort((a, b) => a.min - b.min));
      setEditId(null);
      notify("Range saved!");
    } catch (error) {
      notify(error.message, "error");
    }
  };

  const deleteRow = async (id) => {
    const rowToDelete = ranges.find(r => r.id === id);
    if (rowToDelete.isInfinite) {
      notify("Cannot delete the infinity range. You can edit it instead.", "error");
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/discounts/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete range');
      }

      setRanges((p) => p.filter((r) => r.id !== id));
      notify("Range deleted.", "warn");
    } catch (error) {
      notify(error.message, "error");
    }
  };

  const addRow = async () => {
    const nonInfiniteRanges = ranges.filter(r => !r.isInfinite);
    const lastNonInfinite = nonInfiniteRanges[nonInfiniteRanges.length - 1];
    const newMin = lastNonInfinite ? lastNonInfinite.max + 1 : 0;
    
    const newRow = {
      min: newMin,
      max: newMin + 4999,
      discount: 0,
      isInfinite: false,
    };
    
    try {
      const response = await fetch(`${API_BASE_URL}/discounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRow)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create range');
      }

      const result = await response.json();
      const savedRow = result.range;
      
      const infinityIndex = ranges.findIndex(r => r.isInfinite);
      if (infinityIndex !== -1) {
        const newRanges = [...ranges];
        newRanges.splice(infinityIndex, 0, savedRow);
        setRanges(newRanges);
      } else {
        setRanges((p) => [...p, savedRow]);
      }
      
      setTimeout(() => startEdit(savedRow), 0);
      notify("New range added!");
    } catch (error) {
      notify(error.message, "error");
    }
  };

  const handleEditChange = (fieldKey, value) => {
    setEditVals((v) => ({ ...v, [fieldKey]: value }));
  };

  const handleKeyDown = (e, fieldKey, id) => {
    if (e.key === "Enter") {
      saveEdit(id);
    } else if (e.key === "Escape") {
      setEditId(null);
    }
  };

  const EditField = ({ fieldKey, placeholder, width = 100, rowId }) => {
    const inputRef = useRef(null);
    
    useEffect(() => {
      if (inputRef.current && fieldKey === "min") {
        inputRef.current.focus();
      }
    }, [fieldKey]);

    return (
      <div className="dp-field">
        {(fieldKey === "min" || fieldKey === "max") && (
          <span className="dp-sym">₹</span>
        )}
        <input
          ref={inputRef}
          className="dp-inp"
          style={{ width }}
          type="number"
          min="0"
          max={fieldKey === "discount" ? 100 : undefined}
          step={fieldKey === "discount" ? "1" : "0.01"}
          placeholder={placeholder}
          value={editVals[fieldKey] === null ? "" : editVals[fieldKey]}
          onChange={(e) => handleEditChange(fieldKey, e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, fieldKey, rowId)}
          disabled={fieldKey === "max" && editVals.isInfinite}
        />
        {fieldKey === "discount" && <span className="dp-sym dp-sym-r">%</span>}
        {fieldKey === "max" && (
          <button
            type="button"
            className="dp-infinity-toggle"
            onClick={(e) => {
              e.preventDefault();
              setEditVals((v) => ({
                ...v,
                max: v.isInfinite ? (v.max || "") : null,
                isInfinite: !v.isInfinite,
              }));
            }}
            title={editVals.isInfinite ? "Set finite max" : "Set infinite max"}
          >
            {editVals.isInfinite ? "∞" : "↗"}
          </button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="dp-root">
        <div className="dp-loading">Loading discount ranges...</div>
      </div>
    );
  }

  return (
    <div className="dp-root">
      <style>{CSS}</style>

      {toast && (
        <div className={`dp-toast dp-toast-${toast.type}`}>
          <span>
            {toast.type === "success" && "✓"}
            {toast.type === "error" && "✕"}
            {toast.type === "warn" && "⚠"}
          </span>
          {toast.msg}
        </div>
      )}

      <div className="dp-header">
        <div>
          <p className="dp-eyebrow">Pricing Rules</p>
          <h1 className="dp-title">Discount Ranges</h1>
        </div>
        <button className="dp-btn-add" onClick={addRow}>
          + Add Range
        </button>
      </div>

      <div className="dp-layout">
        <div className="dp-left">
          <div className="dp-card">
            {ranges.length === 0 ? (
              <div className="dp-empty">
                <div className="dp-empty-icon">🏷️</div>
                <p>
                  No ranges yet. Click <strong>+ Add Range</strong> to begin.
                </p>
              </div>
            ) : (
              <table className="dp-table">
                <thead>
                  <tr>
                    <th>Min Amount</th>
                    <th>Max Amount</th>
                    <th>Discount %</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ranges.map((row) => {
                    const ed = editId === row.id;
                    const isActive = matched && matched.id === row.id;
                    return (
                      <tr
                        key={row.id}
                        className={`${ed ? "dp-tr-ed" : ""} ${
                          isActive ? "dp-tr-active" : ""
                        }`}
                      >
                        <td>
                          {ed ? (
                            <EditField 
                              fieldKey="min" 
                              placeholder="0" 
                              width={110} 
                              rowId={row.id}
                            />
                          ) : (
                            <span className="dp-val">{fmt(row.min)}</span>
                          )}
                        </td>
                        <td>
                          {ed ? (
                            <EditField
                              fieldKey="max"
                              placeholder={row.isInfinite ? "∞" : "1000"}
                              width={110}
                              rowId={row.id}
                            />
                          ) : (
                            <span className="dp-val">
                              {row.isInfinite ? "∞" : fmt(row.max)}
                            </span>
                          )}
                        </td>
                        <td>
                          {ed ? (
                            <EditField
                              fieldKey="discount"
                              placeholder="0"
                              width={72}
                              rowId={row.id}
                            />
                          ) : (
                            <div className="dp-disc-cell">
                              <span
                                className={`dp-pct-badge ${
                                  row.discount > 0 ? "dp-pct-on" : ""
                                }`}
                              >
                                {row.discount}%
                              </span>
                              <div className="dp-bar-track">
                                <div
                                  className="dp-bar-fill"
                                  style={{
                                    width: `${Math.min(row.discount, 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </td>
                        <td>
                          {ed ? (
                            <div className="dp-acts">
                              <button
                                className="dp-btn dp-btn-save"
                                onClick={() => saveEdit(row.id)}
                              >
                                ✓ Save
                              </button>
                              <button
                                className="dp-btn dp-btn-cancel"
                                onClick={() => setEditId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="dp-acts">
                              <button
                                className="dp-btn dp-btn-edit"
                                onClick={() => startEdit(row)}
                              >
                                ✎ Edit
                              </button>
                              <button
                                className="dp-btn dp-btn-del"
                                onClick={() => deleteRow(row.id)}
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <p className="dp-hint">
            💡 Enter any amount in the calculator → it auto-detects the matching
            range. The last range can be set to infinity (∞) for amounts above a
            threshold.
          </p>
        </div>

        <div className="dp-right">
          <div className="dp-calc-card">
            <p className="dp-calc-title">Live Calculator</p>

            <label className="dp-calc-label">Enter Amount</label>
            <div className="dp-calc-inp-wrap">
              <span className="dp-calc-sym">₹</span>
              <input
                className="dp-calc-inp"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 2500"
                value={calcAmt}
                onChange={(e) => setCalcAmt(e.target.value)}
              />
            </div>

            {calcAmtN > 0 ? (
              <div className="dp-calc-result">
                {matched ? (
                  <>
                    <div className="dp-match-badge">
                      Range matched: {fmt(matched.min)} –{" "}
                      {matched.isInfinite ? "∞" : fmt(matched.max)}
                    </div>
                    <div className="dp-calc-row">
                      <span>Original</span>
                      <span className="dp-cr-val">{fmt(calcAmtN)}</span>
                    </div>
                    <div className="dp-calc-row">
                      <span>Discount ({discPct}%)</span>
                      <span className="dp-cr-disc">− {fmt(discAmt)}</span>
                    </div>
                    <div className="dp-calc-divider" />
                    <div className="dp-calc-row dp-calc-final-row">
                      <span>Final Payable</span>
                      <span className="dp-cr-final">{fmt(finalAmt)}</span>
                    </div>
                    <div className="dp-savings-pill">
                      🎉 You save {fmt(discAmt)} ({discPct}% off)
                    </div>
                  </>
                ) : (
                  <div className="dp-no-match">
                    <span>⚠</span>
                    <p>
                      ₹{calcAmtN.toLocaleString("en-IN")} doesn't fall in any
                      defined range.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="dp-calc-placeholder">
                Type an amount above to instantly see which discount applies.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:     #090f1c;
  --surf:   #0f1826;
  --border: #1a2d44;
  --bord2:  #213550;
  --accent: #38bdf8;
  --acc2:   #7dd3fc;
  --red:    #f87171;
  --green:  #34d399;
  --muted:  #3d5570;
  --text:   #dde6f0;
  --text2:  #6b8aaa;
}

.dp-root {
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: 'DM Sans', sans-serif;
  padding: 36px 28px;
  max-width: 1020px;
  margin: 0 auto;
}

.dp-loading {
  text-align: center;
  padding: 50px;
  color: var(--text2);
  font-size: 14px;
}

.dp-toast {
  position: fixed; top: 20px; right: 24px;
  display: flex; align-items: center; gap: 10px;
  padding: 11px 18px; border-radius: 9px;
  font-size: 13px; font-weight: 600;
  box-shadow: 0 8px 30px rgba(0,0,0,0.5); z-index: 9999;
  animation: slideIn 0.22s cubic-bezier(0.22,1,0.36,1);
}
.dp-toast-success { background:#052e16; border:1px solid #14532d; color:#6ee7b7; }
.dp-toast-error   { background:#3b0000; border:1px solid #7f1d1d; color:#fca5a5; }
.dp-toast-warn    { background:#2a1800; border:1px solid #78350f; color:#fcd34d; }
@keyframes slideIn {
  from { opacity:0; transform:translateX(14px); }
  to   { opacity:1; transform:translateX(0); }
}

.dp-header {
  display:flex; justify-content:space-between; align-items:flex-end;
  margin-bottom:28px;
}
.dp-eyebrow {
  font-size:10px; font-weight:700; letter-spacing:2.5px;
  text-transform:uppercase; color:var(--accent); margin-bottom:5px;
}
.dp-title {
  font-family:'Syne',sans-serif;
  font-size:26px; font-weight:800; color:#f0f8ff; letter-spacing:-0.5px;
}
.dp-btn-add {
  background:var(--accent); border:none; color:#050d18;
  padding:10px 22px; border-radius:8px;
  font-family:'DM Sans',sans-serif; font-weight:700; font-size:13px; cursor:pointer;
  transition:background 0.15s, transform 0.1s;
}
.dp-btn-add:hover { background:var(--acc2); transform:translateY(-1px); }

.dp-layout {
  display:grid; grid-template-columns:1fr 300px; gap:20px; align-items:start;
}

.dp-card {
  background:var(--surf); border:1px solid var(--border);
  border-radius:12px; overflow:auto;
}

.dp-empty { padding:50px 20px; text-align:center; color:var(--text2); font-size:14px; }
.dp-empty-icon { font-size:36px; margin-bottom:12px; }
.dp-empty strong { color:var(--accent); }

.dp-table { width:100%; border-collapse:collapse; font-size:14px; }
.dp-table thead th {
  text-align:left; font-size:10.5px; font-weight:700;
  text-transform:uppercase; letter-spacing:1px;
  color:var(--muted); padding:13px 18px;
  border-bottom:1px solid var(--border); background:#0c1622;
}
.dp-table tbody td {
  padding:12px 18px; border-bottom:1px solid #0f1d2d; vertical-align:middle;
}
.dp-table tbody tr:last-child td { border-bottom:none; }
.dp-table tbody tr:hover td { background:#101e30; }
.dp-tr-ed td  { background:#0f2038 !important; }
.dp-tr-active td { background:#061e35 !important; }
.dp-tr-active td:first-child { border-left:3px solid var(--accent); }

.dp-val { color:var(--text); font-weight:600; font-size:13.5px; }

.dp-disc-cell { display:flex; flex-direction:column; gap:5px; }
.dp-pct-badge {
  display:inline-block; padding:2px 9px; border-radius:20px;
  background:var(--border); color:var(--muted);
  font-size:12px; font-weight:700; width:fit-content;
}
.dp-pct-on { background:rgba(56,189,248,0.1); color:var(--accent); }
.dp-bar-track { width:80px; height:4px; background:var(--border); border-radius:2px; }
.dp-bar-fill  { height:100%; background:var(--accent); border-radius:2px; transition:width 0.3s; }

.dp-field {
  display:inline-flex; align-items:center;
  background:#060e1a; border:1.5px solid var(--accent);
  border-radius:7px; overflow:hidden;
  box-shadow:0 0 0 3px rgba(56,189,248,0.1);
}
.dp-sym {
  padding:0 8px; font-size:12px; font-weight:700;
  color:var(--accent); background:rgba(56,189,248,0.07);
  height:34px; display:flex; align-items:center;
  border-right:1px solid rgba(56,189,248,0.15); flex-shrink:0;
}
.dp-sym-r { border-right:none; border-left:1px solid rgba(56,189,248,0.15); }
.dp-inp {
  background:transparent; border:none; outline:none;
  color:#f0f8ff; font-size:13px; font-weight:600;
  font-family:'DM Sans',sans-serif; height:34px; padding:0 9px; min-width:0;
}
.dp-infinity-toggle {
  background:rgba(56,189,248,0.1);
  border:none;
  color:var(--accent);
  width:32px;
  height:34px;
  cursor:pointer;
  font-size:16px;
  font-weight:700;
  transition:all 0.15s;
}
.dp-infinity-toggle:hover {
  background:rgba(56,189,248,0.2);
  transform:scale(1.05);
}

.dp-acts { display:flex; gap:7px; align-items:center; }
.dp-btn {
  padding:5px 12px; border-radius:6px;
  font-family:'DM Sans',sans-serif; font-size:12px; font-weight:700;
  cursor:pointer; transition:all 0.15s; white-space:nowrap;
  border: none;
}
.dp-btn-edit   { background:var(--border); border:1px solid var(--bord2); color:var(--text2); }
.dp-btn-edit:hover { background:var(--bord2); color:var(--text); }
.dp-btn-del    { background:transparent; border:1px solid #7f1d1d55; color:var(--red); padding:5px 9px; }
.dp-btn-del:hover { background:#1a0505; border-color:var(--red); }
.dp-btn-save   { background:var(--accent); border:none; color:#050d18; }
.dp-btn-save:hover { background:var(--acc2); }
.dp-btn-cancel { background:var(--border); border:1px solid var(--bord2); color:var(--text2); }
.dp-btn-cancel:hover { background:var(--bord2); }

.dp-hint { margin-top:12px; font-size:12px; color:var(--muted); }

/* Calculator */
.dp-calc-card {
  background:var(--surf); border:1px solid var(--border);
  border-radius:12px; padding:22px 20px;
  position:sticky; top:20px;
}
.dp-calc-title {
  font-size:10.5px; font-weight:700; text-transform:uppercase;
  letter-spacing:2px; color:var(--accent); margin-bottom:16px;
}
.dp-calc-label {
  display:block; font-size:11px; font-weight:700;
  text-transform:uppercase; letter-spacing:1px;
  color:var(--text2); margin-bottom:8px;
}
.dp-calc-inp-wrap {
  display:flex; align-items:center;
  background:#060e1a; border:1.5px solid var(--bord2);
  border-radius:9px; overflow:hidden; transition:border-color 0.15s;
}
.dp-calc-inp-wrap:focus-within {
  border-color:var(--accent); box-shadow:0 0 0 3px rgba(56,189,248,0.1);
}
.dp-calc-sym {
  padding:0 12px; font-size:14px; font-weight:700;
  color:var(--accent); height:42px; display:flex; align-items:center;
  background:rgba(56,189,248,0.06);
  border-right:1px solid rgba(56,189,248,0.15); flex-shrink:0;
}
.dp-calc-inp {
  background:transparent; border:none; outline:none;
  color:#f0f8ff; font-size:16px; font-weight:700;
  font-family:'DM Sans',sans-serif; height:42px; padding:0 12px; width:100%;
}

.dp-calc-result { margin-top:18px; }
.dp-match-badge {
  display:inline-block; padding:4px 11px; border-radius:20px;
  background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.2);
  color:var(--accent); font-size:11px; font-weight:700;
  margin-bottom:14px; letter-spacing:0.3px;
}
.dp-calc-row {
  display:flex; justify-content:space-between; align-items:center;
  padding:8px 0; font-size:13px;
}
.dp-calc-row span:first-child { color:var(--text2); font-weight:500; }
.dp-cr-val   { color:var(--text); font-weight:700; }
.dp-cr-disc  { color:var(--red); font-weight:700; }
.dp-calc-divider { height:1px; background:var(--border); margin:6px 0; }
.dp-calc-final-row span:first-child { color:var(--text); font-weight:700; font-size:14px; }
.dp-cr-final { color:var(--green); font-weight:800; font-size:18px; }
.dp-savings-pill {
  margin-top:14px; padding:8px 14px; border-radius:8px;
  background:rgba(52,211,153,0.08); border:1px solid rgba(52,211,153,0.2);
  color:var(--green); font-size:12px; font-weight:700; text-align:center;
}
.dp-no-match {
  display:flex; align-items:flex-start; gap:10px;
  background:rgba(248,113,113,0.07); border:1px solid rgba(248,113,113,0.2);
  border-radius:9px; padding:14px; margin-top:14px;
  color:var(--red); font-size:13px; font-weight:600;
}
.dp-calc-placeholder {
  margin-top:18px; padding:18px 14px;
  border:1px dashed var(--bord2); border-radius:9px;
  text-align:center; color:var(--muted); font-size:13px; line-height:1.5;
}

input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; }
input[type=number] { -moz-appearance: textfield; }

@media (max-width:680px) {
  .dp-layout { grid-template-columns:1fr; }
  .dp-calc-card { position:static; }
}
`;

export default DiscountPage;