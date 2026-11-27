// ServiceBillView.jsx - Dark Slate UI matching PowerQMax
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  FaReceipt,
  FaSearch,
  FaSyncAlt,
  FaEye,
  FaPrint,
  FaPaperclip,
  FaTimes,
  FaChevronDown,
  FaChevronRight,
  FaPlus,
  FaCheckCircle,
  FaClock,
  FaFileDownload,
  FaTrashAlt,
  FaEdit,
  FaSave,
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

const ServiceBillView = () => {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedRows, setExpandedRows] = useState({});

  // View Modal
  const [selectedBill, setSelectedBill] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Edit Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editBill, setEditBill] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  // Delete confirm
  const [deleteId, setDeleteId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    fetchBills();
  }, []);

  const fetchBills = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch service bills
      const res = await axios.get(`${API_BASE_URL}/api/service-bills?per_page=100`);
      let list = [];
      if (res.data?.bills && Array.isArray(res.data.bills)) {
        list = res.data.bills;
      } else if (Array.isArray(res.data)) {
        list = res.data;
      }
      setBills(list);
    } catch (err) {
      console.error("Error fetching service bills:", err);
      // Fallback: try standard bills
      try {
        const res2 = await axios.get(`${API_BASE_URL}/api/billing/bills?per_page=100`);
        setBills(res2.data?.bills || []);
      } catch (e) {
        setError("Failed to load service bills.");
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (billId) => {
    setExpandedRows((prev) => ({
      ...prev,
      [billId]: !prev[billId],
    }));
  };

  const handleViewBill = async (bill) => {
    let fullBill = { ...bill };
    try {
      const res = await axios.get(`${API_BASE_URL}/api/service-bills/${bill.id}`);
      if (res.data?.bill) {
        fullBill = {
          ...fullBill,
          ...res.data.bill,
          items: res.data.items || fullBill.items || []
        };
      } else if (res.data) {
        fullBill = {
          ...fullBill,
          ...res.data,
          items: res.data.items || fullBill.items || []
        };
      }
    } catch (err) {
      console.warn("Could not fetch detailed service bill, using available bill data:", err);
    }

    fullBill.billNumber = fullBill.billNumber || fullBill.bill_number || `PQM-SB-${fullBill.id}`;
    fullBill.createdAt = fullBill.createdAt || fullBill.created_at || fullBill.date;
    fullBill.paymentMethod = fullBill.paymentMethod || fullBill.payment_method || "Cash";
    fullBill.paymentStatus = fullBill.paymentStatus || fullBill.payment_status || "Paid";
    
    // Normalize item fields
    fullBill.items = (fullBill.items || []).map(it => ({
      ...it,
      serviceItem: it.serviceItem || it.serviceName || it.service_name || it.name || it.product_name || "Service Item",
      serviceDescription: it.serviceDescription || it.service_description || it.description || "",
      price: parseFloat(it.price || it.sell_price || 0),
      quantity: parseInt(it.quantity || 1, 10),
      total: parseFloat(it.total || ((it.price || it.sell_price || 0) * (it.quantity || 1)))
    }));

    const computedSubtotal = fullBill.items.reduce((sum, it) => sum + (it.price * it.quantity), 0);
    fullBill.subtotal = fullBill.subtotal !== undefined && fullBill.subtotal !== null ? parseFloat(fullBill.subtotal) : computedSubtotal;
    fullBill.discount = parseFloat(fullBill.discount || 0);
    fullBill.tax = parseFloat(fullBill.tax || 0);
    fullBill.total = fullBill.total !== undefined && fullBill.total !== null ? parseFloat(fullBill.total) : (fullBill.subtotal + fullBill.tax - fullBill.discount);

    setSelectedBill(fullBill);
    setShowModal(true);
  };

  const handlePrintServiceBill = async (bill) => {
    if (!bill) return;

    let targetBill = bill;
    let items = targetBill.items || [];

    // If items are not loaded, fetch full details from backend
    if (!items || items.length === 0) {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/service-bills/${bill.id}`);
        if (res.data?.bill) {
          targetBill = { ...targetBill, ...res.data.bill };
          items = res.data.items || [];
        } else if (res.data?.items) {
          items = res.data.items;
        }
      } catch (e) {
        console.warn("Could not fetch service bill items, proceeding with available data", e);
      }
    }

    const billNo = targetBill.billNumber || targetBill.bill_number || `PQM-SB-${targetBill.id}`;
    const billDate = formatDate(targetBill.createdAt || targetBill.created_at || targetBill.date);
    const paymentMode = (targetBill.paymentMethod || targetBill.payment_method || 'Cash').toUpperCase();
    const paymentStatus = (targetBill.paymentStatus || targetBill.payment_status || 'Paid').toUpperCase();
    const custName = targetBill.customerName || targetBill.customer_name || '';
    const compName = targetBill.companyName || targetBill.company_name || '';
    
    // Accurately compute subtotal from item rows
    const computedSubtotal = items.reduce((sum, it) => sum + (parseFloat(it.price || it.sell_price || 0) * (parseInt(it.quantity) || 1)), 0);
    const subtotal = (parseFloat(targetBill.subtotal) || computedSubtotal || 0).toFixed(2);
    const discount = parseFloat(targetBill.discount || 0).toFixed(2);
    const tax = parseFloat(targetBill.tax || 0).toFixed(2);
    
    // Mathematical total: Subtotal + Tax - Discount
    const total = Math.max(0, parseFloat(subtotal) + parseFloat(tax) - parseFloat(discount)).toFixed(2);

    let rowsHtml = '';
    items.forEach((item, idx) => {
      const sName = item.serviceName || item.service_name || item.product_name || item.name || 'Service';
      const sDesc = item.serviceDescription || item.service_description || item.description || '';
      const sQty = item.quantity || 1;
      const sPrice = parseFloat(item.price || item.sell_price || 0).toFixed(2);
      const sTotal = parseFloat(item.total || (sPrice * sQty)).toFixed(2);

      rowsHtml += `
        <tr style="background: ${idx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
          <td style="text-align: center; padding: 7px 8px; border: 1px solid #cbd5e1; color: #475569; font-weight: 600;">${idx + 1}</td>
          <td style="text-align: left; padding: 7px 10px; border: 1px solid #cbd5e1;">
            <div style="font-weight: 700; color: #0b2f6b; font-size: 9pt;">${sName}</div>
            ${sDesc ? `<div style="font-size: 7.8pt; color: #64748b; margin-top: 2px;">${sDesc}</div>` : ''}
          </td>
          <td style="text-align: center; padding: 7px 8px; border: 1px solid #cbd5e1; font-weight: 600; color: #334155;">${sQty}</td>
          <td style="text-align: right; padding: 7px 10px; border: 1px solid #cbd5e1; color: #334155;">$${sPrice}</td>
          <td style="text-align: right; padding: 7px 10px; border: 1px solid #cbd5e1; font-weight: 700; color: #0f172a;">$${sTotal}</td>
        </tr>
      `;
    });

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Service Bill - ${billNo}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm 15mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 8px; font-size: 9pt; }
          .header-box { text-align: center; margin-bottom: 12px; }
          .company-name { font-size: 15pt; font-weight: 900; color: #0b2f6b; letter-spacing: 0.8px; text-transform: uppercase; margin: 0 0 3px 0; }
          .company-tags { font-size: 8pt; color: #0284c7; font-weight: 700; letter-spacing: 0.3px; margin-bottom: 4px; }
          .company-info { font-size: 7.8pt; color: #475569; line-height: 1.35; }
          .accent-divider { height: 3px; background: linear-gradient(90deg, #0b2f6b 0%, #0284c7 50%, #38bdf8 100%); margin: 10px 0 14px 0; border-radius: 2px; }
          
          .title-banner { background: linear-gradient(135deg, #0b2f6b 0%, #1e40af 100%); color: #ffffff; padding: 8px 14px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; box-shadow: 0 2px 4px rgba(11,47,107,0.12); }
          .doc-title { font-size: 12pt; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin: 0; }
          .doc-badge { font-size: 7.5pt; font-weight: 700; background: rgba(255,255,255,0.22); border: 1px solid rgba(255,255,255,0.35); padding: 2px 8px; border-radius: 4px; text-transform: uppercase; }

          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
          .meta-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; font-size: 8.5pt; }
          .meta-row { display: flex; justify-content: space-between; padding: 3px 0; }
          .meta-lbl { color: #64748b; font-weight: 600; }
          .meta-val { font-weight: 700; color: #0f172a; }
          .status-paid { background: #dcfce7; color: #15803d; border: 1px solid #86efac; padding: 1px 7px; border-radius: 4px; font-weight: 800; font-size: 7.8pt; }
          .status-pending { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; padding: 1px 7px; border-radius: 4px; font-weight: 800; font-size: 7.8pt; }

          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; }
          .items-table th { background: linear-gradient(135deg, #0b2f6b 0%, #1e3a8a 100%); color: #ffffff; padding: 8px 10px; font-size: 8.2pt; text-transform: uppercase; letter-spacing: 0.5px; border: none; }
          
          .summary-wrapper { display: flex; justify-content: flex-end; margin-bottom: 20px; }
          .summary-card { width: 290px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
          .summary-row { display: flex; justify-content: space-between; padding: 6px 14px; font-size: 8.8pt; color: #475569; }
          .summary-row.discount { background: #fef2f2; color: #dc2626; font-weight: 600; }
          .summary-total { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #0b2f6b 0%, #1e3a8a 100%); color: #ffffff; padding: 9px 14px; font-size: 11pt; font-weight: 800; border-top: 2px solid #38bdf8; }

          .footer-box { border-top: 1px dashed #cbd5e1; padding-top: 14px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 8pt; color: #64748b; }
          .sign-area { text-align: center; width: 180px; }
          .sign-line { border-top: 1.5px solid #0b2f6b; margin-top: 36px; padding-top: 4px; font-weight: 700; color: #0b2f6b; }
        </style>
      </head>
      <body>
        <div class="accent-divider"></div>

        <div class="title-banner">
          <div class="doc-title">SERVICE BILL / RECEIPT</div>
          <div class="doc-badge">Official Record</div>
        </div>

        <div class="meta-grid">
          <div class="meta-card">
            <div class="meta-row">
              <span class="meta-lbl">Bill Number:</span>
              <span class="meta-val" style="color: #0284c7;">${billNo}</span>
            </div>
            <div class="meta-row">
              <span class="meta-lbl">Billing Date:</span>
              <span class="meta-val">${billDate}</span>
            </div>
            ${custName ? `<div class="meta-row"><span class="meta-lbl">Customer Name:</span><span class="meta-val">${custName}</span></div>` : ''}
          </div>
          <div class="meta-card">
            <div class="meta-row">
              <span class="meta-lbl">Payment Method:</span>
              <span class="meta-val">${paymentMode}</span>
            </div>
            <div class="meta-row">
              <span class="meta-lbl">Payment Status:</span>
              <span>
                <span class="${paymentStatus === 'PAID' ? 'status-paid' : 'status-pending'}">
                  ${paymentStatus === 'PAID' ? '&#10004; PAID IN FULL' : paymentStatus}
                </span>
              </span>
            </div>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 8%; text-align: center;">S.NO</th>
              <th style="width: 52%; text-align: left;">SERVICE DESCRIPTION</th>
              <th style="width: 10%; text-align: center;">QTY</th>
              <th style="width: 15%; text-align: right;">RATE (SGD)</th>
              <th style="width: 15%; text-align: right;">TOTAL (SGD)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="5" style="text-align: center; padding: 12px; color: #94a3b8;">No service items recorded</td></tr>'}
          </tbody>
        </table>

        <div class="summary-wrapper">
          <div class="summary-card">
            <div class="summary-row">
              <span>Subtotal:</span>
              <span>$${subtotal}</span>
            </div>
            ${parseFloat(discount) > 0 ? `
            <div class="summary-row discount">
              <span>Discount Applied:</span>
              <span>-$${discount}</span>
            </div>` : ''}
            ${parseFloat(tax) > 0 ? `
            <div class="summary-row">
              <span>GST / Tax:</span>
              <span>+$${tax}</span>
            </div>` : ''}
            <div class="summary-total">
              <span>TOTAL (SGD):</span>
              <span>$${total}</span>
            </div>
          </div>
        </div>

        <div class="footer-box">
          <div>
            <div style="font-weight: 600; color: #0b2f6b;">Thank you for your business!</div>
            <div style="margin-top: 2px;">PowerQ Max Engineering Pte Ltd &bull; Singapore</div>
          </div>
          <div class="sign-area">
            <div class="sign-line">Authorized Signature</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the service bill.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      await axios.delete(`${API_BASE_URL}/api/service-bills/${deleteId}`);
      setBills((prev) => prev.filter((b) => b.id !== deleteId));
      setSuccessMsg("Service bill deleted successfully.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setDeleteLoading(false);
      setDeleteId(null);
    }
  };

  const handleEditOpen = async (bill) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/service-bills/${bill.id}`);
      const data = res.data?.bill ? { ...res.data.bill, items: res.data.items || [] } : { ...bill };
      setEditBill({
        id: data.id,
        customerName: data.customerName || data.customer_name || "",
        customerPhone: data.customerPhone || data.customer_phone || "",
        customerEmail: data.customerEmail || data.customer_email || "",
        customerAddress: data.customerAddress || data.customer_address || "",
        paymentMethod: data.paymentMethod || data.payment_method || "Cash",
        paymentStatus: data.paymentStatus || data.payment_status || "Paid",
      });
      setShowEditModal(true);
    } catch {
      setEditBill({
        id: bill.id,
        customerName: bill.customerName || bill.customer_name || "",
        customerPhone: bill.customerPhone || bill.customer_phone || "",
        customerEmail: bill.customerEmail || bill.customer_email || "",
        customerAddress: bill.customerAddress || bill.customer_address || "",
        paymentMethod: bill.paymentMethod || bill.payment_method || "Cash",
        paymentStatus: bill.paymentStatus || bill.payment_status || "Paid",
      });
      setShowEditModal(true);
    }
  };

  const handleEditSave = async () => {
    if (editBill.customerPhone && editBill.customerPhone.length !== 10) {
      alert("Phone number must be exactly 10 digits.");
      return;
    }
    setEditLoading(true);
    try {
      await axios.put(`${API_BASE_URL}/api/service-bills/${editBill.id}`, editBill);
      setBills((prev) =>
        prev.map((b) =>
          b.id === editBill.id
            ? {
                ...b,
                customerName: editBill.customerName,
                customer_name: editBill.customerName,
                customerPhone: editBill.customerPhone,
                customerEmail: editBill.customerEmail,
                customerAddress: editBill.customerAddress,
                paymentMethod: editBill.paymentMethod,
                payment_method: editBill.paymentMethod,
                paymentStatus: editBill.paymentStatus,
                payment_status: editBill.paymentStatus,
              }
            : b
        )
      );
      setSuccessMsg("Service bill updated successfully.");
      setTimeout(() => setSuccessMsg(""), 3000);
      setShowEditModal(false);
    } catch (err) {
      console.error("Edit error:", err);
    } finally {
      setEditLoading(false);
    }
  };

  const filteredBills = bills.filter((b) => {
    const q = searchTerm.toLowerCase();
    const billNum = (b.billNumber || b.bill_number || `PQM-SB-${b.id}`).toLowerCase();
    const payMethod = (b.paymentMethod || b.payment_method || "").toLowerCase();
    const custName = (b.customerName || b.customer_name || "").toLowerCase();
    const compName = (b.companyName || b.company_name || "").toLowerCase();
    const matchesSearch = billNum.includes(q) || payMethod.includes(q) || custName.includes(q) || compName.includes(q);

    if (!matchesSearch) return false;

    if (statusFilter === "all") return true;
    const stat = (b.paymentStatus || b.payment_status || "").toLowerCase();
    if (statusFilter === "paid") return stat === "paid";
    if (statusFilter === "pending") return stat === "pending";
    if (statusFilter === "partial") return stat === "partial";

    return true;
  });

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
      const s = (status || "").toLowerCase();
      const isPaid = s === "paid";
      const isPending = s === "pending";
      return {
        padding: "3px 10px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: "600",
        textTransform: "capitalize",
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        backgroundColor: isPaid
          ? "rgba(16,185,129,0.15)"
          : isPending
          ? "rgba(245,158,11,0.15)"
          : "rgba(59,130,246,0.15)",
        color: isPaid ? "#10b981" : isPending ? "#f59e0b" : "#3b82f6",
        border: `1px solid ${
          isPaid
            ? "rgba(16,185,129,0.3)"
            : isPending
            ? "rgba(245,158,11,0.3)"
            : "rgba(59,130,246,0.3)"
        }`,
      };
    },
    btnAction: {
      backgroundColor: "#334155",
      color: "#ffffff",
      border: "none",
      padding: "6px 10px",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "12px",
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
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
    modalCard: {
      backgroundColor: "#1e293b",
      border: "1px solid #475569",
      borderRadius: "14px",
      width: "100%",
      maxWidth: "680px",
      maxHeight: "90vh",
      overflowY: "auto",
      padding: "24px",
      boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
    },
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header} className="no-print">
        <div>
          <h2 style={styles.title}>
            <FaReceipt color="#3b82f6" /> Service Bills History
          </h2>
          <p style={styles.subtitle}>
            Browse, inspect, and reprint all issued service bills and receipts (SGD $)
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={fetchBills}
            style={{
              ...styles.btnAction,
              padding: "8px 14px",
              backgroundColor: "#334155",
            }}
            title="Refresh list"
          >
            <FaSyncAlt /> Refresh
          </button>
          <button
            onClick={() => navigate("/service")}
            style={{
              ...styles.btnAction,
              padding: "8px 16px",
              backgroundColor: "#2563eb",
              fontWeight: "600",
            }}
          >
            <FaPlus /> Create Service Bill
          </button>
        </div>
      </div>

      {/* Controls */}
      <div style={styles.controlsRow} className="no-print">
        <div style={styles.searchBox}>
          <FaSearch color="#64748b" />
          <input
            type="text"
            placeholder="Search by bill #, payment method, status..."
            style={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={styles.filterTabs}>
          {["all", "paid", "pending", "partial"].map((st) => (
            <button
              key={st}
              style={styles.filterTab(statusFilter === st)}
              onClick={() => setStatusFilter(st)}
            >
              {st === "all" ? "All Bills" : st.charAt(0).toUpperCase() + st.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={styles.card} className="no-print">
        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "#94a3b8" }}>
            Loading service bills...
          </div>
        ) : filteredBills.length > 0 ? (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: "65px", textAlign: "center" }}>S.no</th>
                <th style={styles.th}>Bill.no</th>
                <th style={styles.th}>Customer / Company</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>payment Method</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Attachment</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Total (SGD)</th>
                <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map((b, index) => {
                const isExpanded = !!expandedRows[b.id];
                const items = b.items || [];

                return (
                  <React.Fragment key={b.id}>
                    <tr>
                      <td style={{ ...styles.td, textAlign: "center" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          {items.length > 0 && (
                            <button
                              onClick={() => toggleRow(b.id)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#94a3b8",
                                cursor: "pointer",
                                padding: "2px",
                              }}
                              title={isExpanded ? "Collapse" : "Expand"}
                            >
                              {isExpanded ? <FaChevronDown size={10} /> : <FaChevronRight size={10} />}
                            </button>
                          )}
                          <span style={{ fontWeight: "600", color: "#94a3b8" }}>{index + 1}</span>
                        </div>
                      </td>
                      <td style={styles.td}>
                        <span style={{ fontWeight: "600", color: "#38bdf8" }}>
                          {b.billNumber || b.bill_number || `PQM-SB-${b.id}`}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {(b.customerName || b.customer_name) && (
                          <div style={{ fontWeight: "500", color: "#e2e8f0" }}>{b.customerName || b.customer_name}</div>
                        )}
                        {(b.companyName || b.company_name) && (
                          <div style={{ fontSize: "11px", color: "#94a3b8" }}>{b.companyName || b.company_name}</div>
                        )}
                        {!(b.customerName || b.customer_name) && !(b.companyName || b.company_name) && (
                          <span style={{ color: "#64748b", fontSize: "12px" }}>—</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <span style={{ color: "#94a3b8" }}>{formatDate(b.createdAt || b.created_at)}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={{ textTransform: "capitalize", color: "#cbd5e1" }}>
                          {b.paymentMethod || b.payment_method || "Cash"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.badge(b.paymentStatus || b.payment_status)}>
                          {(b.paymentStatus || b.payment_status) === "paid" && <FaCheckCircle size={10} />}
                          {(b.paymentStatus || b.payment_status) === "pending" && <FaClock size={10} />}
                          {b.paymentStatus || b.payment_status || "Pending"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        {b.attachment ? (
                          <a
                            href={`${API_BASE_URL}${b.attachment}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: "#38bdf8",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "12px",
                              textDecoration: "none",
                            }}
                          >
                            <FaPaperclip size={11} /> View File
                          </a>
                        ) : (
                          <span style={{ color: "#64748b", fontSize: "11px" }}>None</span>
                        )}
                      </td>
                      <td style={{ ...styles.td, textAlign: "right", fontWeight: "700", color: "#ffffff" }}>
                        {formatSGD(b.total)}
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button
                            style={{ ...styles.btnAction, backgroundColor: "#2563eb" }}
                            onClick={() => handleViewBill(b)}
                            title="Inspect details"
                          >
                            <FaEye /> View
                          </button>
                          <button
                            style={{ ...styles.btnAction, backgroundColor: "#475569" }}
                            onClick={() => handlePrintServiceBill(b)}
                            title="Print Service Bill"
                          >
                            <FaPrint /> Print
                          </button>
                          <button
                            style={{ ...styles.btnAction, backgroundColor: "#d97706" }}
                            onClick={() => handleEditOpen(b)}
                            title="Edit Bill"
                          >
                            <FaEdit /> Edit
                          </button>
                          <button
                            style={{ ...styles.btnAction, backgroundColor: "#dc2626" }}
                            onClick={() => setDeleteId(b.id)}
                            title="Delete Bill"
                          >
                            <FaTrashAlt /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable itemized services row */}
                    {isExpanded && items.length > 0 && (
                      <tr style={{ backgroundColor: "#0f172a" }}>
                        <td colSpan="9" style={{ padding: "12px 24px" }}>
                          <div style={{ fontSize: "12px", fontWeight: "600", color: "#94a3b8", marginBottom: "8px" }}>
                            Itemized Services ({items.length}):
                          </div>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                            <thead>
                              <tr style={{ color: "#64748b", borderBottom: "1px solid #334155" }}>
                                <th style={{ textAlign: "left", padding: "4px 8px" }}>Service Item</th>
                                <th style={{ textAlign: "left", padding: "4px 8px" }}>Description</th>
                                <th style={{ textAlign: "center", padding: "4px 8px" }}>Qty</th>
                                <th style={{ textAlign: "right", padding: "4px 8px" }}>Price</th>
                                <th style={{ textAlign: "right", padding: "4px 8px" }}>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((it, idx) => (
                                <tr key={idx} style={{ borderBottom: "1px solid rgba(51, 65, 85, 0.4)" }}>
                                  <td style={{ padding: "6px 8px", color: "#e2e8f0", fontWeight: "500" }}>
                                    {it.serviceItem || it.serviceName || it.service_name || it.name || it.product_name || "Service Item"}
                                  </td>
                                  <td style={{ padding: "6px 8px", color: "#94a3b8" }}>
                                    {it.serviceDescription || it.service_description || it.description || "—"}
                                  </td>
                                  <td style={{ padding: "6px 8px", textAlign: "center", color: "#cbd5e1" }}>
                                    {it.quantity || 1}
                                  </td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: "#cbd5e1" }}>
                                    {formatSGD(it.price || it.sell_price)}
                                  </td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: "#ffffff", fontWeight: "600" }}>
                                    {formatSGD(it.total || (it.price || it.sell_price) * (it.quantity || 1))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "20px", marginTop: "10px", padding: "8px 14px", backgroundColor: "#1e293b", borderRadius: "6px", fontSize: "12px" }}>
                            <div>
                              <span style={{ color: "#94a3b8" }}>Items Subtotal: </span>
                              <span style={{ color: "#ffffff", fontWeight: "600" }}>
                                {formatSGD(b.subtotal !== undefined && b.subtotal !== null ? b.subtotal : items.reduce((s, it) => s + ((it.price || it.sell_price || 0) * (it.quantity || 1)), 0))}
                              </span>
                            </div>
                            {parseFloat(b.discount || 0) > 0 && (
                              <div>
                                <span style={{ color: "#f87171" }}>Discount: </span>
                                <span style={{ color: "#f87171", fontWeight: "600" }}>-{formatSGD(b.discount)}</span>
                              </div>
                            )}
                            {parseFloat(b.tax || 0) > 0 && (
                              <div>
                                <span style={{ color: "#94a3b8" }}>Tax / GST: </span>
                                <span style={{ color: "#ffffff", fontWeight: "600" }}>+{formatSGD(b.tax)}</span>
                              </div>
                            )}
                            <div>
                              <span style={{ color: "#38bdf8" }}>Total (SGD): </span>
                              <span style={{ color: "#38bdf8", fontWeight: "700" }}>{formatSGD(b.total)}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: "60px", textAlign: "center", color: "#94a3b8" }}>
            No service bills found matching your filter.
          </div>
        )}
      </div>

      {/* Success Message */}
      {successMsg && (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", backgroundColor: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399", padding: "12px 20px", borderRadius: "8px", zIndex: 9999, fontSize: "13px" }}>
          {successMsg}
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, maxWidth: "400px", textAlign: "center" }}>
            <FaTrashAlt size={32} color="#dc2626" style={{ marginBottom: "12px" }} />
            <h3 style={{ color: "#ffffff", margin: "0 0 8px" }}>Delete Service Bill?</h3>
            <p style={{ color: "#94a3b8", fontSize: "13px", marginBottom: "20px" }}>This action cannot be undone.</p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                style={{ ...styles.btnAction, backgroundColor: "#334155", padding: "8px 20px" }}
                onClick={() => setDeleteId(null)}
              >
                Cancel
              </button>
              <button
                style={{ ...styles.btnAction, backgroundColor: "#dc2626", padding: "8px 20px" }}
                onClick={handleDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editBill && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, maxWidth: "500px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
                <FaEdit color="#d97706" /> Edit Service Bill
              </h3>
              <button onClick={() => setShowEditModal(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "18px" }}>
                <FaTimes />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {[
                { label: "Customer Name", key: "customerName", type: "text" },
                { label: "Phone (10 digits)", key: "customerPhone", type: "text" },
                { label: "Email", key: "customerEmail", type: "email" },
                { label: "Address", key: "customerAddress", type: "text" },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>{label}</label>
                  <input
                    type={type}
                    style={{ width: "100%", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", padding: "8px 12px", color: "#ffffff", fontSize: "13px", outline: "none", boxSizing: "border-box" }}
                    value={editBill[key]}
                    onChange={(e) => {
                      if (key === "customerPhone") {
                        const val = e.target.value.replace(/\D/g, "");
                        if (val.length <= 10) setEditBill((prev) => ({ ...prev, [key]: val }));
                      } else {
                        setEditBill((prev) => ({ ...prev, [key]: e.target.value }));
                      }
                    }}
                  />
                </div>
              ))}
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>Payment Method</label>
                <select
                  style={{ width: "100%", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", padding: "8px 12px", color: "#ffffff", fontSize: "13px", outline: "none" }}
                  value={editBill.paymentMethod}
                  onChange={(e) => setEditBill((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                >
                  {["Cash", "PayNow", "Bank Transfer", "Card", "Cheque"].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>Payment Status</label>
                <select
                  style={{ width: "100%", backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: "8px", padding: "8px 12px", color: "#ffffff", fontSize: "13px", outline: "none" }}
                  value={editBill.paymentStatus}
                  onChange={(e) => setEditBill((prev) => ({ ...prev, paymentStatus: e.target.value }))}
                >
                  {["Paid", "Pending", "Partial"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: "20px", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button style={{ ...styles.btnAction, backgroundColor: "#334155", padding: "8px 18px" }} onClick={() => setShowEditModal(false)}>Cancel</button>
              <button style={{ ...styles.btnAction, backgroundColor: "#2563eb", padding: "8px 18px" }} onClick={handleEditSave} disabled={editLoading}>
                <FaSave /> {editLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Bill Modal */}
      {showModal && selectedBill && (
        <div style={styles.modalOverlay} className="no-print">
          <div style={styles.modalCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "17px", color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
                <FaReceipt color="#3b82f6" /> Service Bill: {selectedBill.billNumber || selectedBill.bill_number || `PQM-SB-${selectedBill.id}`}
              </h3>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => handlePrintServiceBill(selectedBill)}
                  style={{ ...styles.btnAction, backgroundColor: "#2563eb" }}
                >
                  <FaPrint /> Print Bill
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "18px" }}
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            {/* Bill Details */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", backgroundColor: "#0f172a", padding: "14px", borderRadius: "10px", border: "1px solid #334155", marginBottom: "16px", fontSize: "12px" }}>
              <div>
                <div><strong style={{ color: "#94a3b8" }}>Bill.no:</strong> {selectedBill.billNumber || selectedBill.bill_number || `PQM-SB-${selectedBill.id}`}</div>
                <div style={{ marginTop: "4px" }}><strong style={{ color: "#94a3b8" }}>Date:</strong> {formatDate(selectedBill.createdAt || selectedBill.created_at || selectedBill.date)}</div>
                {(selectedBill.customerName || selectedBill.customer_name) && (
                  <div style={{ marginTop: "4px" }}><strong style={{ color: "#94a3b8" }}>Customer:</strong> {selectedBill.customerName || selectedBill.customer_name}</div>
                )}
                {(selectedBill.companyName || selectedBill.company_name) && (
                  <div style={{ marginTop: "4px" }}><strong style={{ color: "#94a3b8" }}>Company:</strong> {selectedBill.companyName || selectedBill.company_name}</div>
                )}
              </div>
              <div>
                <div><strong style={{ color: "#94a3b8" }}>Payment Method:</strong> {selectedBill.paymentMethod || selectedBill.payment_method || "Cash"}</div>
                <div style={{ marginTop: "4px" }}><strong style={{ color: "#94a3b8" }}>Status:</strong> {selectedBill.paymentStatus || selectedBill.payment_status || "Paid"}</div>
                {selectedBill.attachment && (
                  <div style={{ marginTop: "6px" }}>
                    <a
                      href={`${API_BASE_URL}${selectedBill.attachment}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#38bdf8", display: "inline-flex", alignItems: "center", gap: "4px", textDecoration: "none" }}
                    >
                      <FaPaperclip /> Download Attached Bill
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Itemized Services Table */}
            <div style={{ border: "1px solid #334155", borderRadius: "8px", overflow: "hidden", marginBottom: "16px" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Service Item</th>
                    <th style={{ ...styles.th, textAlign: "center" }}>Qty</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Rate</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedBill.items || []).map((it, idx) => (
                    <tr key={idx}>
                      <td style={styles.td}>
                        <div style={{ fontWeight: "600", color: "#ffffff" }}>{it.serviceItem || it.serviceName || it.service_name || it.name || it.product_name || "Service Item"}</div>
                        {(it.serviceDescription || it.service_description || it.description) && (
                          <div style={{ fontSize: "11px", color: "#94a3b8" }}>{it.serviceDescription || it.service_description || it.description}</div>
                        )}
                      </td>
                      <td style={{ ...styles.td, textAlign: "center" }}>{it.quantity || 1}</td>
                      <td style={{ ...styles.td, textAlign: "right" }}>{formatSGD(it.price || it.sell_price)}</td>
                      <td style={{ ...styles.td, textAlign: "right", fontWeight: "600" }}>
                        {formatSGD(it.total || (it.price || it.sell_price) * (it.quantity || 1))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div style={{ backgroundColor: "#0f172a", padding: "14px", borderRadius: "8px", border: "1px solid #334155", fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", color: "#94a3b8" }}>
                <span>Subtotal:</span>
                <span>{formatSGD(selectedBill.subtotal !== undefined && selectedBill.subtotal !== null ? selectedBill.subtotal : (selectedBill.items || []).reduce((s, it) => s + ((it.price || it.sell_price || 0) * (it.quantity || 1)), 0))}</span>
              </div>
              {parseFloat(selectedBill.discount || 0) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", color: "#f87171" }}>
                  <span>Discount:</span>
                  <span>-{formatSGD(selectedBill.discount)}</span>
                </div>
              )}
              {parseFloat(selectedBill.tax || 0) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", color: "#94a3b8" }}>
                  <span>Tax / GST:</span>
                  <span>{formatSGD(selectedBill.tax)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid #334155", fontSize: "16px", fontWeight: "700", color: "#38bdf8" }}>
                <span>Grand Total (SGD):</span>
                <span>{formatSGD(selectedBill.total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceBillView;
