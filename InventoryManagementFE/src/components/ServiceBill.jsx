// ServiceBill.jsx - Dark Mode UI matching PowerQMax
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  FaWrench,
  FaReceipt,
  FaPlus,
  FaTrashAlt,
  FaPrint,
  FaPaperclip,
  FaTimes,
  FaArrowLeft,
  FaSave,
  FaCheckCircle,
  FaCreditCard,
  FaMoneyBillWave,
  FaSpinner,
} from "react-icons/fa";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const formatSGD = (amount) => {
  const num = parseFloat(amount) || 0;
  return `$${num.toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const ServiceBill = () => {
  const navigate = useNavigate();

  // State management
  const [manualServices, setManualServices] = useState([]);

  // New service entry form
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDescription, setNewServiceDescription] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newServiceGST, setNewServiceGST] = useState("9");
  const [newServiceCategory, setNewServiceCategory] = useState("General");

  // Bill info
  const [billNumber, setBillNumber] = useState("");
  const [currentDate, setCurrentDate] = useState("");

  // Customer info
  const [customerName, setCustomerName] = useState("Walk-in Customer");
  const [companyName, setCompanyName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerCategory, setCustomerCategory] = useState("Regular");

  // Payment
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentStatus, setPaymentStatus] = useState("Paid");

  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savedBillId, setSavedBillId] = useState(null);

  // Attachment states
  const [billAttachment, setBillAttachment] = useState("");
  const [attachmentFileName, setAttachmentFileName] = useState("");
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef(null);

  const serviceCategories = [
    "General",
    "Repair",
    "Maintenance",
    "Installation",
    "Wiring & Electrical",
    "Testing & Commissioning",
    "Inspection",
    "Consulting",
    "Other",
  ];

  // Initialize date & bill number
  useEffect(() => {
    const now = new Date();
    setCurrentDate(now.toISOString().split("T")[0]);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setBillNumber(`PQM-SB-${randomSuffix}`);
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingAttachment(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      let res;
      try {
        res = await axios.post(
          `${API_BASE_URL}/api/service-bills/upload-attachment`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
      } catch {
        res = await axios.post(
          `${API_BASE_URL}/api/upload`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
      }

      if (res.data?.success) {
        setBillAttachment(res.data.filePath);
        setAttachmentFileName(res.data.fileName || file.name);
        setSuccess("Bill attachment uploaded successfully!");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError("Failed to upload file");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("File upload failed. Please try again.");
    } finally {
      setUploadingAttachment(false);
    }
  };

  const removeAttachment = () => {
    setBillAttachment("");
    setAttachmentFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Add manual service
  const addManualService = () => {
    if (!newServiceName.trim()) {
      setError("Please enter a service name");
      setTimeout(() => setError(""), 3000);
      return;
    }

    const price = parseFloat(newServicePrice);
    if (isNaN(price) || price <= 0) {
      setError("Please enter a valid price");
      setTimeout(() => setError(""), 3000);
      return;
    }

    const gstRate = parseFloat(newServiceGST) || 0;
    const gstAmount = (price * gstRate) / 100;
    const total = price + gstAmount;

    setManualServices([
      ...manualServices,
      {
        id: Date.now(),
        name: newServiceName.trim(),
        description: newServiceDescription.trim(),
        category: newServiceCategory,
        price,
        gstRate,
        gstAmount,
        quantity: 1,
        total,
      },
    ]);

    // Reset inputs
    setNewServiceName("");
    setNewServiceDescription("");
    setNewServicePrice("");
    setSuccess("Service added to bill");
    setTimeout(() => setSuccess(""), 2000);
  };

  const updateQuantity = (id, qty) => {
    const q = Math.max(1, parseInt(qty) || 1);
    setManualServices((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const gstAmount = (s.price * s.gstRate * q) / 100;
          return {
            ...s,
            quantity: q,
            gstAmount,
            total: s.price * q + gstAmount,
          };
        }
        return s;
      })
    );
  };

  const removeService = (id) => {
    setManualServices((prev) => prev.filter((s) => s.id !== id));
  };

  // Calculations
  const subtotal = manualServices.reduce((sum, s) => sum + s.price * s.quantity, 0);
  const totalGST = manualServices.reduce((sum, s) => sum + s.gstAmount, 0);
  const grandTotal = subtotal + totalGST;

  // Auto-set paid amount to grand total if status is Paid
  useEffect(() => {
    if (paymentStatus === "Paid") {
      setPaidAmount(grandTotal);
    }
  }, [grandTotal, paymentStatus]);

  // Save Service Bill to Backend
  const saveBillToDatabase = async () => {
    if (manualServices.length === 0) {
      setError("Please add at least one service before saving.");
      return;
    }

    if (customerPhone && customerPhone.length !== 10) {
      setError("Phone number must be exactly 10 digits.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const billData = {
        billNumber: billNumber,
        customerName: (customerName || "Customer").trim(),
        companyName: (companyName || "").trim(),
        customerPhone: (customerPhone || "").trim(),
        customerEmail: (customerEmail || "").trim(),
        customerAddress: (customerAddress || "").trim(),
        customerType: customerCategory.toLowerCase(),
        discount: 0,
        discountType: "fixed",
        discountAmount: 0,
        subtotal: subtotal,
        tax: totalGST,
        total: grandTotal,
        paidAmount: parseFloat(paidAmount) || grandTotal,
        paymentMethod: paymentMethod.toLowerCase(),
        paymentStatus: paymentStatus.toLowerCase(),
        attachment: billAttachment || "",
        items: manualServices.map((s) => ({
          serviceName: s.name,
          serviceDescription: s.description || "",
          quantity: s.quantity,
          price: s.price,
          gst_rate: s.gstRate,
          category: s.category || "General",
        })),
      };

      const response = await axios.post(`${API_BASE_URL}/api/service-bills`, billData);

      if (response.data?.success) {
        setSuccess("✅ Service bill saved successfully! Redirecting to Service Bills records...");
        setSavedBillId(response.data.billId);
        if (response.data.billNumber) setBillNumber(response.data.billNumber);
        setTimeout(() => {
          navigate("/serviceBillView");
        }, 1200);
      } else {
        setError(response.data?.error || "Failed to save bill");
      }
    } catch (err) {
      console.error("Save error:", err);
      setError(err.response?.data?.error || "Failed to save service bill");
    } finally {
      setLoading(false);
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
    grid: {
      display: "grid",
      gridTemplateColumns: "1fr 400px",
      gap: "24px",
    },
    card: {
      backgroundColor: "#1e293b",
      border: "1px solid #334155",
      borderRadius: "12px",
      padding: "20px",
      marginBottom: "20px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
    },
    cardTitle: {
      fontSize: "15px",
      fontWeight: "600",
      color: "#ffffff",
      margin: "0 0 16px 0",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    formGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: "14px",
    },
    label: {
      display: "block",
      fontSize: "12px",
      color: "#94a3b8",
      marginBottom: "6px",
      fontWeight: "500",
    },
    input: {
      width: "100%",
      backgroundColor: "#0f172a",
      border: "1px solid #334155",
      borderRadius: "8px",
      padding: "9px 12px",
      color: "#ffffff",
      fontSize: "13px",
      outline: "none",
      boxSizing: "border-box",
    },
    btnPrimary: {
      backgroundColor: "#2563eb",
      color: "#ffffff",
      border: "none",
      padding: "10px 18px",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: "600",
      fontSize: "13px",
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      transition: "background-color 0.2s",
    },
    btnSecondary: {
      backgroundColor: "#334155",
      color: "#ffffff",
      border: "none",
      padding: "8px 14px",
      borderRadius: "8px",
      cursor: "pointer",
      fontWeight: "500",
      fontSize: "13px",
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: "13px",
      textAlign: "left",
    },
    th: {
      padding: "10px 12px",
      backgroundColor: "#111827",
      color: "#94a3b8",
      fontSize: "11px",
      fontWeight: "600",
      textTransform: "uppercase",
      borderBottom: "1px solid #334155",
    },
    td: {
      padding: "10px 12px",
      borderBottom: "1px solid #334155",
      color: "#e2e8f0",
    },
    summaryRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "8px 0",
      fontSize: "13px",
      color: "#94a3b8",
    },
    summaryTotal: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 0 4px 0",
      fontSize: "18px",
      fontWeight: "700",
      color: "#ffffff",
      borderTop: "1px solid #334155",
      marginTop: "8px",
    },
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header} className="no-print">
        <div>
          <h2 style={styles.title}>
            <FaWrench color="#3b82f6" /> Create Service Bill
          </h2>
          <p style={styles.subtitle}>
            Issue itemized service bills with attachments and custom discounts (SGD $)
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            style={styles.btnSecondary}
            onClick={() => navigate("/serviceBillView")}
          >
            <FaReceipt /> View All Service Bills
          </button>
        </div>
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
          className="no-print"
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
          className="no-print"
        >
          {success}
        </div>
      )}

      {/* Main Two Column Layout */}
      <div style={styles.grid} className="no-print">
        {/* Left Column: Form Entires */}
        <div>
          {/* Customer Information */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>👤 Customer Information</h3>
            <div style={styles.formGrid}>
              <div>
                <label style={styles.label}>Customer Name</label>
                <input
                  type="text"
                  style={styles.input}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Walk-in Customer"
                />
              </div>
              <div>
                <label style={styles.label}>Company Name</label>
                <select
                  style={styles.input}
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                >
                  <option value="">-- Select Company (Optional) --</option>
                  <option value="PowerQ Max Engineering Pte Ltd">PowerQ Max Engineering Pte Ltd</option>
                </select>
              </div>
              <div>
                <label style={styles.label}>Phone</label>
                <input
                  type="text"
                  style={styles.input}
                  value={customerPhone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    if (val.length <= 10) setCustomerPhone(val);
                  }}
                  placeholder="10-digit phone number"
                  maxLength={10}
                />
              </div>
              <div>
                <label style={styles.label}>Email</label>
                <input
                  type="email"
                  style={styles.input}
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@email.com"
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={styles.label}>Address</label>
                <input
                  type="text"
                  style={styles.input}
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Street, City, Postal Code"
                />
              </div>
            </div>
          </div>

          {/* Add Service Manually */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>➕ Add Service Manually</h3>
            <div style={styles.formGrid}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={styles.label}>Service Name *</label>
                <input
                  type="text"
                  style={styles.input}
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="e.g. Electrical DB Box Wiring & Circuit Testing"
                />
              </div>
              <div>
                <label style={styles.label}>Service Category</label>
                <select
                  style={styles.input}
                  value={newServiceCategory}
                  onChange={(e) => setNewServiceCategory(e.target.value)}
                >
                  {serviceCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={styles.label}>Unit Price (SGD $) *</label>
                <input
                  type="number"
                  step="0.01"
                  style={styles.input}
                  value={newServicePrice}
                  onChange={(e) => setNewServicePrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label style={styles.label}>GST (%)</label>
                <select
                  style={styles.input}
                  value={newServiceGST}
                  onChange={(e) => setNewServiceGST(e.target.value)}
                >
                  <option value="9">9% GST (Singapore Standard)</option>
                  <option value="0">0% (Zero Rated / Exempt)</option>
                  <option value="18">18%</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={styles.label}>Description / Scope of Work</label>
                <textarea
                  style={{ ...styles.input, minHeight: "60px", resize: "vertical" }}
                  value={newServiceDescription}
                  onChange={(e) => setNewServiceDescription(e.target.value)}
                  placeholder="Details of labor, materials supplied, diagnostics..."
                />
              </div>
            </div>

            <div style={{ marginTop: "14px", display: "flex", justifyContent: "flex-end" }}>
              <button style={styles.btnPrimary} onClick={addManualService}>
                <FaPlus /> Add Service Item
              </button>
            </div>
          </div>

          {/* Service Bill Attachment */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>
              <FaPaperclip color="#38bdf8" /> Attach Service Bill / Document
            </h3>
            <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "-10px", marginBottom: "14px" }}>
              Attach vendor bills, work orders, service reports, or signed customer receipts (PDF, PNG, JPG).
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                style={{ display: "none" }}
                id="service-attachment-input"
              />
              <label
                htmlFor="service-attachment-input"
                style={{
                  ...styles.btnSecondary,
                  cursor: "pointer",
                }}
              >
                <FaPaperclip /> {uploadingAttachment ? "Uploading..." : "Choose File to Attach"}
              </label>

              {attachmentFileName && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    backgroundColor: "rgba(59, 130, 246, 0.15)",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: "#93c5fd",
                  }}
                >
                  <FaPaperclip size={12} />
                  <span>{attachmentFileName}</span>
                  <button
                    onClick={removeAttachment}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#f87171",
                      cursor: "pointer",
                      padding: "0 2px",
                    }}
                    title="Remove attachment"
                  >
                    <FaTimes size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Bill Summary */}
        <div>
          <div style={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", color: "#ffffff" }}>Bill Summary</h3>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#38bdf8" }}>{billNumber}</span>
            </div>

            {/* Items List */}
            {manualServices.length > 0 ? (
              <div style={{ maxHeight: "250px", overflowY: "auto", marginBottom: "16px" }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Service</th>
                      <th style={styles.th}>Qty</th>
                      <th style={{ ...styles.th, textAlign: "right" }}>Total</th>
                      <th style={styles.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {manualServices.map((s) => (
                      <tr key={s.id}>
                        <td style={styles.td}>
                          <div style={{ fontWeight: "500" }}>{s.name}</div>
                          <div style={{ fontSize: "11px", color: "#94a3b8" }}>{s.category}</div>
                        </td>
                        <td style={styles.td}>
                          <input
                            type="number"
                            min="1"
                            value={s.quantity}
                            onChange={(e) => updateQuantity(s.id, e.target.value)}
                            style={{
                              width: "45px",
                              backgroundColor: "#0f172a",
                              border: "1px solid #334155",
                              color: "#fff",
                              padding: "4px",
                              borderRadius: "4px",
                              textAlign: "center",
                              fontSize: "12px",
                            }}
                          />
                        </td>
                        <td style={{ ...styles.td, textAlign: "right", fontWeight: "600" }}>
                          {formatSGD(s.total)}
                        </td>
                        <td style={{ ...styles.td, textAlign: "center" }}>
                          <button
                            onClick={() => removeService(s.id)}
                            style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer" }}
                          >
                            <FaTrashAlt size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: "30px 10px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                No services added yet. Add a service on the left to populate the bill.
              </div>
            )}

            {/* Calculations Breakdown */}
            <div style={styles.summaryRow}>
              <span>Subtotal</span>
              <span>{formatSGD(subtotal)}</span>
            </div>
            {totalGST > 0 && (
              <div style={styles.summaryRow}>
                <span>GST Amount</span>
                <span>{formatSGD(totalGST)}</span>
              </div>
            )}

            <div style={styles.summaryTotal}>
              <span>Total Payable</span>
              <span style={{ color: "#38bdf8" }}>{formatSGD(grandTotal)}</span>
            </div>

            {/* Payment Options */}
            <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #334155" }}>
              <div style={styles.formGrid}>
                <div>
                  <label style={styles.label}>Payment Method</label>
                  <select
                    style={styles.input}
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="Cash">Cash</option>
                    <option value="PayNow">PayNow</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Card">Credit / Debit Card</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label style={styles.label}>Payment Status</label>
                  <select
                    style={styles.input}
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                  >
                    <option value="Paid">Paid in Full</option>
                    <option value="Pending">Pending</option>
                    <option value="Partial">Partial</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ marginTop: "20px" }}>
              <button
                style={{ ...styles.btnPrimary, width: "100%", justifyContent: "center" }}
                onClick={saveBillToDatabase}
                disabled={loading}
              >
                {loading ? <FaSpinner className="animate-spin" /> : <FaSave />} Save Service Bill
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceBill;
