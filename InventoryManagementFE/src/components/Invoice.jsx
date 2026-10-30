import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { POWERQ_LOGO_BASE64, BCA_LOGO_BASE64 } from "../assets/invoiceLogos";

const InvoicePage = () => {
  // Create axios instance with credentials
  const api = axios.create({
    baseURL: 'http://localhost:5000/api',
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    timeout: 10000
  });

  // Add request interceptor for debugging
  api.interceptors.request.use(request => {
    console.log('Starting Request:', request.method.toUpperCase(), request.url);
    return request;
  });

  // Add response interceptor for error handling
  api.interceptors.response.use(
    response => {
      console.log('Response:', response.status);
      return response;
    },
    error => {
      console.log('Response Error:', error.message);
      if (error.response) {
        if (error.response.status === 401) {
          setIsAuthenticated(false);
          setError('Session expired. Please login again.');
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        }
      }
      return Promise.reject(error);
    }
  );

  // Company details
  const companyDetails = {
    name: "POWERQ MAX ENGINEERING PTE LTD",
    services: "Electrical • BMS • ELV & Security • Fire Alarm • Renovation • IT",
    uen: "202649167W",
    address: "10 Jalan Besar, #15-02, Sim Lim Tower, Singapore 208787",
    phone: "+65 9860 4001",
    email: "powerqmaxengineering@gmail.com"
  };

  // State for invoices list
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 10,
    total: 0,
    pages: 1
  });
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [dashboardStats, setDashboardStats] = useState(null);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });
  const [filterStatus, setFilterStatus] = useState('all'); // all, paid, unpaid, partial
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, highest, lowest

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState(1);

  // Form data
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "", gstin: "", attn: "" });
  const [yourPoNo, setYourPoNo] = useState("");
  const [ourDoNo, setOurDoNo] = useState("");
  const [bankName, setBankName] = useState("[Bank name]");
  const [accountNo, setAccountNo] = useState("[Account number]");
  const [bankCode, setBankCode] = useState("[Code]");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState("fixed");
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0]);
  const [notes, setNotes] = useState("");
  const [customerErrors, setCustomerErrors] = useState({});
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savedInvoice, setSavedInvoice] = useState(null);
  
  // Payment details
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentStatus, setPaymentStatus] = useState('unpaid');
  const [isInterState, setIsInterState] = useState(false);

  // Refs
  const searchRef = useRef(null);
  const modalRef = useRef(null);
  const viewModalRef = useRef(null);

  // Helper function to safely format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-IN');
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Helper function to safely parse number
  const safeNumber = (value, defaultValue = 0) => {
    if (value === null || value === undefined) return defaultValue;
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  };

  // Check authentication on mount
  useEffect(() => {
    const user = localStorage.getItem('user');
    if (!user) {
      setIsAuthenticated(false);
      setError('Please login first');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } else {
      testBackendConnection();
    }
  }, []);

  // Fetch invoices when page changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchInvoices();
    }
  }, [pagination.page]);

  // Apply filters
  useEffect(() => {
    if (invoices.length > 0) {
      applyFilters();
    }
  }, [invoices, searchTerm, dateRange, filterStatus, sortBy]);

  // Handle click outside to close modal
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        if (items.length > 0 || customer.name || customer.phone) {
          if (window.confirm("Are you sure you want to close? Your progress will be lost.")) {
            resetForm();
            setShowModal(false);
          }
        } else {
          setShowModal(false);
          resetForm();
        }
      }
      
      if (viewModalRef.current && !viewModalRef.current.contains(event.target) && showViewModal) {
        setShowViewModal(false);
        setViewingInvoice(null);
      }
    };
    
    if (showModal || showViewModal) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showModal, showViewModal, items, customer]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setProducts([]);
        setSearchError("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // SEARCH PRODUCT with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.length >= 2) {
        fetchProducts();
      } else {
        setProducts([]);
        setSearchError("");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [search]);

  // Test backend connection
  const testBackendConnection = async () => {
    try {
      console.log('Testing backend connection...');
      const response = await api.get('/invoice?page=1&per_page=1');
      console.log('Backend connection successful:', response.data);
      fetchInvoices();
      fetchDashboardStats();
    } catch (err) {
      console.error('Backend connection failed:', err);
      setError('Cannot connect to backend server. Please make sure it\'s running on port 5000.');
    }
  };

  // Fetch invoices from backend
  const fetchInvoices = async () => {
    if (!isAuthenticated) return;
    
    setInvoicesLoading(true);
    setError('');
    
    try {
      const url = `/invoice?page=${pagination.page}&per_page=${pagination.per_page}`;
      const response = await api.get(url);
      
      if (response.data && response.data.success) {
        setInvoices(response.data.items || []);
        setFilteredInvoices(response.data.items || []);
        setPagination({
          page: response.data.page || 1,
          per_page: response.data.per_page || 10,
          total: response.data.total || 0,
          pages: response.data.pages || 1
        });
      } else {
        setError(response.data?.error || 'Failed to load invoices');
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load invoices');
    } finally {
      setInvoicesLoading(false);
    }
  };

  // Apply filters to invoices
  const applyFilters = () => {
    let filtered = [...invoices];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(inv => 
        (inv.invoice_number?.toLowerCase().includes(term)) ||
        (inv.customer_name?.toLowerCase().includes(term)) ||
        (inv.customer_phone?.toLowerCase().includes(term)) ||
        (inv.customer_email?.toLowerCase().includes(term))
      );
    }

    // Date range filter
    if (dateRange.start && dateRange.end) {
      const start = new Date(dateRange.start);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59, 999);
      
      filtered = filtered.filter(inv => {
        const invDate = new Date(inv.invoice_date);
        return invDate >= start && invDate <= end;
      });
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(inv => 
        (inv.payment_status || inv.paymentStatus) === filterStatus
      );
    }

    // Sorting
    filtered.sort((a, b) => {
      switch(sortBy) {
        case 'newest':
          return new Date(b.invoice_date) - new Date(a.invoice_date);
        case 'oldest':
          return new Date(a.invoice_date) - new Date(b.invoice_date);
        case 'highest':
          return (b.total || 0) - (a.total || 0);
        case 'lowest':
          return (a.total || 0) - (b.total || 0);
        default:
          return 0;
      }
    });

    setFilteredInvoices(filtered);
  };

  // Reset filters
  const resetFilters = () => {
    setSearchTerm('');
    setDateRange({ start: '', end: '' });
    setFilterStatus('all');
    setSortBy('newest');
    setFilteredInvoices(invoices);
  };

  // Fetch dashboard stats
  const fetchDashboardStats = async () => {
    try {
      const response = await api.get('/invoice/stats/dashboard');
      if (response.data && response.data.success) {
        setDashboardStats(response.data.stats);
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    }
  };

  const fetchProducts = async () => {
    if (!isAuthenticated) return;
    
    setSearchLoading(true);
    setSearchError("");
    
    try {
      const response = await api.get(`/billing/search-products?q=${encodeURIComponent(search)}`);
      
      if (Array.isArray(response.data)) {
        setProducts(response.data);
        if (response.data.length === 0) {
          setSearchError("No products found matching your search");
        }
      } else if (response.data.items && Array.isArray(response.data.items)) {
        setProducts(response.data.items);
        if (response.data.items.length === 0) {
          setSearchError("No products found matching your search");
        }
      } else {
        setSearchError("Received unexpected data format from server");
        setProducts([]);
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchError('Failed to search products');
      setProducts([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Fetch single invoice details
  const fetchInvoiceDetails = async (id) => {
    try {
      const response = await api.get(`/invoice/${id}`);
      if (response.data && response.data.success) {
        setViewingInvoice(response.data.invoice);
        setShowViewModal(true);
      }
    } catch (err) {
      console.error('Error fetching invoice details:', err);
      setError('Failed to load invoice details');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Update payment status
  const updatePaymentStatus = async (id, status, method = null) => {
    try {
      const response = await api.patch(`/invoice/${id}/payment`, {
        paymentStatus: status,
        paymentMethod: method
      });
      
      if (response.data && response.data.success) {
        setSuccess('Payment status updated successfully');
        fetchInvoices();
        fetchDashboardStats();
        if (viewingInvoice) {
          fetchInvoiceDetails(id);
        }
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Error updating payment status:', err);
      setError('Failed to update payment status');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Validate customer form
  const validateCustomerForm = () => {
    const errors = {};
    if (!customer.name.trim()) errors.name = "Customer name is required";
    if (!customer.phone.trim()) errors.phone = "Phone number is required";
    else if (!/^\d{8,15}$/.test(customer.phone.replace(/\D/g, ''))) errors.phone = "Phone must be 8-15 digits";
    
    if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
      errors.email = "Invalid email format";
    }
    
    setCustomerErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle next step
  const handleNextStep = () => {
    if (modalStep === 1 && validateCustomerForm()) {
      setModalStep(2);
    } else if (modalStep === 2 && items.length > 0) {
      setModalStep(3);
    }
  };

  // Handle back step
  const handleBackStep = () => {
    setModalStep(modalStep - 1);
  };

  // Reset form
  const resetForm = () => {
    setCustomer({ name: "", phone: "", email: "", address: "", gstin: "", attn: "" });
    setYourPoNo("");
    setOurDoNo("");
    setBankName("[Bank name]");
    setAccountNo("[Account number]");
    setBankCode("[Code]");
    setItems([]);
    setDiscount(0);
    setDiscountType("fixed");
    setNotes("");
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setDueDate(new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0]);
    setPaymentMethod('cash');
    setPaymentStatus('unpaid');
    setIsInterState(false);
    setModalStep(1);
    setCustomerErrors({});
    setSearch("");
    setProducts([]);
    setSearchError("");
    setError('');
    setSuccess('');
    setSavedInvoice(null);
  };

  // ADD PRODUCT
  const addProduct = (product) => {
    const existing = items.find((i) => i.productId === product.id);
    if (existing) {
      setItems(
        items.map((i) =>
          i.productId === product.id 
            ? { ...i, quantity: i.quantity + 1 } 
            : i
        )
      );
      setSuccess(`${product.name} quantity increased`);
    } else {
      setItems([...items, { 
        productId: product.id, 
        name: product.name, 
        model: product.model || '', 
        price: product.sellPrice || product.price || 0,
        mrp: product.mrp || product.sellPrice || product.price || 0,
        quantity: 1,
        unit: product.unit || 'nos',
        hsnCode: product.hsnCode || "",
        gst: product.gst || 0
      }]);
      setSuccess(`${product.name} added to invoice`);
    }
    setSearch("");
    setProducts([]);
    setSearchError("");
    
    setTimeout(() => setSuccess(''), 2000);
  };

  // CHANGE QTY
  const changeQty = (index, qty) => {
    if (qty < 1) qty = 1;
    const updated = [...items];
    updated[index].quantity = qty;
    setItems(updated);
  };

  // CHANGE UNIT
  const changeUnit = (index, unit) => {
    const updated = [...items];
    updated[index].unit = unit;
    setItems(updated);
  };

  // REMOVE PRODUCT
  const removeItem = (index) => {
    const updated = [...items];
    const removedItem = updated[index];
    updated.splice(index, 1);
    setItems(updated);
    setSuccess(`${removedItem.name} removed from invoice`);
    setTimeout(() => setSuccess(''), 2000);
  };

  // CALCULATIONS
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const calculateDiscount = () => {
    if (discountType === "percentage") {
      return (subtotal * discount) / 100;
    }
    return discount;
  };

  const discountAmount = calculateDiscount();
  const taxableAmount = subtotal - discountAmount;

  // Calculate GST
  const calculateGST = () => {
    const gstDetails = {};
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    
    items.forEach(item => {
      const gstRate = item.gst || 0;
      const itemTotal = (item.price * item.quantity);
      const taxableValue = itemTotal * (100 / (100 + gstRate));
      const gstAmount = itemTotal - taxableValue;
      
      if (!gstDetails[gstRate]) {
        gstDetails[gstRate] = {
          taxable: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          total: 0
        };
      }
      
      if (gstRate > 0) {
        if (isInterState) {
          gstDetails[gstRate].igst += gstAmount;
          igstTotal += gstAmount;
        } else {
          gstDetails[gstRate].cgst += gstAmount / 2;
          gstDetails[gstRate].sgst += gstAmount / 2;
          cgstTotal += gstAmount / 2;
          sgstTotal += gstAmount / 2;
        }
        gstDetails[gstRate].taxable += taxableValue;
      } else {
        gstDetails[gstRate].taxable += itemTotal;
      }
      gstDetails[gstRate].total += itemTotal;
    });
    
    return { gstDetails, cgstTotal, sgstTotal, igstTotal };
  };

  const { gstDetails, cgstTotal, sgstTotal, igstTotal } = calculateGST();
  const total = taxableAmount + cgstTotal + sgstTotal + igstTotal;

  // SAVE INVOICE
  const saveInvoice = async () => {
    if (!isAuthenticated) {
      setError('Please login first');
      return;
    }

    if (items.length === 0) {
      setError("Add products first");
      setTimeout(() => setError(''), 3000);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const payload = {
      customerName: customer.name.trim(),
      customerPhone: customer.phone.replace(/\D/g, ''),
      customerEmail: customer.email.trim() || '',
      customerAddress: customer.address.trim() || '',
      customerGstin: customer.gstin ? customer.gstin.trim().toUpperCase() : '',
      attn: (customer.attn || '').trim(),
      yourPoNo: yourPoNo.trim(),
      ourDoNo: ourDoNo.trim(),
      bankName: bankName.trim(),
      accountNo: accountNo.trim(),
      bankCode: bankCode.trim(),
      invoiceDate,
      dueDate,
      discountType,
      discountRate: discount,
      notes: notes.trim() || '',
      paymentMethod,
      paymentStatus,
      isInterState,
      items: items.map((item) => ({ 
        productId: item.productId, 
        quantity: item.quantity,
        unit: item.unit || 'nos',
        price: item.price,
        hsnCode: item.hsnCode,
        gst: item.gst || 0
      }))
    };

    try {
      const res = await api.post('/invoice', payload);
      
      if (res.data && res.data.success) {
        setSavedInvoice(res.data.invoice);
        setSuccess(`✅ Invoice Created Successfully!\nInvoice Number: ${res.data.invoiceNumber}`);
        
        fetchInvoices();
        fetchDashboardStats();
        
        setTimeout(() => {
          if (window.confirm(`Invoice ${res.data.invoiceNumber} saved successfully!\n\nDo you want to print it?`)) {
            handlePrintInvoice(res.data.invoice);
          }
          
          resetForm();
          setShowModal(false);
          setSuccess('');
        }, 2000);
      } else {
        setError(res.data?.error || 'Failed to save invoice');
      }
      
    } catch (err) {
      console.error("Error creating invoice:", err);
      
      let errorMessage = "Failed to save invoice. ";
      
      if (err.response) {
        if (err.response.status === 401) {
          errorMessage = "Session expired. Please login again.";
        } else if (err.response.status === 400) {
          errorMessage = err.response.data?.error || "Invalid data. Please check your inputs.";
        } else if (err.response.status === 500) {
          errorMessage = "Server error. Please try again later.";
        } else {
          errorMessage = err.response.data?.message || `Error (Status: ${err.response.status})`;
        }
      } else if (err.request) {
        errorMessage = "No response from server. Please check your connection.";
      } else {
        errorMessage = "Error setting up request. Please try again.";
      }
      
      setError(errorMessage);
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  // Function to convert number to words
  const numberToWords = (num) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    
    const convertLessThanThousand = (n) => {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + ' ' + ones[n % 10];
      return ones[Math.floor(n / 100)] + ' Hundred ' + convertLessThanThousand(n % 100);
    };
    
    let amount = Math.floor(num);
    const paise = Math.round((num - amount) * 100);
    
    let words = '';
    if (amount >= 10000000) {
      words += convertLessThanThousand(Math.floor(amount / 10000000)) + ' Crore ';
      amount %= 10000000;
    }
    if (amount >= 100000) {
      words += convertLessThanThousand(Math.floor(amount / 100000)) + ' Lakh ';
      amount %= 100000;
    }
    if (amount >= 1000) {
      words += convertLessThanThousand(Math.floor(amount / 1000)) + ' Thousand ';
      amount %= 1000;
    }
    words += convertLessThanThousand(amount);
    
    if (paise > 0) {
      words += ' and ' + convertLessThanThousand(paise) + ' Paise';
    }
    
    return words.trim() || 'Zero Rupees';
  };

  // Function to print invoice
  const handlePrintInvoice = (invoice) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print the invoice');
      return;
    }

    const formatDisplayDate = (dateString) => {
      if (!dateString) return '';
      try {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return dateString;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      } catch (e) {
        return dateString;
      }
    };

    const items = invoice.items || [];
    const totalRowsCount = Math.max(15, items.length);

    let rowsHtml = '';
    for (let i = 0; i < totalRowsCount; i++) {
      const rowNo = i + 1;
      if (i < items.length) {
        const item = items[i];
        const desc = (item.product_name || item.productName || '') + (item.product_model ? ` (${item.product_model})` : '');
        const qty = item.quantity !== undefined ? item.quantity : '';
        const unit = item.unit || 'nos';
        const price = safeNumber(item.price).toFixed(2);
        const amount = safeNumber(item.total || (item.price * item.quantity)).toFixed(2);
        rowsHtml += `
          <tr>
            <td class="col-no">${rowNo}</td>
            <td class="col-desc">${desc}</td>
            <td class="col-qty">${qty}</td>
            <td class="col-unit">${unit}</td>
            <td class="col-price">${price}</td>
            <td class="col-amount">${amount}</td>
          </tr>
        `;
      } else {
        rowsHtml += `
          <tr>
            <td class="col-no">${rowNo}</td>
            <td class="col-desc"></td>
            <td class="col-qty"></td>
            <td class="col-unit"></td>
            <td class="col-price"></td>
            <td class="col-amount"></td>
          </tr>
        `;
      }
    }

    const totalAmount = safeNumber(invoice.total).toFixed(2);

    const printContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Invoice ${invoice.invoice_number || invoice.invoiceNumber || 'PQM-INV'}</title>
        <style>
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm 12mm 8mm 12mm;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            padding: 10px 15px;
            color: #000;
            background: #fff;
            font-size: 11px;
            line-height: 1.25;
          }
          .invoice-container {
            width: 100%;
            max-width: 780px;
            margin: 0 auto;
          }
          /* Header */
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 2px;
          }
          .header-left {
            width: 130px;
            vertical-align: middle;
            text-align: left;
          }
          .header-left img {
            width: 115px;
            height: auto;
            display: block;
          }
          .header-center {
            text-align: center;
            vertical-align: middle;
            padding: 0 10px;
          }
          .header-right {
            width: 90px;
            vertical-align: middle;
            text-align: right;
          }
          .header-right img {
            width: 58px;
            height: auto;
            display: inline-block;
          }
          .company-name {
            color: #0b2f6b;
            font-size: 13.5pt;
            font-weight: 800;
            letter-spacing: 0.3px;
            margin-bottom: 2px;
            text-transform: uppercase;
          }
          .company-tags {
            color: #0284c7;
            font-size: 8.5pt;
            font-weight: 600;
            margin-bottom: 3px;
          }
          .company-tags span {
            margin: 0 1px;
          }
          .company-info {
            color: #555;
            font-size: 8pt;
            line-height: 1.35;
          }
          .company-info strong {
            color: #333;
          }
          /* Divider */
          .divider-container {
            margin-top: 8px;
            margin-bottom: 12px;
          }
          .divider-thick {
            height: 2.5px;
            background-color: #022362;
          }
          .divider-gap {
            height: 2px;
          }
          .divider-thin {
            height: 1.5px;
            background-color: #46a8e5;
          }
          /* Document Title */
          .doc-title {
            text-align: center;
            color: #0b2f6b;
            font-size: 15pt;
            font-weight: 800;
            letter-spacing: 1.5px;
            margin-bottom: 12px;
            text-transform: uppercase;
          }
          /* Details Box */
          .meta-wrapper {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            width: 100%;
          }
          .meta-table {
            border-collapse: collapse;
          }
          .meta-left {
            width: 58%;
          }
          .meta-left .meta-label {
            width: 65px;
          }
          .meta-right {
            width: 40%;
          }
          .meta-right .meta-label {
            width: 95px;
          }
          .meta-label {
            color: #0b2f6b;
            font-weight: bold;
            font-size: 8.5pt;
            padding: 2px 4px 2px 0;
            vertical-align: middle;
            white-space: nowrap;
          }
          .meta-val {
            background-color: #fff9db !important;
            font-size: 8.5pt;
            padding: 2px 6px;
            color: #000;
            height: 18px;
            vertical-align: middle;
          }
          /* Items Table */
          .items-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          .items-table th {
            background-color: #0b2f6b !important;
            color: #ffffff !important;
            font-weight: bold;
            font-size: 8.5pt;
            padding: 4px 2px;
            border: 1px solid #9ca3af;
            text-align: center;
            vertical-align: middle;
          }
          .items-table td {
            font-size: 8.5pt;
            padding: 2.5px 5px;
            border: 1px solid #9ca3af;
            height: 18px;
            line-height: 1.2;
          }
          .col-no {
            width: 6%;
            text-align: center;
            background-color: #ffffff !important;
          }
          .col-desc {
            width: 46%;
            text-align: left;
            background-color: #fff9db !important;
            white-space: pre-wrap;
            word-break: break-word;
          }
          .col-qty {
            width: 7%;
            text-align: center;
            background-color: #fff9db !important;
          }
          .col-unit {
            width: 7%;
            text-align: center;
            background-color: #fff9db !important;
          }
          .col-price {
            width: 17%;
            text-align: right;
            background-color: #fff9db !important;
          }
          .col-amount {
            width: 17%;
            text-align: right;
            background-color: #ffffff !important;
          }
          /* Total & GST notice bar */
          .bottom-bar {
            width: 100%;
            border-collapse: collapse;
            margin-top: 0;
            table-layout: fixed;
          }
          .gst-note-cell {
            width: 66%;
            font-style: italic;
            font-size: 8pt;
            color: #666;
            vertical-align: top;
            padding-top: 4px;
            padding-left: 2px;
            text-align: left;
          }
          .total-label-cell {
            width: 17%;
            background-color: #0b2f6b !important;
            color: #ffffff !important;
            font-weight: bold;
            text-align: center;
            font-size: 8.5pt;
            padding: 4px 6px;
            border-left: 1px solid #0b2f6b;
            border-right: 1px solid #0b2f6b;
            border-bottom: 1px solid #0b2f6b;
          }
          .total-value-cell {
            width: 17%;
            background-color: #ffffff !important;
            color: #000;
            font-weight: bold;
            text-align: right;
            font-size: 8.5pt;
            padding: 4px 5px;
            border-right: 1px solid #9ca3af;
            border-bottom: 1px solid #9ca3af;
            border-left: 1px solid #9ca3af;
          }
          /* Payment details */
          .section-heading {
            color: #0b2f6b;
            font-size: 9pt;
            font-weight: bold;
            margin-top: 8px;
            margin-bottom: 3px;
            text-transform: uppercase;
          }
          .payment-table {
            border-collapse: collapse;
            font-size: 8.5pt;
            width: 80%;
          }
          .pay-label {
            font-weight: bold;
            color: #000;
            width: 140px;
            padding: 1.5px 0;
            vertical-align: middle;
            white-space: nowrap;
          }
          .pay-val {
            color: #000;
            padding: 1.5px 6px;
            vertical-align: middle;
          }
          .pay-highlight-row {
            background-color: #fff9db !important;
          }
          .payment-subtext {
            font-size: 7.5pt;
            font-style: italic;
            color: #777;
            margin-top: 3px;
            margin-bottom: 8px;
          }
          /* Terms */
          .terms-ol {
            margin: 2px 0 0 0;
            padding-left: 14px;
            font-size: 7.5pt;
            line-height: 1.35;
            color: #000;
          }
          .terms-ol li {
            margin-bottom: 2px;
          }
          /* Signatures */
          .signatures-container {
            display: flex;
            justify-content: space-between;
            margin-top: 25px;
            margin-bottom: 12px;
          }
          .sig-block {
            width: 44%;
          }
          .sig-title {
            font-weight: bold;
            font-size: 8.5pt;
            color: #000;
            margin-bottom: 38px;
          }
          .sig-line {
            border-bottom: 1.2px solid #000;
            width: 100%;
            margin-bottom: 4px;
          }
          .sig-legend {
            font-size: 7.5pt;
            color: #666;
          }
          /* Page footer */
          .page-footer {
            text-align: center;
            font-size: 7.5pt;
            color: #555;
            margin-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <!-- Top Header -->
          <table class="header-table">
            <tr>
              <td class="header-left">
                <img src="${POWERQ_LOGO_BASE64}" alt="PowerQ Max Logo" />
              </td>
              <td class="header-center">
                <div class="company-name">POWERQ MAX ENGINEERING PTE LTD</div>
                <div class="company-tags">
                  <span>Electrical</span> &bull; 
                  <span>BMS</span> &bull; 
                  <span>ELV &amp; Security</span> &bull; 
                  <span>Fire Alarm</span> &bull; 
                  <span>Renovation</span> &bull; 
                  <span>IT</span>
                </div>
                <div class="company-info">Company Registration No. (UEN): 202649167W</div>
                <div class="company-info">10 Jalan Besar, #15-02, Sim Lim Tower, Singapore 208787</div>
                <div class="company-info"><strong>Tel:</strong> +65 9860 4001 &nbsp;|&nbsp; <strong>Email:</strong> powerqmaxengineering@gmail.com</div>
              </td>
              <td class="header-right">
                <img src="${BCA_LOGO_BASE64}" alt="BCA Registered Contractor" />
              </td>
            </tr>
          </table>

          <!-- Double line divider -->
          <div class="divider-container">
            <div class="divider-thick"></div>
            <div class="divider-gap"></div>
            <div class="divider-thin"></div>
          </div>

          <!-- Document Title -->
          <div class="doc-title">INVOICE</div>

          <!-- Metadata Section -->
          <div class="meta-wrapper">
            <table class="meta-table meta-left">
              <tr>
                <td class="meta-label">To:</td>
                <td class="meta-val">${invoice.customer_name || invoice.customerName || ''}</td>
              </tr>
              <tr>
                <td class="meta-label">Attn:</td>
                <td class="meta-val">${invoice.attn || ''}</td>
              </tr>
              <tr>
                <td class="meta-label">Address:</td>
                <td class="meta-val">${invoice.customer_address || invoice.customerAddress || ''}</td>
              </tr>
              <tr>
                <td class="meta-label">Tel:</td>
                <td class="meta-val">${invoice.customer_phone || invoice.customerPhone || ''}</td>
              </tr>
              <tr>
                <td class="meta-label">Email:</td>
                <td class="meta-val">${invoice.customer_email || invoice.customerEmail || ''}</td>
              </tr>
            </table>

            <table class="meta-table meta-right">
              <tr>
                <td class="meta-label">Invoice No.:</td>
                <td class="meta-val">${invoice.invoice_number || invoice.invoiceNumber || 'PQM-INV-0001'}</td>
              </tr>
              <tr>
                <td class="meta-label">Date:</td>
                <td class="meta-val">${formatDisplayDate(invoice.invoice_date || invoice.invoiceDate)}</td>
              </tr>
              <tr>
                <td class="meta-label">Your PO No.:</td>
                <td class="meta-val">${invoice.your_po_no || invoice.yourPoNo || ''}</td>
              </tr>
              <tr>
                <td class="meta-label">Our DO No.:</td>
                <td class="meta-val">${invoice.our_do_no || invoice.ourDoNo || ''}</td>
              </tr>
              <tr>
                <td class="meta-label">Due Date:</td>
                <td class="meta-val">${formatDisplayDate(invoice.due_date || invoice.dueDate)}</td>
              </tr>
            </table>
          </div>

          <!-- Items Table -->
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 6%;">No.</th>
                <th style="width: 46%;">Description</th>
                <th style="width: 7%;">Qty</th>
                <th style="width: 7%;">Unit</th>
                <th style="width: 17%;">Unit Price<br/>(SGD)</th>
                <th style="width: 17%;">Amount (SGD)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <!-- GST Notice & Total Due -->
          <table class="bottom-bar">
            <tr>
              <td class="gst-note-cell">Not GST-registered &ndash; no GST charged.</td>
              <td class="total-label-cell">TOTAL DUE</td>
              <td class="total-value-cell">${totalAmount}</td>
            </tr>
          </table>

          <!-- Payment Details -->
          <div class="section-heading">PAYMENT DETAILS</div>
          <table class="payment-table">
            <tr>
              <td class="pay-label">Account Name:</td>
              <td class="pay-val">PowerQ Max Engineering Pte Ltd</td>
            </tr>
            <tr>
              <td class="pay-label">Bank:</td>
              <td class="pay-val pay-highlight-row">${invoice.bank_name || invoice.bankName || '[Bank name]'}</td>
            </tr>
            <tr>
              <td class="pay-label">Account No.:</td>
              <td class="pay-val pay-highlight-row">${invoice.account_no || invoice.accountNo || '[Account number]'}</td>
            </tr>
            <tr>
              <td class="pay-label">Bank Code / SWIFT:</td>
              <td class="pay-val pay-highlight-row">${invoice.bank_code || invoice.bankCode || '[Code]'}</td>
            </tr>
            <tr>
              <td class="pay-label">PayNow (UEN):</td>
              <td class="pay-val">202649167W</td>
            </tr>
          </table>
          <div class="payment-subtext">Please quote the invoice number as your payment reference.</div>

          <!-- Terms & Conditions -->
          <div class="section-heading">TERMS &amp; CONDITIONS</div>
          <ol class="terms-ol">
            <li>Payment terms: within 30 days from the invoice date.</li>
            <li>Goods sold and works done remain the property of PowerQ Max Engineering Pte Ltd until full payment is received.</li>
            <li>Please raise any queries on this invoice within 7 days of the invoice date.</li>
            <li>Payment by bank transfer or PayNow only. In line with the phase-out of cheques in Singapore, cheques will not be accepted from 1 January 2027.</li>
          </ol>

          <!-- Signatures -->
          <div class="signatures-container">
            <div class="sig-block">
              <div class="sig-title">For PowerQ Max Engineering Pte Ltd</div>
              <div class="sig-line"></div>
              <div class="sig-legend">Name / Signature / Company Stamp / Date</div>
            </div>
            <div class="sig-block">
              <div class="sig-title">Received by Customer</div>
              <div class="sig-line"></div>
              <div class="sig-legend">Name / Signature / Company Stamp / Date</div>
            </div>
          </div>

          <!-- Footer -->
          <div class="page-footer">Page 1 of 1</div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  // Show login required message if not authenticated
  if (!isAuthenticated) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h2 style={styles.title}>Invoices</h2>
        </div>
        <div style={styles.authMessage}>
          <h3>🔒 Authentication Required</h3>
          <p style={{color: '#dc3545', margin: '20px 0'}}>{error || 'Please login to access invoices'}</p>
          <button 
            style={styles.createButton}
            onClick={() => window.location.href = '/login'}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header with Create Button */}
      <div style={styles.header}>
        <h2 style={styles.title}>Invoices</h2>
        <button 
          style={styles.createButton}
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
        >
          + Create New Invoice
        </button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div style={{...styles.alert, ...styles.alertError, marginBottom: '20px', whiteSpace: 'pre-wrap'}}>
          ⚠️ {error}
        </div>
      )}
      
      {success && (
        <div style={{...styles.alert, ...styles.alertSuccess, marginBottom: '20px', whiteSpace: 'pre-wrap'}}>
          ✅ {success}
        </div>
      )}

      {/* Search and Filter Bar */}
      <div style={styles.filterBar}>
        <div style={styles.searchBox}>
          <input
            type="text"
            style={styles.searchInput}
            placeholder="Search by invoice #, customer name, phone, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              style={styles.clearSearch}
              onClick={() => setSearchTerm('')}
            >
              ×
            </button>
          )}
        </div>

        <input
          type="date"
          style={styles.filterInput}
          value={dateRange.start}
          onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
          placeholder="From Date"
        />

        <input
          type="date"
          style={styles.filterInput}
          value={dateRange.end}
          onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
          placeholder="To Date"
        />

        <select
          style={styles.filterSelect}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
        </select>

        <select
          style={styles.filterSelect}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="highest">Highest Amount</option>
          <option value="lowest">Lowest Amount</option>
        </select>

        <button 
          style={styles.resetButton}
          onClick={resetFilters}
        >
          Reset Filters
        </button>
      </div>

      {/* Results count */}
      {!invoicesLoading && (
        <div style={styles.resultsCount}>
          Showing {filteredInvoices.length} of {invoices.length} invoices
          {filteredInvoices.length !== invoices.length && (
            <span> (filtered)</span>
          )}
        </div>
      )}

      {/* Invoices Table */}
      <div style={styles.tableContainer}>
        {invoicesLoading ? (
          <div style={styles.loadingState}>Loading invoices...</div>
        ) : filteredInvoices.length === 0 ? (
          <div style={styles.emptyState}>
            <p>No invoices found. Click "Create New Invoice" to get started.</p>
          </div>
        ) : (
          <>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Invoice #</th>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Customer</th>
                  <th style={styles.th}>Phone</th>
                  <th style={styles.th}>Due Date</th>
                  <th style={styles.th}>Total</th>
                  <th style={styles.th}>Payment</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td style={styles.td}>{invoice.invoice_number || invoice.invoiceNumber}</td>
                    <td style={styles.td}>{formatDate(invoice.invoice_date || invoice.invoiceDate)}</td>
                    <td style={styles.td}>{invoice.customer_name || invoice.customerName}</td>
                    <td style={styles.td}>{invoice.customer_phone || invoice.customerPhone}</td>
                    <td style={styles.td}>{formatDate(invoice.due_date || invoice.dueDate)}</td>
                    <td style={styles.td}>₹{safeNumber(invoice.total).toFixed(2)}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.statusBadge,
                        backgroundColor: (invoice.payment_status || invoice.paymentStatus) === 'paid' ? '#10b981' : 
                                       (invoice.payment_status || invoice.paymentStatus) === 'partial' ? '#f59e0b' : '#ef4444'
                      }}>
                        {invoice.payment_status || invoice.paymentStatus || 'unpaid'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.actionButtons}>
                        <button 
                          style={styles.viewButton}
                          onClick={() => fetchInvoiceDetails(invoice.id)}
                        >
                          View
                        </button>
                        <button 
                          style={styles.printButton}
                          onClick={() => handlePrintInvoice(invoice)}
                        >
                          Print
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div style={styles.pagination}>
                <button 
                  style={styles.pageButton}
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                  disabled={pagination.page === 1}
                >
                  Previous
                </button>
                <span style={styles.pageInfo}>
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button 
                  style={styles.pageButton}
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                  disabled={pagination.page === pagination.pages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* View Invoice Modal */}
      {showViewModal && viewingInvoice && (
        <div style={styles.modalOverlay}>
          <div style={{...styles.modal, maxWidth: '1000px'}} ref={viewModalRef}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                Invoice Details - {viewingInvoice.invoice_number || viewingInvoice.invoiceNumber}
              </h3>
              <button 
                style={styles.closeButton}
                onClick={() => {
                  setShowViewModal(false);
                  setViewingInvoice(null);
                }}
              >
                ×
              </button>
            </div>
            
            <div style={styles.modalContent}>
              {/* Company Header */}
              <div style={styles.viewCompanyHeader}>
                <h3 style={{color: '#3b82f6', margin: 0}}>{companyDetails.name}</h3>
                <p style={{margin: '5px 0', color: '#94a3b8'}}>{companyDetails.address}</p>
                <p style={{margin: 0, color: '#94a3b8'}}>Phone: {companyDetails.phone} | Email: {companyDetails.email}</p>
              </div>

              {/* Status Update Section */}
              <div style={styles.statusUpdateSection}>
                <h4 style={styles.viewSectionTitle}>Update Payment Status</h4>
                <div style={styles.statusUpdateRow}>
                  <div style={styles.statusUpdateField}>
                    <label style={styles.label}>Payment Status</label>
                    <select 
                      style={styles.statusSelect}
                      value={viewingInvoice.payment_status || viewingInvoice.paymentStatus || 'unpaid'}
                      onChange={(e) => updatePaymentStatus(viewingInvoice.id, e.target.value, viewingInvoice.payment_method || viewingInvoice.paymentMethod)}
                    >
                      <option value="paid">Paid</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="partial">Partial</option>
                    </select>
                  </div>
                  <div style={styles.statusUpdateField}>
                    <label style={styles.label}>Payment Method</label>
                    <select 
                      style={styles.statusSelect}
                      value={viewingInvoice.payment_method || viewingInvoice.paymentMethod || 'cash'}
                      onChange={(e) => updatePaymentStatus(viewingInvoice.id, viewingInvoice.payment_status || viewingInvoice.paymentStatus, e.target.value)}
                    >
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cheque">Cheque</option>
                      <option value="online">Online</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={styles.viewTwoColumn}>
                <div style={styles.viewColumn}>
                  <div style={styles.viewSection}>
                    <h4 style={styles.viewSectionTitle}>Bill To:</h4>
                    <div style={styles.viewCard}>
                      <p><strong>{viewingInvoice.customer_name || viewingInvoice.customerName}</strong></p>
                      {viewingInvoice.attn && <p><strong>Attn:</strong> {viewingInvoice.attn}</p>}
                      <p>Phone: {viewingInvoice.customer_phone || viewingInvoice.customerPhone}</p>
                      {(viewingInvoice.customer_email || viewingInvoice.customerEmail) && <p>Email: {viewingInvoice.customer_email || viewingInvoice.customerEmail}</p>}
                      {(viewingInvoice.customer_address || viewingInvoice.customerAddress) && <p>Address: {viewingInvoice.customer_address || viewingInvoice.customerAddress}</p>}
                      {(viewingInvoice.customer_gstin || viewingInvoice.customerGstin) && <p>GSTIN: {viewingInvoice.customer_gstin || viewingInvoice.customerGstin}</p>}
                    </div>
                  </div>
                </div>

                <div style={styles.viewColumn}>
                  <div style={styles.viewSection}>
                    <h4 style={styles.viewSectionTitle}>Invoice Details:</h4>
                    <div style={styles.viewCard}>
                      <p><strong>Invoice No:</strong> {viewingInvoice.invoice_number || viewingInvoice.invoiceNumber}</p>
                      <p><strong>Date:</strong> {formatDate(viewingInvoice.invoice_date || viewingInvoice.invoiceDate)}</p>
                      <p><strong>Due Date:</strong> {formatDate(viewingInvoice.due_date || viewingInvoice.dueDate)}</p>
                      {(viewingInvoice.your_po_no || viewingInvoice.yourPoNo) && <p><strong>Your PO No:</strong> {viewingInvoice.your_po_no || viewingInvoice.yourPoNo}</p>}
                      {(viewingInvoice.our_do_no || viewingInvoice.ourDoNo) && <p><strong>Our DO No:</strong> {viewingInvoice.our_do_no || viewingInvoice.ourDoNo}</p>}
                      <p><strong>Payment Method:</strong> {(viewingInvoice.payment_method || viewingInvoice.paymentMethod || 'cash').toUpperCase()}</p>
                      <p><strong>Transaction Type:</strong> {safeNumber(viewingInvoice.igst_total || viewingInvoice.igstTotal) > 0 ? 'Inter-State (IGST)' : 'Intra-State (CGST+SGST)'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div style={styles.viewSection}>
                <h4 style={styles.viewSectionTitle}>Items</h4>
                <div style={styles.tableContainer}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Product</th>
                        <th style={styles.th}>HSN</th>
                        <th style={styles.th}>Price</th>
                        <th style={styles.th}>Qty</th>
                        <th style={styles.th}>Unit</th>
                        <th style={styles.th}>GST%</th>
                        <th style={styles.th}>CGST</th>
                        <th style={styles.th}>SGST</th>
                        <th style={styles.th}>IGST</th>
                        <th style={styles.th}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingInvoice.items?.map((item, index) => (
                        <tr key={index}>
                          <td style={styles.td}>
                            <div>{item.product_name || item.productName}</div>
                            {(item.product_model || item.productModel) && <small style={styles.modelText}>{item.product_model || item.productModel}</small>}
                          </td>
                          <td style={styles.td}>{item.hsn_code || item.hsnCode || '-'}</td>
                          <td style={styles.td}>₹{safeNumber(item.price).toFixed(2)}</td>
                          <td style={styles.td}>{item.quantity}</td>
                          <td style={styles.td}>{item.unit || 'nos'}</td>
                          <td style={styles.td}>{safeNumber(item.gst_rate || item.gst)}%</td>
                          <td style={styles.td}>₹{safeNumber(item.cgst).toFixed(2)}</td>
                          <td style={styles.td}>₹{safeNumber(item.sgst).toFixed(2)}</td>
                          <td style={styles.td}>₹{safeNumber(item.igst).toFixed(2)}</td>
                          <td style={styles.td}>₹{safeNumber(item.total).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={styles.viewSummary}>
                <div style={styles.viewSummaryItem}><strong>Subtotal:</strong> ₹{safeNumber(viewingInvoice.subtotal).toFixed(2)}</div>
                {safeNumber(viewingInvoice.discount) > 0 && (
                  <div style={styles.viewSummaryItem}><strong>Discount:</strong> -₹{safeNumber(viewingInvoice.discount).toFixed(2)}</div>
                )}
                <div style={styles.viewSummaryItem}><strong>Taxable Amount:</strong> ₹{(safeNumber(viewingInvoice.subtotal) - safeNumber(viewingInvoice.discount)).toFixed(2)}</div>
                {safeNumber(viewingInvoice.cgst_total || viewingInvoice.cgstTotal) > 0 && (
                  <div style={styles.viewSummaryItem}><strong>CGST:</strong> ₹{safeNumber(viewingInvoice.cgst_total || viewingInvoice.cgstTotal).toFixed(2)}</div>
                )}
                {safeNumber(viewingInvoice.sgst_total || viewingInvoice.sgstTotal) > 0 && (
                  <div style={styles.viewSummaryItem}><strong>SGST:</strong> ₹{safeNumber(viewingInvoice.sgst_total || viewingInvoice.sgstTotal).toFixed(2)}</div>
                )}
                {safeNumber(viewingInvoice.igst_total || viewingInvoice.igstTotal) > 0 && (
                  <div style={styles.viewSummaryItem}><strong>IGST:</strong> ₹{safeNumber(viewingInvoice.igst_total || viewingInvoice.igstTotal).toFixed(2)}</div>
                )}
                <div style={{...styles.viewSummaryItem, ...styles.viewTotal}}>
                  <strong>Total:</strong> ₹{safeNumber(viewingInvoice.total).toFixed(2)}
                </div>
                <div style={styles.viewAmountWords}>
                  <strong>Amount in Words:</strong> {numberToWords(safeNumber(viewingInvoice.total))} Only
                </div>
              </div>

              {viewingInvoice.notes && (
                <div style={styles.viewSection}>
                  <h4 style={styles.viewSectionTitle}>Terms & Conditions</h4>
                  <div style={styles.viewCard}>
                    <p style={{margin: 0, whiteSpace: 'pre-wrap'}}>{viewingInvoice.notes}</p>
                  </div>
                </div>
              )}

              <div style={styles.viewActions}>
                <button 
                  style={styles.printButton}
                  onClick={() => handlePrintInvoice(viewingInvoice)}
                >
                  🖨️ Print Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal} ref={modalRef}>
            {/* Modal Header */}
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {modalStep === 1 ? "Customer Details" : 
                 modalStep === 2 ? "Add Products" : 
                 "Payment & Summary"}
              </h3>
              <div style={styles.stepIndicator}>
                Step {modalStep} of 3
              </div>
              <button 
                style={styles.closeButton}
                onClick={() => {
                  if (items.length > 0 || customer.name || customer.phone) {
                    if (window.confirm("Are you sure you want to close? Your progress will be lost.")) {
                      resetForm();
                      setShowModal(false);
                    }
                  } else {
                    resetForm();
                    setShowModal(false);
                  }
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div style={styles.modalContent}>
              {error && (
                <div style={{...styles.alert, ...styles.alertError, marginBottom: '20px'}}>
                  ⚠️ {error}
                </div>
              )}
              
              {success && (
                <div style={{...styles.alert, ...styles.alertSuccess, marginBottom: '20px'}}>
                  ✅ {success}
                </div>
              )}
              
              {/* Step 1: Customer Details */}
              {modalStep === 1 && (
                <div style={styles.stepContent}>
                  <div style={styles.formGrid}>
                    <div style={styles.formField}>
                      <label style={styles.label}>Customer Name *</label>
                      <input 
                        style={{...styles.input, borderColor: customerErrors.name ? '#ef4444' : '#334155'}}
                        value={customer.name} 
                        onChange={(e) => setCustomer({ ...customer, name: e.target.value })} 
                        placeholder="Enter customer / company name"
                      />
                      {customerErrors.name && (
                        <span style={styles.errorText}>{customerErrors.name}</span>
                      )}
                    </div>

                    <div style={styles.formField}>
                      <label style={styles.label}>Attn (Contact Person)</label>
                      <input 
                        style={styles.input} 
                        value={customer.attn || ''} 
                        onChange={(e) => setCustomer({ ...customer, attn: e.target.value })} 
                        placeholder="e.g. Mr. John Tan"
                      />
                    </div>
                    
                    <div style={styles.formField}>
                      <label style={styles.label}>Phone *</label>
                      <input 
                        style={{...styles.input, borderColor: customerErrors.phone ? '#ef4444' : '#334155'}}
                        value={customer.phone} 
                        onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} 
                        placeholder="e.g. 98604001 or +65 9860 4001"
                      />
                      {customerErrors.phone && (
                        <span style={styles.errorText}>{customerErrors.phone}</span>
                      )}
                    </div>
                    
                    <div style={styles.formField}>
                      <label style={styles.label}>Email</label>
                      <input 
                        style={{...styles.input, borderColor: customerErrors.email ? '#ef4444' : '#334155'}}
                        type="email"
                        value={customer.email} 
                        onChange={(e) => setCustomer({ ...customer, email: e.target.value })} 
                        placeholder="email@example.com"
                      />
                      {customerErrors.email && (
                        <span style={styles.errorText}>{customerErrors.email}</span>
                      )}
                    </div>
                    
                    <div style={styles.formField}>
                      <label style={styles.label}>Address</label>
                      <input 
                        style={styles.input} 
                        value={customer.address} 
                        onChange={(e) => setCustomer({ ...customer, address: e.target.value })} 
                        placeholder="Enter address"
                      />
                    </div>

                    <div style={styles.formField}>
                      <label style={styles.label}>Your PO No.</label>
                      <input 
                        style={styles.input} 
                        value={yourPoNo} 
                        onChange={(e) => setYourPoNo(e.target.value)} 
                        placeholder="Customer Purchase Order No."
                      />
                    </div>

                    <div style={styles.formField}>
                      <label style={styles.label}>Our DO No.</label>
                      <input 
                        style={styles.input} 
                        value={ourDoNo} 
                        onChange={(e) => setOurDoNo(e.target.value)} 
                        placeholder="Delivery Order No."
                      />
                    </div>
                    
                    <div style={styles.formField}>
                      <label style={styles.label}>UEN / GSTIN (Optional)</label>
                      <input 
                        style={styles.input} 
                        value={customer.gstin} 
                        onChange={(e) => setCustomer({ ...customer, gstin: e.target.value.toUpperCase() })} 
                        placeholder="Registration / Tax ID"
                      />
                    </div>
                  </div>

                  <div style={styles.dateSection}>
                    <div style={styles.dateField}>
                      <label style={styles.label}>Invoice Date</label>
                      <input 
                        type="date" 
                        style={styles.dateInput} 
                        value={invoiceDate} 
                        onChange={(e) => setInvoiceDate(e.target.value)} 
                      />
                    </div>
                    <div style={styles.dateField}>
                      <label style={styles.label}>Due Date</label>
                      <input 
                        type="date" 
                        style={styles.dateInput} 
                        value={dueDate} 
                        onChange={(e) => setDueDate(e.target.value)} 
                        min={invoiceDate}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Add Products */}
              {modalStep === 2 && (
                <div style={styles.stepContent}>
                  {/* Product Search */}
                  <div ref={searchRef} style={styles.searchWrapper}>
                    <div style={styles.searchContainer}>
                      <input 
                        style={styles.searchInput} 
                        placeholder="Search product by name, model or SKU... (min 2 characters)" 
                        value={search} 
                        onChange={(e) => setSearch(e.target.value)} 
                      />
                      {searchLoading && <span style={styles.loadingText}>Searching...</span>}
                    </div>
                    
                    {searchError && (
                      <div style={styles.searchError}>
                        {searchError}
                      </div>
                    )}
                    
                    {products.length > 0 && (
                      <div style={styles.dropdown}>
                        {products.map((p) => (
                          <div key={p.id} style={styles.dropdownItem} onClick={() => addProduct(p)}>
                            <div style={styles.productInfo}>
                              <strong>{p.name}</strong> 
                              {p.model && <span style={styles.productModel}>({p.model})</span>}
                              {p.type && <span style={styles.productType}> - {p.type}</span>}
                            </div>
                            <div style={styles.productPrice}>
                              ₹{p.sellPrice || p.price || 0} 
                              {p.quantity !== undefined && (
                                <span style={{...styles.stockInfo, color: p.quantity < 5 ? '#ef4444' : '#94a3b8'}}>
                                  Stock: {p.quantity}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Products Table */}
                  {items.length > 0 && (
                    <div style={styles.tableContainer}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Product</th>
                            <th style={styles.th}>HSN</th>
                            <th style={styles.th}>Price</th>
                            <th style={styles.th}>Qty</th>
                            <th style={styles.th}>Unit</th>
                            <th style={styles.th}>GST%</th>
                            <th style={styles.th}>Total</th>
                            <th style={styles.th}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, index) => (
                            <tr key={index}>
                              <td style={styles.td}>
                                <div>{item.name}</div>
                                {item.model && <small style={styles.modelText}>{item.model}</small>}
                              </td>
                              <td style={styles.td}>{item.hsnCode || "-"}</td>
                              <td style={styles.td}>₹{safeNumber(item.price).toFixed(2)}</td>
                              <td style={styles.td}>
                                <input 
                                  type="number" 
                                  style={styles.qtyInput} 
                                  value={item.quantity} 
                                  min="1"
                                  onChange={(e) => changeQty(index, parseInt(e.target.value) || 1)} 
                                />
                              </td>
                              <td style={styles.td}>
                                <input 
                                  type="text" 
                                  style={{...styles.qtyInput, width: '55px', textAlign: 'center'}} 
                                  value={item.unit || 'nos'} 
                                  onChange={(e) => changeUnit(index, e.target.value)} 
                                  placeholder="nos"
                                />
                              </td>
                              <td style={styles.td}>{item.gst}%</td>
                              <td style={styles.td}>₹{(item.price * item.quantity).toFixed(2)}</td>
                              <td style={styles.td}>
                                <button style={styles.deleteBtn} onClick={() => removeItem(index)}>
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {items.length === 0 && !searchLoading && !searchError && (
                    <div style={styles.emptyState}>
                      <p>No products added yet. Search and add products above.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Payment & Summary */}
              {modalStep === 3 && (
                <div style={styles.stepContent}>
                  {/* Payment Details */}
                  <div style={styles.paymentSection}>
                    <h4 style={styles.sectionTitle}>Payment Details</h4>
                    <div style={styles.paymentGrid}>
                      <div style={styles.formField}>
                        <label style={styles.label}>Payment Method</label>
                        <select 
                          style={styles.select}
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                        >
                          <option value="cash">Cash</option>
                          <option value="card">Card</option>
                          <option value="bank_transfer">Bank Transfer</option>
                          <option value="cheque">Cheque</option>
                          <option value="online">Online</option>
                        </select>
                      </div>
                      
                      <div style={styles.formField}>
                        <label style={styles.label}>Payment Status</label>
                        <select 
                          style={styles.select}
                          value={paymentStatus}
                          onChange={(e) => setPaymentStatus(e.target.value)}
                        >
                          <option value="paid">Paid</option>
                          <option value="unpaid">Unpaid</option>
                          <option value="partial">Partial</option>
                        </select>
                      </div>

                      <div style={styles.formField}>
                        <label style={styles.label}>Bank Name</label>
                        <input 
                          style={styles.input} 
                          value={bankName} 
                          onChange={(e) => setBankName(e.target.value)} 
                          placeholder="[Bank name]"
                        />
                      </div>

                      <div style={styles.formField}>
                        <label style={styles.label}>Account Number</label>
                        <input 
                          style={styles.input} 
                          value={accountNo} 
                          onChange={(e) => setAccountNo(e.target.value)} 
                          placeholder="[Account number]"
                        />
                      </div>

                      <div style={styles.formField}>
                        <label style={styles.label}>Bank Code / SWIFT</label>
                        <input 
                          style={styles.input} 
                          value={bankCode} 
                          onChange={(e) => setBankCode(e.target.value)} 
                          placeholder="[Code]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Transaction Type */}
                  <div style={styles.transactionSection}>
                    <h4 style={styles.sectionTitle}>Transaction Type</h4>
                    <div style={styles.transactionToggle}>
                      <label style={styles.radioLabel}>
                        <input
                          type="radio"
                          checked={!isInterState}
                          onChange={() => setIsInterState(false)}
                        />
                        Intra-State (CGST + SGST)
                      </label>
                      <label style={styles.radioLabel}>
                        <input
                          type="radio"
                          checked={isInterState}
                          onChange={() => setIsInterState(true)}
                        />
                        Inter-State (IGST)
                      </label>
                    </div>
                  </div>

                  {/* Summary */}
                  {items.length > 0 && (
                    <div style={styles.summarySection}>
                      <h4 style={styles.summaryTitle}>Summary</h4>
                      
                      <div style={styles.summaryRow}>
                        <span>Subtotal:</span>
                        <span>₹{subtotal.toFixed(2)}</span>
                      </div>
                      
                      <div style={styles.discountRow}>
                        <select 
                          style={styles.discountTypeSelect}
                          value={discountType}
                          onChange={(e) => {
                            setDiscountType(e.target.value);
                            setDiscount(0);
                          }}
                        >
                          <option value="fixed">Fixed (₹)</option>
                          <option value="percentage">Percentage (%)</option>
                        </select>
                        <input 
                          type="number" 
                          style={styles.discountInput}
                          placeholder={discountType === "fixed" ? "Discount amount" : "Discount %"}
                          value={discount} 
                          min="0"
                          max={discountType === "percentage" ? "100" : subtotal}
                          step={discountType === "fixed" ? "1" : "0.1"}
                          onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} 
                        />
                      </div>

                      {discountAmount > 0 && (
                        <div style={styles.summaryRow}>
                          <span>Discount:</span>
                          <span style={styles.discountAmount}>-₹{discountAmount.toFixed(2)}</span>
                        </div>
                      )}

                      <div style={styles.summaryRow}>
                        <span>Taxable Amount:</span>
                        <span>₹{taxableAmount.toFixed(2)}</span>
                      </div>

                      {Object.keys(gstDetails).length > 0 && (
                        <>
                          <hr style={styles.divider} />
                          <h5 style={styles.gstTitle}>GST Breakdown</h5>
                          {Object.entries(gstDetails).map(([rate, details]) => (
                            rate > 0 ? (
                              <div key={rate} style={styles.gstRow}>
                                <span>GST @{rate}%:</span>
                                <span>
                                  {isInterState ? (
                                    <>IGST: ₹{details.igst.toFixed(2)}</>
                                  ) : (
                                    <>CGST: ₹{details.cgst.toFixed(2)} | SGST: ₹{details.sgst.toFixed(2)}</>
                                  )}
                                </span>
                              </div>
                            ) : null
                          ))}
                        </>
                      )}

                      <div style={styles.totalRow}>
                        <span>Total:</span>
                        <span style={styles.totalAmount}>₹{total.toFixed(2)}</span>
                      </div>

                      <div style={styles.amountWords}>
                        <strong>Amount in Words:</strong> {numberToWords(total)} Only
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div style={styles.notesSection}>
                    <label style={styles.label}>Notes / Terms & Conditions:</label>
                    <textarea 
                      style={styles.notesInput}
                      rows="3"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Enter any additional notes, terms, or conditions..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={styles.modalFooter}>
              {modalStep > 1 && (
                <button 
                  style={styles.backButton}
                  onClick={handleBackStep}
                >
                  Back
                </button>
              )}
              
              {modalStep < 3 ? (
                <button 
                  style={styles.nextButton}
                  onClick={handleNextStep}
                  disabled={modalStep === 2 && items.length === 0}
                >
                  Next
                </button>
              ) : (
                <button 
                  style={styles.saveButton}
                  onClick={saveInvoice}
                  disabled={loading || items.length === 0}
                >
                  {loading ? "Creating..." : "Save Invoice"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: "30px",
    color: "#fff",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    backgroundColor: "#0b1120",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },
  title: {
    fontSize: "28px",
    fontWeight: "600",
    color: "#fff",
    margin: 0,
  },
  authMessage: {
    background: "#1e293b",
    padding: "40px",
    borderRadius: "12px",
    textAlign: "center",
    maxWidth: "400px",
    margin: "100px auto",
  },
  createButton: {
    background: "#3b82f6",
    color: "#fff",
    padding: "12px 24px",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background-color 0.2s",
    ":hover": {
      backgroundColor: "#2563eb",
    },
  },
  filterBar: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto",
    gap: "12px",
    marginBottom: "20px",
    padding: "16px",
    backgroundColor: "#1e293b",
    borderRadius: "8px",
    border: "1px solid #334155",
  },
  searchBox: {
    position: "relative",
  },
  searchInput: {
    width: "100%",
    padding: "10px 12px",
    paddingRight: "35px",
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    color: "#fff",
    borderRadius: "6px",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
    ":focus": {
      borderColor: "#3b82f6",
    },
  },
  clearSearch: {
    position: "absolute",
    right: "8px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    color: "#94a3b8",
    fontSize: "20px",
    cursor: "pointer",
    padding: "0 4px",
    ":hover": {
      color: "#fff",
    },
  },
  filterInput: {
    padding: "10px",
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    color: "#fff",
    borderRadius: "6px",
    fontSize: "14px",
    outline: "none",
  },
  filterSelect: {
    padding: "10px",
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    color: "#fff",
    borderRadius: "6px",
    fontSize: "14px",
    outline: "none",
    cursor: "pointer",
  },
  resetButton: {
    padding: "10px 16px",
    backgroundColor: "#475569",
    border: "none",
    color: "#fff",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "background-color 0.2s",
    ":hover": {
      backgroundColor: "#64748b",
    },
  },
  resultsCount: {
    marginBottom: "12px",
    color: "#94a3b8",
    fontSize: "14px",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    padding: "20px",
  },
  modal: {
    background: "#1e293b",
    borderRadius: "12px",
    width: "100%",
    maxWidth: "1000px",
    maxHeight: "90vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)",
  },
  modalHeader: {
    padding: "20px 24px",
    borderBottom: "1px solid #334155",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: "20px",
    fontWeight: "600",
    color: "#fff",
    margin: 0,
  },
  stepIndicator: {
    color: "#94a3b8",
    fontSize: "14px",
  },
  closeButton: {
    background: "none",
    border: "none",
    color: "#94a3b8",
    fontSize: "24px",
    cursor: "pointer",
    padding: "0 8px",
    ":hover": {
      color: "#fff",
    },
  },
  modalContent: {
    padding: "24px",
    overflowY: "auto",
    flex: 1,
  },
  modalFooter: {
    padding: "20px 24px",
    borderTop: "1px solid #334155",
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
  },
  stepContent: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "16px",
  },
  formField: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  label: {
    color: "#e2e8f0",
    fontSize: "14px",
    fontWeight: "500",
  },
  input: {
    padding: "10px 12px",
    borderRadius: "6px",
    border: "1px solid #334155",
    backgroundColor: "#0f172a",
    color: "#fff",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s",
    ":focus": {
      borderColor: "#3b82f6",
    },
  },
  select: {
    padding: "10px 12px",
    borderRadius: "6px",
    border: "1px solid #334155",
    backgroundColor: "#0f172a",
    color: "#fff",
    fontSize: "14px",
    outline: "none",
  },
  alert: {
    padding: '12px',
    borderRadius: '5px',
    fontWeight: 'bold',
  },
  alertError: {
    background: '#f8d7da',
    color: '#721c24',
    border: '1px solid #f5c6cb',
  },
  alertSuccess: {
    background: '#d4edda',
    color: '#155724',
    border: '1px solid #c3e6cb',
  },
  errorText: {
    color: "#ef4444",
    fontSize: "12px",
    marginTop: "4px",
  },
  dateSection: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "16px",
    marginTop: "8px",
  },
  dateField: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  dateInput: {
    padding: "10px 12px",
    borderRadius: "6px",
    border: "1px solid #334155",
    backgroundColor: "#0f172a",
    color: "#fff",
    fontSize: "14px",
  },
  searchWrapper: {
    position: "relative",
  },
  searchContainer: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "8px",
  },
  loadingText: {
    color: "#94a3b8",
    fontSize: "14px",
  },
  searchError: {
    color: "#ef4444",
    fontSize: "14px",
    padding: "8px 12px",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: "6px",
    marginBottom: "8px",
  },
  dropdown: {
    position: "absolute",
    background: "#1e293b",
    color: "#fff",
    width: "100%",
    marginTop: "4px",
    borderRadius: "6px",
    border: "1px solid #334155",
    maxHeight: "300px",
    overflowY: "auto",
    zIndex: 1001,
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
  },
  dropdownItem: {
    padding: "12px 16px",
    cursor: "pointer",
    borderBottom: "1px solid #334155",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    transition: "background-color 0.2s",
    ":hover": {
      backgroundColor: "#2d3a4f",
    },
  },
  productInfo: {
    display: "flex",
    flexDirection: "column",
  },
  productModel: {
    fontSize: "12px",
    color: "#94a3b8",
    marginLeft: "4px",
  },
  productType: {
    fontSize: "12px",
    color: "#94a3b8",
  },
  productPrice: {
    fontWeight: "600",
    color: "#22c55e",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  stockInfo: {
    fontSize: "12px",
    marginLeft: "8px",
  },
  tableContainer: {
    overflowX: "auto",
    marginTop: "16px",
    maxHeight: "400px",
    overflowY: "auto",
    border: "1px solid #334155",
    borderRadius: "6px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
  },
  th: {
    textAlign: "left",
    padding: "12px 8px",
    borderBottom: "2px solid #334155",
    color: "#94a3b8",
    fontWeight: "600",
    position: "sticky",
    top: 0,
    backgroundColor: "#1e293b",
  },
  td: {
    padding: "12px 8px",
    borderBottom: "1px solid #334155",
  },
  modelText: {
    color: "#94a3b8",
    fontSize: "12px",
  },
  qtyInput: {
    width: "60px",
    padding: "6px",
    borderRadius: "4px",
    border: "1px solid #334155",
    backgroundColor: "#0f172a",
    color: "#fff",
    textAlign: "center",
  },
  deleteBtn: {
    background: "#ef4444",
    color: "#fff",
    border: "none",
    padding: "6px 12px",
    cursor: "pointer",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: "500",
    transition: "background-color 0.2s",
    ":hover": {
      backgroundColor: "#dc2626",
    },
  },
  paymentSection: {
    background: "#0f172a",
    padding: "20px",
    borderRadius: "8px",
  },
  sectionTitle: {
    color: "#e2e8f0",
    fontSize: "16px",
    fontWeight: "600",
    marginBottom: "16px",
  },
  paymentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "16px",
  },
  transactionSection: {
    background: "#0f172a",
    padding: "20px",
    borderRadius: "8px",
  },
  transactionToggle: {
    display: "flex",
    gap: "24px",
  },
  radioLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#e2e8f0",
    fontSize: "14px",
    cursor: "pointer",
  },
  summarySection: {
    background: "#0f172a",
    padding: "16px",
    borderRadius: "8px",
    marginTop: "16px",
  },
  summaryTitle: {
    color: "#e2e8f0",
    fontSize: "16px",
    fontWeight: "600",
    marginBottom: "12px",
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "8px",
    color: "#e2e8f0",
  },
  discountRow: {
    display: "flex",
    gap: "8px",
    marginBottom: "8px",
  },
  discountTypeSelect: {
    padding: "8px",
    borderRadius: "4px",
    border: "1px solid #334155",
    backgroundColor: "#0f172a",
    color: "#fff",
    fontSize: "14px",
    flex: 1,
  },
  discountInput: {
    padding: "8px",
    borderRadius: "4px",
    border: "1px solid #334155",
    backgroundColor: "#0f172a",
    color: "#fff",
    fontSize: "14px",
    flex: 2,
  },
  discountAmount: {
    color: "#ef4444",
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "12px",
    paddingTop: "12px",
    borderTop: "2px solid #334155",
    fontSize: "16px",
    fontWeight: "600",
    color: "#fff",
  },
  totalAmount: {
    color: "#22c55e",
  },
  divider: {
    border: "none",
    borderTop: "1px solid #334155",
    margin: "12px 0",
  },
  gstTitle: {
    color: "#e2e8f0",
    fontSize: "14px",
    fontWeight: "600",
    marginBottom: "8px",
  },
  gstRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "13px",
    color: "#94a3b8",
    marginBottom: "4px",
  },
  notesSection: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "16px",
  },
  notesInput: {
    padding: "12px",
    borderRadius: "6px",
    border: "1px solid #334155",
    backgroundColor: "#0f172a",
    color: "#fff",
    fontSize: "14px",
    resize: "vertical",
    outline: "none",
    ":focus": {
      borderColor: "#3b82f6",
    },
  },
  emptyState: {
    textAlign: "center",
    padding: "40px",
    color: "#94a3b8",
    backgroundColor: "#0f172a",
    borderRadius: "8px",
  },
  loadingState: {
    textAlign: "center",
    padding: "40px",
    color: "#94a3b8",
  },
  nextButton: {
    background: "#3b82f6",
    color: "#fff",
    padding: "10px 24px",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background-color 0.2s",
    ":hover": {
      backgroundColor: "#2563eb",
    },
    ":disabled": {
      backgroundColor: "#64748b",
      cursor: "not-allowed",
    },
  },
  backButton: {
    background: "#64748b",
    color: "#fff",
    padding: "10px 24px",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background-color 0.2s",
    ":hover": {
      backgroundColor: "#475569",
    },
  },
  saveButton: {
    background: "#22c55e",
    color: "#fff",
    padding: "10px 24px",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background-color 0.2s",
    ":disabled": {
      backgroundColor: "#94a3b8",
      cursor: "not-allowed",
    },
    ":hover:not(:disabled)": {
      backgroundColor: "#16a34a",
    },
  },
  actionButtons: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  },
  viewButton: {
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "12px",
    cursor: "pointer",
    transition: "background-color 0.2s",
    ":hover": {
      backgroundColor: "#2563eb",
    },
  },
  printButton: {
    background: "#64748b",
    color: "#fff",
    border: "none",
    padding: "8px 16px",
    borderRadius: "4px",
    fontSize: "14px",
    cursor: "pointer",
    transition: "background-color 0.2s",
    ":hover": {
      backgroundColor: "#475569",
    },
  },
  pagination: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "20px",
    marginTop: "20px",
    padding: "10px",
  },
  pageButton: {
    background: "#334155",
    color: "#fff",
    border: "none",
    padding: "8px 16px",
    borderRadius: "4px",
    fontSize: "14px",
    cursor: "pointer",
    transition: "background-color 0.2s",
    ":disabled": {
      backgroundColor: "#1e293b",
      color: "#64748b",
      cursor: "not-allowed",
    },
    ":hover:not(:disabled)": {
      backgroundColor: "#475569",
    },
  },
  pageInfo: {
    color: "#94a3b8",
    fontSize: "14px",
  },
  statusBadge: {
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: "500",
    color: "#fff",
    display: "inline-block",
  },
  viewCompanyHeader: {
    textAlign: "center",
    marginBottom: "24px",
    padding: "16px",
    background: "#0f172a",
    borderRadius: "8px",
    border: "1px solid #334155",
  },
  viewTwoColumn: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
    marginBottom: "24px",
  },
  viewColumn: {
    width: "100%",
  },
  viewSection: {
    marginBottom: "20px",
  },
  viewSectionTitle: {
    color: "#e2e8f0",
    fontSize: "16px",
    fontWeight: "600",
    marginBottom: "10px",
  },
  viewCard: {
    background: "#0f172a",
    padding: "16px",
    borderRadius: "8px",
    border: "1px solid #334155",
  },
  viewSummary: {
    background: "#0f172a",
    padding: "20px",
    borderRadius: "8px",
    marginBottom: "20px",
    border: "1px solid #334155",
  },
  viewSummaryItem: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "8px",
    color: "#e2e8f0",
  },
  viewTotal: {
    marginTop: "12px",
    paddingTop: "12px",
    borderTop: "2px solid #334155",
    fontSize: "18px",
    fontWeight: "600",
    color: "#22c55e",
  },
  viewAmountWords: {
    marginTop: "12px",
    paddingTop: "8px",
    color: "#94a3b8",
    fontSize: "14px",
    fontStyle: "italic",
  },
  viewActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "20px",
  },
  statusUpdateSection: {
    background: "#0f172a",
    padding: "16px",
    borderRadius: "8px",
    marginBottom: "20px",
    border: "1px solid #334155",
  },
  statusUpdateRow: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "16px",
  },
  statusUpdateField: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  statusSelect: {
    padding: "8px",
    borderRadius: "4px",
    border: "1px solid #334155",
    backgroundColor: "#1e293b",
    color: "#fff",
    fontSize: "14px",
    outline: "none",
  },
  amountWords: {
    marginTop: "8px",
    color: "#94a3b8",
    fontSize: "14px",
    fontStyle: "italic",
  },
};

export default InvoicePage;