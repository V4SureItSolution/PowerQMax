import React, { useState, useEffect } from "react";
import {
  FaShoppingCart,
  FaMoneyBillWave,
  FaChartLine,
  FaSpinner,
  FaCalendarDay,
  FaCalendarWeek,
  FaCalendarAlt,
  FaReceipt,
  FaArrowRight,
  FaCreditCard,
  FaCheckCircle,
} from "react-icons/fa";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    billing: {
      today: { bills: 0, sales: 0, average: 0 },
      thisWeek: { bills: 0, sales: 0 },
      thisMonth: { bills: 0, sales: 0 },
      pendingItems: 0,
      totalPayments: 0,
    },
    paymentMethods: [],
    recentBills: [],
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch billing statistics (sales only)
      const billingStatsResponse = await axios.get(
        `${API_BASE_URL}/api/billing/statistics`
      );

      // 2. Fetch recent sales bills
      let recentBills = [];
      try {
        const billsResponse = await axios.get(
          `${API_BASE_URL}/api/billing/bills?page=1&per_page=6`
        );
        recentBills = billsResponse.data?.bills || [];
      } catch (e) {
        console.warn("Could not fetch recent bills:", e);
      }

      const billingStats = billingStatsResponse.data || {};

      // Calculate total payments from payment methods
      const totalPayments = (billingStats.paymentMethods || []).reduce(
        (sum, method) => sum + (method.total || 0),
        0
      );

      setStats({
        billing: {
          today: billingStats.today || { bills: 0, sales: 0, average: 0 },
          thisWeek: billingStats.thisWeek || { bills: 0, sales: 0 },
          thisMonth: billingStats.thisMonth || { bills: 0, sales: 0 },
          pendingItems: billingStats.pendingItems || 0,
          totalPayments: totalPayments,
        },
        paymentMethods: billingStats.paymentMethods || [],
        recentBills: recentBills,
      });
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to load sales data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-SG", {
      style: "currency",
      currency: "SGD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString("en-SG", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const styles = {
    container: {
      padding: "24px",
      backgroundColor: "#0f172a",
      minHeight: "100vh",
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      color: "#e2e8f0",
    },
    header: {
      marginBottom: "28px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "16px",
    },
    title: {
      margin: 0,
      color: "#ffffff",
      fontSize: "26px",
      fontWeight: "700",
      letterSpacing: "-0.5px",
    },
    subtitle: {
      color: "#94a3b8",
      marginTop: "4px",
      fontSize: "14px",
    },
    refreshButton: {
      backgroundColor: "#2563eb",
      color: "white",
      border: "none",
      padding: "10px 18px",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: "500",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      transition: "background-color 0.2s",
    },
    cards: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
      gap: "20px",
      marginBottom: "28px",
    },
    card: {
      backgroundColor: "#1e293b",
      padding: "22px",
      borderRadius: "14px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
      display: "flex",
      alignItems: "center",
      gap: "16px",
      border: "1px solid #334155",
      transition: "transform 0.2s, box-shadow 0.2s",
    },
    icon: {
      fontSize: "28px",
      padding: "12px",
      borderRadius: "12px",
      backgroundColor: "rgba(255,255,255,0.06)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    cardContent: {
      flex: 1,
    },
    cardLabel: {
      color: "#94a3b8",
      fontSize: "13px",
      fontWeight: "500",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      marginBottom: "4px",
    },
    cardValue: {
      color: "#ffffff",
      fontSize: "22px",
      fontWeight: "700",
      margin: 0,
    },
    cardSmallValue: {
      color: "#94a3b8",
      fontSize: "12px",
      marginTop: "4px",
    },
    grid2: {
      display: "grid",
      gridTemplateColumns: "2fr 1fr",
      gap: "24px",
      marginBottom: "24px",
    },
    tableContainer: {
      backgroundColor: "#1e293b",
      padding: "22px",
      borderRadius: "14px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
      border: "1px solid #334155",
    },
    tableHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "16px",
    },
    tableTitle: {
      fontSize: "17px",
      fontWeight: "600",
      color: "#ffffff",
      margin: 0,
      display: "flex",
      alignItems: "center",
      gap: "10px",
    },
    viewAllLink: {
      color: "#3b82f6",
      fontSize: "13px",
      cursor: "pointer",
      textDecoration: "none",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 14px",
      backgroundColor: "rgba(59, 130, 246, 0.12)",
      borderRadius: "20px",
      fontWeight: "500",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
    },
    th: {
      padding: "12px 14px",
      borderBottom: "1px solid #334155",
      textAlign: "left",
      color: "#94a3b8",
      fontWeight: "500",
      fontSize: "12px",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    td: {
      padding: "12px 14px",
      borderBottom: "1px solid #334155",
      textAlign: "left",
      fontSize: "14px",
    },
    statusBadge: {
      padding: "3px 10px",
      borderRadius: "12px",
      fontSize: "11px",
      fontWeight: "600",
      textTransform: "capitalize",
      display: "inline-block",
    },
    paidBadge: {
      backgroundColor: "rgba(16, 185, 129, 0.15)",
      color: "#10b981",
      border: "1px solid rgba(16, 185, 129, 0.3)",
    },
    pendingBadge: {
      backgroundColor: "rgba(245, 158, 11, 0.15)",
      color: "#f59e0b",
      border: "1px solid rgba(245, 158, 11, 0.3)",
    },
    partialBadge: {
      backgroundColor: "rgba(59, 130, 246, 0.15)",
      color: "#3b82f6",
      border: "1px solid rgba(59, 130, 246, 0.3)",
    },
    loadingContainer: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "400px",
      flexDirection: "column",
      gap: "16px",
    },
    errorContainer: {
      backgroundColor: "rgba(239, 68, 68, 0.15)",
      color: "#ef4444",
      padding: "14px 18px",
      borderRadius: "8px",
      marginBottom: "20px",
      border: "1px solid rgba(239, 68, 68, 0.3)",
      display: "flex",
      alignItems: "center",
      gap: "10px",
    },
    paymentGrid: {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      marginTop: "12px",
    },
    paymentCard: {
      backgroundColor: "#0f172a",
      padding: "14px 16px",
      borderRadius: "10px",
      border: "1px solid #334155",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    paymentMethod: {
      color: "#e2e8f0",
      fontSize: "14px",
      fontWeight: "500",
      textTransform: "capitalize",
      display: "flex",
      alignItems: "center",
      gap: "10px",
    },
    paymentAmount: {
      fontSize: "16px",
      fontWeight: "700",
      color: "#ffffff",
      textAlign: "right",
    },
    paymentCount: {
      color: "#94a3b8",
      fontSize: "11px",
      marginTop: "2px",
      textAlign: "right",
    },
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <FaSpinner style={{ fontSize: "36px", color: "#3b82f6" }} className="animate-spin" />
          <p style={{ color: "#94a3b8" }}>Loading sales dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Sales Dashboard</h2>
          <p style={styles.subtitle}>
            Overview of sales revenue and transactions (SGD $)
          </p>
        </div>
        <button style={styles.refreshButton} onClick={fetchDashboardData}>
          <FaChartLine /> Refresh Sales Data
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div style={styles.errorContainer}>
          <span>{error}</span>
        </div>
      )}

      {/* Top 4 Sales Cards */}
      <div style={styles.cards}>
        {/* Today's Sales */}
        <div style={styles.card}>
          <div style={{ ...styles.icon, color: "#3b82f6" }}>
            <FaCalendarDay />
          </div>
          <div style={styles.cardContent}>
            <div style={styles.cardLabel}>Today's Sales</div>
            <div style={styles.cardValue}>
              {formatCurrency(stats.billing.today.sales)}
            </div>
            <div style={styles.cardSmallValue}>
              {stats.billing.today.bills} bills · Avg: {formatCurrency(stats.billing.today.average)}
            </div>
          </div>
        </div>

        {/* This Week's Sales */}
        <div style={styles.card}>
          <div style={{ ...styles.icon, color: "#f59e0b" }}>
            <FaCalendarWeek />
          </div>
          <div style={styles.cardContent}>
            <div style={styles.cardLabel}>This Week's Sales</div>
            <div style={styles.cardValue}>
              {formatCurrency(stats.billing.thisWeek.sales)}
            </div>
            <div style={styles.cardSmallValue}>
              {stats.billing.thisWeek.bills} bills recorded this week
            </div>
          </div>
        </div>

        {/* This Month's Sales */}
        <div style={styles.card}>
          <div style={{ ...styles.icon, color: "#8b5cf6" }}>
            <FaCalendarAlt />
          </div>
          <div style={styles.cardContent}>
            <div style={styles.cardLabel}>This Month's Sales</div>
            <div style={styles.cardValue}>
              {formatCurrency(stats.billing.thisMonth.sales)}
            </div>
            <div style={styles.cardSmallValue}>
              {stats.billing.thisMonth.bills} bills recorded this month
            </div>
          </div>
        </div>

        {/* Total Payments / Revenue */}
        <div style={styles.card}>
          <div style={{ ...styles.icon, color: "#10b981" }}>
            <FaMoneyBillWave />
          </div>
          <div style={styles.cardContent}>
            <div style={styles.cardLabel}>Total Revenue Received</div>
            <div style={styles.cardValue}>
              {formatCurrency(stats.billing.totalPayments || 0)}
            </div>
            <div style={styles.cardSmallValue}>
              {stats.billing.pendingItems > 0
                ? `${stats.billing.pendingItems} items pending delivery`
                : "All payments & collections"}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Recent Sales & Payment Methods Breakdown */}
      <div style={styles.grid2}>
        {/* Recent Sales Transactions */}
        <div style={styles.tableContainer}>
          <div style={styles.tableHeader}>
            <h3 style={styles.tableTitle}>
              <FaReceipt color="#3b82f6" />
              Recent Sales & Service Bills
            </h3>
            <span
              style={styles.viewAllLink}
              onClick={() => navigate("/serviceBillView")}
            >
              View All Bills <FaArrowRight size={12} />
            </span>
          </div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Bill #</th>
                <th style={styles.th}>Customer</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Payment</th>
                <th style={styles.th}>Status</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Total (SGD)</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentBills.length > 0 ? (
                stats.recentBills.map((bill) => {
                  const status = (bill.paymentStatus || "pending").toLowerCase();
                  const badgeStyle =
                    status === "paid"
                      ? styles.paidBadge
                      : status === "partial"
                      ? styles.partialBadge
                      : styles.pendingBadge;

                  return (
                    <tr key={bill.id}>
                      <td style={styles.td}>
                        <span style={{ fontWeight: "600", color: "#38bdf8" }}>
                          {bill.billNumber}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={{ fontWeight: "500" }}>
                          {bill.customerName || "Walk-in Customer"}
                        </div>
                        {bill.customerPhone && (
                          <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                            {bill.customerPhone}
                          </div>
                        )}
                      </td>
                      <td style={styles.td}>
                        <span style={{ color: "#94a3b8", fontSize: "13px" }}>
                          {formatDate(bill.createdAt)}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={{ textTransform: "capitalize", color: "#cbd5e1" }}>
                          {bill.paymentMethod || "Cash"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={{ ...styles.statusBadge, ...badgeStyle }}>
                          {bill.paymentStatus || "Pending"}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        <span style={{ fontWeight: "700", color: "#ffffff" }}>
                          {formatCurrency(bill.total)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan="6"
                    style={{ ...styles.td, textAlign: "center", padding: "40px" }}
                  >
                    <FaShoppingCart
                      size={32}
                      style={{ opacity: 0.4, marginBottom: "12px", color: "#64748b" }}
                    />
                    <div style={{ color: "#94a3b8" }}>No recent sales bills found</div>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                      Create a new service bill to record sales
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Payment Methods Breakdown */}
        <div style={styles.tableContainer}>
          <div style={styles.tableHeader}>
            <h3 style={styles.tableTitle}>
              <FaCreditCard color="#10b981" />
              Payment Methods Breakdown
            </h3>
          </div>

          {(() => {
            const methodConfig = [
              { key: "cash", label: "Cash", color: "#10b981" },
              { key: "paynow", label: "PayNow", color: "#8b5cf6" },
              { key: "bank_transfer", label: "Bank Transfer", color: "#06b6d4" },
              { key: "card", label: "Card", color: "#3b82f6" },
            ];
            const dataMap = {};
            stats.paymentMethods.forEach((m) => {
              dataMap[m.method?.toLowerCase()] = m;
            });
            return (
              <div style={styles.paymentGrid}>
                {methodConfig.map((cfg) => {
                  const m = dataMap[cfg.key];
                  return (
                    <div key={cfg.key} style={styles.paymentCard}>
                      <div style={styles.paymentMethod}>
                        <span
                          style={{
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            backgroundColor: cfg.color,
                            display: "inline-block",
                          }}
                        />
                        <span>{cfg.label}</span>
                      </div>
                      <div>
                        <div style={styles.paymentAmount}>
                          {formatCurrency(m?.total || 0)}
                        </div>
                        <div style={styles.paymentCount}>
                          {m?.count || 0} {(m?.count || 0) === 1 ? "sale" : "sales"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Grand Total Card */}
          <div
            style={{
              marginTop: "20px",
              padding: "16px",
              backgroundColor: "#0f172a",
              borderRadius: "10px",
              border: "1px solid #334155",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ color: "#94a3b8", fontSize: "13px" }}>
                Total Revenue
              </span>
              <span
                style={{
                  fontSize: "18px",
                  fontWeight: "700",
                  color: "#10b981",
                }}
              >
                {formatCurrency(stats.billing.totalPayments || 0)}
              </span>
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "#64748b",
                marginTop: "4px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <FaCheckCircle size={10} color="#10b981" /> Cumulative sales collected
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
