import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  FaMoneyCheckAlt,
  FaPlus,
  FaSearch,
  FaPrint,
  FaEdit,
  FaTrashAlt,
  FaCheckCircle,
  FaClock,
  FaFileInvoiceDollar,
  FaCalendarAlt,
  FaFilter,
  FaTimes,
  FaDownload,
  FaSyncAlt,
} from "react-icons/fa";

const API_BASE = "http://localhost:5000/api";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const PAYMENT_METHODS = ["Bank Transfer", "PayNow", "Cash", "Cheque"];
const STATUSES = ["Pending", "Paid", "Processing"];

const formatSGD = (amount) => {
  const num = parseFloat(amount) || 0;
  return `$${num.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const Salary = () => {
  const [salaries, setSalaries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total_payroll: 0,
    total_paid: 0,
    total_pending: 0,
    paid_count: 0,
    pending_count: 0,
    total_records: 0,
  });

  // Filters
  const [search, setSearch] = useState("");
  const [filterMonth, setFilterMonth] = useState("All");
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterStatus, setFilterStatus] = useState("All");

  // Modals
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingSalary, setEditingSalary] = useState(null);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [dailyOtData, setDailyOtData] = useState(null);
  const [loadingDailyOt, setLoadingDailyOt] = useState(false);
  const [showDailyOtModal, setShowDailyOtModal] = useState(false);

  // Form State
  const initialForm = {
    employee_id: "",
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear(),
    basic_salary: 0,
    allowances: 0,
    overtime_pay: 0,
    ot_hours_15: 0,
    sunday_hours_20: 0,
    bonus: 0,
    deductions: 0,
    cpf_employee: 0,
    cpf_employer: 0,
    payment_method: "Bank Transfer",
    payment_status: "Pending",
    payment_date: "",
    notes: "",
  };
  const [formData, setFormData] = useState(initialForm);

  const token = localStorage.getItem("token");
  const api = useMemo(
    () =>
      axios.create({
        baseURL: API_BASE,
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      }),
    [token]
  );

  const fetchEmployees = async () => {
    try {
      // Try attendance/employees endpoint first, then employees
      let res;
      try {
        res = await api.get("/attendance/employees");
        if (res.data?.employees) {
          setEmployees(res.data.employees);
          return;
        }
      } catch (e) {
        // Fallback
      }
      res = await api.get("/employees");
      const list = Array.isArray(res.data) ? res.data : res.data?.employees || [];
      setEmployees(list);
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  };

  const fetchSalaries = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterMonth !== "All") params.month = filterMonth;
      if (filterYear) params.year = filterYear;
      if (filterStatus !== "All") params.status = filterStatus;
      if (search) params.search = search;

      const res = await api.get("/salary", { params });
      if (res.data?.success) {
        setSalaries(res.data.salaries || []);
      }
    } catch (err) {
      console.error("Error fetching salaries:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params = {};
      if (filterYear) params.year = filterYear;
      if (filterMonth !== "All") params.month = filterMonth;
      const res = await api.get("/salary/stats", { params });
      if (res.data?.success && res.data.stats) {
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error("Error fetching salary stats:", err);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchSalaries();
    fetchStats();
  }, [filterMonth, filterYear, filterStatus, search]);

  // Real-time calculation in Add/Edit modal
  const baseSalaryNum = parseFloat(formData.basic_salary) || 0;
  const hourlyRate = baseSalaryNum > 0 ? baseSalaryNum / 176 : 0;
  const standardOtHours = parseFloat(formData.ot_hours_15) || 0;
  const sundayOtHours = parseFloat(formData.sunday_hours_20) || 0;
  const calculatedStandardOtPay = Math.round(standardOtHours * hourlyRate * 1.5 * 100) / 100;
  const calculatedSundayOtPay = Math.round(sundayOtHours * hourlyRate * 2.0 * 100) / 100;

  const calculatedGross =
    (parseFloat(formData.basic_salary) || 0) +
    (parseFloat(formData.allowances) || 0) +
    (parseFloat(formData.overtime_pay) || 0) +
    (parseFloat(formData.bonus) || 0);

  const calculatedNet =
    calculatedGross -
    ((parseFloat(formData.deductions) || 0) + (parseFloat(formData.cpf_employee) || 0));

  const fetchDailyOvertimeSync = async (empId, month, year, autoApply = true) => {
    if (!empId) return;
    setLoadingDailyOt(true);
    try {
      const res = await api.get(`/attendance/employee/${empId}/monthly-overtime`, {
        params: { month, year },
      });
      if (res.data?.success) {
        setDailyOtData(res.data);
        if (autoApply) {
          const ot15 = res.data.total_standard_ot_hours || 0;
          const ot20 = res.data.total_sunday_ot_hours || 0;
          setFormData((prev) => {
            const basic = parseFloat(prev.basic_salary) || 0;
            const hr = basic > 0 ? basic / 176 : 0;
            const otPay = Math.round((ot15 * hr * 1.5 + ot20 * hr * 2.0) * 100) / 100;
            return {
              ...prev,
              ot_hours_15: ot15,
              sunday_hours_20: ot20,
              overtime_pay: (ot15 > 0 || ot20 > 0) ? otPay : prev.overtime_pay,
            };
          });
        }
      }
    } catch (err) {
      console.error("Error fetching daily overtime sync:", err);
    } finally {
      setLoadingDailyOt(false);
    }
  };

  const handleEmployeeChange = (empId) => {
    const selectedEmp = employees.find((e) => String(e.id) === String(empId));
    const newBasic =
      selectedEmp?.basic_salary || selectedEmp?.salary || formData.basic_salary;
    setFormData((prev) => ({
      ...prev,
      employee_id: empId,
      basic_salary: newBasic || prev.basic_salary,
    }));
    fetchDailyOvertimeSync(empId, formData.month, formData.year, true);
  };

  const handleMonthChange = (month) => {
    setFormData((prev) => ({ ...prev, month }));
    if (formData.employee_id) {
      fetchDailyOvertimeSync(formData.employee_id, month, formData.year, true);
    }
  };

  const handleYearChange = (year) => {
    setFormData((prev) => ({ ...prev, year }));
    if (formData.employee_id) {
      fetchDailyOvertimeSync(formData.employee_id, formData.month, year, true);
    }
  };

  const applyDailyOtToForm = () => {
    if (!dailyOtData) return;
    const ot15 = dailyOtData.total_standard_ot_hours || 0;
    const ot20 = dailyOtData.total_sunday_ot_hours || 0;
    const basic = parseFloat(formData.basic_salary) || 0;
    const hr = basic > 0 ? basic / 176 : 0;
    const otPay = Math.round((ot15 * hr * 1.5 + ot20 * hr * 2.0) * 100) / 100;
    setFormData((prev) => ({
      ...prev,
      ot_hours_15: ot15,
      sunday_hours_20: ot20,
      overtime_pay: otPay,
    }));
    setShowDailyOtModal(false);
  };

  const handleOpenAddModal = () => {
    setEditingSalary(null);
    const empId = employees.length > 0 ? employees[0].id : "";
    const m = MONTHS[new Date().getMonth()];
    const y = new Date().getFullYear();
    const selectedEmp = employees.find((e) => e.id === empId);
    const defaultBasic = selectedEmp?.basic_salary || selectedEmp?.salary || 0;

    setFormData({
      ...initialForm,
      employee_id: empId,
      month: m,
      year: y,
      basic_salary: defaultBasic,
    });
    setDailyOtData(null);
    setShowAddEditModal(true);

    if (empId) {
      fetchDailyOvertimeSync(empId, m, y, true);
    }
  };

  const handleOpenEditModal = (sal) => {
    setEditingSalary(sal);
    setFormData({
      employee_id: sal.employee_id,
      month: sal.month,
      year: sal.year,
      basic_salary: sal.basic_salary,
      allowances: sal.allowances,
      overtime_pay: sal.overtime_pay,
      ot_hours_15: sal.ot_hours_15 || 0,
      sunday_hours_20: sal.sunday_hours_20 || 0,
      bonus: sal.bonus,
      deductions: sal.deductions,
      cpf_employee: sal.cpf_employee,
      cpf_employer: sal.cpf_employer,
      payment_method: sal.payment_method || "Bank Transfer",
      payment_status: sal.payment_status || "Pending",
      payment_date: sal.payment_date || "",
      notes: sal.notes || "",
    });
    setDailyOtData(null);
    setShowAddEditModal(true);

    if (sal.employee_id) {
      fetchDailyOvertimeSync(sal.employee_id, sal.month, sal.year, false);
    }
  };

  const handleSaveSalary = async (e) => {
    e.preventDefault();
    try {
      if (editingSalary) {
        await api.put(`/salary/${editingSalary.id}`, formData);
      } else {
        await api.post("/salary", formData);
      }
      setShowAddEditModal(false);
      fetchSalaries();
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save salary record");
    }
  };

  const handleDeleteSalary = async (id) => {
    if (!window.confirm("Are you sure you want to delete this salary record?")) return;
    try {
      await api.delete(`/salary/${id}`);
      fetchSalaries();
      fetchStats();
    } catch (err) {
      alert("Failed to delete salary record");
    }
  };

  const handleQuickStatusPaid = async (id) => {
    try {
      await api.patch(`/salary/${id}/status`, { payment_status: "Paid" });
      fetchSalaries();
      fetchStats();
    } catch (err) {
      alert("Failed to update status");
    }
  };

  const handleViewPayslip = (sal) => {
    setSelectedPayslip(sal);
    setShowPayslipModal(true);
  };

  const printPayslip = () => {
    const printContent = document.getElementById("payslip-printable-area");
    if (!printContent) return;
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Payslip - ${selectedPayslip?.employee_name || "Employee"}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #111; margin: 0; }
            .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
            .company-name { font-size: 22px; font-weight: bold; color: #1e3a8a; }
            .company-sub { font-size: 13px; color: #555; margin-top: 4px; }
            .payslip-title { font-size: 18px; font-weight: bold; margin-top: 10px; text-transform: uppercase; letter-spacing: 1px; }
            .grid-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; font-size: 13px; }
            .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; }
            .table-sec { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
            .table-sec th, .table-sec td { border: 1px solid #cbd5e1; padding: 8px 12px; }
            .table-sec th { background: #f1f5f9; text-align: left; }
            .table-sec td.num { text-align: right; }
            .net-box { background: #eff6ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 25px; }
            .net-label { font-size: 14px; font-weight: bold; color: #1e40af; text-transform: uppercase; }
            .net-amount { font-size: 28px; font-weight: 800; color: #1d4ed8; margin-top: 4px; }
            .footer-sig { display: flex; justify-content: space-between; margin-top: 50px; padding-top: 20px; font-size: 13px; }
            .sig-line { border-top: 1px solid #94a3b8; width: 200px; text-align: center; padding-top: 6px; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  };

  const styles = {
    container: {
      padding: "24px",
      minHeight: "100vh",
      backgroundColor: "#0f172a",
      color: "#f8fafc",
      fontFamily: "system-ui, -apple-system, sans-serif",
    },
    headerRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "24px",
      flexWrap: "wrap",
      gap: "16px",
    },
    title: {
      fontSize: "26px",
      fontWeight: "700",
      color: "#ffffff",
      display: "flex",
      alignItems: "center",
      gap: "12px",
    },
    btnPrimary: {
      backgroundColor: "#2563eb",
      color: "#ffffff",
      padding: "10px 20px",
      borderRadius: "8px",
      border: "none",
      fontWeight: "600",
      fontSize: "14px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      cursor: "pointer",
      boxShadow: "0 4px 12px rgba(37,99,235,0.3)",
      transition: "background 0.2s",
    },
    statsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: "18px",
      marginBottom: "24px",
    },
    statCard: {
      backgroundColor: "#1e293b",
      borderRadius: "12px",
      padding: "20px",
      border: "1px solid #334155",
      display: "flex",
      alignItems: "center",
      gap: "16px",
    },
    statIconBox: {
      width: "48px",
      height: "48px",
      borderRadius: "10px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "22px",
    },
    statValue: {
      fontSize: "22px",
      fontWeight: "700",
      color: "#ffffff",
      marginTop: "4px",
    },
    statLabel: {
      fontSize: "13px",
      color: "#94a3b8",
      fontWeight: "500",
    },
    filterBar: {
      backgroundColor: "#1e293b",
      padding: "16px 20px",
      borderRadius: "12px",
      border: "1px solid #334155",
      display: "flex",
      flexWrap: "wrap",
      gap: "14px",
      alignItems: "center",
      marginBottom: "20px",
    },
    input: {
      backgroundColor: "#0f172a",
      border: "1px solid #334155",
      borderRadius: "8px",
      padding: "8px 12px",
      color: "#ffffff",
      fontSize: "14px",
      outline: "none",
    },
    select: {
      backgroundColor: "#0f172a",
      border: "1px solid #334155",
      borderRadius: "8px",
      padding: "8px 12px",
      color: "#ffffff",
      fontSize: "14px",
      outline: "none",
      cursor: "pointer",
    },
    tableContainer: {
      backgroundColor: "#1e293b",
      borderRadius: "12px",
      border: "1px solid #334155",
      overflowX: "auto",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      textAlign: "left",
      fontSize: "13px",
    },
    th: {
      backgroundColor: "#111827",
      color: "#94a3b8",
      padding: "12px 16px",
      fontWeight: "600",
      textTransform: "uppercase",
      fontSize: "11px",
      letterSpacing: "0.5px",
      borderBottom: "1px solid #334155",
    },
    td: {
      padding: "14px 16px",
      borderBottom: "1px solid #334155",
      color: "#e2e8f0",
    },
    badge: (status) => ({
      padding: "4px 10px",
      borderRadius: "20px",
      fontSize: "12px",
      fontWeight: "600",
      display: "inline-block",
      backgroundColor:
        status === "Paid"
          ? "rgba(16,185,129,0.15)"
          : status === "Processing"
          ? "rgba(245,158,11,0.15)"
          : "rgba(239,68,68,0.15)",
      color:
        status === "Paid"
          ? "#10b981"
          : status === "Processing"
          ? "#f59e0b"
          : "#ef4444",
      border: `1px solid ${
        status === "Paid"
          ? "rgba(16,185,129,0.3)"
          : status === "Processing"
          ? "rgba(245,158,11,0.3)"
          : "rgba(239,68,68,0.3)"
      }`,
    }),
    modalOverlay: {
      position: "fixed",
      inset: 0,
      backgroundColor: "rgba(0,0,0,0.75)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: "20px",
    },
    modalCard: {
      backgroundColor: "#1e293b",
      border: "1px solid #334155",
      borderRadius: "14px",
      width: "100%",
      maxWidth: "750px",
      maxHeight: "90vh",
      overflowY: "auto",
      padding: "26px",
      boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
    },
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>
            <FaMoneyCheckAlt color="#3b82f6" /> Salary & Payroll Management
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "14px", marginTop: "4px" }}>
            Manage employee monthly salaries, allowances, CPF, and payslips in Singapore Dollar (SGD $)
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => {
              fetchSalaries();
              fetchStats();
            }}
            style={{
              ...styles.btnPrimary,
              backgroundColor: "#334155",
            }}
            title="Refresh"
          >
            <FaSyncAlt />
          </button>
          <button style={styles.btnPrimary} onClick={handleOpenAddModal}>
            <FaPlus /> Add Salary Record
          </button>
        </div>
      </div>

      {/* Overview Statistics Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIconBox, backgroundColor: "rgba(59,130,246,0.15)", color: "#3b82f6" }}>
            SGD
          </div>
          <div>
            <div style={styles.statLabel}>Total Net Payroll</div>
            <div style={styles.statValue}>{formatSGD(stats.total_payroll)}</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIconBox, backgroundColor: "rgba(16,185,129,0.15)", color: "#10b981" }}>
            <FaCheckCircle />
          </div>
          <div>
            <div style={styles.statLabel}>Paid Amount</div>
            <div style={styles.statValue}>{formatSGD(stats.total_paid)}</div>
            <div style={{ fontSize: "12px", color: "#10b981" }}>{stats.paid_count} records paid</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIconBox, backgroundColor: "rgba(239,68,68,0.15)", color: "#ef4444" }}>
            <FaClock />
          </div>
          <div>
            <div style={styles.statLabel}>Pending Payouts</div>
            <div style={styles.statValue}>{formatSGD(stats.total_pending)}</div>
            <div style={{ fontSize: "12px", color: "#ef4444" }}>{stats.pending_count} pending</div>
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={{ ...styles.statIconBox, backgroundColor: "rgba(168,85,247,0.15)", color: "#a855f7" }}>
            <FaFileInvoiceDollar />
          </div>
          <div>
            <div style={styles.statLabel}>Total Records</div>
            <div style={styles.statValue}>{stats.total_records}</div>
            <div style={{ fontSize: "12px", color: "#94a3b8" }}>Total Deductions: {formatSGD(stats.total_deductions)}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={styles.filterBar}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "220px" }}>
          <FaSearch color="#64748b" />
          <input
            type="text"
            placeholder="Search employee name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...styles.input, width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FaCalendarAlt color="#64748b" />
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            style={styles.select}
          >
            <option value="All">All Months</option>
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            style={styles.select}
          >
            {[2024, 2025, 2026, 2027, 2028].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FaFilter color="#64748b" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={styles.select}
          >
            <option value="All">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Salary Records Table */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Employee</th>
              <th style={styles.th}>Period</th>
              <th style={styles.th}>Basic ($)</th>
              <th style={styles.th}>Allowances ($)</th>
              <th style={styles.th}>Gross ($)</th>
              <th style={styles.th}>Deductions & CPF ($)</th>
              <th style={styles.th}>Net Salary ($)</th>
              <th style={styles.th}>Status</th>
              <th style={{ ...styles.th, textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" style={{ ...styles.td, textAlign: "center", padding: "40px" }}>
                  Loading salary records...
                </td>
              </tr>
            ) : salaries.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ ...styles.td, textAlign: "center", padding: "40px", color: "#64748b" }}>
                  No salary records found for the selected filter.
                </td>
              </tr>
            ) : (
              salaries.map((sal) => (
                <tr key={sal.id} style={{ transition: "background 0.2s" }}>
                  <td style={styles.td}>
                    <div style={{ fontWeight: "600", color: "#ffffff" }}>{sal.employee_name || "Employee"}</div>
                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                      ID: {sal.employee_code || "—"} | {sal.designation || sal.department || "Staff"}
                    </div>
                  </td>
                  <td style={styles.td}>
                    {sal.month} {sal.year}
                  </td>
                  <td style={styles.td}>{formatSGD(sal.basic_salary)}</td>
                  <td style={styles.td}>{formatSGD((sal.allowances || 0) + (sal.overtime_pay || 0) + (sal.bonus || 0))}</td>
                  <td style={styles.td}>{formatSGD(sal.gross_salary)}</td>
                  <td style={{ ...styles.td, color: "#f87171" }}>
                    -{formatSGD((sal.deductions || 0) + (sal.cpf_employee || 0))}
                  </td>
                  <td style={{ ...styles.td, fontWeight: "700", color: "#60a5fa", fontSize: "14px" }}>
                    {formatSGD(sal.net_salary)}
                  </td>
                  <td style={styles.td}>
                    <span style={styles.badge(sal.payment_status)}>{sal.payment_status}</span>
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                      {sal.payment_method}
                    </div>
                  </td>
                  <td style={{ ...styles.td, textAlign: "center" }}>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                      <button
                        onClick={() => handleViewPayslip(sal)}
                        style={{
                          background: "#0284c7",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          padding: "6px 10px",
                          cursor: "pointer",
                          fontSize: "12px",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                        title="View & Print Payslip"
                      >
                        <FaPrint /> Payslip
                      </button>

                      {sal.payment_status !== "Paid" && (
                        <button
                          onClick={() => handleQuickStatusPaid(sal.id)}
                          style={{
                            background: "#059669",
                            color: "#fff",
                            border: "none",
                            borderRadius: "6px",
                            padding: "6px 10px",
                            cursor: "pointer",
                            fontSize: "12px",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                          title="Mark as Paid"
                        >
                          <FaCheckCircle /> Paid
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenEditModal(sal)}
                        style={{
                          background: "#475569",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          padding: "6px 10px",
                          cursor: "pointer",
                          fontSize: "12px",
                        }}
                        title="Edit Record"
                      >
                        <FaEdit />
                      </button>

                      <button
                        onClick={() => handleDeleteSalary(sal.id)}
                        style={{
                          background: "#dc2626",
                          color: "#fff",
                          border: "none",
                          borderRadius: "6px",
                          padding: "6px 10px",
                          cursor: "pointer",
                          fontSize: "12px",
                        }}
                        title="Delete Record"
                      >
                        <FaTrashAlt />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Salary Modal */}
      {showAddEditModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "700", color: "#ffffff", margin: 0 }}>
                {editingSalary ? "Edit Salary Record" : "Add Salary Record"}
              </h2>
              <button
                onClick={() => setShowAddEditModal(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "18px" }}
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSaveSalary}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
                    Select Employee *
                  </label>
                  <select
                    value={formData.employee_id}
                    onChange={(e) => handleEmployeeChange(e.target.value)}
                    required
                    style={{ ...styles.select, width: "100%" }}
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name || emp.name} ({emp.employee_id || `#${emp.id}`})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
                      Month *
                    </label>
                    <select
                      value={formData.month}
                      onChange={(e) => handleMonthChange(e.target.value)}
                      style={{ ...styles.select, width: "100%" }}
                    >
                      {MONTHS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
                      Year *
                    </label>
                    <input
                      type="number"
                      value={formData.year}
                      onChange={(e) => handleYearChange(Number(e.target.value))}
                      style={{ ...styles.input, width: "100%" }}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Earnings Section */}
              <div style={{ background: "#0f172a", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: "600", color: "#60a5fa", marginBottom: "12px" }}>
                  Earnings (SGD $)
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "12px", color: "#94a3b8" }}>Basic Salary ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.basic_salary}
                      onChange={(e) => setFormData({ ...formData, basic_salary: e.target.value })}
                      style={{ ...styles.input, width: "100%", marginTop: "4px" }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", color: "#94a3b8" }}>Allowances ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.allowances}
                      onChange={(e) => setFormData({ ...formData, allowances: e.target.value })}
                      style={{ ...styles.input, width: "100%", marginTop: "4px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", color: "#94a3b8" }}>Overtime Pay ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.overtime_pay}
                      onChange={(e) => setFormData({ ...formData, overtime_pay: e.target.value })}
                      style={{ ...styles.input, width: "100%", marginTop: "4px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", color: "#94a3b8" }}>Bonus ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.bonus}
                      onChange={(e) => setFormData({ ...formData, bonus: e.target.value })}
                      style={{ ...styles.input, width: "100%", marginTop: "4px" }}
                    />
                  </div>
                </div>

                {/* Overtime & Sunday Calculator Banner */}
                <div style={{ marginTop: "14px", padding: "14px", background: "rgba(59, 130, 246, 0.08)", border: "1px dashed rgba(59, 130, 246, 0.35)", borderRadius: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                    <div>
                      <span style={{ fontSize: "13px", fontWeight: "600", color: "#60a5fa" }}>
                        ⏱️ Daily Overtime Calculator (8:00 AM – 5:00 PM Office Hours)
                      </span>
                      <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                        Base Hourly: <strong>${hourlyRate.toFixed(2)}/hr</strong> (Basic ÷ 176h) | Mon–Sat: <strong>1.5x</strong> | Sunday: <strong>2.0x</strong>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => fetchDailyOvertimeSync(formData.employee_id, formData.month, formData.year, true)}
                        disabled={loadingDailyOt || !formData.employee_id}
                        style={{
                          background: "#1e293b",
                          border: "1px solid #475569",
                          color: "#cbd5e1",
                          borderRadius: "6px",
                          padding: "5px 10px",
                          fontSize: "11px",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                        title="Re-sync overtime logs from Attendance module"
                      >
                        <FaSyncAlt className={loadingDailyOt ? "animate-spin" : ""} size={10} />
                        {loadingDailyOt ? "Syncing..." : "Sync Attendance OT"}
                      </button>

                      {dailyOtData && dailyOtData.record_count > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowDailyOtModal(true)}
                          style={{
                            background: "rgba(16, 185, 129, 0.2)",
                            border: "1px solid rgba(16, 185, 129, 0.4)",
                            color: "#34d399",
                            borderRadius: "6px",
                            padding: "5px 10px",
                            fontSize: "11px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            fontWeight: "600",
                          }}
                        >
                          📋 Daily Breakdown ({dailyOtData.record_count} days)
                        </button>
                      )}
                    </div>
                  </div>

                  {dailyOtData && dailyOtData.record_count > 0 ? (
                    <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: "6px", padding: "8px 12px", marginBottom: "12px", fontSize: "12px", color: "#6ee7b7" }}>
                      ⚡ <strong>Auto-synced from daily attendance:</strong> {dailyOtData.total_standard_ot_hours} hrs standard OT (1.5x) + {dailyOtData.total_sunday_ot_hours} hrs Sunday OT (2.0x) recorded across {dailyOtData.record_count} dates.
                    </div>
                  ) : formData.employee_id && !loadingDailyOt ? (
                    <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "10px" }}>
                      No daily overtime recorded in attendance for {formData.month} {formData.year}. You can enter hours manually or log OT in the Attendance module.
                    </div>
                  ) : null}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ fontSize: "11px", color: "#cbd5e1" }}>Standard OT Hours (1.5x Rate)</label>
                      <input
                        type="number"
                        step="0.5"
                        placeholder="0 hrs"
                        value={formData.ot_hours_15 || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          const ot15 = parseFloat(val) || 0;
                          const ot20 = parseFloat(formData.sunday_hours_20) || 0;
                          const newOtPay = Math.round((ot15 * hourlyRate * 1.5 + ot20 * hourlyRate * 2.0) * 100) / 100;
                          setFormData({ ...formData, ot_hours_15: val, overtime_pay: newOtPay });
                        }}
                        style={{ ...styles.input, width: "100%", marginTop: "4px", fontSize: "12px", padding: "6px 10px" }}
                      />
                      <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                        Pay: {formatSGD(calculatedStandardOtPay)} (1.5x)
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", color: "#cbd5e1" }}>Sunday Work Hours (2.0x Rate)</label>
                      <input
                        type="number"
                        step="0.5"
                        placeholder="0 hrs"
                        value={formData.sunday_hours_20 || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          const ot20 = parseFloat(val) || 0;
                          const ot15 = parseFloat(formData.ot_hours_15) || 0;
                          const newOtPay = Math.round((ot15 * hourlyRate * 1.5 + ot20 * hourlyRate * 2.0) * 100) / 100;
                          setFormData({ ...formData, sunday_hours_20: val, overtime_pay: newOtPay });
                        }}
                        style={{ ...styles.input, width: "100%", marginTop: "4px", fontSize: "12px", padding: "6px 10px" }}
                      />
                      <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                        Pay: {formatSGD(calculatedSundayOtPay)} (2.0x)
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "10px", fontSize: "13px", color: "#94a3b8", textAlign: "right" }}>
                  Gross Earnings: <strong style={{ color: "#ffffff" }}>{formatSGD(calculatedGross)}</strong>
                </div>
              </div>

              {/* Deductions Section */}
              <div style={{ background: "#0f172a", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: "600", color: "#f87171", marginBottom: "12px" }}>
                  Deductions & Contributions (SGD $)
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "12px", color: "#94a3b8" }}>Other Deductions ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.deductions}
                      onChange={(e) => setFormData({ ...formData, deductions: e.target.value })}
                      style={{ ...styles.input, width: "100%", marginTop: "4px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", color: "#94a3b8" }}>Employee CPF ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.cpf_employee}
                      onChange={(e) => setFormData({ ...formData, cpf_employee: e.target.value })}
                      style={{ ...styles.input, width: "100%", marginTop: "4px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "12px", color: "#94a3b8" }}>Employer CPF ($) [Info]</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.cpf_employer}
                      onChange={(e) => setFormData({ ...formData, cpf_employer: e.target.value })}
                      style={{ ...styles.input, width: "100%", marginTop: "4px" }}
                    />
                  </div>
                </div>
                <div style={{ marginTop: "12px", padding: "10px", background: "rgba(59,130,246,0.1)", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#93c5fd" }}>Calculated Net Salary:</span>
                  <span style={{ fontSize: "18px", fontWeight: "800", color: "#60a5fa" }}>{formatSGD(calculatedNet)}</span>
                </div>
              </div>

              {/* Payment Details */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
                    Payment Method
                  </label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    style={{ ...styles.select, width: "100%" }}
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm} value={pm}>
                        {pm}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
                    Payment Status
                  </label>
                  <select
                    value={formData.payment_status}
                    onChange={(e) => setFormData({ ...formData, payment_status: e.target.value })}
                    style={{ ...styles.select, width: "100%" }}
                  >
                    {STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    style={{ ...styles.input, width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="Optional notes or reference numbers"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  style={{ ...styles.input, width: "100%" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  style={{
                    backgroundColor: "#334155",
                    color: "#ffffff",
                    padding: "10px 18px",
                    borderRadius: "8px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.btnPrimary}>
                  {editingSalary ? "Update Record" : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Daily Overtime Breakdown Modal */}
      {showDailyOtModal && dailyOtData && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, maxWidth: "680px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", color: "#ffffff", fontWeight: "700" }}>
                  Daily Overtime Log: {formData.month} {formData.year}
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#94a3b8" }}>
                  Itemized records from daily attendance for employee #{formData.employee_id}
                </p>
              </div>
              <button
                onClick={() => setShowDailyOtModal(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "18px" }}
              >
                <FaTimes />
              </button>
            </div>

            <div style={{ maxHeight: "380px", overflowY: "auto", marginBottom: "16px", border: "1px solid #334155", borderRadius: "8px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left" }}>Date</th>
                    <th style={{ padding: "10px 14px", textAlign: "left" }}>Day</th>
                    <th style={{ padding: "10px 14px", textAlign: "left" }}>Type & Multiplier</th>
                    <th style={{ padding: "10px 14px", textAlign: "right" }}>OT Hours</th>
                    <th style={{ padding: "10px 14px", textAlign: "left" }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyOtData.daily_records && dailyOtData.daily_records.length > 0 ? (
                    dailyOtData.daily_records.map((rec, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #1e293b", background: idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                        <td style={{ padding: "10px 14px", color: "#ffffff", fontWeight: "500" }}>
                          {rec.date}
                        </td>
                        <td style={{ padding: "10px 14px", color: rec.is_sunday ? "#fbbf24" : "#94a3b8" }}>
                          {rec.day_name}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: "10px",
                              fontSize: "11px",
                              fontWeight: "600",
                              background: rec.is_sunday ? "rgba(245, 158, 11, 0.2)" : "rgba(59, 130, 246, 0.2)",
                              color: rec.is_sunday ? "#fbbf24" : "#60a5fa",
                              border: `1px solid ${rec.is_sunday ? "rgba(245, 158, 11, 0.4)" : "rgba(59, 130, 246, 0.4)"}`,
                            }}
                          >
                            {rec.is_sunday ? "Sunday (2.0x)" : "Standard (1.5x)"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: "#ffffff", fontWeight: "600" }}>
                          +{rec.hours} hrs
                        </td>
                        <td style={{ padding: "10px 14px", color: "#94a3b8", fontSize: "12px" }}>
                          {rec.notes || "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>
                        No daily overtime records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary card */}
            <div style={{ background: "#0f172a", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                Standard (1.5x): <strong style={{ color: "#60a5fa" }}>{dailyOtData.total_standard_ot_hours} hrs</strong>
                {" | "}
                Sunday (2.0x): <strong style={{ color: "#fbbf24" }}>{dailyOtData.total_sunday_ot_hours} hrs</strong>
              </div>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "#34d399" }}>
                Total Estimated OT: {formatSGD(calculatedStandardOtPay + calculatedSundayOtPay)}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setShowDailyOtModal(false)}
                style={{ background: "#334155", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={applyDailyOtToForm}
                style={{ background: "#2563eb", color: "#fff", border: "none", padding: "8px 18px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}
              >
                Apply to Overtime Hours
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Payslip Modal */}
      {showPayslipModal && selectedPayslip && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, maxWidth: "680px", backgroundColor: "#ffffff", color: "#111827" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={printPayslip}
                  style={{
                    backgroundColor: "#2563eb",
                    color: "#ffffff",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "none",
                    fontWeight: "600",
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <FaPrint /> Print / Save PDF
                </button>
              </div>
              <button
                onClick={() => setShowPayslipModal(false)}
                style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "18px" }}
              >
                <FaTimes />
              </button>
            </div>

            {/* Printable Content Area */}
            <div id="payslip-printable-area" style={{ padding: "10px" }}>
              <div className="header" style={{ textAlign: "center", borderBottom: "2px solid #2563eb", paddingBottom: "12px", marginBottom: "20px" }}>
                <div className="company-name" style={{ fontSize: "22px", fontWeight: "bold", color: "#1e3a8a" }}>
                  PowerQ Max Engineering Pte Ltd
                </div>
                <div className="company-sub" style={{ fontSize: "12px", color: "#555", marginTop: "2px" }}>
                  Singapore | Electrical & Engineering Solutions
                </div>
                <div className="payslip-title" style={{ fontSize: "16px", fontWeight: "bold", marginTop: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "#334155" }}>
                  Itemized Pay Slip
                </div>
              </div>

              <div className="grid-meta" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "20px", fontSize: "13px" }}>
                <div className="meta-box" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "12px" }}>
                  <div><strong>Employee Name:</strong> {selectedPayslip.employee_name || "Employee"}</div>
                  <div style={{ marginTop: "4px" }}><strong>Employee ID:</strong> {selectedPayslip.employee_code || "—"}</div>
                  <div style={{ marginTop: "4px" }}><strong>Designation:</strong> {selectedPayslip.designation || "Staff"}</div>
                  <div style={{ marginTop: "4px" }}><strong>Department:</strong> {selectedPayslip.department || "General"}</div>
                  <div style={{ marginTop: "4px" }}><strong>Office Hours:</strong> 8:00 AM – 5:00 PM</div>
                </div>
                <div className="meta-box" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "12px" }}>
                  <div><strong>Payment Period:</strong> {selectedPayslip.month} {selectedPayslip.year}</div>
                  <div style={{ marginTop: "4px" }}><strong>Payment Mode:</strong> {selectedPayslip.payment_method}</div>
                  <div style={{ marginTop: "4px" }}><strong>Payment Status:</strong> {selectedPayslip.payment_status}</div>
                  <div style={{ marginTop: "4px" }}><strong>Payment Date:</strong> {selectedPayslip.payment_date || "—"}</div>
                  <div style={{ marginTop: "4px" }}><strong>OT Multipliers:</strong> 1.5x OT / 2.0x Sunday</div>
                </div>
              </div>

              {/* Earnings & Deductions Tables */}
              <table className="table-sec" style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 12px", textAlign: "left" }}>Item Description</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 12px", textAlign: "right" }}>Earnings (SGD $)</th>
                    <th style={{ border: "1px solid #cbd5e1", padding: "8px 12px", textAlign: "right" }}>Deductions (SGD $)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #cbd5e1", padding: "8px 12px" }}>Basic Salary</td>
                    <td style={{ border: "1px solid #cbd5e1", padding: "8px 12px", textAlign: "right" }}>{formatSGD(selectedPayslip.basic_salary)}</td>
                    <td style={{ border: "1px solid #cbd5e1", padding: "8px 12px", textAlign: "right" }}>—</td>
                  </tr>
                  {selectedPayslip.allowances > 0 && (
                    <tr>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 12px" }}>Allowances (Transport/Meal)</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 12px", textAlign: "right" }}>{formatSGD(selectedPayslip.allowances)}</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 12px", textAlign: "right" }}>—</td>
                    </tr>
                  )}
                  {selectedPayslip.overtime_pay > 0 && (
                    <tr>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 12px" }}>Overtime Pay</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 12px", textAlign: "right" }}>{formatSGD(selectedPayslip.overtime_pay)}</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 12px", textAlign: "right" }}>—</td>
                    </tr>
                  )}
                  {selectedPayslip.bonus > 0 && (
                    <tr>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 12px" }}>Bonus / Incentives</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 12px", textAlign: "right" }}>{formatSGD(selectedPayslip.bonus)}</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 12px", textAlign: "right" }}>—</td>
                    </tr>
                  )}
                  {selectedPayslip.cpf_employee > 0 && (
                    <tr>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 12px" }}>Employee CPF Contribution</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 12px", textAlign: "right" }}>—</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 12px", textAlign: "right", color: "#dc2626" }}>{formatSGD(selectedPayslip.cpf_employee)}</td>
                    </tr>
                  )}
                  {selectedPayslip.deductions > 0 && (
                    <tr>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 12px" }}>Other Deductions / Unpaid Leave</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 12px", textAlign: "right" }}>—</td>
                      <td style={{ border: "1px solid #cbd5e1", padding: "8px 12px", textAlign: "right", color: "#dc2626" }}>{formatSGD(selectedPayslip.deductions)}</td>
                    </tr>
                  )}
                  <tr style={{ fontWeight: "bold", background: "#f8fafc" }}>
                    <td style={{ border: "1px solid #cbd5e1", padding: "8px 12px" }}>Subtotals</td>
                    <td style={{ border: "1px solid #cbd5e1", padding: "8px 12px", textAlign: "right" }}>{formatSGD(selectedPayslip.gross_salary)}</td>
                    <td style={{ border: "1px solid #cbd5e1", padding: "8px 12px", textAlign: "right", color: "#dc2626" }}>
                      {formatSGD((selectedPayslip.deductions || 0) + (selectedPayslip.cpf_employee || 0))}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Net Pay Callout */}
              <div className="net-box" style={{ background: "#eff6ff", border: "2px solid #3b82f6", borderRadius: "8px", padding: "14px", textAlign: "center", marginBottom: "20px" }}>
                <div className="net-label" style={{ fontSize: "13px", fontWeight: "bold", color: "#1e40af", textTransform: "uppercase" }}>
                  Net Take-Home Pay (SGD)
                </div>
                <div className="net-amount" style={{ fontSize: "26px", fontWeight: "800", color: "#1d4ed8", marginTop: "2px" }}>
                  {formatSGD(selectedPayslip.net_salary)}
                </div>
              </div>

              {selectedPayslip.cpf_employer > 0 && (
                <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "20px", background: "#f8fafc", padding: "8px", borderRadius: "4px" }}>
                  * Employer CPF Contribution: {formatSGD(selectedPayslip.cpf_employer)} (paid by employer to CPF Board directly).
                </div>
              )}

              {/* Signatures */}
              <div className="footer-sig" style={{ display: "flex", justifyContent: "space-between", marginTop: "40px", paddingTop: "15px", fontSize: "12px", color: "#475569" }}>
                <div className="sig-line" style={{ borderTop: "1px solid #94a3b8", width: "180px", textAlign: "center", paddingTop: "6px" }}>
                  Employer Signature
                </div>
                <div className="sig-line" style={{ borderTop: "1px solid #94a3b8", width: "180px", textAlign: "center", paddingTop: "6px" }}>
                  Employee Signature
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Salary;
