import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import axios from "axios";
import { 
  FaUserCircle, 
  FaClock, 
  FaCalendarAlt, 
  FaCheckCircle, 
  FaTimesCircle,
  FaHistory,
  FaChartLine,
  FaSignInAlt,
  FaSignOutAlt
} from "react-icons/fa";

const Attendance = () => {
  const [loading, setLoading] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [toast, setToast] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [stats, setStats] = useState({ totalDays: 0, presentDays: 0, attendanceRate: 0 });

  // Get user info from localStorage
  const username = localStorage.getItem("username") || "Employee";
  const email = localStorage.getItem("email") || "";
  const token = localStorage.getItem("token");

  // Configure axios
  const api = axios.create({
    baseURL: "http://localhost:5000/api",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
  });

  useEffect(() => {
    fetchToday();
    fetchHistory();
  }, []);

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchToday = async () => {
    try {
      const res = await api.get("/attendance/today");
      setTodayAttendance(res.data);
    } catch (err) {
      console.error("Error fetching today's attendance:", err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get("/attendance/history");
      const attendances = res.data.attendances || [];
      setAttendanceHistory(attendances);
      
      // Calculate stats
      const totalDays = attendances.length;
      const presentDays = attendances.filter(a => a.status === 'present').length;
      const attendanceRate = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : 0;
      setStats({ totalDays, presentDays, attendanceRate });
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      const res = await api.post("/attendance/check-in", {});
      setTodayAttendance(res.data.data);
      showToast("✓ Checked in successfully!");
      fetchHistory();
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Failed to check in";
      showToast(errorMsg, true);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setLoading(true);
    try {
      const res = await api.put("/attendance/check-out", {});
      setTodayAttendance(res.data.data);
      showToast("✓ Checked out successfully!");
      fetchHistory();
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Failed to check out";
      showToast(errorMsg, true);
    } finally {
      setLoading(false);
    }
  };

  const isCheckedIn = !!todayAttendance?.check_in_time;
  const isCheckedOut = !!todayAttendance?.check_out_time;

  const formatTime = (time) => {
    if (!time) return "--:--";
    return format(new Date(time), "hh:mm a");
  };

  const getDuration = () => {
    if (!todayAttendance?.check_in_time) return null;
    const start = new Date(todayAttendance.check_in_time);
    const end = todayAttendance.check_out_time
      ? new Date(todayAttendance.check_out_time)
      : new Date();
    const hours = Math.floor((end - start) / 3600000);
    const minutes = Math.floor(((end - start) % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  // Dark theme styles matching UserTypeManager
  const styles = {
    container: {
      minHeight: "100vh",
      backgroundColor: "#0a0e27",
      padding: "40px 20px",
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif'
    },
    content: {
      maxWidth: "1200px",
      margin: "0 auto",
    },
    header: {
      marginBottom: "40px",
      textAlign: "center",
    },
    title: {
      fontSize: "28px",
      fontWeight: "600",
      color: "#ffffff",
      marginBottom: "12px",
      borderBottom: "2px solid #2a2f4a",
      display: "inline-block",
      paddingBottom: "10px",
    },
    subtitle: {
      fontSize: "14px",
      color: "#a0a5c0",
      marginTop: "12px",
    },
    statsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
      gap: "20px",
      marginBottom: "30px",
    },
    statCard: {
      background: "#1a1f3e",
      borderRadius: "12px",
      padding: "24px",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
      border: "1px solid #2a2f4a",
      transition: "transform 0.2s, box-shadow 0.2s",
      cursor: "pointer",
    },
    statIcon: {
      fontSize: "32px",
      marginBottom: "12px",
    },
    statValue: {
      fontSize: "32px",
      fontWeight: "700",
      color: "#ffffff",
      marginBottom: "8px",
    },
    statLabel: {
      fontSize: "14px",
      color: "#a0a5c0",
      fontWeight: "500",
    },
    userCard: {
      background: "#1a1f3e",
      borderRadius: "12px",
      padding: "24px",
      marginBottom: "30px",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
      border: "1px solid #2a2f4a",
    },
    userInfo: {
      display: "flex",
      alignItems: "center",
      gap: "20px",
      flexWrap: "wrap",
    },
    userAvatar: {
      width: "70px",
      height: "70px",
      borderRadius: "50%",
      background: "linear-gradient(135deg, #4c9aff 0%, #764ba2 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "white",
      fontSize: "28px",
      fontWeight: "600",
    },
    userDetails: {
      flex: 1,
    },
    userName: {
      fontSize: "24px",
      fontWeight: "700",
      color: "#ffffff",
      marginBottom: "4px",
    },
    userEmail: {
      fontSize: "14px",
      color: "#a0a5c0",
    },
    userMeta: {
      display: "flex",
      gap: "16px",
      marginTop: "8px",
      fontSize: "13px",
      color: "#6c72a0",
    },
    mainCard: {
      background: "#1a1f3e",
      borderRadius: "12px",
      padding: "40px",
      marginBottom: "30px",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
      border: "1px solid #2a2f4a",
      position: "relative",
      overflow: "hidden",
    },
    mainCardDecor: {
      position: "absolute",
      top: "-50%",
      right: "-10%",
      width: "300px",
      height: "300px",
      background: "linear-gradient(135deg, rgba(76,154,255,0.1) 0%, rgba(118,75,162,0.1) 100%)",
      borderRadius: "50%",
    },
    clockSection: {
      textAlign: "center",
      marginBottom: "40px",
      position: "relative",
      zIndex: 1,
    },
    currentTime: {
      fontSize: "56px",
      fontWeight: "700",
      color: "#ffffff",
      fontFamily: "monospace",
      marginBottom: "8px",
      letterSpacing: "2px",
    },
    currentDate: {
      fontSize: "16px",
      color: "#a0a5c0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
    },
    statusContainer: {
      display: "flex",
      justifyContent: "center",
      gap: "30px",
      marginBottom: "30px",
      flexWrap: "wrap",
    },
    statusBox: {
      textAlign: "center",
      padding: "20px",
      borderRadius: "12px",
      flex: 1,
      minWidth: "150px",
      border: "1px solid #2a2f4a",
    },
    statusBoxIn: {
      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
      color: "white",
    },
    statusBoxOut: {
      background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
      color: "white",
    },
    statusBoxLabel: {
      fontSize: "12px",
      textTransform: "uppercase",
      letterSpacing: "1px",
      marginBottom: "8px",
      opacity: 0.9,
    },
    statusBoxValue: {
      fontSize: "24px",
      fontWeight: "700",
    },
    durationCard: {
      background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
      padding: "24px",
      borderRadius: "12px",
      textAlign: "center",
      marginBottom: "30px",
    },
    durationLabel: {
      fontSize: "14px",
      color: "#92400e",
      marginBottom: "8px",
      fontWeight: "600",
    },
    durationValue: {
      fontSize: "36px",
      fontWeight: "800",
      color: "#92400e",
    },
    buttonGroup: {
      display: "flex",
      gap: "20px",
      justifyContent: "center",
    },
    button: {
      padding: "12px 28px",
      fontSize: "15px",
      fontWeight: "600",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      transition: "all 0.2s",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    checkInBtn: {
      background: "#10b981",
      color: "white",
    },
    checkOutBtn: {
      background: "#ef4444",
      color: "white",
    },
    disabledBtn: {
      background: "#2a2f4a",
      color: "#6c72a0",
      cursor: "not-allowed",
    },
    historySection: {
      background: "#1a1f3e",
      borderRadius: "12px",
      padding: "32px",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
      border: "1px solid #2a2f4a",
    },
    historyHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "24px",
      paddingBottom: "16px",
      borderBottom: "2px solid #2a2f4a",
    },
    historyTitle: {
      fontSize: "20px",
      fontWeight: "600",
      color: "#ffffff",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    historyCount: {
      fontSize: "13px",
      color: "#a0a5c0",
      background: "#0a0e27",
      padding: "4px 12px",
      borderRadius: "20px",
      fontWeight: "600",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
    },
    th: {
      textAlign: "left",
      padding: "12px 16px",
      fontSize: "12px",
      fontWeight: "600",
      color: "#a0a5c0",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      borderBottom: "1px solid #2a2f4a",
    },
    td: {
      padding: "14px 16px",
      fontSize: "14px",
      color: "#e0e5f0",
      borderBottom: "1px solid #2a2f4a",
    },
    statusBadge: {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      padding: "4px 12px",
      borderRadius: "20px",
      fontSize: "12px",
      fontWeight: "600",
    },
    emptyState: {
      textAlign: "center",
      padding: "60px",
      color: "#6c72a0",
    },
    toast: {
      position: "fixed",
      bottom: "24px",
      right: "24px",
      padding: "12px 20px",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: "500",
      zIndex: 1000,
      animation: "slideInRight 0.3s ease",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    },
    toastSuccess: {
      background: "#10b981",
      color: "white",
    },
    toastError: {
      background: "#ef4444",
      color: "white",
    },
  };

  return (
    <>
      <style>
        {`
          @keyframes slideInRight {
            from {
              opacity: 0;
              transform: translateX(100px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          
          button:hover:not(:disabled) {
            opacity: 0.85;
            transform: translateY(-1px);
          }
          
          button:active:not(:disabled) {
            transform: translateY(0);
          }
          
          .stat-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
          }
          
          tr:hover {
            background-color: #0f132e;
          }
          
          input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: #4c9aff;
            box-shadow: 0 0 0 2px rgba(76, 154, 255, 0.2);
          }
        `}
      </style>

      <div style={styles.container}>
        <div style={styles.content}>
          {/* Header */}
          <div style={styles.header}>
            <h1 style={styles.title}>Attendance Tracker</h1>
            <p style={styles.subtitle}>Track your daily attendance with ease</p>
          </div>

          {/* Stats Cards */}
          <div style={styles.statsGrid}>
            <div className="stat-card" style={styles.statCard}>
              <FaChartLine style={styles.statIcon} color="#4c9aff" />
              <div style={styles.statValue}>{stats.attendanceRate}%</div>
              <div style={styles.statLabel}>Attendance Rate</div>
            </div>
            <div className="stat-card" style={styles.statCard}>
              <FaCheckCircle style={styles.statIcon} color="#10b981" />
              <div style={styles.statValue}>{stats.presentDays}</div>
              <div style={styles.statLabel}>Days Present</div>
            </div>
            <div className="stat-card" style={styles.statCard}>
              <FaHistory style={styles.statIcon} color="#f59e0b" />
              <div style={styles.statValue}>{stats.totalDays}</div>
              <div style={styles.statLabel}>Total Days</div>
            </div>
          </div>

          {/* User Info Card */}
          <div style={styles.userCard}>
            <div style={styles.userInfo}>
              <div style={styles.userAvatar}>
                {username.charAt(0).toUpperCase()}
              </div>
              <div style={styles.userDetails}>
                <div style={styles.userName}>{username}</div>
                <div style={styles.userEmail}>{email}</div>
                <div style={styles.userMeta}>
                  <span>📧 Employee ID: {email.split('@')[0]}</span>
                  <span>📍 Office Location</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Attendance Card */}
          <div style={styles.mainCard}>
            <div style={styles.mainCardDecor}></div>
            
            <div style={styles.clockSection}>
              <div style={styles.currentTime}>
                {format(new Date(), "hh:mm:ss a")}
              </div>
              <div style={styles.currentDate}>
                <FaCalendarAlt />
                <span>{format(new Date(), "EEEE, MMMM d, yyyy")}</span>
              </div>
            </div>

            <div style={styles.statusContainer}>
              <div style={{...styles.statusBox, ...styles.statusBoxIn}}>
                <div style={styles.statusBoxLabel}>
                  <FaClock /> Check In
                </div>
                <div style={styles.statusBoxValue}>
                  {formatTime(todayAttendance?.check_in_time)}
                </div>
              </div>
              <div style={{...styles.statusBox, ...styles.statusBoxOut}}>
                <div style={styles.statusBoxLabel}>
                  <FaClock /> Check Out
                </div>
                <div style={styles.statusBoxValue}>
                  {formatTime(todayAttendance?.check_out_time)}
                </div>
              </div>
            </div>

            {isCheckedIn && (
              <div style={styles.durationCard}>
                <div style={styles.durationLabel}>Today's Duration</div>
                <div style={styles.durationValue}>
                  {getDuration() || "Calculating..."}
                </div>
              </div>
            )}

            <div style={styles.buttonGroup}>
              <button
                onClick={handleCheckIn}
                disabled={loading || isCheckedIn}
                style={{
                  ...styles.button,
                  ...styles.checkInBtn,
                  ...((loading || isCheckedIn) && styles.disabledBtn),
                }}
              >
                <FaSignInAlt /> {loading ? "Processing..." : "Check In"}
              </button>
              <button
                onClick={handleCheckOut}
                disabled={loading || !isCheckedIn || isCheckedOut}
                style={{
                  ...styles.button,
                  ...styles.checkOutBtn,
                  ...((loading || !isCheckedIn || isCheckedOut) && styles.disabledBtn),
                }}
              >
                <FaSignOutAlt /> {loading ? "Processing..." : "Check Out"}
              </button>
            </div>
          </div>

          {/* History Section */}
          <div style={styles.historySection}>
            <div style={styles.historyHeader}>
              <h3 style={styles.historyTitle}>
                <FaHistory /> Attendance History
              </h3>
              <span style={styles.historyCount}>
                {attendanceHistory.length} records
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Day</th>
                    <th style={styles.th}>Check In</th>
                    <th style={styles.th}>Check Out</th>
                    <th style={styles.th}>Duration</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceHistory.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={styles.emptyState}>
                        <FaHistory size={48} style={{ marginBottom: "16px", opacity: 0.5 }} />
                        <div>No attendance records yet</div>
                        <div style={{ fontSize: "13px", marginTop: "8px" }}>
                          Check in to start tracking
                        </div>
                      </td>
                    </tr>
                  ) : (
                    attendanceHistory.map((rec) => {
                      const status = rec.status === "present"
                        ? { bg: "#10b981", color: "white", icon: "✓", label: "Present" }
                        : rec.status === "late"
                        ? { bg: "#f59e0b", color: "white", icon: "⚠", label: "Late" }
                        : { bg: "#ef4444", color: "white", icon: "✗", label: "Absent" };

                      return (
                        <tr key={rec.id}>
                          <td style={styles.td}>
                            {format(new Date(rec.date), "MMM dd, yyyy")}
                          </td>
                          <td style={{...styles.td, color: "#a0a5c0"}}>
                            {format(new Date(rec.date), "EEE")}
                          </td>
                          <td style={styles.td}>
                            {rec.check_in_time ? format(new Date(rec.check_in_time), "hh:mm a") : "—"}
                          </td>
                          <td style={styles.td}>
                            {rec.check_out_time ? format(new Date(rec.check_out_time), "hh:mm a") : "—"}
                          </td>
                          <td style={styles.td}>
                            {rec.total_hours ? `${rec.total_hours}h` : "—"}
                          </td>
                          <td style={styles.td}>
                            <span
                              style={{
                                ...styles.statusBadge,
                                background: status.bg,
                                color: status.color,
                              }}
                            >
                              {status.icon} {status.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            ...styles.toast,
            ...(toast.isError ? styles.toastError : styles.toastSuccess),
          }}
        >
          {toast.msg}
        </div>
      )}
    </>
  );
};

export default Attendance;