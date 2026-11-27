import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import {
  FaPlus,
  FaReceipt,
  FaCalendarDay,
  FaCalendarAlt,
  FaSearch,
  FaFilter,
  FaDownload,
  FaEdit,
  FaTrash,
  FaTimes,
  FaCheck,
  FaTruck,
  FaMoneyBillWave,
  FaFilePdf,
  FaImage,
  FaPaperclip,
  FaUndo,
  FaInfoCircle,
  FaExternalLinkAlt,
  FaChartPie,
  FaExclamationTriangle,
  FaClock,
  FaHistory,
  FaBell,
  FaChevronDown,
  FaChevronUp,
  FaCoins
} from "react-icons/fa";

const BASE_URL = "http://localhost:5000";

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  withCredentials: true,
});

const formatSGD = (num) => {
  const val = parseFloat(num) || 0;
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    minimumFractionDigits: 2,
  }).format(val);
};

const formatDateStr = (dateStr) => {
  if (!dateStr) return "—";
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString("en-SG", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
};

const isPdfFile = (fileName) => {
  if (!fileName) return false;
  return fileName.toLowerCase().endsWith(".pdf");
};

const isImageFile = (fileName) => {
  if (!fileName) return false;
  const lower = fileName.toLowerCase();
  return (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp")
  );
};

const getStatusBadge = (status) => {
  switch (status) {
    case "Paid":
      return {
        bg: "rgba(16, 185, 129, 0.15)",
        text: "#34d399",
        border: "#10b981",
        label: "Paid",
        icon: <FaCheck style={{ fontSize: "11px" }} />
      };
    case "Partially Paid":
      return {
        bg: "rgba(56, 189, 248, 0.15)",
        text: "#38bdf8",
        border: "#0284c7",
        label: "Partially Paid",
        icon: <FaClock style={{ fontSize: "11px" }} />
      };
    case "Overdue":
      return {
        bg: "rgba(239, 68, 68, 0.2)",
        text: "#f87171",
        border: "#dc2626",
        label: "Overdue",
        icon: <FaExclamationTriangle style={{ fontSize: "11px" }} />
      };
    case "Pending":
    default:
      return {
        bg: "rgba(245, 158, 11, 0.15)",
        text: "#fbbf24",
        border: "#d97706",
        label: "Pending",
        icon: <FaClock style={{ fontSize: "11px" }} />
      };
  }
};

const getDueDateBadge = (expense) => {
  if (expense.payment_status === "Paid") {
    return {
      bg: "rgba(16, 185, 129, 0.1)",
      text: "#10b981",
      border: "rgba(16, 185, 129, 0.3)",
      textLabel: "Settled"
    };
  }
  if (!expense.due_date) {
    return null;
  }
  const days = expense.days_until_due;
  if (days === null || days === undefined) {
    return null;
  }
  if (days < 0) {
    return {
      bg: "rgba(239, 68, 68, 0.2)",
      text: "#f87171",
      border: "#ef4444",
      textLabel: `${Math.abs(days)}d Overdue`
    };
  }
  if (days === 0) {
    return {
      bg: "rgba(245, 158, 11, 0.2)",
      text: "#fbbf24",
      border: "#f59e0b",
      textLabel: "Due Today"
    };
  }
  if (days <= 7) {
    return {
      bg: "rgba(56, 189, 248, 0.15)",
      text: "#38bdf8",
      border: "#0284c7",
      textLabel: `In ${days} day${days > 1 ? "s" : ""}`
    };
  }
  return {
    bg: "rgba(100, 116, 139, 0.15)",
    text: "#94a3b8",
    border: "#475569",
    textLabel: `In ${days}d`
  };
};

const PaymentTracking = () => {
  // Navigation tabs: "expenses" (default) or "suppliers"
  const [activeTab, setActiveTab] = useState("expenses");

  // ==========================================
  // EXPENSES / PAYMENT ENTRIES STATE
  // ==========================================
  const [expenses, setExpenses] = useState([]);
  const [expenseSummary, setExpenseSummary] = useState({
    total_committed: 0,
    total_paid: 0,
    total_pending: 0,
    overdue_total: 0,
    overdue_count: 0,
    due_today_total: 0,
    due_today_count: 0,
    upcoming_total: 0,
    upcoming_count: 0,
    paid_count: 0,
    partially_paid_count: 0,
    pending_count: 0,
    category_summary: []
  });

  // Reminders state
  const [reminders, setReminders] = useState({ overdue: [], due_today: [], upcoming: [] });
  const [reminderStats, setReminderStats] = useState({
    overdue_count: 0,
    overdue_pending: 0,
    due_today_count: 0,
    due_today_pending: 0,
    upcoming_count: 0,
    upcoming_pending: 0,
    total_attention_count: 0,
    total_attention_pending: 0
  });
  const [showRemindersPanel, setShowRemindersPanel] = useState(true);

  const [categories, setCategories] = useState([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [expenseError, setExpenseError] = useState("");
  const [expenseSuccess, setExpenseSuccess] = useState("");

  // Filters state
  const [filterType, setFilterType] = useState("all"); // "all", "daily", "monthly", "custom"
  const [statusFilter, setStatusFilter] = useState("all"); // "all", "pending", "partially_paid", "paid", "overdue"
  const [dueStatusFilter, setDueStatusFilter] = useState("all"); // "all", "overdue", "due_today", "upcoming"
  const [selectedDay, setSelectedDay] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [customRange, setCustomRange] = useState({ from: "", to: "" });
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedMethod, setSelectedMethod] = useState("all");
  const [expenseSearch, setExpenseSearch] = useState("");

  // Pagination for expenses
  const [expensePage, setExpensePage] = useState(1);
  const [expenseItemsPerPage] = useState(10);

  // Add / Edit Expense Modal state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [isEditingExpense, setIsEditingExpense] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [expenseFormData, setExpenseFormData] = useState({
    amount: "",
    description: "",
    expense_date: new Date().toISOString().split("T")[0],
    due_date: "",
    category: "",
    payment_method: "Cash",
    reference_number: "",
    notes: "",
    initial_payment_status: "unpaid", // "unpaid", "full", "partial"
    initial_paid_amount: "",
    initial_payment_mode: "Cash",
    initial_payment_date: new Date().toISOString().split("T")[0],
    initial_remarks: ""
  });
  const [selectedBillFile, setSelectedBillFile] = useState(null);
  const [existingBillAttachment, setExistingBillAttachment] = useState(null);
  const [existingBillOriginalName, setExistingBillOriginalName] = useState(null);
  const [removeExistingBill, setRemoveExistingBill] = useState(false);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const fileInputRef = useRef(null);

  // Record Partial Payment Modal state
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [recordingExpense, setRecordingExpense] = useState(null);
  const [partialPaymentForm, setPartialPaymentForm] = useState({
    amount_paid: "",
    payment_date: new Date().toISOString().split("T")[0],
    payment_mode: "Cash",
    remarks: ""
  });
  const [isSubmittingPartialPayment, setIsSubmittingPartialPayment] = useState(false);

  // Payment History Modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyExpense, setHistoryExpense] = useState(null);

  // Bill Viewer Modal state
  const [viewingBillExpense, setViewingBillExpense] = useState(null);

  // ==========================================
  // EXISTING SUPPLIER PAYMENT TRACKING STATE
  // ==========================================
  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [supplierError, setSupplierError] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [showSupplierPaymentPopup, setShowSupplierPaymentPopup] = useState(false);
  const [showSupplierDetailsPopup, setShowSupplierDetailsPopup] = useState(false);
  const [supplierPaymentForm, setSupplierPaymentForm] = useState({
    amount: "",
    payment_method: "Cash",
    reference_number: "",
    notes: ""
  });
  const [supplierSearchTerm, setSupplierSearchTerm] = useState("");
  const [supplierStatusFilter, setSupplierStatusFilter] = useState("all");
  const [supplierPage, setSupplierPage] = useState(1);
  const [supplierItemsPerPage] = useState(10);

  // ==========================================
  // INITIAL DATA LOADING & AUTH
  // ==========================================
  useEffect(() => {
    fetchExpenses();
    fetchExpenseSummary();
    fetchReminders();
    fetchCategories();
    fetchSuppliers();
  }, []);

  // ==========================================
  // API CALLS: EXPENSES & REMINDERS
  // ==========================================
  const fetchExpenses = async () => {
    try {
      setLoadingExpenses(true);
      setExpenseError("");

      const params = {
        filter_type: filterType,
        search: expenseSearch,
        status: statusFilter,
        due_status: dueStatusFilter,
        payment_method: selectedMethod
      };

      if (selectedCategory && selectedCategory !== "all") {
        params.category = selectedCategory;
      }

      if (filterType === "daily") {
        params.date = selectedDay;
      } else if (filterType === "monthly") {
        params.month = selectedMonth;
      } else if (filterType === "custom") {
        if (customRange.from) params.from_date = customRange.from;
        if (customRange.to) params.to_date = customRange.to;
      }

      const res = await api.get("/expenses", { params });
      if (res.data && res.data.success) {
        setExpenses(res.data.expenses || []);
      }
    } catch (err) {
      console.error("Error fetching expenses:", err);
      setExpenseError("Failed to fetch payment entries. Please check backend connection.");
    } finally {
      setLoadingExpenses(false);
    }
  };

  const fetchExpenseSummary = async () => {
    try {
      const res = await api.get("/expenses/summary");
      if (res.data && res.data.success) {
        setExpenseSummary(res.data.summary);
      }
    } catch (err) {
      console.error("Error fetching expense summary:", err);
    }
  };

  const fetchReminders = async () => {
    try {
      const res = await api.get("/expenses/reminders");
      if (res.data && res.data.success) {
        setReminders(res.data.reminders || { overdue: [], due_today: [], upcoming: [] });
        setReminderStats(res.data.stats || {});
      }
    } catch (err) {
      console.error("Error fetching payment reminders:", err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get("/expenses/categories");
      if (res.data && res.data.success && res.data.categories) {
        setCategories(res.data.categories);
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  // Re-fetch expenses when filters change
  useEffect(() => {
    fetchExpenses();
    setExpensePage(1);
  }, [filterType, statusFilter, dueStatusFilter, selectedDay, selectedMonth, customRange.from, customRange.to, selectedCategory, selectedMethod]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchExpenses();
      setExpensePage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [expenseSearch]);

  const showNotification = (msg, isSuccess = true) => {
    if (isSuccess) {
      setExpenseSuccess(msg);
      setTimeout(() => setExpenseSuccess(""), 4500);
    } else {
      setExpenseError(msg);
      setTimeout(() => setExpenseError(""), 5500);
    }
  };

  // ==========================================
  // ADD & EDIT PAYMENT ENTRY MODAL
  // ==========================================
  const handleOpenAddExpense = () => {
    setIsEditingExpense(false);
    setEditingExpenseId(null);
    setExpenseFormData({
      amount: "",
      description: "",
      expense_date: new Date().toISOString().split("T")[0],
      due_date: "",
      category: "",
      payment_method: "Cash",
      reference_number: "",
      notes: "",
      initial_payment_status: "unpaid",
      initial_paid_amount: "",
      initial_payment_mode: "Cash",
      initial_payment_date: new Date().toISOString().split("T")[0],
      initial_remarks: ""
    });
    setSelectedBillFile(null);
    setExistingBillAttachment(null);
    setExistingBillOriginalName(null);
    setRemoveExistingBill(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShowExpenseModal(true);
  };

  const handleOpenEditExpense = (expense) => {
    setIsEditingExpense(true);
    setEditingExpenseId(expense.id);
    setExpenseFormData({
      amount: expense.total_amount || expense.amount || "",
      description: expense.description || "",
      expense_date: expense.expense_date || new Date().toISOString().split("T")[0],
      due_date: expense.due_date || "",
      category: expense.category || "",
      payment_method: expense.payment_method || "Cash",
      reference_number: expense.reference_number || "",
      notes: expense.notes || "",
      initial_payment_status: "unpaid",
      initial_paid_amount: "",
      initial_payment_mode: "Cash",
      initial_payment_date: new Date().toISOString().split("T")[0],
      initial_remarks: ""
    });
    setSelectedBillFile(null);
    setExistingBillAttachment(expense.bill_attachment);
    setExistingBillOriginalName(expense.bill_original_name || expense.bill_attachment);
    setRemoveExistingBill(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setShowExpenseModal(true);
  };

  const handleSubmitExpense = async (e) => {
    e.preventDefault();
    if (!expenseFormData.description.trim()) {
      showNotification("Please enter a payment description", false);
      return;
    }
    const parsedAmount = parseFloat(expenseFormData.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showNotification("Please enter a valid total amount greater than 0", false);
      return;
    }
    if (!expenseFormData.category.trim()) {
      showNotification("Please enter a category name", false);
      return;
    }

    try {
      setIsSubmittingExpense(true);
      const formData = new FormData();
      formData.append("amount", parsedAmount);
      formData.append("description", expenseFormData.description.trim());
      formData.append("expense_date", expenseFormData.expense_date);
      if (expenseFormData.due_date) {
        formData.append("due_date", expenseFormData.due_date);
      } else {
        formData.append("due_date", "");
      }
      formData.append("category", expenseFormData.category.trim());
      formData.append("payment_method", expenseFormData.payment_method);
      formData.append("reference_number", expenseFormData.reference_number.trim());
      formData.append("notes", expenseFormData.notes.trim());

      // Initial payment data (only on creation)
      if (!isEditingExpense) {
        formData.append("initial_payment_status", expenseFormData.initial_payment_status);
        if (expenseFormData.initial_payment_status === "full") {
          formData.append("initial_paid_amount", parsedAmount);
          formData.append("initial_payment_mode", expenseFormData.initial_payment_mode || expenseFormData.payment_method);
          formData.append("initial_payment_date", expenseFormData.initial_payment_date);
          formData.append("initial_remarks", expenseFormData.initial_remarks || "Paid in Full");
        } else if (expenseFormData.initial_payment_status === "partial" && expenseFormData.initial_paid_amount) {
          formData.append("initial_paid_amount", expenseFormData.initial_paid_amount);
          formData.append("initial_payment_mode", expenseFormData.initial_payment_mode);
          formData.append("initial_payment_date", expenseFormData.initial_payment_date);
          formData.append("initial_remarks", expenseFormData.initial_remarks || "Initial partial payment");
        }
      }

      if (selectedBillFile) {
        formData.append("file", selectedBillFile);
      }
      if (removeExistingBill) {
        formData.append("remove_bill", "true");
      }

      if (isEditingExpense && editingExpenseId) {
        const res = await api.put(`/expenses/${editingExpenseId}`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        if (res.data && res.data.success) {
          showNotification("Payment entry updated successfully!");
          setShowExpenseModal(false);
          fetchExpenses();
          fetchExpenseSummary();
          fetchReminders();
          fetchCategories();
        }
      } else {
        const res = await api.post("/expenses", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        if (res.data && res.data.success) {
          showNotification("Payment entry recorded successfully!");
          setShowExpenseModal(false);
          fetchExpenses();
          fetchExpenseSummary();
          fetchReminders();
          fetchCategories();
        }
      }
    } catch (err) {
      console.error("Error saving payment entry:", err);
      showNotification(err.response?.data?.error || "Failed to save payment entry", false);
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const handleDeleteExpense = async (expense) => {
    if (!window.confirm(`Are you sure you want to delete payment entry: "${expense.description}" ($${expense.total_amount || expense.amount})? This will also remove any recorded partial payments.`)) {
      return;
    }
    try {
      setLoadingExpenses(true);
      const res = await api.delete(`/expenses/${expense.id}`);
      if (res.data && res.data.success) {
        showNotification("Payment entry deleted successfully!");
        fetchExpenses();
        fetchExpenseSummary();
        fetchReminders();
      }
    } catch (err) {
      console.error("Error deleting expense:", err);
      showNotification(err.response?.data?.error || "Failed to delete payment entry", false);
    } finally {
      setLoadingExpenses(false);
    }
  };

  // ==========================================
  // PARTIAL PAYMENT MODAL & ACTIONS
  // ==========================================
  const handleOpenRecordPayment = (expense) => {
    setRecordingExpense(expense);
    setPartialPaymentForm({
      amount_paid: expense.remaining_amount > 0 ? expense.remaining_amount.toFixed(2) : "",
      payment_date: new Date().toISOString().split("T")[0],
      payment_mode: "Cash",
      remarks: ""
    });
    setShowRecordPaymentModal(true);
  };

  const handleSubmitPartialPayment = async (e) => {
    e.preventDefault();
    if (!recordingExpense) return;
    const amt = parseFloat(partialPaymentForm.amount_paid);
    if (isNaN(amt) || amt <= 0) {
      showNotification("Please enter a valid payment amount greater than 0", false);
      return;
    }
    try {
      setIsSubmittingPartialPayment(true);
      const res = await api.post(`/expenses/${recordingExpense.id}/payments`, {
        amount_paid: amt,
        payment_date: partialPaymentForm.payment_date,
        payment_mode: partialPaymentForm.payment_mode,
        remarks: partialPaymentForm.remarks.trim()
      });
      if (res.data && res.data.success) {
        showNotification(`Payment of ${formatSGD(amt)} recorded successfully!`);
        setShowRecordPaymentModal(false);
        setRecordingExpense(null);
        fetchExpenses();
        fetchExpenseSummary();
        fetchReminders();
      }
    } catch (err) {
      console.error("Error recording partial payment:", err);
      showNotification(err.response?.data?.error || "Failed to record payment", false);
    } finally {
      setIsSubmittingPartialPayment(false);
    }
  };

  // Open Payment History
  const handleOpenHistory = (expense) => {
    setHistoryExpense(expense);
    setShowHistoryModal(true);
  };

  const handleDeletePartialPayment = async (expenseId, paymentId) => {
    if (!window.confirm("Are you sure you want to delete this payment record? Balance will be recalculated.")) {
      return;
    }
    try {
      const res = await api.delete(`/expenses/${expenseId}/payments/${paymentId}`);
      if (res.data && res.data.success) {
        showNotification("Payment record deleted successfully!");
        setHistoryExpense(res.data.expense);
        fetchExpenses();
        fetchExpenseSummary();
        fetchReminders();
      }
    } catch (err) {
      console.error("Error deleting partial payment:", err);
      showNotification(err.response?.data?.error || "Failed to delete payment record", false);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setFilterType("all");
    setStatusFilter("all");
    setDueStatusFilter("all");
    setSelectedDay(new Date().toISOString().split("T")[0]);
    const d = new Date();
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setCustomRange({ from: "", to: "" });
    setSelectedCategory("all");
    setSelectedMethod("all");
    setExpenseSearch("");
    setExpensePage(1);
  };

  // Pagination for expenses
  const paginatedExpenses = useMemo(() => {
    const startIndex = (expensePage - 1) * expenseItemsPerPage;
    return expenses.slice(startIndex, startIndex + expenseItemsPerPage);
  }, [expenses, expensePage, expenseItemsPerPage]);

  const totalExpensePages = Math.ceil(expenses.length / expenseItemsPerPage) || 1;

  // Filtered sums
  const filteredTotalCommitted = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (parseFloat(e.total_amount || e.amount) || 0), 0);
  }, [expenses]);

  const filteredTotalPaid = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (parseFloat(e.total_paid) || 0), 0);
  }, [expenses]);

  const filteredTotalPending = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (parseFloat(e.remaining_amount) || 0), 0);
  }, [expenses]);

  // ==========================================
  // SUPPLIER PAYMENTS LOGIC (EXISTING)
  // ==========================================
  const fetchSuppliers = async () => {
    try {
      setLoadingSuppliers(true);
      const res = await api.get("/suppliers-with-items");
      if (res.data && res.data.success) {
        const suppliersWithPayments = await Promise.all(
          res.data.suppliers.map(async (supplier) => {
            try {
              const paymentRes = await api.get(`/suppliers/${supplier.id}/payments`);
              const paymentData = paymentRes.data;
              const totalPurchase = (supplier.items || []).reduce(
                (sum, item) => sum + (item.quantity || 0) * (item.buy_price || 0),
                0
              );
              const totalPaid = paymentData.success
                ? paymentData.payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
                : 0;
              const remainingBalance = totalPurchase - totalPaid;

              return {
                ...supplier,
                payments: paymentData.success ? paymentData.payments : [],
                total_purchase: totalPurchase,
                total_paid: totalPaid,
                remaining_balance: remainingBalance,
                payment_status: remainingBalance <= 0 ? "Paid" : totalPaid > 0 ? "Pending" : "Unpaid"
              };
            } catch (err) {
              return {
                ...supplier,
                payments: [],
                total_purchase: 0,
                total_paid: 0,
                remaining_balance: 0,
                payment_status: "Unpaid"
              };
            }
          })
        );
        setSuppliers(suppliersWithPayments);
      }
    } catch (err) {
      setSupplierError(err.message || "Failed to fetch suppliers");
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const handleRecordSupplierPayment = async (e) => {
    e.preventDefault();
    if (!supplierPaymentForm.amount || parseFloat(supplierPaymentForm.amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    try {
      const response = await api.post(`/suppliers/${selectedSupplier.id}/payments`, {
        amount: parseFloat(supplierPaymentForm.amount),
        payment_method: supplierPaymentForm.payment_method,
        reference_number: supplierPaymentForm.reference_number,
        notes: supplierPaymentForm.notes
      });
      if (response.data.success) {
        showNotification("Supplier payment recorded successfully!");
        setShowSupplierPaymentPopup(false);
        setSupplierPaymentForm({
          amount: "",
          payment_method: "Cash",
          reference_number: "",
          notes: ""
        });
        fetchSuppliers();
      } else {
        alert(response.data.error || "Failed to record payment");
      }
    } catch (err) {
      alert(err.response?.data?.error || "Error recording payment");
    }
  };

  const handleDeleteSupplierPayment = async (paymentId) => {
    if (!window.confirm("Are you sure you want to delete this payment record?")) {
      return;
    }
    try {
      const response = await api.delete(`/suppliers/${selectedSupplier.id}/payments/${paymentId}`);
      if (response.data.success) {
        showNotification("Supplier payment deleted successfully!");
        if (showSupplierDetailsPopup) {
          const updatedPayments = selectedSupplier.payments.filter((p) => p.id !== paymentId);
          const totalPaid = updatedPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
          const remainingBalance = selectedSupplier.total_purchase - totalPaid;
          setSelectedSupplier({
            ...selectedSupplier,
            payments: updatedPayments,
            total_paid: totalPaid,
            remaining_balance: remainingBalance,
            payment_status: remainingBalance <= 0 ? "Paid" : totalPaid > 0 ? "Pending" : "Unpaid"
          });
        }
        fetchSuppliers();
      }
    } catch (err) {
      alert("Error deleting payment");
    }
  };

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((supplier) => {
      const matchesSearch =
        supplier.name?.toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
        supplier.company?.toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
        supplier.email?.toLowerCase().includes(supplierSearchTerm.toLowerCase());

      const matchesStatus =
        supplierStatusFilter === "all" ||
        supplier.payment_status?.toLowerCase() === supplierStatusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [suppliers, supplierSearchTerm, supplierStatusFilter]);

  const paginatedSuppliers = useMemo(() => {
    const startIndex = (supplierPage - 1) * supplierItemsPerPage;
    return filteredSuppliers.slice(startIndex, startIndex + supplierItemsPerPage);
  }, [filteredSuppliers, supplierPage, supplierItemsPerPage]);

  const totalSupplierPages = Math.ceil(filteredSuppliers.length / supplierItemsPerPage) || 1;

  // ==========================================
  // STYLES OBJECT
  // ==========================================
  const styles = {
    container: {
      padding: "24px 32px",
      backgroundColor: "#0f172a",
      minHeight: "100vh",
      color: "#e2e8f0",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
    tabNav: {
      display: "flex",
      gap: "12px",
      borderBottom: "1px solid #334155",
      paddingBottom: "16px",
      marginBottom: "24px",
    },
    tabBtn: (isActive) => ({
      padding: "10px 20px",
      borderRadius: "8px",
      border: "none",
      fontSize: "14px",
      fontWeight: "600",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      backgroundColor: isActive ? "#2563eb" : "#1e293b",
      color: isActive ? "#ffffff" : "#94a3b8",
      boxShadow: isActive ? "0 4px 12px rgba(37, 99, 235, 0.3)" : "none",
      transition: "all 0.2s ease",
    }),
    headerRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "20px",
      flexWrap: "wrap",
      gap: "16px",
    },
    title: {
      fontSize: "24px",
      fontWeight: "700",
      margin: 0,
      color: "#f8fafc",
      display: "flex",
      alignItems: "center",
      gap: "10px",
    },
    subtitle: {
      color: "#94a3b8",
      fontSize: "13.5px",
      marginTop: "6px",
      lineHeight: "1.4",
    },
    primaryBtn: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      backgroundColor: "#2563eb",
      color: "#fff",
      border: "none",
      padding: "10px 20px",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: "600",
      cursor: "pointer",
      boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
      transition: "all 0.2s ease",
    },
    summaryGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
      gap: "14px",
      marginBottom: "20px",
    },
    summaryCard: (accentColor = "#38bdf8") => ({
      backgroundColor: "#1e293b",
      borderRadius: "14px",
      padding: "16px 18px",
      border: "1px solid #334155",
      borderLeft: `4px solid ${accentColor}`,
      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
    }),
    summaryLabel: {
      color: "#94a3b8",
      fontSize: "11.5px",
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      marginBottom: "6px",
    },
    summaryAmount: (accentColor = "#f8fafc") => ({
      fontSize: "24px",
      fontWeight: "700",
      color: accentColor,
      letterSpacing: "-0.5px",
      lineHeight: "1.2",
    }),
    summarySubtext: {
      color: "#64748b",
      fontSize: "11.5px",
      marginTop: "6px",
    },
    remindersBanner: {
      backgroundColor: "#1e293b",
      borderRadius: "14px",
      border: "1px solid #334155",
      padding: "16px 20px",
      marginBottom: "20px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
    },
    remindersHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      cursor: "pointer",
    },
    remindersBadgesRow: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      flexWrap: "wrap",
      marginTop: "8px",
    },
    reminderPill: (type) => {
      let bg = "rgba(56, 189, 248, 0.15)";
      let color = "#38bdf8";
      let border = "#0284c7";
      if (type === "overdue") {
        bg = "rgba(239, 68, 68, 0.2)";
        color = "#f87171";
        border = "#dc2626";
      } else if (type === "due_today") {
        bg = "rgba(245, 158, 11, 0.2)";
        color = "#fbbf24";
        border = "#f59e0b";
      }
      return {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 12px",
        borderRadius: "20px",
        backgroundColor: bg,
        color: color,
        border: `1px solid ${border}`,
        fontSize: "12.5px",
        fontWeight: "600",
      };
    },
    reminderCardsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
      gap: "12px",
      marginTop: "16px",
      paddingTop: "16px",
      borderTop: "1px solid #334155",
    },
    reminderItemCard: (status) => ({
      backgroundColor: "#0f172a",
      borderRadius: "10px",
      border: `1px solid ${status === "Overdue" ? "#dc2626" : status === "Due Today" ? "#f59e0b" : "#38bdf8"}`,
      padding: "14px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      gap: "10px",
    }),
    categoryBox: {
      backgroundColor: "#1e293b",
      borderRadius: "14px",
      padding: "14px 18px",
      border: "1px solid #334155",
      marginBottom: "20px",
    },
    categoryPillsWrap: {
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      marginTop: "8px",
    },
    categoryPill: (isSelected = false) => ({
      padding: "4px 12px",
      borderRadius: "16px",
      backgroundColor: isSelected ? "#2563eb" : "rgba(100, 116, 139, 0.2)",
      color: isSelected ? "#ffffff" : "#cbd5e1",
      border: `1px solid ${isSelected ? "#38bdf8" : "#475569"}`,
      fontSize: "12px",
      fontWeight: "600",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      transition: "all 0.15s ease",
    }),
    filterContainer: {
      backgroundColor: "#1e293b",
      borderRadius: "14px",
      padding: "16px 20px",
      border: "1px solid #334155",
      marginBottom: "20px",
      display: "flex",
      flexDirection: "column",
      gap: "14px",
    },
    filterTabsRow: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      flexWrap: "wrap",
    },
    filterPeriodBtn: (isActive) => ({
      padding: "6px 12px",
      borderRadius: "6px",
      fontSize: "12.5px",
      fontWeight: "500",
      cursor: "pointer",
      border: isActive ? "1px solid #38bdf8" : "1px solid #334155",
      backgroundColor: isActive ? "#0284c7" : "#0f172a",
      color: isActive ? "#ffffff" : "#94a3b8",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      transition: "all 0.15s ease",
    }),
    filterInputRow: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      flexWrap: "wrap",
    },
    searchInput: {
      flex: "1",
      minWidth: "200px",
      padding: "8px 12px",
      backgroundColor: "#0f172a",
      border: "1px solid #334155",
      color: "#f8fafc",
      borderRadius: "6px",
      fontSize: "13px",
    },
    selectInput: {
      padding: "8px 12px",
      backgroundColor: "#0f172a",
      border: "1px solid #334155",
      color: "#f8fafc",
      borderRadius: "6px",
      fontSize: "13px",
      minWidth: "150px",
      cursor: "pointer",
    },
    datePicker: {
      padding: "6px 10px",
      backgroundColor: "#0f172a",
      border: "1px solid #334155",
      color: "#f8fafc",
      borderRadius: "6px",
      fontSize: "12.5px",
      colorScheme: "dark",
    },
    resetBtn: {
      padding: "7px 12px",
      backgroundColor: "transparent",
      border: "1px solid #475569",
      color: "#94a3b8",
      borderRadius: "6px",
      fontSize: "12.5px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "6px",
    },
    tableCard: {
      backgroundColor: "#1e293b",
      borderRadius: "14px",
      border: "1px solid #334155",
      overflow: "hidden",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      textAlign: "left",
      fontSize: "13px",
    },
    th: {
      backgroundColor: "#0f172a",
      padding: "12px 14px",
      color: "#94a3b8",
      fontWeight: "600",
      fontSize: "11.5px",
      textTransform: "uppercase",
      letterSpacing: "0.4px",
      borderBottom: "1px solid #334155",
    },
    td: {
      padding: "12px 14px",
      borderBottom: "1px solid #334155",
      color: "#e2e8f0",
      verticalAlign: "middle",
    },
    billBadge: (hasBill) => ({
      display: "inline-flex",
      alignItems: "center",
      gap: "5px",
      padding: "3px 8px",
      borderRadius: "5px",
      fontSize: "11.5px",
      fontWeight: "500",
      cursor: hasBill ? "pointer" : "default",
      backgroundColor: hasBill ? "rgba(16, 185, 129, 0.15)" : "transparent",
      color: hasBill ? "#34d399" : "#64748b",
      border: hasBill ? "1px solid rgba(16, 185, 129, 0.4)" : "1px dashed #334155",
      transition: "all 0.15s ease",
    }),
    actionBtn: (color = "#38bdf8") => ({
      padding: "5px 8px",
      borderRadius: "5px",
      border: "none",
      backgroundColor: "rgba(255, 255, 255, 0.06)",
      color: color,
      cursor: "pointer",
      marginRight: "4px",
      fontSize: "12.5px",
      transition: "all 0.15s ease",
    }),
    modalOverlay: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.75)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      zIndex: 99999,
      padding: "85px 16px 40px 16px",
      overflowY: "auto",
    },
    modalContent: {
      backgroundColor: "#1e293b",
      border: "1px solid #334155",
      borderRadius: "16px",
      width: "100%",
      maxWidth: "560px",
      maxHeight: "calc(100vh - 130px)",
      overflowY: "auto",
      boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
      padding: "24px",
      margin: "0 auto",
    },
    modalHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "18px",
      borderBottom: "1px solid #334155",
      paddingBottom: "12px",
    },
    modalTitle: {
      fontSize: "18px",
      fontWeight: "700",
      color: "#f8fafc",
      margin: 0,
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    closeBtn: {
      background: "transparent",
      border: "none",
      color: "#94a3b8",
      fontSize: "18px",
      cursor: "pointer",
      padding: "4px",
      borderRadius: "6px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    formGroup: {
      marginBottom: "14px",
    },
    formLabel: {
      display: "block",
      fontSize: "12px",
      fontWeight: "600",
      color: "#94a3b8",
      marginBottom: "5px",
      textTransform: "uppercase",
      letterSpacing: "0.3px",
    },
    formInput: {
      width: "100%",
      padding: "9px 12px",
      backgroundColor: "#0f172a",
      border: "1px solid #334155",
      borderRadius: "7px",
      color: "#f8fafc",
      fontSize: "13.5px",
      boxSizing: "border-box",
    },
    fileUploadBox: {
      border: "2px dashed #475569",
      borderRadius: "8px",
      padding: "14px",
      textAlign: "center",
      backgroundColor: "rgba(15, 23, 42, 0.6)",
      cursor: "pointer",
      transition: "border-color 0.2s",
    },
    modalFooter: {
      display: "flex",
      justifyContent: "flex-end",
      gap: "10px",
      marginTop: "20px",
      paddingTop: "14px",
      borderTop: "1px solid #334155",
    },
    cancelBtn: {
      padding: "9px 16px",
      borderRadius: "7px",
      border: "1px solid #475569",
      backgroundColor: "transparent",
      color: "#cbd5e1",
      fontSize: "13px",
      fontWeight: "500",
      cursor: "pointer",
    },
    submitBtn: {
      padding: "9px 18px",
      borderRadius: "7px",
      border: "none",
      backgroundColor: "#2563eb",
      color: "#ffffff",
      fontSize: "13px",
      fontWeight: "600",
      cursor: "pointer",
      boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
    },
    alertSuccess: {
      backgroundColor: "rgba(16, 185, 129, 0.15)",
      border: "1px solid #10b981",
      color: "#34d399",
      padding: "12px 16px",
      borderRadius: "8px",
      marginBottom: "16px",
      fontSize: "13.5px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    alertError: {
      backgroundColor: "rgba(239, 68, 68, 0.15)",
      border: "1px solid #ef4444",
      color: "#f87171",
      padding: "12px 16px",
      borderRadius: "8px",
      marginBottom: "16px",
      fontSize: "13.5px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    paginationRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 16px",
      borderTop: "1px solid #334155",
      backgroundColor: "#1e293b",
      fontSize: "12.5px",
      color: "#94a3b8",
    },
    pageBtn: (disabled, active) => ({
      padding: "5px 10px",
      borderRadius: "5px",
      border: "1px solid #334155",
      backgroundColor: active ? "#2563eb" : "#0f172a",
      color: active ? "#ffffff" : disabled ? "#475569" : "#e2e8f0",
      cursor: disabled ? "not-allowed" : "pointer",
      fontSize: "12px",
      fontWeight: active ? "600" : "500",
      margin: "0 2px",
    }),
  };

  return (
    <div style={styles.container}>
      {/* Top Tabs */}
      <div style={styles.tabNav}>
        <button
          style={styles.tabBtn(activeTab === "expenses")}
          onClick={() => setActiveTab("expenses")}
        >
          <FaReceipt /> Payment Tracking &amp; Expenses
        </button>
        <button
          style={styles.tabBtn(activeTab === "suppliers")}
          onClick={() => setActiveTab("suppliers")}
        >
          <FaTruck /> Supplier Payments
        </button>
      </div>

      {/* Alert Notifications */}
      {expenseSuccess && (
        <div style={styles.alertSuccess}>
          <FaCheck /> {expenseSuccess}
        </div>
      )}
      {expenseError && activeTab === "expenses" && (
        <div style={styles.alertError}>
          <FaInfoCircle /> {expenseError}
        </div>
      )}
      {supplierError && activeTab === "suppliers" && (
        <div style={styles.alertError}>
          <FaInfoCircle /> {supplierError}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: PAYMENT TRACKING & EXPENSES                         */}
      {/* ========================================================= */}
      {activeTab === "expenses" && (
        <div>
          {/* Header Row */}
          <div style={styles.headerRow}>
            <div>
              <h1 style={styles.title}>
                <FaMoneyBillWave style={{ color: "#38bdf8" }} />
                Payment Tracking &amp; Expense Management
              </h1>
              <div style={styles.subtitle}>
                Manage due dates, record partial payments, monitor outstanding balances, and track payment reminders.
              </div>
            </div>
            <button
              style={styles.primaryBtn}
              onClick={handleOpenAddExpense}
              title="Add a new payment or expense entry"
            >
              <FaPlus /> + Add Payment Entry
            </button>
          </div>

          {/* Payment Reminders & Notification System */}
          {(reminderStats.overdue_count > 0 || reminderStats.due_today_count > 0 || reminderStats.upcoming_count > 0) && (
            <div style={styles.remindersBanner}>
              <div
                style={styles.remindersHeader}
                onClick={() => setShowRemindersPanel(!showRemindersPanel)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <FaBell style={{ color: "#f59e0b", fontSize: "17px" }} />
                  <div>
                    <span style={{ fontSize: "14px", fontWeight: "700", color: "#f8fafc" }}>
                      Payment Due Notifications &amp; Reminders
                    </span>
                    <span style={{ fontSize: "12px", color: "#94a3b8", marginLeft: "8px" }}>
                      ({reminderStats.total_attention_count} payments need attention — Total Pending: {formatSGD(reminderStats.total_attention_pending)})
                    </span>
                  </div>
                </div>
                <button
                  style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "14px" }}
                >
                  {showRemindersPanel ? <FaChevronUp /> : <FaChevronDown />}
                </button>
              </div>

              {/* Status Pills */}
              <div style={styles.remindersBadgesRow}>
                {reminderStats.overdue_count > 0 && (
                  <div
                    style={styles.reminderPill("overdue")}
                    onClick={(e) => {
                      e.stopPropagation();
                      setStatusFilter("overdue");
                    }}
                    title="Click to filter overdue payments"
                  >
                    <FaExclamationTriangle />
                    <span>{reminderStats.overdue_count} Overdue</span>
                    <strong style={{ marginLeft: "4px" }}>({formatSGD(reminderStats.overdue_pending)})</strong>
                  </div>
                )}
                {reminderStats.due_today_count > 0 && (
                  <div
                    style={styles.reminderPill("due_today")}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDueStatusFilter("due_today");
                    }}
                    title="Click to filter payments due today"
                  >
                    <FaClock />
                    <span>{reminderStats.due_today_count} Due Today</span>
                    <strong style={{ marginLeft: "4px" }}>({formatSGD(reminderStats.due_today_pending)})</strong>
                  </div>
                )}
                {reminderStats.upcoming_count > 0 && (
                  <div
                    style={styles.reminderPill("upcoming")}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDueStatusFilter("upcoming");
                    }}
                    title="Click to filter upcoming payments"
                  >
                    <FaBell />
                    <span>{reminderStats.upcoming_count} Upcoming</span>
                    <strong style={{ marginLeft: "4px" }}>({formatSGD(reminderStats.upcoming_pending)})</strong>
                  </div>
                )}
              </div>

              {/* Expandable Reminder Items Carousel / Grid */}
              {showRemindersPanel && (
                <div style={styles.reminderCardsGrid}>
                  {/* Overdue Items */}
                  {(reminders?.overdue || []).map((item) => (
                    <div key={`overdue-${item.id}`} style={styles.reminderItemCard("Overdue")}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "700",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              backgroundColor: "rgba(239, 68, 68, 0.2)",
                              color: "#f87171",
                              border: "1px solid #ef4444",
                            }}
                          >
                            🚨 Overdue ({Math.abs(item.days_until_due || 0)}d ago)
                          </span>
                          <span style={{ fontSize: "11.5px", color: "#94a3b8" }}>
                            {item.category}
                          </span>
                        </div>
                        <div style={{ fontWeight: "600", color: "#f8fafc", fontSize: "13.5px", marginTop: "6px" }}>
                          {item.description}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "3px" }}>
                          Due Date: <strong style={{ color: "#f87171" }}>{formatDateStr(item.due_date)}</strong>
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #1e293b", paddingTop: "8px" }}>
                        <div>
                          <div style={{ fontSize: "11px", color: "#94a3b8" }}>Pending Balance</div>
                          <div style={{ fontSize: "15px", fontWeight: "700", color: "#f87171" }}>
                            {formatSGD(item.pending_amount)}
                          </div>
                          <div style={{ fontSize: "10.5px", color: "#64748b" }}>
                            Total: {formatSGD(item.total_amount)}
                          </div>
                        </div>
                        <button
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            backgroundColor: "#2563eb",
                            color: "#fff",
                            border: "none",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                          onClick={() => handleOpenRecordPayment(item)}
                        >
                          <FaCoins /> Pay Now
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Due Today Items */}
                  {(reminders?.due_today || []).map((item) => (
                    <div key={`today-${item.id}`} style={styles.reminderItemCard("Due Today")}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "700",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              backgroundColor: "rgba(245, 158, 11, 0.2)",
                              color: "#fbbf24",
                              border: "1px solid #f59e0b",
                            }}
                          >
                            ⚠️ Due Today
                          </span>
                          <span style={{ fontSize: "11.5px", color: "#94a3b8" }}>
                            {item.category}
                          </span>
                        </div>
                        <div style={{ fontWeight: "600", color: "#f8fafc", fontSize: "13.5px", marginTop: "6px" }}>
                          {item.description}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "3px" }}>
                          Due Date: <strong style={{ color: "#fbbf24" }}>{formatDateStr(item.due_date)}</strong>
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #1e293b", paddingTop: "8px" }}>
                        <div>
                          <div style={{ fontSize: "11px", color: "#94a3b8" }}>Pending Balance</div>
                          <div style={{ fontSize: "15px", fontWeight: "700", color: "#fbbf24" }}>
                            {formatSGD(item.pending_amount)}
                          </div>
                          <div style={{ fontSize: "10.5px", color: "#64748b" }}>
                            Total: {formatSGD(item.total_amount)}
                          </div>
                        </div>
                        <button
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            backgroundColor: "#2563eb",
                            color: "#fff",
                            border: "none",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                          onClick={() => handleOpenRecordPayment(item)}
                        >
                          <FaCoins /> Pay Now
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Upcoming Items */}
                  {(reminders?.upcoming || []).slice(0, 6).map((item) => (
                    <div key={`upcoming-${item.id}`} style={styles.reminderItemCard("Upcoming")}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "700",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              backgroundColor: "rgba(56, 189, 248, 0.15)",
                              color: "#38bdf8",
                              border: "1px solid #0284c7",
                            }}
                          >
                            🔔 Due in {item.days_until_due || 0} days
                          </span>
                          <span style={{ fontSize: "11.5px", color: "#94a3b8" }}>
                            {item.category}
                          </span>
                        </div>
                        <div style={{ fontWeight: "600", color: "#f8fafc", fontSize: "13.5px", marginTop: "6px" }}>
                          {item.description}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "3px" }}>
                          Due Date: <strong style={{ color: "#38bdf8" }}>{formatDateStr(item.due_date)}</strong>
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #1e293b", paddingTop: "8px" }}>
                        <div>
                          <div style={{ fontSize: "11px", color: "#94a3b8" }}>Pending Balance</div>
                          <div style={{ fontSize: "15px", fontWeight: "700", color: "#38bdf8" }}>
                            {formatSGD(item.pending_amount)}
                          </div>
                          <div style={{ fontSize: "10.5px", color: "#64748b" }}>
                            Total: {formatSGD(item.total_amount)}
                          </div>
                        </div>
                        <button
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            backgroundColor: "#2563eb",
                            color: "#fff",
                            border: "none",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                          onClick={() => handleOpenRecordPayment(item)}
                        >
                          <FaCoins /> Record Payment
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Top Summary Cards */}
          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard("#38bdf8")}>
              <div style={styles.summaryLabel}>
                <FaReceipt style={{ color: "#38bdf8" }} /> Total Amount
              </div>
              <div style={styles.summaryAmount("#38bdf8")}>
                {formatSGD(expenseSummary.total_committed)}
              </div>
              <div style={styles.summarySubtext}>
                {expenseSummary.overall_count || expenses.length} total entries recorded
              </div>
            </div>

            <div style={styles.summaryCard("#10b981")}>
              <div style={styles.summaryLabel}>
                <FaCheck style={{ color: "#10b981" }} /> Total Amount Paid
              </div>
              <div style={styles.summaryAmount("#10b981")}>
                {formatSGD(expenseSummary.total_paid)}
              </div>
              <div style={styles.summarySubtext}>
                {expenseSummary.paid_count || 0} fully paid, {expenseSummary.partially_paid_count || 0} partial
              </div>
            </div>

            <div style={styles.summaryCard("#f59e0b")}>
              <div style={styles.summaryLabel}>
                <FaClock style={{ color: "#f59e0b" }} /> Remaining Amount
              </div>
              <div style={styles.summaryAmount("#fbbf24")}>
                {formatSGD(expenseSummary.total_pending)}
              </div>
              <div style={styles.summarySubtext}>
                {expenseSummary.pending_count || 0} pending payments
              </div>
            </div>

            <div style={styles.summaryCard("#ef4444")}>
              <div style={styles.summaryLabel}>
                <FaExclamationTriangle style={{ color: "#ef4444" }} /> Overdue Amount
              </div>
              <div style={styles.summaryAmount("#f87171")}>
                {formatSGD(expenseSummary.overdue_total)}
              </div>
              <div style={styles.summarySubtext}>
                {expenseSummary.overdue_count || 0} payments overdue
              </div>
            </div>
          </div>

          {/* Category-wise Breakdown Bar */}
          {expenseSummary.category_summary && expenseSummary.category_summary.length > 0 && (
            <div style={styles.categoryBox}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#f8fafc", display: "flex", alignItems: "center", gap: "6px" }}>
                  <FaChartPie style={{ color: "#38bdf8" }} /> Category-wise Spending &amp; Outflow
                </div>
                <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                  Click a category below to filter
                </div>
              </div>

              <div style={styles.categoryPillsWrap}>
                {expenseSummary.category_summary.map((catItem) => {
                  const isSelected = selectedCategory === catItem.category;
                  return (
                    <div
                      key={catItem.category}
                      style={styles.categoryPill(isSelected)}
                      onClick={() => setSelectedCategory(isSelected ? "all" : catItem.category)}
                      title={`Filter by ${catItem.category}`}
                    >
                      <span>{catItem.category}</span>
                      <strong style={{ color: "#38bdf8" }}>{formatSGD(catItem.total)}</strong>
                      <span style={{ fontSize: "11px", opacity: 0.8 }}>({catItem.percentage}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filters & Search Toolbar */}
          <div style={styles.filterContainer}>
            {/* Period Tabs */}
            <div style={styles.filterTabsRow}>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#94a3b8", marginRight: "4px" }}>
                Period:
              </span>
              <button
                style={styles.filterPeriodBtn(filterType === "all")}
                onClick={() => setFilterType("all")}
              >
                All Time
              </button>
              <button
                style={styles.filterPeriodBtn(filterType === "daily")}
                onClick={() => setFilterType("daily")}
              >
                <FaCalendarDay /> Daily
              </button>
              <button
                style={styles.filterPeriodBtn(filterType === "monthly")}
                onClick={() => setFilterType("monthly")}
              >
                <FaCalendarAlt /> Monthly
              </button>
              <button
                style={styles.filterPeriodBtn(filterType === "custom")}
                onClick={() => setFilterType("custom")}
              >
                <FaFilter /> Custom Range
              </button>

              {/* Dynamic period picker controls */}
              {filterType === "daily" && (
                <input
                  type="date"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  style={styles.datePicker}
                  title="Select specific date"
                />
              )}
              {filterType === "monthly" && (
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={styles.datePicker}
                  title="Select month"
                />
              )}
              {filterType === "custom" && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="date"
                    value={customRange.from}
                    onChange={(e) => setCustomRange((prev) => ({ ...prev, from: e.target.value }))}
                    style={styles.datePicker}
                    placeholder="From Date"
                    title="From Date"
                  />
                  <span style={{ color: "#64748b" }}>to</span>
                  <input
                    type="date"
                    value={customRange.to}
                    onChange={(e) => setCustomRange((prev) => ({ ...prev, to: e.target.value }))}
                    style={styles.datePicker}
                    placeholder="To Date"
                    title="To Date"
                  />
                </div>
              )}
            </div>

            {/* Status & Search Row */}
            <div style={styles.filterInputRow}>
              {/* Search */}
              <div style={{ display: "flex", alignItems: "center", flex: "1", minWidth: "200px", position: "relative" }}>
                <FaSearch style={{ position: "absolute", left: "10px", color: "#64748b" }} />
                <input
                  type="text"
                  placeholder="Search description, category, reference, notes..."
                  value={expenseSearch}
                  onChange={(e) => setExpenseSearch(e.target.value)}
                  style={{ ...styles.searchInput, paddingLeft: "32px" }}
                />
              </div>

              {/* Payment Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={styles.selectInput}
                title="Filter by payment status"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>

              {/* Due Date Status Filter */}
              <select
                value={dueStatusFilter}
                onChange={(e) => setDueStatusFilter(e.target.value)}
                style={styles.selectInput}
                title="Filter by due date status"
              >
                <option value="all">All Due Timelines</option>
                <option value="overdue">🚨 Overdue Only</option>
                <option value="due_today">⚠️ Due Today Only</option>
                <option value="upcoming">🔔 Upcoming Only</option>
              </select>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={styles.selectInput}
                title="Filter by category"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Payment Method Filter */}
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                style={styles.selectInput}
                title="Filter by payment method"
              >
                <option value="all">All Payment Modes</option>
                <option value="Cash">Cash</option>
                <option value="PayNow">PayNow</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Cheque">Cheque</option>
                <option value="NETS">NETS</option>
              </select>

              {(filterType !== "all" || statusFilter !== "all" || dueStatusFilter !== "all" || selectedCategory !== "all" || selectedMethod !== "all" || expenseSearch) && (
                <button style={styles.resetBtn} onClick={handleResetFilters}>
                  <FaUndo /> Reset
                </button>
              )}
            </div>
          </div>

          {/* Payment History / Tracking Table */}
          <div style={styles.tableCard}>
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Category</th>
                    <th style={styles.th}>Payment Description</th>
                    <th style={styles.th}>Total Amount</th>
                    <th style={styles.th}>Total Paid</th>
                    <th style={styles.th}>Remaining</th>
                    <th style={styles.th}>Due Date</th>
                    <th style={styles.th}>Payment Status</th>
                    <th style={styles.th}>Last Payment</th>
                    <th style={styles.th}>Bill / Proof</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingExpenses ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                        Loading payment records...
                      </td>
                    </tr>
                  ) : paginatedExpenses.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: "center", padding: "50px 20px", color: "#94a3b8" }}>
                        <FaReceipt style={{ fontSize: "32px", color: "#475569", marginBottom: "12px", display: "block", margin: "0 auto 10px" }} />
                        <div style={{ fontSize: "15px", fontWeight: "600", color: "#cbd5e1" }}>No payment entries found</div>
                        <div style={{ fontSize: "13px", marginTop: "4px" }}>
                          {expenseSearch || selectedCategory !== "all" || filterType !== "all" || statusFilter !== "all"
                            ? "Try adjusting your filters or search terms."
                            : "Click '+ Add Payment Entry' above to record your first payment."}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedExpenses.map((expense) => {
                      const statusInfo = getStatusBadge(expense.payment_status);
                      const dueBadge = getDueDateBadge(expense);
                      const hasBill = Boolean(expense.bill_attachment);
                      const totalAmt = parseFloat(expense.total_amount || expense.amount) || 0;
                      const paidAmt = parseFloat(expense.total_paid) || 0;
                      const remAmt = parseFloat(expense.remaining_amount) || 0;

                      return (
                        <tr key={expense.id} style={{ transition: "background-color 0.15s" }}>
                          {/* 1. Category */}
                          <td style={styles.td}>
                            <span
                              style={{
                                padding: "4px 10px",
                                borderRadius: "14px",
                                backgroundColor: "rgba(56, 189, 248, 0.12)",
                                color: "#38bdf8",
                                border: "1px solid rgba(56, 189, 248, 0.3)",
                                fontSize: "11.5px",
                                fontWeight: "600",
                                display: "inline-block",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {expense.category || "General"}
                            </span>
                          </td>

                          {/* 2. Payment Description */}
                          <td style={{ ...styles.td, maxWidth: "260px" }}>
                            <div style={{ fontWeight: "600", color: "#f8fafc" }}>
                              {expense.description}
                            </div>
                            {expense.notes && (
                              <div style={{ fontSize: "11.5px", color: "#94a3b8", marginTop: "2px" }}>
                                {expense.notes}
                              </div>
                            )}
                            {expense.reference_number && (
                              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                                Ref: {expense.reference_number}
                              </div>
                            )}
                          </td>

                          {/* 3. Total Amount */}
                          <td style={styles.td}>
                            <span style={{ fontSize: "14px", fontWeight: "700", color: "#f8fafc" }}>
                              {formatSGD(totalAmt)}
                            </span>
                          </td>

                          {/* 4. Total Amount Paid */}
                          <td style={styles.td}>
                            <span style={{ fontSize: "13.5px", fontWeight: "600", color: "#10b981" }}>
                              {formatSGD(paidAmt)}
                            </span>
                            {expense.payments_count > 0 && (
                              <div style={{ fontSize: "11px", color: "#64748b" }}>
                                ({expense.payments_count} payment{expense.payments_count > 1 ? "s" : ""})
                              </div>
                            )}
                          </td>

                          {/* 5. Remaining Amount */}
                          <td style={styles.td}>
                            <span
                              style={{
                                fontSize: "14px",
                                fontWeight: "700",
                                color: remAmt > 0 ? (expense.payment_status === "Overdue" ? "#f87171" : "#fbbf24") : "#10b981",
                              }}
                            >
                              {formatSGD(remAmt)}
                            </span>
                          </td>

                          {/* 6. Due Date */}
                          <td style={{ ...styles.td, whiteSpace: "nowrap" }}>
                            {expense.due_date ? (
                              <div>
                                <div style={{ fontWeight: "600", color: "#f8fafc", fontSize: "12.5px" }}>
                                  {formatDateStr(expense.due_date)}
                                </div>
                                {dueBadge && (
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "2px 7px",
                                      borderRadius: "4px",
                                      backgroundColor: dueBadge.bg,
                                      color: dueBadge.text,
                                      border: `1px solid ${dueBadge.border}`,
                                      fontSize: "10.5px",
                                      fontWeight: "600",
                                      marginTop: "3px",
                                    }}
                                  >
                                    {dueBadge.textLabel}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: "#64748b" }}>—</span>
                            )}
                          </td>

                          {/* 7. Payment Status */}
                          <td style={styles.td}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "4px 10px",
                                borderRadius: "14px",
                                backgroundColor: statusInfo.bg,
                                color: statusInfo.text,
                                border: `1px solid ${statusInfo.border}`,
                                fontSize: "11.5px",
                                fontWeight: "600",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {statusInfo.icon}
                              {statusInfo.label}
                            </span>
                          </td>

                          {/* 8. Last Payment Date */}
                          <td style={{ ...styles.td, whiteSpace: "nowrap" }}>
                            <span style={{ fontSize: "12px", color: expense.last_payment_date ? "#cbd5e1" : "#64748b" }}>
                              {expense.last_payment_date ? formatDateStr(expense.last_payment_date) : "—"}
                            </span>
                          </td>

                          {/* 9. Bill Attachment */}
                          <td style={styles.td}>
                            {hasBill ? (
                              <button
                                style={styles.billBadge(true)}
                                onClick={() => setViewingBillExpense(expense)}
                                title="Click to view or download attached bill/receipt"
                              >
                                {isPdfFile(expense.bill_attachment) ? (
                                  <FaFilePdf style={{ color: "#f87171" }} />
                                ) : (
                                  <FaImage style={{ color: "#38bdf8" }} />
                                )}
                                <span>View Bill</span>
                              </button>
                            ) : (
                              <span style={styles.billBadge(false)}>
                                <FaPaperclip style={{ opacity: 0.5 }} /> No Bill
                              </span>
                            )}
                          </td>

                          {/* 10. Actions */}
                          <td style={{ ...styles.td, textAlign: "right", whiteSpace: "nowrap" }}>
                            {/* Record Partial Payment button */}
                            {remAmt > 0 && (
                              <button
                                style={styles.actionBtn("#10b981")}
                                onClick={() => handleOpenRecordPayment(expense)}
                                title="Record a partial or full payment"
                              >
                                <FaCoins /> + Pay
                              </button>
                            )}

                            {/* View Payment History button */}
                            <button
                              style={styles.actionBtn("#a855f7")}
                              onClick={() => handleOpenHistory(expense)}
                              title="View payment history"
                            >
                              <FaHistory />
                            </button>

                            {/* Edit button */}
                            <button
                              style={styles.actionBtn("#38bdf8")}
                              onClick={() => handleOpenEditExpense(expense)}
                              title="Edit payment entry"
                            >
                              <FaEdit />
                            </button>

                            {/* Delete button */}
                            <button
                              style={styles.actionBtn("#ef4444")}
                              onClick={() => handleDeleteExpense(expense)}
                              title="Delete payment entry"
                            >
                              <FaTrash />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {expenses.length > 0 && (
              <div style={styles.paginationRow}>
                <div>
                  Showing {paginatedExpenses.length} of {expenses.length} entries (Total Amount:{" "}
                  <strong>{formatSGD(filteredTotalCommitted)}</strong>, Total Paid:{" "}
                  <strong style={{ color: "#10b981" }}>{formatSGD(filteredTotalPaid)}</strong>, Pending:{" "}
                  <strong style={{ color: "#fbbf24" }}>{formatSGD(filteredTotalPending)}</strong>)
                </div>
                <div>
                  <button
                    style={styles.pageBtn(expensePage === 1, false)}
                    onClick={() => setExpensePage((p) => Math.max(1, p - 1))}
                    disabled={expensePage === 1}
                  >
                    Prev
                  </button>
                  {Array.from({ length: totalExpensePages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      style={styles.pageBtn(false, expensePage === p)}
                      onClick={() => setExpensePage(p)}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    style={styles.pageBtn(expensePage === totalExpensePages, false)}
                    onClick={() => setExpensePage((p) => Math.min(totalExpensePages, p + 1))}
                    disabled={expensePage === totalExpensePages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: SUPPLIER PAYMENTS (EXISTING FUNCTIONALITY)          */}
      {/* ========================================================= */}
      {activeTab === "suppliers" && (
        <div>
          {/* Header */}
          <div style={styles.headerRow}>
            <div>
              <h1 style={styles.title}>
                <FaTruck style={{ color: "#38bdf8" }} />
                Supplier Payment Tracking
              </h1>
              <div style={styles.subtitle}>
                Track supplier purchases, payment records, remaining balances, and supplier accounts.
              </div>
            </div>
          </div>

          {/* Supplier Summary Cards */}
          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard("#38bdf8")}>
              <div style={styles.summaryLabel}>Total Purchase Amount</div>
              <div style={styles.summaryAmount("#38bdf8")}>
                {formatSGD(
                  suppliers.reduce((sum, s) => sum + (s.total_purchase || 0), 0)
                )}
              </div>
            </div>
            <div style={styles.summaryCard("#10b981")}>
              <div style={styles.summaryLabel}>Total Paid Amount</div>
              <div style={styles.summaryAmount("#10b981")}>
                {formatSGD(
                  suppliers.reduce((sum, s) => sum + (s.total_paid || 0), 0)
                )}
              </div>
            </div>
            <div style={styles.summaryCard("#f59e0b")}>
              <div style={styles.summaryLabel}>Total Remaining Balance</div>
              <div style={styles.summaryAmount("#f59e0b")}>
                {formatSGD(
                  suppliers.reduce((sum, s) => sum + (s.remaining_balance || 0), 0)
                )}
              </div>
            </div>
            <div style={styles.summaryCard("#a855f7")}>
              <div style={styles.summaryLabel}>Suppliers Count</div>
              <div style={styles.summaryAmount("#c084fc")}>{suppliers.length}</div>
            </div>
          </div>

          {/* Supplier Search and Filter */}
          <div style={styles.filterContainer}>
            <div style={styles.filterInputRow}>
              <input
                type="text"
                style={styles.searchInput}
                placeholder="Search by supplier name, company, or email..."
                value={supplierSearchTerm}
                onChange={(e) => {
                  setSupplierSearchTerm(e.target.value);
                  setSupplierPage(1);
                }}
              />
              <select
                style={styles.selectInput}
                value={supplierStatusFilter}
                onChange={(e) => {
                  setSupplierStatusFilter(e.target.value);
                  setSupplierPage(1);
                }}
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
          </div>

          {/* Suppliers Table */}
          <div style={styles.tableCard}>
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Supplier Name</th>
                    <th style={styles.th}>Company</th>
                    <th style={styles.th}>Total Purchase</th>
                    <th style={styles.th}>Paid Amount</th>
                    <th style={styles.th}>Remaining</th>
                    <th style={styles.th}>Status</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingSuppliers && suppliers.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                        Loading suppliers...
                      </td>
                    </tr>
                  ) : paginatedSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                        No suppliers found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedSuppliers.map((supplier) => (
                      <tr key={supplier.id}>
                        <td style={styles.td}>
                          <strong>{supplier.name || "—"}</strong>
                        </td>
                        <td style={styles.td}>{supplier.company || "—"}</td>
                        <td style={styles.td}>{formatSGD(supplier.total_purchase)}</td>
                        <td style={styles.td}>{formatSGD(supplier.total_paid)}</td>
                        <td style={styles.td}>
                          <span
                            style={{
                              color: supplier.remaining_balance > 0 ? "#f59e0b" : "#10b981",
                              fontWeight: "600",
                            }}
                          >
                            {formatSGD(supplier.remaining_balance)}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "14px",
                              fontSize: "12px",
                              fontWeight: "600",
                              backgroundColor:
                                supplier.payment_status === "Paid"
                                  ? "rgba(16, 185, 129, 0.2)"
                                  : supplier.payment_status === "Pending"
                                    ? "rgba(245, 158, 11, 0.2)"
                                    : "rgba(239, 68, 68, 0.2)",
                              color:
                                supplier.payment_status === "Paid"
                                  ? "#10b981"
                                  : supplier.payment_status === "Pending"
                                    ? "#f59e0b"
                                    : "#ef4444",
                              border: `1px solid ${supplier.payment_status === "Paid"
                                ? "#10b981"
                                : supplier.payment_status === "Pending"
                                  ? "#f59e0b"
                                  : "#ef4444"
                                }`,
                            }}
                          >
                            {supplier.payment_status}
                          </span>
                        </td>
                        <td style={{ ...styles.td, textAlign: "right" }}>
                          <button
                            style={styles.actionBtn("#10b981")}
                            onClick={() => {
                              setSelectedSupplier(supplier);
                              setSupplierPaymentForm({
                                amount: supplier.remaining_balance > 0 ? supplier.remaining_balance.toFixed(2) : "",
                                payment_method: "Cash",
                                reference_number: "",
                                notes: ""
                              });
                              setShowSupplierPaymentPopup(true);
                            }}
                            title="Record Payment"
                          >
                            Record Payment
                          </button>
                          <button
                            style={styles.actionBtn("#38bdf8")}
                            onClick={() => {
                              setSelectedSupplier(supplier);
                              setShowSupplierDetailsPopup(true);
                            }}
                            title="View Details"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination for Suppliers */}
            {filteredSuppliers.length > 0 && (
              <div style={styles.paginationRow}>
                <div>
                  Showing {paginatedSuppliers.length} of {filteredSuppliers.length} suppliers
                </div>
                <div>
                  <button
                    style={styles.pageBtn(supplierPage === 1, false)}
                    onClick={() => setSupplierPage((p) => Math.max(1, p - 1))}
                    disabled={supplierPage === 1}
                  >
                    Prev
                  </button>
                  {Array.from({ length: totalSupplierPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      style={styles.pageBtn(false, supplierPage === p)}
                      onClick={() => setSupplierPage(p)}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    style={styles.pageBtn(supplierPage === totalSupplierPages, false)}
                    onClick={() => setSupplierPage((p) => Math.min(totalSupplierPages, p + 1))}
                    disabled={supplierPage === totalSupplierPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: ADD / EDIT PAYMENT ENTRY MODAL                   */}
      {/* ========================================================= */}
      {showExpenseModal && (
        <div style={styles.modalOverlay} onClick={() => setShowExpenseModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                <FaReceipt style={{ color: "#38bdf8" }} />
                {isEditingExpense ? "Edit Payment Entry" : "Add Payment Entry"}
              </h2>
              <button style={styles.closeBtn} onClick={() => setShowExpenseModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmitExpense}>
              {/* Total Amount */}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Total Amount (SGD) *</label>
                <div style={{ position: "relative" }}>
                  <span
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#94a3b8",
                      fontWeight: "700",
                      fontSize: "15px",
                    }}
                  >
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={expenseFormData.amount}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, amount: e.target.value })}
                    style={{ ...styles.formInput, paddingLeft: "30px", fontSize: "16px", fontWeight: "700" }}
                    disabled={isSubmittingExpense}
                    autoFocus
                  />
                </div>
              </div>

              {/* Description */}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Payment Description / Details *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Office rent, monthly electricity, software license, vendor invoice..."
                  value={expenseFormData.description}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, description: e.target.value })}
                  style={styles.formInput}
                  disabled={isSubmittingExpense}
                />
              </div>

              {/* Category (MANUAL TEXT ENTRY) & Due Date */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={styles.formLabel}>
                    Category (Manual Entry) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Office Supplies, Rent, Hardware..."
                    value={expenseFormData.category}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, category: e.target.value })}
                    style={styles.formInput}
                    disabled={isSubmittingExpense}
                    list="category-suggestions"
                  />
                  <datalist id="category-suggestions">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label style={styles.formLabel}>
                    Due Date <span style={{ color: "#fbbf24", fontSize: "10.5px" }}>(Payment Deadline)</span>
                  </label>
                  <input
                    type="date"
                    value={expenseFormData.due_date}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, due_date: e.target.value })}
                    style={styles.formInput}
                    disabled={isSubmittingExpense}
                  />
                </div>
              </div>

              {/* Recorded Date & Payment Method */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={styles.formLabel}>Entry / Invoice Date *</label>
                  <input
                    type="date"
                    required
                    value={expenseFormData.expense_date}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, expense_date: e.target.value })}
                    style={styles.formInput}
                    disabled={isSubmittingExpense}
                  />
                </div>

                <div>
                  <label style={styles.formLabel}>Primary Payment Mode</label>
                  <select
                    value={expenseFormData.payment_method}
                    onChange={(e) => setExpenseFormData({ ...expenseFormData, payment_method: e.target.value })}
                    style={styles.formInput}
                    disabled={isSubmittingExpense}
                  >
                    <option value="Cash">Cash</option>
                    <option value="PayNow">PayNow</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Cheque">Cheque</option>
                    <option value="NETS">NETS</option>
                  </select>
                </div>
              </div>

              {/* Reference Number */}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Reference / Receipt No. (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. REC-2026-001, Invoice #489..."
                  value={expenseFormData.reference_number}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, reference_number: e.target.value })}
                  style={styles.formInput}
                  disabled={isSubmittingExpense}
                />
              </div>

              {/* Initial Payment options (Only for new entries) */}
              {!isEditingExpense && (
                <div
                  style={{
                    backgroundColor: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    marginBottom: "14px",
                  }}
                >
                  <label style={{ ...styles.formLabel, color: "#38bdf8", marginBottom: "8px" }}>
                    Initial Payment Status
                  </label>
                  <div style={{ display: "flex", gap: "16px", marginBottom: "10px", flexWrap: "wrap" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="initial_status"
                        value="unpaid"
                        checked={expenseFormData.initial_payment_status === "unpaid"}
                        onChange={() => setExpenseFormData({ ...expenseFormData, initial_payment_status: "unpaid" })}
                      />
                      <span>No payment made yet (Pending)</span>
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="initial_status"
                        value="full"
                        checked={expenseFormData.initial_payment_status === "full"}
                        onChange={() => setExpenseFormData({ ...expenseFormData, initial_payment_status: "full" })}
                      />
                      <span style={{ color: "#34d399", fontWeight: "600" }}>Paid in Full</span>
                    </label>

                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="initial_status"
                        value="partial"
                        checked={expenseFormData.initial_payment_status === "partial"}
                        onChange={() => setExpenseFormData({ ...expenseFormData, initial_payment_status: "partial" })}
                      />
                      <span style={{ color: "#38bdf8", fontWeight: "600" }}>Partial Payment Made</span>
                    </label>
                  </div>

                  {/* Partial initial payment fields */}
                  {expenseFormData.initial_payment_status === "partial" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed #334155" }}>
                      <div>
                        <label style={{ fontSize: "11px", color: "#94a3b8" }}>Initial Amount Paid (SGD) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="Amount paid"
                          value={expenseFormData.initial_paid_amount}
                          onChange={(e) => setExpenseFormData({ ...expenseFormData, initial_paid_amount: e.target.value })}
                          style={styles.formInput}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "11px", color: "#94a3b8" }}>Payment Mode</label>
                        <select
                          value={expenseFormData.initial_payment_mode}
                          onChange={(e) => setExpenseFormData({ ...expenseFormData, initial_payment_mode: e.target.value })}
                          style={styles.formInput}
                        >
                          <option value="Cash">Cash</option>
                          <option value="PayNow">PayNow</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Credit Card">Credit Card</option>
                          <option value="Cheque">Cheque</option>
                          <option value="NETS">NETS</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Bill / Receipt Upload */}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Bill / Receipt Proof (Upload)</label>

                {/* Existing attachment if editing */}
                {isEditingExpense && existingBillAttachment && !removeExistingBill && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      backgroundColor: "rgba(16, 185, 129, 0.1)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      borderRadius: "6px",
                      marginBottom: "10px",
                      fontSize: "12.5px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#34d399" }}>
                      <FaPaperclip />
                      <span style={{ maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {existingBillOriginalName || existingBillAttachment}
                      </span>
                    </div>
                    <button
                      type="button"
                      style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "12px" }}
                      onClick={() => setRemoveExistingBill(true)}
                    >
                      Remove
                    </button>
                  </div>
                )}

                {/* File picker input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  accept=".png,.jpg,.jpeg,.webp,.pdf,.doc,.docx,.xlsx,.txt"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedBillFile(e.target.files[0]);
                      setRemoveExistingBill(false);
                    }
                  }}
                />

                <div
                  style={styles.fileUploadBox}
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                >
                  {selectedBillFile ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: "#38bdf8" }}>
                      {isPdfFile(selectedBillFile.name) ? <FaFilePdf /> : <FaImage />}
                      <span style={{ fontWeight: "600" }}>{selectedBillFile.name}</span>
                      <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                        ({(selectedBillFile.size / 1024).toFixed(1)} KB)
                      </span>
                      <FaTimes
                        style={{ color: "#ef4444", marginLeft: "8px", cursor: "pointer" }}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setSelectedBillFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      />
                    </div>
                  ) : (
                    <div>
                      <FaPaperclip style={{ fontSize: "18px", color: "#64748b", marginBottom: "4px" }} />
                      <div style={{ fontSize: "12.5px", color: "#cbd5e1" }}>
                        Click to upload receipt, bill image, or PDF proof
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "3px" }}>
                        Supports JPG, PNG, WEBP, PDF, DOCX (Max 16MB)
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Notes (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="Additional remarks, payment terms, or comments..."
                  value={expenseFormData.notes}
                  onChange={(e) => setExpenseFormData({ ...expenseFormData, notes: e.target.value })}
                  style={{ ...styles.formInput, resize: "vertical" }}
                  disabled={isSubmittingExpense}
                />
              </div>

              {/* Modal Actions */}
              <div style={styles.modalFooter}>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => setShowExpenseModal(false)}
                  disabled={isSubmittingExpense}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={styles.submitBtn}
                  disabled={isSubmittingExpense}
                >
                  {isSubmittingExpense
                    ? "Saving..."
                    : isEditingExpense
                      ? "Update Payment Entry"
                      : "Save Payment Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: RECORD PARTIAL / FULL PAYMENT MODAL             */}
      {/* ========================================================= */}
      {showRecordPaymentModal && recordingExpense && (
        <div style={styles.modalOverlay} onClick={() => setShowRecordPaymentModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  <FaCoins style={{ color: "#10b981" }} /> Record Payment
                </h2>
                <div style={{ fontSize: "12.5px", color: "#94a3b8", marginTop: "4px" }}>
                  {recordingExpense.description} ({recordingExpense.category})
                </div>
              </div>
              <button style={styles.closeBtn} onClick={() => setShowRecordPaymentModal(false)}>
                <FaTimes />
              </button>
            </div>

            {/* Balances overview */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "10px",
                marginBottom: "18px",
                backgroundColor: "#0f172a",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #334155",
              }}
            >
              <div>
                <div style={{ fontSize: "10.5px", color: "#94a3b8", textTransform: "uppercase" }}>Total Amount</div>
                <div style={{ fontSize: "15px", fontWeight: "700", color: "#f8fafc", marginTop: "2px" }}>
                  {formatSGD(recordingExpense.total_amount || recordingExpense.amount)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "10.5px", color: "#94a3b8", textTransform: "uppercase" }}>Total Paid</div>
                <div style={{ fontSize: "15px", fontWeight: "700", color: "#10b981", marginTop: "2px" }}>
                  {formatSGD(recordingExpense.total_paid)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "10.5px", color: "#94a3b8", textTransform: "uppercase" }}>Remaining Balance</div>
                <div style={{ fontSize: "15px", fontWeight: "700", color: "#fbbf24", marginTop: "2px" }}>
                  {formatSGD(recordingExpense.remaining_amount)}
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmitPartialPayment}>
              {/* Amount Paid */}
              <div style={styles.formGroup}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                  <label style={styles.formLabel}>Amount Paid (SGD) *</label>
                  {recordingExpense.remaining_amount > 0 && (
                    <button
                      type="button"
                      style={{
                        background: "none",
                        border: "none",
                        color: "#38bdf8",
                        fontSize: "11.5px",
                        fontWeight: "600",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                      onClick={() =>
                        setPartialPaymentForm({
                          ...partialPaymentForm,
                          amount_paid: recordingExpense.remaining_amount.toFixed(2),
                        })
                      }
                    >
                      Pay Full Remaining ({formatSGD(recordingExpense.remaining_amount)})
                    </button>
                  )}
                </div>
                <div style={{ position: "relative" }}>
                  <span
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#94a3b8",
                      fontWeight: "700",
                      fontSize: "15px",
                    }}
                  >
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="Enter amount paid"
                    value={partialPaymentForm.amount_paid}
                    onChange={(e) => setPartialPaymentForm({ ...partialPaymentForm, amount_paid: e.target.value })}
                    style={{ ...styles.formInput, paddingLeft: "30px", fontSize: "16px", fontWeight: "700" }}
                    disabled={isSubmittingPartialPayment}
                    autoFocus
                  />
                </div>
              </div>

              {/* Payment Date & Mode */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={styles.formLabel}>Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={partialPaymentForm.payment_date}
                    onChange={(e) => setPartialPaymentForm({ ...partialPaymentForm, payment_date: e.target.value })}
                    style={styles.formInput}
                    disabled={isSubmittingPartialPayment}
                  />
                </div>

                <div>
                  <label style={styles.formLabel}>Payment Mode *</label>
                  <select
                    value={partialPaymentForm.payment_mode}
                    onChange={(e) => setPartialPaymentForm({ ...partialPaymentForm, payment_mode: e.target.value })}
                    style={styles.formInput}
                    disabled={isSubmittingPartialPayment}
                  >
                    <option value="Cash">Cash</option>
                    <option value="PayNow">PayNow</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Cheque">Cheque</option>
                    <option value="NETS">NETS</option>
                  </select>
                </div>
              </div>

              {/* Remarks */}
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Remarks / Reference (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 1st installment, PayNow ref #, cheque #..."
                  value={partialPaymentForm.remarks}
                  onChange={(e) => setPartialPaymentForm({ ...partialPaymentForm, remarks: e.target.value })}
                  style={styles.formInput}
                  disabled={isSubmittingPartialPayment}
                />
              </div>

              <div style={styles.modalFooter}>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => setShowRecordPaymentModal(false)}
                  disabled={isSubmittingPartialPayment}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ ...styles.submitBtn, backgroundColor: "#10b981" }}
                  disabled={isSubmittingPartialPayment}
                >
                  {isSubmittingPartialPayment ? "Recording..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: PAYMENT HISTORY AUDIT MODAL                      */}
      {/* ========================================================= */}
      {showHistoryModal && historyExpense && (
        <div style={styles.modalOverlay} onClick={() => setShowHistoryModal(false)}>
          <div style={{ ...styles.modalContent, maxWidth: "680px" }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  <FaHistory style={{ color: "#a855f7" }} /> Payment History &amp; Audit
                </h2>
                <div style={{ fontSize: "12.5px", color: "#94a3b8", marginTop: "4px" }}>
                  {historyExpense.description} ({historyExpense.category})
                </div>
              </div>
              <button style={styles.closeBtn} onClick={() => setShowHistoryModal(false)}>
                <FaTimes />
              </button>
            </div>

            {/* Balances summary */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "10px",
                marginBottom: "18px",
                backgroundColor: "#0f172a",
                padding: "12px 14px",
                borderRadius: "8px",
                border: "1px solid #334155",
              }}
            >
              <div>
                <div style={{ fontSize: "10.5px", color: "#94a3b8", textTransform: "uppercase" }}>Total Amount</div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "#f8fafc", marginTop: "2px" }}>
                  {formatSGD(historyExpense.total_amount || historyExpense.amount)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "10.5px", color: "#94a3b8", textTransform: "uppercase" }}>Total Paid</div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "#10b981", marginTop: "2px" }}>
                  {formatSGD(historyExpense.total_paid)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "10.5px", color: "#94a3b8", textTransform: "uppercase" }}>Remaining</div>
                <div style={{ fontSize: "16px", fontWeight: "700", color: "#fbbf24", marginTop: "2px" }}>
                  {formatSGD(historyExpense.remaining_amount)}
                </div>
              </div>
            </div>

            {/* Partial Payments Table */}
            <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid #334155", borderRadius: "8px" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Payment Date</th>
                    <th style={styles.th}>Amount Paid</th>
                    <th style={styles.th}>Payment Mode</th>
                    <th style={styles.th}>Remarks</th>
                    <th style={{ ...styles.th, textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {historyExpense.partial_payments && historyExpense.partial_payments.length > 0 ? (
                    historyExpense.partial_payments.map((p) => (
                      <tr key={p.id}>
                        <td style={styles.td}>
                          <div style={{ fontWeight: "600", color: "#f8fafc" }}>
                            {formatDateStr(p.payment_date)}
                          </div>
                          <div style={{ fontSize: "10.5px", color: "#64748b" }}>
                            {p.payment_date}
                          </div>
                        </td>
                        <td style={styles.td}>
                          <strong style={{ color: "#10b981", fontSize: "14px" }}>
                            {formatSGD(p.amount_paid)}
                          </strong>
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              backgroundColor: "#0f172a",
                              border: "1px solid #334155",
                              fontSize: "11.5px",
                              color: "#cbd5e1",
                            }}
                          >
                            {p.payment_mode || "Cash"}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={{ fontSize: "12px", color: p.remarks ? "#cbd5e1" : "#64748b" }}>
                            {p.remarks || "—"}
                          </span>
                        </td>
                        <td style={{ ...styles.td, textAlign: "right" }}>
                          <button
                            onClick={() => handleDeletePartialPayment(historyExpense.id, p.id)}
                            style={styles.actionBtn("#ef4444")}
                            title="Delete this payment record"
                          >
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>
                        No payment records have been made for this entry yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={styles.modalFooter}>
              {historyExpense.remaining_amount > 0 && (
                <button
                  type="button"
                  style={{ ...styles.submitBtn, backgroundColor: "#10b981", marginRight: "auto" }}
                  onClick={() => {
                    setShowHistoryModal(false);
                    handleOpenRecordPayment(historyExpense);
                  }}
                >
                  <FaCoins /> + Record Another Payment
                </button>
              )}
              <button
                type="button"
                style={styles.submitBtn}
                onClick={() => setShowHistoryModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: BILL VIEWER & DOWNLOAD MODAL                     */}
      {/* ========================================================= */}
      {viewingBillExpense && (
        <div style={styles.modalOverlay} onClick={() => setViewingBillExpense(null)}>
          <div style={{ ...styles.modalContent, maxWidth: "750px" }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  <FaPaperclip style={{ color: "#10b981" }} />
                  Attached Bill / Receipt Proof
                </h2>
                <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                  {viewingBillExpense.description} ({formatSGD(viewingBillExpense.total_amount || viewingBillExpense.amount)}) —{" "}
                  {formatDateStr(viewingBillExpense.expense_date)}
                </div>
              </div>
              <button style={styles.closeBtn} onClick={() => setViewingBillExpense(null)}>
                <FaTimes />
              </button>
            </div>

            {/* Bill Preview Area */}
            <div
              style={{
                backgroundColor: "#0b1120",
                borderRadius: "10px",
                border: "1px solid #334155",
                padding: "16px",
                textAlign: "center",
                minHeight: "260px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isImageFile(viewingBillExpense.bill_attachment) ? (
                <img
                  src={`${BASE_URL}/uploads/${viewingBillExpense.bill_attachment}`}
                  alt="Receipt Preview"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "450px",
                    objectFit: "contain",
                    borderRadius: "8px",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                  }}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `${BASE_URL}/api/expenses/bill/${viewingBillExpense.bill_attachment}`;
                  }}
                />
              ) : isPdfFile(viewingBillExpense.bill_attachment) ? (
                <div style={{ width: "100%", height: "450px" }}>
                  <iframe
                    src={`${BASE_URL}/uploads/${viewingBillExpense.bill_attachment}`}
                    title="PDF Bill Preview"
                    style={{ width: "100%", height: "100%", border: "none", borderRadius: "8px" }}
                  />
                </div>
              ) : (
                <div style={{ padding: "40px" }}>
                  <FaPaperclip style={{ fontSize: "48px", color: "#38bdf8", marginBottom: "12px" }} />
                  <div style={{ fontSize: "16px", fontWeight: "600", color: "#f8fafc" }}>
                    {viewingBillExpense.bill_original_name || viewingBillExpense.bill_attachment}
                  </div>
                  <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "6px" }}>
                    Document file attached to this payment
                  </div>
                </div>
              )}
            </div>

            {/* Details & Download Bar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "18px",
                paddingTop: "14px",
                borderTop: "1px solid #334155",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                Filename: <strong>{viewingBillExpense.bill_original_name || viewingBillExpense.bill_attachment}</strong>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <a
                  href={`${BASE_URL}/uploads/${viewingBillExpense.bill_attachment}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    backgroundColor: "#0284c7",
                    color: "#ffffff",
                    textDecoration: "none",
                    fontSize: "13px",
                    fontWeight: "600",
                  }}
                >
                  <FaExternalLinkAlt /> Open in New Tab
                </a>
                <a
                  href={`${BASE_URL}/api/expenses/bill/${viewingBillExpense.bill_attachment}?download=1`}
                  download
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    backgroundColor: "#10b981",
                    color: "#ffffff",
                    textDecoration: "none",
                    fontSize: "13px",
                    fontWeight: "600",
                  }}
                >
                  <FaDownload /> Download Bill
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: SUPPLIER RECORD PAYMENT POPUP (EXISTING)         */}
      {/* ========================================================= */}
      {showSupplierPaymentPopup && selectedSupplier && (
        <div style={styles.modalOverlay} onClick={() => setShowSupplierPaymentPopup(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Record Supplier Payment</h2>
                <div style={{ color: "#94a3b8", marginTop: "4px", fontSize: "13px" }}>
                  {selectedSupplier.name} ({selectedSupplier.company})
                </div>
                <div style={{ color: "#f59e0b", marginTop: "2px", fontSize: "13px", fontWeight: "600" }}>
                  Remaining Balance: {formatSGD(selectedSupplier.remaining_balance)}
                </div>
              </div>
              <button style={styles.closeBtn} onClick={() => setShowSupplierPaymentPopup(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleRecordSupplierPayment}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Amount (SGD) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="Enter payment amount"
                  value={supplierPaymentForm.amount}
                  onChange={(e) => setSupplierPaymentForm({ ...supplierPaymentForm, amount: e.target.value })}
                  style={styles.formInput}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Payment Method</label>
                <select
                  value={supplierPaymentForm.payment_method}
                  onChange={(e) => setSupplierPaymentForm({ ...supplierPaymentForm, payment_method: e.target.value })}
                  style={styles.formInput}
                >
                  <option value="Cash">Cash</option>
                  <option value="PayNow">PayNow</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="NETS">NETS</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Reference Number</label>
                <input
                  type="text"
                  placeholder="Cheque number, transaction ID..."
                  value={supplierPaymentForm.reference_number}
                  onChange={(e) => setSupplierPaymentForm({ ...supplierPaymentForm, reference_number: e.target.value })}
                  style={styles.formInput}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Notes</label>
                <textarea
                  rows="2"
                  placeholder="Additional notes..."
                  value={supplierPaymentForm.notes}
                  onChange={(e) => setSupplierPaymentForm({ ...supplierPaymentForm, notes: e.target.value })}
                  style={{ ...styles.formInput, resize: "vertical" }}
                />
              </div>

              <div style={styles.modalFooter}>
                <button
                  type="button"
                  style={styles.cancelBtn}
                  onClick={() => setShowSupplierPaymentPopup(false)}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.submitBtn}>
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 6: SUPPLIER DETAILS POPUP (EXISTING)                */}
      {/* ========================================================= */}
      {showSupplierDetailsPopup && selectedSupplier && (
        <div style={styles.modalOverlay} onClick={() => setShowSupplierDetailsPopup(false)}>
          <div style={{ ...styles.modalContent, maxWidth: "800px" }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>{selectedSupplier.name} - Details</h2>
                <div style={{ color: "#94a3b8", fontSize: "13px", marginTop: "4px" }}>
                  {selectedSupplier.company} | {selectedSupplier.phone || "No phone"} | {selectedSupplier.email || "No email"}
                </div>
              </div>
              <button style={styles.closeBtn} onClick={() => setShowSupplierDetailsPopup(false)}>
                <FaTimes />
              </button>
            </div>

            {/* Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
              <div style={{ padding: "12px", backgroundColor: "#0f172a", borderRadius: "8px", border: "1px solid #334155" }}>
                <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase" }}>Total Purchase</div>
                <div style={{ fontSize: "18px", fontWeight: "700", color: "#f8fafc", marginTop: "4px" }}>
                  {formatSGD(selectedSupplier.total_purchase)}
                </div>
              </div>
              <div style={{ padding: "12px", backgroundColor: "#0f172a", borderRadius: "8px", border: "1px solid #334155" }}>
                <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase" }}>Total Paid</div>
                <div style={{ fontSize: "18px", fontWeight: "700", color: "#10b981", marginTop: "4px" }}>
                  {formatSGD(selectedSupplier.total_paid)}
                </div>
              </div>
              <div style={{ padding: "12px", backgroundColor: "#0f172a", borderRadius: "8px", border: "1px solid #334155" }}>
                <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase" }}>Remaining</div>
                <div style={{ fontSize: "18px", fontWeight: "700", color: "#f59e0b", marginTop: "4px" }}>
                  {formatSGD(selectedSupplier.remaining_balance)}
                </div>
              </div>
            </div>

            {/* Payment History */}
            <div style={{ marginBottom: "20px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "600", color: "#f8fafc", marginBottom: "10px" }}>
                Payment History
              </h3>
              <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid #334155", borderRadius: "8px" }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Date</th>
                      <th style={styles.th}>Amount</th>
                      <th style={styles.th}>Method</th>
                      <th style={styles.th}>Reference</th>
                      <th style={{ ...styles.th, textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSupplier.payments && selectedSupplier.payments.length > 0 ? (
                      selectedSupplier.payments.map((p) => (
                        <tr key={p.id}>
                          <td style={styles.td}>{formatDateStr(p.payment_date)}</td>
                          <td style={styles.td}><strong>{formatSGD(p.amount)}</strong></td>
                          <td style={styles.td}>{p.payment_method}</td>
                          <td style={styles.td}>{p.reference_number || "—"}</td>
                          <td style={{ ...styles.td, textAlign: "right" }}>
                            <button
                              onClick={() => handleDeleteSupplierPayment(p.id)}
                              style={styles.actionBtn("#ef4444")}
                              title="Delete payment"
                            >
                              <FaTrash />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ textAlign: "center", padding: "20px", color: "#94a3b8" }}>
                          No payment records found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.submitBtn}
                onClick={() => setShowSupplierDetailsPopup(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentTracking;
