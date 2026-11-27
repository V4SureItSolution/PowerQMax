import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  FaCalendarCheck,
  FaCalendarDay,
  FaChevronLeft,
  FaChevronRight,
  FaUserTimes,
  FaCheckCircle,
  FaClock,
  FaSearch,
  FaEdit,
  FaTimes,
  FaSpinner,
} from "react-icons/fa";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const Attendance = () => {
  const [loading, setLoading] = useState(true);
  const [rosterData, setRosterData] = useState({
    date: new Date().toISOString().split("T")[0],
    office_hours: "08:00 AM - 05:00 PM",
    total_employees: 0,
    present_count: 0,
    absent_count: 0,
    leave_count: 0,
    roster: [],
  });

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // Modal State for marking Absent / Leave / Overtime
  const [showModal, setShowModal] = useState(false);
  const [modalEmployee, setModalEmployee] = useState(null);
  const [modalStatus, setModalStatus] = useState("absent");
  const [modalNotes, setModalNotes] = useState("");
  const [modalOvertime, setModalOvertime] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const token = localStorage.getItem("token");
  const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
  });

  const showNotification = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    fetchDailyRoster(selectedDate);
  }, [selectedDate]);

  const fetchDailyRoster = async (date) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/attendance/daily-roster?date=${date}`);
      if (res.data?.success) {
        setRosterData(res.data);
      }
    } catch (err) {
      console.error("Error fetching daily roster:", err);
      showNotification("Failed to load attendance roster", true);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (days) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split("T")[0]);
  };

  const handleSetToday = () => {
    setSelectedDate(new Date().toISOString().split("T")[0]);
  };

  // Open modal to mark absent, leave, or log daily overtime
  const handleOpenMarkModal = (emp, defaultStatus = "absent") => {
    setModalEmployee(emp);
    setModalStatus(defaultStatus);
    setModalNotes(emp.notes || "");
    setModalOvertime(emp.daily_overtime || 0);
    setShowModal(true);
  };

  // Submit absent/leave/present status with daily overtime
  const handleSaveStatus = async (e) => {
    e.preventDefault();
    if (!modalEmployee) return;

    setSubmitting(true);
    try {
      const res = await api.post("/api/attendance/mark-status", {
        employee_id: modalEmployee.employee_id,
        date: selectedDate,
        status: modalStatus,
        notes: modalNotes,
        overtime_hours: parseFloat(modalOvertime) || 0,
      });

      if (res.data?.success) {
        showNotification(
          `${modalEmployee.employee_name} updated successfully`
        );
        setShowModal(false);
        fetchDailyRoster(selectedDate);
      }
    } catch (err) {
      console.error("Error marking status:", err);
      showNotification("Failed to update status", true);
    } finally {
      setSubmitting(false);
    }
  };

  // Quick reset to Present (preserving any recorded overtime)
  const handleQuickResetPresent = async (emp) => {
    try {
      const res = await api.post("/api/attendance/mark-status", {
        employee_id: emp.employee_id,
        date: selectedDate,
        status: "present",
        notes: "",
        overtime_hours: emp.daily_overtime || 0,
      });

      if (res.data?.success) {
        showNotification(`${emp.employee_name} marked as Present`);
        fetchDailyRoster(selectedDate);
      }
    } catch (err) {
      console.error("Error setting present:", err);
      showNotification("Failed to reset status", true);
    }
  };

  // Filtered employees
  const filteredRoster = (rosterData.roster || []).filter((emp) => {
    const matchesSearch =
      emp.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employee_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.department?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === "All") return true;
    if (statusFilter === "Present") return emp.status === "present";
    if (statusFilter === "Absent") return emp.status === "absent";
    if (statusFilter === "Leave")
      return emp.status === "leave" || emp.status === "half-day";

    return true;
  });

  const totalDayOT = (rosterData.roster || []).reduce(
    (sum, r) => sum + (parseFloat(r.daily_overtime) || 0),
    0
  );

  const formattedDisplayDate = new Date(selectedDate).toLocaleDateString(
    "en-SG",
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );

  const isToday =
    selectedDate === new Date().toISOString().split("T")[0];

  const styles = {
    container: {
      padding: "24px",
      backgroundColor: "#0f172a",
      minHeight: "100vh",
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      color: "#e2e8f0",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "16px",
      marginBottom: "24px",
    },
    title: {
      fontSize: "26px",
      fontWeight: "700",
      color: "#ffffff",
      margin: 0,
      display: "flex",
      alignItems: "center",
      gap: "10px",
    },
    subtitle: {
      color: "#94a3b8",
      fontSize: "14px",
      marginTop: "4px",
    },
    dateToolbar: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      backgroundColor: "#1e293b",
      padding: "6px 10px",
      borderRadius: "10px",
      border: "1px solid #334155",
    },
    dateButton: {
      backgroundColor: "#334155",
      color: "#ffffff",
      border: "none",
      padding: "8px 12px",
      borderRadius: "6px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      fontSize: "13px",
      fontWeight: "500",
    },
    dateInput: {
      backgroundColor: "#0f172a",
      color: "#ffffff",
      border: "1px solid #475569",
      padding: "8px 12px",
      borderRadius: "6px",
      fontSize: "13px",
      outline: "none",
      cursor: "pointer",
    },
    officeBadge: {
      backgroundColor: "rgba(59, 130, 246, 0.12)",
      color: "#60a5fa",
      border: "1px solid rgba(59, 130, 246, 0.3)",
      padding: "6px 14px",
      borderRadius: "20px",
      fontSize: "13px",
      fontWeight: "500",
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
    },
    noticeCard: {
      backgroundColor: "rgba(30, 41, 59, 0.8)",
      border: "1px solid #334155",
      borderRadius: "12px",
      padding: "14px 18px",
      marginBottom: "24px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      fontSize: "13px",
      color: "#94a3b8",
    },
    kpiGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: "16px",
      marginBottom: "24px",
    },
    kpiCard: {
      backgroundColor: "#1e293b",
      borderRadius: "12px",
      padding: "18px 20px",
      border: "1px solid #334155",
      display: "flex",
      alignItems: "center",
      gap: "16px",
    },
    kpiIcon: {
      fontSize: "24px",
      padding: "12px",
      borderRadius: "10px",
      backgroundColor: "rgba(255, 255, 255, 0.05)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    kpiValue: {
      fontSize: "24px",
      fontWeight: "700",
      color: "#ffffff",
      margin: 0,
    },
    kpiLabel: {
      fontSize: "12px",
      color: "#94a3b8",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      fontWeight: "500",
    },
    controlsRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "16px",
      flexWrap: "wrap",
      marginBottom: "20px",
    },
    searchBox: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      backgroundColor: "#1e293b",
      padding: "8px 14px",
      borderRadius: "8px",
      border: "1px solid #334155",
      flex: 1,
      maxWidth: "350px",
    },
    searchInput: {
      background: "transparent",
      border: "none",
      color: "#ffffff",
      fontSize: "13px",
      outline: "none",
      width: "100%",
    },
    filterTabs: {
      display: "flex",
      gap: "8px",
    },
    filterTab: (active) => ({
      padding: "8px 16px",
      borderRadius: "8px",
      border: active ? "1px solid #3b82f6" : "1px solid #334155",
      backgroundColor: active ? "#2563eb" : "#1e293b",
      color: active ? "#ffffff" : "#94a3b8",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: "500",
      transition: "all 0.2s",
    }),
    tableContainer: {
      backgroundColor: "#1e293b",
      borderRadius: "14px",
      border: "1px solid #334155",
      overflow: "hidden",
      boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      textAlign: "left",
    },
    th: {
      padding: "14px 18px",
      backgroundColor: "#1e293b",
      color: "#94a3b8",
      fontSize: "12px",
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      borderBottom: "1px solid #334155",
    },
    td: {
      padding: "14px 18px",
      borderBottom: "1px solid #334155",
      fontSize: "13px",
    },
    badge: {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "4px 10px",
      borderRadius: "14px",
      fontSize: "12px",
      fontWeight: "600",
      textTransform: "capitalize",
    },
    badgePresent: {
      backgroundColor: "rgba(16, 185, 129, 0.15)",
      color: "#10b981",
      border: "1px solid rgba(16, 185, 129, 0.3)",
    },
    badgeAbsent: {
      backgroundColor: "rgba(239, 68, 68, 0.15)",
      color: "#ef4444",
      border: "1px solid rgba(239, 68, 68, 0.3)",
    },
    badgeLeave: {
      backgroundColor: "rgba(245, 158, 11, 0.15)",
      color: "#f59e0b",
      border: "1px solid rgba(245, 158, 11, 0.3)",
    },
    actionBtn: {
      padding: "6px 12px",
      borderRadius: "6px",
      fontSize: "12px",
      fontWeight: "500",
      cursor: "pointer",
      border: "none",
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      transition: "opacity 0.2s",
    },
    btnAbsent: {
      backgroundColor: "rgba(239, 68, 68, 0.2)",
      color: "#f87171",
      border: "1px solid rgba(239, 68, 68, 0.4)",
    },
    btnLeave: {
      backgroundColor: "rgba(245, 158, 11, 0.2)",
      color: "#fbbf24",
      border: "1px solid rgba(245, 158, 11, 0.4)",
    },
    btnPresent: {
      backgroundColor: "rgba(16, 185, 129, 0.2)",
      color: "#34d399",
      border: "1px solid rgba(16, 185, 129, 0.4)",
    },
    modalOverlay: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.75)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: "16px",
    },
    modalContent: {
      backgroundColor: "#1e293b",
      borderRadius: "14px",
      border: "1px solid #475569",
      width: "100%",
      maxWidth: "460px",
      padding: "24px",
      boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
    },
    formGroup: {
      marginBottom: "16px",
    },
    label: {
      display: "block",
      fontSize: "13px",
      fontWeight: "500",
      color: "#cbd5e1",
      marginBottom: "6px",
    },
    input: {
      width: "100%",
      backgroundColor: "#0f172a",
      border: "1px solid #334155",
      borderRadius: "8px",
      padding: "10px 12px",
      color: "#ffffff",
      fontSize: "13px",
      outline: "none",
      boxSizing: "border-box",
    },
  };

  return (
    <div style={styles.container}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            padding: "12px 20px",
            borderRadius: "8px",
            backgroundColor: toast.isError ? "#ef4444" : "#10b981",
            color: "#ffffff",
            fontWeight: "500",
            zIndex: 10000,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>
            <FaCalendarCheck color="#3b82f6" />
            Staff Attendance
          </h2>
          <p style={styles.subtitle}>{formattedDisplayDate}</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {rosterData.is_sunday ? (
            <div
              style={{
                ...styles.officeBadge,
                backgroundColor: "rgba(245, 158, 11, 0.15)",
                color: "#fbbf24",
                border: "1px solid rgba(245, 158, 11, 0.4)",
              }}
            >
              ⚡ Sunday (2.0x Pay Multiplier)
            </div>
          ) : (
            <div style={styles.officeBadge}>
              <FaClock /> Office Time: 8:00 AM – 5:00 PM (1.5x OT)
            </div>
          )}

          {/* Date Selector Toolbar */}
          <div style={styles.dateToolbar}>
            <button
              style={styles.dateButton}
              onClick={() => handleDateChange(-1)}
              title="Previous Day"
            >
              <FaChevronLeft size={12} />
            </button>
            <input
              type="date"
              style={styles.dateInput}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            <button
              style={styles.dateButton}
              onClick={() => handleDateChange(1)}
              title="Next Day"
            >
              <FaChevronRight size={12} />
            </button>
            {!isToday && (
              <button
                style={{ ...styles.dateButton, backgroundColor: "#2563eb" }}
                onClick={handleSetToday}
              >
                Today
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <div style={{ ...styles.kpiIcon, color: "#3b82f6" }}>
            <FaCalendarDay />
          </div>
          <div>
            <div style={styles.kpiLabel}>Total Employees</div>
            <div style={styles.kpiValue}>{rosterData.total_employees}</div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={{ ...styles.kpiIcon, color: "#10b981" }}>
            <FaCheckCircle />
          </div>
          <div>
            <div style={styles.kpiLabel}>Present Today</div>
            <div style={{ ...styles.kpiValue, color: "#10b981" }}>
              {rosterData.present_count}
            </div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={{ ...styles.kpiIcon, color: "#ef4444" }}>
            <FaUserTimes />
          </div>
          <div>
            <div style={styles.kpiLabel}>Absent</div>
            <div style={{ ...styles.kpiValue, color: "#ef4444" }}>
              {rosterData.absent_count}
            </div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={{ ...styles.kpiIcon, color: "#f59e0b" }}>
            <FaClock />
          </div>
          <div>
            <div style={styles.kpiLabel}>On Leave</div>
            <div style={{ ...styles.kpiValue, color: "#f59e0b" }}>
              {rosterData.leave_count}
            </div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={{ ...styles.kpiIcon, color: "#a855f7" }}>
            <FaClock />
          </div>
          <div>
            <div style={styles.kpiLabel}>Daily OT Logged</div>
            <div style={{ ...styles.kpiValue, color: "#c084fc" }}>
              {totalDayOT.toFixed(1)} hrs
            </div>
          </div>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div style={styles.controlsRow}>
        <div style={styles.searchBox}>
          <FaSearch color="#64748b" />
          <input
            type="text"
            placeholder="Search employee by name, code, dept..."
            style={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={styles.filterTabs}>
          {["All", "Present", "Absent", "Leave"].map((tab) => (
            <button
              key={tab}
              style={styles.filterTab(statusFilter === tab)}
              onClick={() => setStatusFilter(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Roster Table */}
      <div style={styles.tableContainer}>
        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#94a3b8" }}>
            <FaSpinner size={32} className="animate-spin" color="#3b82f6" />
            <div style={{ marginTop: "12px" }}>Loading attendance roster...</div>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Employee</th>
                <th style={styles.th}>Department</th>
                <th style={styles.th}>Designation</th>
                <th style={styles.th}>Office Hours</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Daily Overtime</th>
                <th style={styles.th}>Reason / Notes</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Attendance Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoster.length > 0 ? (
                filteredRoster.map((emp) => {
                  const isPresent = emp.status === "present";
                  const isAbsent = emp.status === "absent";
                  const isLeave = emp.status === "leave" || emp.status === "half-day";

                  const badgeStyle = isPresent
                    ? styles.badgePresent
                    : isAbsent
                    ? styles.badgeAbsent
                    : styles.badgeLeave;

                  return (
                    <tr key={emp.employee_id}>
                      <td style={styles.td}>
                        <div style={{ fontWeight: "600", color: "#ffffff" }}>
                          {emp.employee_name}
                        </div>
                        <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                          {emp.employee_code}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <span style={{ color: "#cbd5e1" }}>
                          {emp.department || "General"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={{ color: "#94a3b8" }}>
                          {emp.designation || "Staff"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={{ color: "#94a3b8", fontSize: "12px" }}>
                          8:00 AM – 5:00 PM (8h)
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={{ ...styles.badge, ...badgeStyle }}>
                          {isPresent && <FaCheckCircle size={11} />}
                          {isAbsent && <FaUserTimes size={11} />}
                          {isLeave && <FaClock size={11} />}
                          {emp.status}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {emp.daily_overtime > 0 ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "3px 9px",
                              borderRadius: "12px",
                              fontSize: "12px",
                              fontWeight: "600",
                              backgroundColor: emp.is_sunday
                                ? "rgba(245, 158, 11, 0.18)"
                                : "rgba(59, 130, 246, 0.18)",
                              color: emp.is_sunday ? "#fbbf24" : "#60a5fa",
                              border: `1px solid ${
                                emp.is_sunday
                                  ? "rgba(245, 158, 11, 0.4)"
                                  : "rgba(59, 130, 246, 0.4)"
                              }`,
                            }}
                          >
                            <FaClock size={10} />
                            +{emp.daily_overtime}h ({emp.is_sunday ? "2.0x Sun" : "1.5x OT"})
                          </span>
                        ) : (
                          <span style={{ color: "#64748b", fontSize: "12px" }}>0 hrs</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <span style={{ color: emp.notes ? "#fbbf24" : "#64748b" }}>
                          {emp.notes || "—"}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            gap: "8px",
                            justifyContent: "flex-end",
                          }}
                        >
                          {isPresent ? (
                            <>
                              <button
                                style={{
                                  ...styles.actionBtn,
                                  backgroundColor: "rgba(59, 130, 246, 0.15)",
                                  color: "#60a5fa",
                                  border: "1px solid rgba(59, 130, 246, 0.35)",
                                }}
                                onClick={() => handleOpenMarkModal(emp, "present")}
                                title="Log Overtime or edit details"
                              >
                                <FaClock /> Log Daily OT
                              </button>
                              <button
                                style={{ ...styles.actionBtn, ...styles.btnAbsent }}
                                onClick={() => handleOpenMarkModal(emp, "absent")}
                                title="Mark this employee as Absent"
                              >
                                <FaUserTimes /> Absent
                              </button>
                              <button
                                style={{ ...styles.actionBtn, ...styles.btnLeave }}
                                onClick={() => handleOpenMarkModal(emp, "leave")}
                                title="Mark this employee as On Leave"
                              >
                                <FaClock /> Leave
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                style={{ ...styles.actionBtn, ...styles.btnPresent }}
                                onClick={() => handleQuickResetPresent(emp)}
                                title="Restore to default Present"
                              >
                                <FaCheckCircle /> Set Present
                              </button>
                              <button
                                style={{
                                  ...styles.actionBtn,
                                  backgroundColor: "#334155",
                                  color: "#ffffff",
                                }}
                                onClick={() =>
                                  handleOpenMarkModal(emp, emp.status)
                                }
                                title="Edit reason/status/overtime"
                              >
                                <FaEdit /> Edit
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan="8"
                    style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}
                  >
                    No employee records match the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal for Marking Absent / On Leave */}
      {showModal && modalEmployee && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "18px", color: "#ffffff" }}>
                Update Attendance: {modalEmployee.employee_name}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: "18px",
                }}
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveStatus}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  readOnly
                  disabled
                  style={{ ...styles.input, opacity: 0.7 }}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Attendance Status</label>
                <select
                  style={styles.input}
                  value={modalStatus}
                  onChange={(e) => setModalStatus(e.target.value)}
                >
                  <option value="present">Present (Standard 8am - 5pm)</option>
                  <option value="absent">Absent</option>
                  <option value="leave">On Leave (Full Day)</option>
                  <option value="half-day">Half Day Leave</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "6px",
                  }}
                >
                  <label style={styles.label}>Daily Overtime (Hours)</label>
                  <span
                    style={{
                      fontSize: "11px",
                      color: rosterData.is_sunday ? "#fbbf24" : "#60a5fa",
                      fontWeight: "600",
                    }}
                  >
                    {rosterData.is_sunday
                      ? "⚡ Sunday Rate: 2.0x Multiplier"
                      : "⏱️ Standard OT: 1.5x Multiplier"}
                  </span>
                </div>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  placeholder="0.0"
                  style={styles.input}
                  value={modalOvertime}
                  onChange={(e) => setModalOvertime(e.target.value)}
                />
                <div
                  style={{
                    fontSize: "11px",
                    color: "#94a3b8",
                    marginTop: "4px",
                  }}
                >
                  {rosterData.is_sunday
                    ? "Sunday hours are compensated at 2.0x hourly rate."
                    : "Office hours are 8:00 AM – 5:00 PM. Work hours beyond 5:00 PM are compensated at 1.5x hourly rate."}
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Reason / Remarks</label>
                <textarea
                  style={{ ...styles.input, minHeight: "80px", resize: "vertical" }}
                  placeholder="e.g. Medical Leave (MC), Annual Leave, Urgent Personal Matter..."
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "24px",
                }}
              >
                <button
                  type="button"
                  style={{
                    backgroundColor: "#334155",
                    color: "#ffffff",
                    border: "none",
                    padding: "10px 18px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    backgroundColor:
                      modalStatus === "absent"
                        ? "#dc2626"
                        : modalStatus === "present"
                        ? "#10b981"
                        : "#f59e0b",
                    color: "#ffffff",
                    border: "none",
                    padding: "10px 20px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: "600",
                  }}
                >
                  {submitting ? "Saving..." : `Confirm ${modalStatus}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
