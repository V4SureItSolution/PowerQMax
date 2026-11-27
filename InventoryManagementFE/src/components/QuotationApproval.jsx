// QuotationApproval.jsx - Quotation Approval Module
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  FaClipboardCheck,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaSearch,
  FaSyncAlt,
  FaEye,
  FaPrint,
  FaFilter,
  FaTimes,
  FaUserCheck,
  FaBan,
  FaFileInvoiceDollar,
  FaTrashAlt,
} from "react-icons/fa";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const formatSGD = (amount) => {
  const num = parseFloat(amount) || 0;
  return `$${num.toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-SG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

const QuotationApproval = () => {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending"); // Default to pending approvals

  // Modals
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approverName, setApproverName] = useState("Manager");

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUserName = user.full_name || user.name || "Manager";

  useEffect(() => {
    setApproverName(currentUserName);
    fetchQuotations();
  }, []);

  const fetchQuotations = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API_BASE_URL}/api/quotation?per_page=100`);
      let list = [];
      if (res.data?.items && Array.isArray(res.data.items)) {
        list = res.data.items;
      } else if (Array.isArray(res.data)) {
        list = res.data;
      }
      setQuotations(list);
    } catch (err) {
      console.error("Error fetching quotations:", err);
      setError("Failed to load quotations for approval");
    } finally {
      setLoading(false);
    }
  };

  // Create Invoice from Approved Quotation
  const handleCreateInvoice = (q) => {
    navigate("/invoice", {
      state: {
        fromQuotation: true,
        prefill: {
          customerName: q.customerName || "",
          customerPhone: q.customerPhone || "",
          customerEmail: q.customerEmail || "",
          customerAddress: q.customerAddress || "",
          attn: q.attn || "",
          yourPoNo: q.quotationNumber || "",
          notes: q.notes || "",
          items: (q.items || []).map((it) => ({
            name: it.productName || it.name || "",
            price: parseFloat(it.price) || 0,
            quantity: parseInt(it.quantity) || 1,
            unit: it.unit || "nos",
            gst: parseFloat(it.gst) || 0,
          })),
        },
      },
    });
  };

  // Approve Quotation
  const handleApprove = async (q) => {
    if (!window.confirm(`Approve Quotation ${q.quotationNumber} for ${q.customerName}?`)) {
      return;
    }

    try {
      const res = await axios.post(`${API_BASE_URL}/api/quotation/${q.id}/approve`, {
        approvedBy: approverName,
      });

      if (res.data?.success) {
        setSuccess(`✅ Quotation ${q.quotationNumber} approved successfully!`);
        setTimeout(() => setSuccess(""), 3500);
        fetchQuotations();
        if (showDetailModal) setShowDetailModal(false);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to approve quotation");
      setTimeout(() => setError(""), 3500);
    }
  };

  // Open Reject Modal
  const openRejectModal = (q) => {
    setSelectedQuotation(q);
    setRejectionReason("");
    setShowRejectModal(true);
  };

  // Confirm Reject
  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!selectedQuotation) return;

    try {
      const res = await axios.post(`${API_BASE_URL}/api/quotation/${selectedQuotation.id}/reject`, {
        approvedBy: approverName,
        rejectionReason: rejectionReason.trim() || "Rejected by approver",
      });

      if (res.data?.success) {
        setSuccess(`Quotation ${selectedQuotation.quotationNumber} has been rejected.`);
        setTimeout(() => setSuccess(""), 3500);
        setShowRejectModal(false);
        if (showDetailModal) setShowDetailModal(false);
        fetchQuotations();
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to reject quotation");
      setTimeout(() => setError(""), 3500);
    }
  };

  // Delete Quotation
  const handleDeleteQuotation = async (q) => {
    if (!window.confirm(`Delete Quotation ${q.quotationNumber}? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/quotation/${q.id}`);
      setSuccess(`Quotation ${q.quotationNumber} deleted successfully.`);
      setTimeout(() => setSuccess(""), 3000);
      if (showDetailModal) setShowDetailModal(false);
      fetchQuotations();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete quotation");
      setTimeout(() => setError(""), 3000);
    }
  };

  // View Details
  const handleViewDetails = (q) => {
    setSelectedQuotation(q);
    setShowDetailModal(true);
  };

  // Filtered quotations
  const filteredList = quotations.filter((q) => {
    const s = searchTerm.toLowerCase();
    const matchesSearch =
      (q.quotationNumber && q.quotationNumber.toLowerCase().includes(s)) ||
      (q.customerName && q.customerName.toLowerCase().includes(s)) ||
      (q.customerPhone && q.customerPhone.toLowerCase().includes(s));

    if (!matchesSearch) return false;

    const approvalStatus = (q.approvalStatus || "pending").toLowerCase();
    if (statusFilter === "all") return true;
    if (statusFilter === "pending") return approvalStatus === "pending";
    if (statusFilter === "approved") return approvalStatus === "approved";
    if (statusFilter === "rejected") return approvalStatus === "rejected";

    return true;
  });

  // KPI Calculations
  const pendingList = quotations.filter((q) => (q.approvalStatus || "pending").toLowerCase() === "pending");
  const approvedList = quotations.filter((q) => (q.approvalStatus || "").toLowerCase() === "approved");
  const rejectedList = quotations.filter((q) => (q.approvalStatus || "").toLowerCase() === "rejected");
  const pendingTotalValue = pendingList.reduce((sum, q) => sum + (parseFloat(q.total) || 0), 0);

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
      marginBottom: "24px",
      flexWrap: "wrap",
      gap: "16px",
    },
    title: {
      fontSize: "24px",
      fontWeight: "700",
      color: "#ffffff",
      margin: 0,
      display: "flex",
      alignItems: "center",
      gap: "10px",
    },
    subtitle: {
      color: "#94a3b8",
      fontSize: "13px",
      marginTop: "4px",
    },
    kpiGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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
    kpiIcon: (color) => ({
      fontSize: "24px",
      padding: "12px",
      borderRadius: "10px",
      backgroundColor: "rgba(255, 255, 255, 0.05)",
      color: color,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }),
    controlsRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "14px",
      marginBottom: "20px",
      flexWrap: "wrap",
    },
    searchBox: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      backgroundColor: "#1e293b",
      padding: "8px 14px",
      borderRadius: "8px",
      border: "1px solid #334155",
      width: "320px",
      maxWidth: "100%",
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
      gap: "6px",
    },
    filterTab: (active) => ({
      padding: "6px 14px",
      borderRadius: "8px",
      border: active ? "1px solid #3b82f6" : "1px solid #334155",
      backgroundColor: active ? "#2563eb" : "#1e293b",
      color: active ? "#ffffff" : "#94a3b8",
      cursor: "pointer",
      fontSize: "12px",
      fontWeight: "500",
      transition: "all 0.15s",
    }),
    card: {
      backgroundColor: "#1e293b",
      border: "1px solid #334155",
      borderRadius: "12px",
      overflow: "hidden",
      boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      textAlign: "left",
      fontSize: "13px",
    },
    th: {
      padding: "12px 14px",
      backgroundColor: "#111827",
      color: "#94a3b8",
      fontSize: "11px",
      fontWeight: "600",
      textTransform: "uppercase",
      borderBottom: "1px solid #334155",
    },
    td: {
      padding: "12px 14px",
      borderBottom: "1px solid #334155",
      color: "#e2e8f0",
    },
    badge: (status) => {
      const s = (status || "pending").toLowerCase();
      const isApproved = s === "approved";
      const isRejected = s === "rejected";
      return {
        padding: "3px 10px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: "600",
        textTransform: "capitalize",
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        backgroundColor: isApproved
          ? "rgba(16,185,129,0.15)"
          : isRejected
          ? "rgba(239,68,68,0.15)"
          : "rgba(245,158,11,0.15)",
        color: isApproved ? "#10b981" : isRejected ? "#ef4444" : "#f59e0b",
        border: `1px solid ${
          isApproved
            ? "rgba(16,185,129,0.3)"
            : isRejected
            ? "rgba(239,68,68,0.3)"
            : "rgba(245,158,11,0.3)"
        }`,
      };
    },
    btnAction: {
      padding: "6px 12px",
      borderRadius: "6px",
      fontSize: "12px",
      fontWeight: "600",
      cursor: "pointer",
      border: "none",
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
    },
    modalOverlay: {
      position: "fixed",
      inset: 0,
      backgroundColor: "rgba(0,0,0,0.75)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: "16px",
    },
    modalCard: {
      backgroundColor: "#1e293b",
      border: "1px solid #475569",
      borderRadius: "14px",
      width: "100%",
      maxWidth: "700px",
      maxHeight: "90vh",
      overflowY: "auto",
      padding: "24px",
      boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
    },
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>
            <FaClipboardCheck color="#3b82f6" /> Quotation Approval Module
          </h2>
          <p style={styles.subtitle}>
            Review customer quotations, approve terms & pricing, or reject with notes
          </p>
        </div>
        <button
          onClick={fetchQuotations}
          style={{
            ...styles.btnAction,
            backgroundColor: "#334155",
            color: "#ffffff",
            padding: "8px 14px",
          }}
          title="Refresh List"
        >
          <FaSyncAlt /> Refresh
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div
          style={{
            backgroundColor: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#f87171",
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          style={{
            backgroundColor: "rgba(16,185,129,0.15)",
            border: "1px solid rgba(16,185,129,0.3)",
            color: "#34d399",
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "16px",
          }}
        >
          {success}
        </div>
      )}

      {/* KPI Cards */}
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <div style={styles.kpiIcon("#f59e0b")}>
            <FaClock />
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase" }}>
              Pending Approvals
            </div>
            <div style={{ fontSize: "22px", fontWeight: "700", color: "#f59e0b" }}>
              {pendingList.length}
            </div>
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>
              Value: {formatSGD(pendingTotalValue)}
            </div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiIcon("#10b981")}>
            <FaCheckCircle />
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase" }}>
              Approved Quotations
            </div>
            <div style={{ fontSize: "22px", fontWeight: "700", color: "#10b981" }}>
              {approvedList.length}
            </div>
            <div style={{ fontSize: "11px", color: "#10b981" }}>Ready for invoicing</div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiIcon("#ef4444")}>
            <FaBan />
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase" }}>
              Rejected
            </div>
            <div style={{ fontSize: "22px", fontWeight: "700", color: "#ef4444" }}>
              {rejectedList.length}
            </div>
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>Requires revision</div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiIcon("#3b82f6")}>
            <FaClipboardCheck />
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase" }}>
              Total Quotations
            </div>
            <div style={{ fontSize: "22px", fontWeight: "700", color: "#ffffff" }}>
              {quotations.length}
            </div>
            <div style={{ fontSize: "11px", color: "#94a3b8" }}>All time records</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div style={styles.controlsRow}>
        <div style={styles.searchBox}>
          <FaSearch color="#64748b" />
          <input
            type="text"
            placeholder="Search quotation #, customer, phone..."
            style={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={styles.filterTabs}>
          {[
            { id: "pending", label: `Pending (${pendingList.length})` },
            { id: "approved", label: `Approved (${approvedList.length})` },
            { id: "rejected", label: `Rejected (${rejectedList.length})` },
            { id: "all", label: "All Quotations" },
          ].map((tab) => (
            <button
              key={tab.id}
              style={styles.filterTab(statusFilter === tab.id)}
              onClick={() => setStatusFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quotations Table */}
      <div style={styles.card}>
        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#94a3b8" }}>
            Loading quotations...
          </div>
        ) : filteredList.length > 0 ? (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Quotation #</th>
                <th style={styles.th}>Customer</th>
                <th style={styles.th}>Date & Validity</th>
                <th style={styles.th}>Prepared By</th>
                <th style={styles.th}>Approval Status</th>
                <th style={styles.th}>Decision Info</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Total (SGD)</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Approval Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.map((q) => {
                const status = (q.approvalStatus || "pending").toLowerCase();
                const isPending = status === "pending";

                return (
                  <tr key={q.id}>
                    <td style={styles.td}>
                      <span style={{ fontWeight: "600", color: "#38bdf8" }}>
                        {q.quotationNumber}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={{ fontWeight: "600", color: "#ffffff" }}>{q.customerName}</div>
                      {q.customerPhone && (
                        <div style={{ fontSize: "11px", color: "#94a3b8" }}>{q.customerPhone}</div>
                      )}
                    </td>
                    <td style={styles.td}>
                      <div>{formatDate(q.quotationDate)}</div>
                      <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                        Valid: {formatDate(q.validUntil)}
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={{ color: "#cbd5e1" }}>{q.preparedBy || "Staff"}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.badge(q.approvalStatus)}>
                        {status === "approved" && <FaCheckCircle size={10} />}
                        {status === "rejected" && <FaTimesCircle size={10} />}
                        {status === "pending" && <FaClock size={10} />}
                        {q.approvalStatus || "Pending"}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {q.approvedBy && (
                        <div style={{ fontSize: "12px", color: "#cbd5e1" }}>
                          By: <strong>{q.approvedBy}</strong>
                        </div>
                      )}
                      {q.rejectionReason && (
                        <div style={{ fontSize: "11px", color: "#f87171", maxWidth: "160px" }}>
                          Reason: {q.rejectionReason}
                        </div>
                      )}
                      {!q.approvedBy && !q.rejectionReason && (
                        <span style={{ color: "#64748b", fontSize: "12px" }}>Awaiting Review</span>
                      )}
                    </td>
                    <td style={{ ...styles.td, textAlign: "right", fontWeight: "700", color: "#ffffff" }}>
                      {formatSGD(q.total)}
                    </td>
                    <td style={{ ...styles.td, textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <button
                          style={{ ...styles.btnAction, backgroundColor: "#334155", color: "#ffffff" }}
                          onClick={() => handleViewDetails(q)}
                          title="View Details"
                        >
                          <FaEye />
                        </button>

                        {isPending && (
                          <>
                            <button
                              style={{ ...styles.btnAction, backgroundColor: "#10b981", color: "#ffffff" }}
                              onClick={() => handleApprove(q)}
                              title="Approve this quotation"
                            >
                              <FaCheckCircle /> Approve
                            </button>
                            <button
                              style={{ ...styles.btnAction, backgroundColor: "#dc2626", color: "#ffffff" }}
                              onClick={() => openRejectModal(q)}
                              title="Reject this quotation"
                            >
                              <FaBan /> Reject
                            </button>
                          </>
                        )}

                        {status === "approved" && (
                          <button
                            style={{ ...styles.btnAction, backgroundColor: "#7c3aed", color: "#ffffff" }}
                            onClick={() => handleCreateInvoice(q)}
                            title="Create Invoice from this Quotation"
                          >
                            <FaFileInvoiceDollar /> Invoice
                          </button>
                        )}

                        <button
                          style={{ ...styles.btnAction, backgroundColor: "#dc2626", color: "#ffffff" }}
                          onClick={() => handleDeleteQuotation(q)}
                          title="Delete Quotation"
                        >
                          <FaTrashAlt /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: "60px", textAlign: "center", color: "#94a3b8" }}>
            No quotations found for this filter.
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && selectedQuotation && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, maxWidth: "480px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", color: "#f87171", display: "flex", alignItems: "center", gap: "8px" }}>
                <FaBan /> Reject Quotation: {selectedQuotation.quotationNumber}
              </h3>
              <button
                onClick={() => setShowRejectModal(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "18px" }}
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleConfirmReject}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "6px" }}>
                  Approver Name
                </label>
                <input
                  type="text"
                  style={{
                    width: "100%",
                    backgroundColor: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    color: "#ffffff",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "#cbd5e1", marginBottom: "6px" }}>
                  Reason for Rejection *
                </label>
                <textarea
                  required
                  placeholder="e.g. Price too low, customer requested revision, scope changed..."
                  style={{
                    width: "100%",
                    minHeight: "80px",
                    backgroundColor: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    color: "#ffffff",
                    fontSize: "13px",
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  style={{
                    backgroundColor: "#334155",
                    color: "#ffffff",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "13px",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    backgroundColor: "#dc2626",
                    color: "#ffffff",
                    border: "none",
                    padding: "8px 18px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: "600",
                  }}
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quotation Details Modal */}
      {showDetailModal && selectedQuotation && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "17px", color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
                <FaClipboardCheck color="#3b82f6" /> Quotation: {selectedQuotation.quotationNumber}
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "18px" }}
              >
                <FaTimes />
              </button>
            </div>

            {/* Meta summary */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", backgroundColor: "#0f172a", padding: "14px", borderRadius: "10px", border: "1px solid #334155", marginBottom: "16px", fontSize: "12px" }}>
              <div>
                <div><strong style={{ color: "#94a3b8" }}>Customer:</strong> {selectedQuotation.customerName}</div>
                {selectedQuotation.attn && <div style={{ marginTop: "4px" }}><strong style={{ color: "#94a3b8" }}>Attn:</strong> {selectedQuotation.attn}</div>}
                <div style={{ marginTop: "4px" }}><strong style={{ color: "#94a3b8" }}>Phone:</strong> {selectedQuotation.customerPhone}</div>
                {selectedQuotation.customerEmail && <div style={{ marginTop: "4px" }}><strong style={{ color: "#94a3b8" }}>Email:</strong> {selectedQuotation.customerEmail}</div>}
              </div>
              <div>
                <div><strong style={{ color: "#94a3b8" }}>Date:</strong> {formatDate(selectedQuotation.quotationDate)}</div>
                <div style={{ marginTop: "4px" }}><strong style={{ color: "#94a3b8" }}>Valid Until:</strong> {formatDate(selectedQuotation.validUntil)}</div>
                <div style={{ marginTop: "4px" }}><strong style={{ color: "#94a3b8" }}>Prepared By:</strong> {selectedQuotation.preparedBy || "Staff"}</div>
                <div style={{ marginTop: "4px" }}>
                  <strong style={{ color: "#94a3b8" }}>Approval Status:</strong>{" "}
                  <span style={styles.badge(selectedQuotation.approvalStatus)}>
                    {selectedQuotation.approvalStatus || "Pending"}
                  </span>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div style={{ border: "1px solid #334155", borderRadius: "8px", overflow: "hidden", marginBottom: "16px" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Item Description</th>
                    <th style={{ ...styles.th, textAlign: "center" }}>Qty</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Sell Price (SGD)</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedQuotation.items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td style={styles.td}>
                        <div style={{ fontWeight: "600", color: "#ffffff" }}>
                          {it.productName || it.name || "Item"}
                        </div>
                        {it.productModel && (
                          <div style={{ fontSize: "11px", color: "#94a3b8" }}>{it.productModel}</div>
                        )}
                      </td>
                      <td style={{ ...styles.td, textAlign: "center" }}>
                        {it.quantity} {it.unit || "nos"}
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        {formatSGD(it.price)}
                      </td>
                      <td style={{ ...styles.td, textAlign: "right", fontWeight: "600" }}>
                        {formatSGD(it.total || it.price * it.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div style={{ backgroundColor: "#0f172a", padding: "14px", borderRadius: "8px", border: "1px solid #334155", fontSize: "13px", marginBottom: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", color: "#94a3b8" }}>
                <span>Subtotal:</span>
                <span>{formatSGD(selectedQuotation.subtotal)}</span>
              </div>
              {selectedQuotation.discount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", color: "#f87171" }}>
                  <span>Discount ({selectedQuotation.discountType === "percentage" ? `${selectedQuotation.discountRate}%` : "Fixed"}):</span>
                  <span>-{formatSGD(selectedQuotation.discount)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid #334155", fontSize: "16px", fontWeight: "700", color: "#38bdf8" }}>
                <span>Total Amount:</span>
                <span>{formatSGD(selectedQuotation.total)}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                {selectedQuotation.rejectionReason && (
                  <span style={{ fontSize: "12px", color: "#f87171" }}>
                    Rejected reason: {selectedQuotation.rejectionReason}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                {(selectedQuotation.approvalStatus || "pending").toLowerCase() === "pending" && (
                  <>
                    <button
                      style={{ ...styles.btnAction, backgroundColor: "#10b981", color: "#fff", padding: "8px 16px" }}
                      onClick={() => handleApprove(selectedQuotation)}
                    >
                      <FaCheckCircle /> Approve
                    </button>
                    <button
                      style={{ ...styles.btnAction, backgroundColor: "#dc2626", color: "#fff", padding: "8px 16px" }}
                      onClick={() => openRejectModal(selectedQuotation)}
                    >
                      <FaBan /> Reject
                    </button>
                  </>
                )}
                {(selectedQuotation.approvalStatus || "").toLowerCase() === "approved" && (
                  <button
                    style={{ ...styles.btnAction, backgroundColor: "#7c3aed", color: "#fff", padding: "8px 16px" }}
                    onClick={() => handleCreateInvoice(selectedQuotation)}
                  >
                    <FaFileInvoiceDollar /> Create Invoice
                  </button>
                )}
                <button
                  style={{ ...styles.btnAction, backgroundColor: "#dc2626", color: "#fff", padding: "8px 16px" }}
                  onClick={() => handleDeleteQuotation(selectedQuotation)}
                >
                  <FaTrashAlt /> Delete
                </button>
                <button
                  style={{ ...styles.btnAction, backgroundColor: "#334155", color: "#fff", padding: "8px 16px" }}
                  onClick={() => setShowDetailModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotationApproval;
