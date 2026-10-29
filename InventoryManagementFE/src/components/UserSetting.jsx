import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { FaSave, FaSyncAlt, FaShieldAlt, FaUserCog, FaPlus, FaTrashAlt, FaEdit, FaTimes } from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const ROLE_TEMPLATES = {
  admin: [
    "dashboard", "products", "category", "stock_in", "stock_out", "low_stock",
    "warranty", "create_bill", "bill_reports", "service_bill", "service_bills", 
    "sales_bills", "quotations", "invoices", "discount", "add_supplier", 
    "supplier_list", "payment_tracking", "employee", "user_type", "attendance", 
    "company", "enquiries", "customer_details", "usersettings"
  ],
  manager: [
    "dashboard", "products", "category", "stock_in", "stock_out", "low_stock",
    "warranty", "create_bill", "bill_reports", "service_bill", "service_bills", 
    "sales_bills", "quotations", "invoices", "discount", "add_supplier", 
    "supplier_list", "payment_tracking", "employee", "attendance", "company", 
    "enquiries", "customer_details"
  ],
  staff: [
    "dashboard", "products", "stock_in", "stock_out", "create_bill", 
    "service_bill", "service_bills", "sales_bills", "warranty"
  ],
  hr: [
    "dashboard", "employee", "user_type", "attendance", "company"
  ],
  supplier: [
    "dashboard", "supplier_list", "payment_tracking"
  ]
};

const UserSetting = () => {
  const [modules, setModules] = useState([]);
  const [userTypes, setUserTypes] = useState([]);
  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [addingUser, setAddingUser] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

  const API_BASE = "http://localhost:5000/api";

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Module Structure
      const moduleRes = await axios.get(`${API_BASE}/modules`);
      const moduleData = moduleRes.data.modules || [];
      setModules(moduleData);

      // 2. Fetch User Types
      const utRes = await axios.get(`${API_BASE}/user-types`);
      const utData = Array.isArray(utRes.data) ? utRes.data : [];
      setUserTypes(utData);

      // 3. Fetch Permissions for all User Types
      const initialMatrix = {};
      await Promise.all(
        utData.map(async (ut) => {
          try {
            const permRes = await axios.get(`${API_BASE}/permissions?userType=${ut.name}`);
            const fetchedPerms = Array.isArray(permRes.data) ? permRes.data : [];
            
            const rolePerms = {};
            const roleNameLower = ut.name.toLowerCase();

            // Intelligent Defaulting:
            if (fetchedPerms.length === 0 && ROLE_TEMPLATES[roleNameLower]) {
               const template = ROLE_TEMPLATES[roleNameLower];
               moduleData.forEach(mod => {
                 mod.submodules.forEach(sub => {
                   if (template.includes(sub.id.toLowerCase())) {
                      rolePerms[`${mod.id}_${sub.id}`] = true;
                   }
                 });
               });
            } else {
               fetchedPerms.forEach(p => {
                 rolePerms[`${p.module_id}_${p.submodule_id}`] = p.view;
               });
            }
            
            initialMatrix[ut.name] = rolePerms;
          } catch (err) {
            console.error(`Error fetching perms for ${ut.name}:`, err);
            initialMatrix[ut.name] = {};
          }
        })
      );

      setMatrix(initialMatrix);
    } catch (error) {
      console.error("Initialization error:", error);
      toast.error("Failed to load user settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleCheckboxChange = (userTypeName, moduleId, submoduleId) => {
    const key = `${moduleId}_${submoduleId}`;
    setMatrix(prev => ({
      ...prev,
      [userTypeName]: {
        ...prev[userTypeName],
        [key]: !prev[userTypeName]?.[key]
      }
    }));
  };

  const handleSaveMatrix = async () => {
    setSaving(true);
    try {
      const bulkData = {};
      
      userTypes.forEach(ut => {
        const roleMatrix = matrix[ut.name] || {};
        const permissionsArray = [];
        
        modules.forEach(mod => {
          mod.submodules.forEach(sub => {
            const isView = roleMatrix[`${mod.id}_${sub.id}`] || false;
            permissionsArray.push({
              user_type: ut.name,
              module_id: mod.id,
              submodule_id: sub.id,
              view: isView,
              add: isView, 
              edit: isView,
              delete: isView
            });
          });
        });
        
        bulkData[ut.name] = permissionsArray;
      });

      await axios.post(`${API_BASE}/bulk-save-permissions`, bulkData);
      toast.success("Security policies updated successfully!");
    } catch (error) {
       console.error("Save error:", error);
       toast.error("Failed to update security policies");
    } finally {
      setSaving(false);
    }
  };

  const addUserType = async () => {
    if (!newName.trim()) return;
    try {
      await axios.post(`${API_BASE}/user-types`, { name: newName.trim() });
      toast.success("User type created!");
      setNewName("");
      setAddingUser(false);
      fetchInitialData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create user type");
    }
  };

  const deleteUserType = async (id, name) => {
    if (name.toLowerCase() === "admin") {
      toast.error("Cannot delete admin role");
      return;
    }
    if (!window.confirm(`Delete role "${name}"? This will remove all associated permissions.`)) return;
    try {
      await axios.delete(`${API_BASE}/user-types/${id}`);
      toast.success("User type deleted");
      fetchInitialData();
    } catch (err) {
      toast.error("Failed to delete user type");
    }
  };

  const startEdit = (user) => {
    setEditingId(user.id);
    setEditName(user.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const updateUserType = async (id) => {
    if (!editName.trim()) return;
    try {
      await axios.put(`${API_BASE}/user-types/${id}`, { name: editName.trim() });
      toast.success("User type updated");
      setEditingId(null);
      fetchInitialData();
    } catch (err) {
      toast.error("Failed to update user type");
    }
  };

  const allSubmodules = useMemo(() => {
    const list = [];
    modules.forEach(mod => {
      mod.submodules.forEach(sub => {
        list.push({ ...sub, moduleId: mod.id, moduleName: mod.name });
      });
    });
    return list;
  }, [modules]);

  const styles = {
    wrapper: {
      background: "#f5f7fa",
      padding: "24px",
      minHeight: "100vh",
      fontFamily: "'Inter', system-ui, sans-serif",
      color: "#1e293b"
    },
    header: {
      marginBottom: "28px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      background: "#fff",
      padding: "20px 24px",
      borderRadius: "16px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      border: "1px solid #e2e8f0"
    },
    title: {
      fontSize: "22px",
      fontWeight: "700",
      color: "#1e293b",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      margin: 0
    },
    tableContainer: {
      background: "#fff",
      borderRadius: "16px",
      boxShadow: "0 10px 25px rgba(0,0,0,0.03)",
      overflow: "auto",
      maxHeight: "calc(100vh - 220px)",
      position: "relative",
      border: "1px solid #e2e8f0"
    },
    table: {
      width: "100%",
      borderCollapse: "separate",
      borderSpacing: 0,
      fontSize: "13px"
    },
    thCategory: {
      background: "#eff6ff",
      color: "#1d4ed8",
      padding: "14px",
      fontWeight: "700",
      textAlign: "center",
      borderBottom: "1px solid #dbeafe",
      borderRight: "1px solid #dbeafe",
      position: "sticky",
      top: 0,
      zIndex: 10,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      fontSize: "11px"
    },
    thSubmodule: {
      background: "#f8fafc",
      color: "#64748b",
      padding: "12px",
      fontWeight: "600",
      textAlign: "center",
      borderBottom: "1px solid #e2e8f0",
      borderRight: "1px solid #f1f5f9",
      position: "sticky",
      top: "43px", 
      zIndex: 10,
      fontSize: "12px"
    },
    stickyCol: {
      position: "sticky",
      left: 0,
      background: "#fff",
      zIndex: 20,
      borderRight: "2px solid #e2e8f0",
      padding: "16px 24px",
      minWidth: "180px",
      fontWeight: "600",
      color: "#1e293b",
      display: "flex",
      alignItems: "center",
      gap: "12px"
    },
    avatar: {
      width: "32px",
      height: "32px",
      borderRadius: "8px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "12px",
      fontWeight: "700",
      color: "#fff",
      fontFamily: "monospace"
    },
    stickyHeaderCol: {
      position: "sticky",
      left: 0,
      top: 0,
      zIndex: 30,
      background: "#fff",
      borderRight: "2px solid #e2e8f0",
      borderBottom: "1px solid #e2e8f0",
      padding: "16px 24px",
      textAlign: "left",
      color: "#64748b",
      fontSize: "11px",
      textTransform: "uppercase",
      fontWeight: "700"
    },
    td: {
      padding: "12px",
      textAlign: "center",
      borderBottom: "1px solid #f1f5f9",
      borderRight: "1px solid #f1f5f9"
    },
    checkbox: {
      width: "18px",
      height: "18px",
      cursor: "pointer",
      accentColor: "#3b82f6"
    },
    btnSave: {
      background: "#3b82f6",
      color: "#fff",
      padding: "10px 24px",
      borderRadius: "10px",
      border: "none",
      fontWeight: "600",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      boxShadow: "0 4px 12px rgba(59, 130, 246, 0.25)",
      transition: "all 0.2s"
    },
    btnRefresh: {
      background: "#fff",
      color: "#64748b",
      padding: "10px 24px",
      borderRadius: "10px",
      border: "1px solid #e2e8f0",
      fontWeight: "600",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      transition: "all 0.2s"
    },
    btnSecondary: {
      background: "#f1f5f9",
      color: "#475569",
      padding: "10px 20px",
      borderRadius: "10px",
      border: "none",
      fontWeight: "600",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      transition: "all 0.2s"
    },
    controls: {
       display: "flex",
       gap: "12px"
    },
    actionBtn: {
      padding: "6px",
      borderRadius: "6px",
      border: "none",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "12px",
      background: "transparent"
    }
  };

  const getAvatarColor = (name) => {
     const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
     const charCode = name.charCodeAt(0);
     return colors[charCode % colors.length];
  };

  if (loading) {
    return (
      <div style={styles.wrapper}>
        <div style={{ textAlign: "center", padding: "100px" }}>
          <FaSyncAlt className="spin" size={40} color="#3b82f6" />
          <p style={{ marginTop: "20px", color: "#64748b", fontWeight: "500" }}>Loading Security Matrix...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="us-root" style={styles.wrapper}>
      <ToastContainer position="top-right" />
      <div style={styles.header}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <h1 style={styles.title}>
            <FaUserCog color="#3b82f6" />
            User Settings Matrix
          </h1>
          <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>Define granular access levels for all organizational roles</p>
        </div>
        <div style={styles.controls}>
          {addingUser ? (
            <div style={{ display: "flex", gap: "8px" }}>
              <input 
                value={newName} 
                onChange={e => setNewName(e.target.value)}
                placeholder="New role name..."
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
              />
              <button 
                style={{ ...styles.btnSave, padding: "8px 16px" }}
                onClick={addUserType}
              >Add</button>
              <button 
                 style={{ ...styles.btnSecondary, padding: "8px 16px" }}
                 onClick={() => setAddingUser(false)}
              >Cancel</button>
            </div>
          ) : (
            <button style={styles.btnSecondary} onClick={() => setAddingUser(true)}>
              <FaPlus /> Add Role
            </button>
          )}
          
          <button style={styles.btnRefresh} onClick={fetchInitialData}>
            <FaSyncAlt /> Sync
          </button>
          <button 
            style={{...styles.btnSave, opacity: saving ? 0.7 : 1}} 
            onClick={handleSaveMatrix}
            disabled={saving}
          >
            <FaSave /> {saving ? "Updating..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div style={styles.tableContainer} className="tbl-scroll">
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.stickyHeaderCol} rowSpan={2}>Organization Roles</th>
              {modules.map(mod => (
                <th 
                  key={mod.id} 
                  style={styles.thCategory} 
                  colSpan={mod.submodules.length}
                >
                  {mod.name}
                </th>
              ))}
            </tr>
            <tr>
              {allSubmodules.map(sub => (
                <th key={`${sub.moduleId}_${sub.id}`} style={styles.thSubmodule}>
                  {sub.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {userTypes.map(ut => (
              <tr key={ut.id}>
                <td style={styles.stickyCol}>
                  <div style={{ ...styles.avatar, background: getAvatarColor(ut.name) }}>
                    {ut.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    {editingId === ut.id ? (
                      <div style={{ display: "flex", gap: "4px" }}>
                        <input 
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          style={{ width: "80px", fontSize: "12px", padding: "2px" }}
                        />
                        <FaSave color="#10b981" cursor="pointer" onClick={() => updateUserType(ut.id)} />
                        <FaTimes color="#ef4444" cursor="pointer" onClick={cancelEdit} />
                      </div>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: "600" }}>{ut.name}</div>
                          {ut.name.toLowerCase() === "admin" && (
                            <span style={{ fontSize: "10px", color: "#10b981", fontWeight: "700" }}>SUPER ADMIN</span>
                          )}
                        </div>
                        {ut.name.toLowerCase() !== "admin" && (
                          <div style={{ display: "flex", gap: "5px" }}>
                            <button style={styles.actionBtn} title="Edit Name" onClick={() => startEdit(ut)}>
                              <FaEdit color="#64748b" />
                            </button>
                            <button style={styles.actionBtn} title="Delete Role" onClick={() => deleteUserType(ut.id, ut.name)}>
                              <FaTrashAlt color="#ef4444" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                {allSubmodules.map(sub => {
                  const isChecked = matrix[ut.name]?.[`${sub.moduleId}_${sub.id}`] || false;
                  const isAdmin = ut.name.toLowerCase() === "admin";
                  
                  return (
                    <td key={`${ut.id}_${sub.moduleId}_${sub.id}`} style={styles.td}>
                      <input
                        type="checkbox"
                        checked={isAdmin ? true : isChecked}
                        disabled={isAdmin}
                        onChange={() => handleCheckboxChange(ut.name, sub.moduleId, sub.id)}
                        style={{
                          ...styles.checkbox,
                          opacity: isAdmin ? 0.4 : 1
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .spin { animation: spin 1.5s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        tr:hover td { background-color: #f8fafc !important; }
        .tbl-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .tbl-scroll::-webkit-scrollbar-track { background: #f1f5f9; }
        .tbl-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default UserSetting;