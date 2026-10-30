import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { POWERQ_LOGO_BASE64, BCA_LOGO_BASE64 } from "../assets/invoiceLogos";

const QuotationPage = () => {
  // Create axios instance with credentials
  const api = axios.create({
    baseURL: 'http://localhost:5000/api',
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Add request interceptor for debugging
  api.interceptors.request.use(request => {
    console.log('Starting Request:', request.url);
    return request;
  });

  // Add response interceptor for error handling
  api.interceptors.response.use(
    response => {
      console.log('Response:', response.status);
      return response;
    },
    error => {
      console.log('Response Error:', error.response?.status, error.response?.data);
      if (error.response?.status === 401) {
        setIsAuthenticated(false);
        setError('Session expired. Please login again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      }
      return Promise.reject(error);
    }
  );

  // Company details
  const companyDetails = {
    name: "PowerQ Max Engineering Pte Ltd",
    address: "10 Jalan Besar, #15-02, Sim Lim Tower, Singapore 208787",
    phone: "+65 9860 4001",
    email: "powerqmaxengineering@gmail.com",
    regNo: "202649167W",
    gstin: ""
  };

  // State for quotations list
  const [quotations, setQuotations] = useState([]);
  const [filteredQuotations, setFilteredQuotations] = useState([]);
  const [quotationsLoading, setQuotationsLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 10,
    total: 0,
    pages: 1
  });
  const [viewingQuotation, setViewingQuotation] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });
  const [sortBy, setSortBy] = useState('newest');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState(1);

  // Form data
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "", gstin: "", attn: "" });
  const [project, setProject] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState("fixed");
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [notes, setNotes] = useState("");
  const [customerErrors, setCustomerErrors] = useState({});
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savedQuotation, setSavedQuotation] = useState(null);

  const searchRef = useRef(null);
  const modalRef = useRef(null);
  const viewModalRef = useRef(null);

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
      fetchQuotations();
    }
  }, []);

  // Fetch quotations when page changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchQuotations();
    }
  }, [pagination.page]);

  // Apply filters whenever filter criteria change
  useEffect(() => {
    if (quotations.length > 0) {
      applyFilters();
    }
  }, [quotations, searchTerm, dateRange, sortBy]);

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
        setViewingQuotation(null);
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

  // Fetch quotations from backend
  const fetchQuotations = async () => {
    if (!isAuthenticated) return;

    setQuotationsLoading(true);

    try {
      let url = `/quotation?page=${pagination.page}&per_page=10`;

      const response = await api.get(url);

      if (response.data) {
        const quotationsData = response.data.items || [];
        setQuotations(quotationsData);
        setFilteredQuotations(quotationsData);
        setPagination({
          page: response.data.current_page || 1,
          per_page: 10,
          total: response.data.total || 0,
          pages: response.data.pages || 1
        });
      }
    } catch (err) {
      console.error('Error fetching quotations:', err);
      setError('Failed to load quotations');
      setTimeout(() => setError(''), 3000);
    } finally {
      setQuotationsLoading(false);
    }
  };

  // Apply filters to quotations
  const applyFilters = () => {
    let filtered = [...quotations];

    if (searchTerm) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(q =>
        (q.quotationNumber?.toLowerCase().includes(term)) ||
        (q.customerName?.toLowerCase().includes(term)) ||
        (q.customerPhone?.toLowerCase().includes(term)) ||
        (q.customerEmail?.toLowerCase().includes(term)) ||
        (q.customerGstin?.toLowerCase().includes(term))
      );
    }

    if (dateRange.start && dateRange.end) {
      const start = new Date(dateRange.start);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59, 999);

      filtered = filtered.filter(q => {
        const qDate = new Date(q.quotationDate);
        return qDate >= start && qDate <= end;
      });
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.quotationDate) - new Date(a.quotationDate);
        case 'oldest':
          return new Date(a.quotationDate) - new Date(b.quotationDate);
        case 'highest':
          return (b.total || 0) - (a.total || 0);
        case 'lowest':
          return (a.total || 0) - (b.total || 0);
        default:
          return 0;
      }
    });

    setFilteredQuotations(filtered);
  };

  // Reset filters
  const resetFilters = () => {
    setSearchTerm('');
    setDateRange({ start: '', end: '' });
    setSortBy('newest');
    setFilteredQuotations(quotations);
  };

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const exportData = filteredQuotations.map(q => ({
        'Quotation #': q.quotationNumber || '',
        'Date': new Date(q.quotationDate).toLocaleDateString(),
        'Customer Name': q.customerName || '',
        'Customer Phone': q.customerPhone || '',
        'Customer Email': q.customerEmail || '',
        'Valid Until': new Date(q.validUntil).toLocaleDateString(),
        'Subtotal (₹)': (q.subtotal || 0).toFixed(2),
        'Discount (₹)': (q.discount || 0).toFixed(2),
        'Total (₹)': (q.total || 0).toFixed(2),
        'Items Count': q.items?.length || 0
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Quotations");

      const wscols = [
        { wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 15 },
        { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }
      ];
      worksheet['!cols'] = wscols;

      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      const file = new Blob([excelBuffer], {
        type: "application/octet-stream",
      });

      const date = new Date().toISOString().split('T')[0];
      saveAs(file, `Quotations_${date}.xlsx`);

      setSuccess(`✅ Exported ${filteredQuotations.length} quotations to Excel`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error("Export error:", err);
      setError("❌ Failed to export to Excel");
      setTimeout(() => setError(''), 3000);
    }
  };

  // Export to PDF
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();

      doc.setFontSize(20);
      doc.setTextColor(99, 102, 241);
      doc.text('Quotations Report', 14, 22);

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

      let filterY = 37;
      if (searchTerm) {
        doc.text(`Search: "${searchTerm}"`, 14, filterY);
        filterY += 5;
      }
      if (dateRange.start && dateRange.end) {
        doc.text(`Date Range: ${dateRange.start} to ${dateRange.end}`, 14, filterY);
        filterY += 5;
      }

      const totalAmount = filteredQuotations.reduce((sum, q) => sum + (q.total || 0), 0);

      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(`Total Quotations: ${filteredQuotations.length}`, 14, filterY + 5);
      doc.text(`Total Amount: ₹${totalAmount.toFixed(2)}`, 14, filterY + 12);

      const tableColumn = [
        'Quotation #', 'Date', 'Customer', 'Phone', 'Valid Until', 'Total (₹)'
      ];

      const tableRows = filteredQuotations.map(q => [
        q.quotationNumber || '',
        new Date(q.quotationDate).toLocaleDateString(),
        (q.customerName || '').substring(0, 20),
        q.customerPhone || '',
        new Date(q.validUntil).toLocaleDateString(),
        (q.total || 0).toFixed(2)
      ]);

      const startY = filterY + 22;

      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: startY,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [240, 240, 240] },
      });

      const date = new Date().toISOString().split('T')[0];
      doc.save(`Quotations_Report_${date}.pdf`);

      setSuccess(`✅ Exported ${filteredQuotations.length} quotations to PDF`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error("PDF export error:", err);
      setError("❌ Failed to export to PDF");
      setTimeout(() => setError(''), 3000);
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
        console.error("Unexpected response format:", response.data);
        setSearchError("Received unexpected data format from server");
        setProducts([]);
      }
    } catch (err) {
      console.error('Search error:', err);
      if (err.response) {
        if (err.response.status === 401) {
          setSearchError('Session expired. Please login again.');
        } else if (err.response.status === 404) {
          setSearchError('Search endpoint not found. Please check API configuration.');
        } else {
          setSearchError(err.response.data?.error || `Failed to search products (Status: ${err.response.status})`);
        }
      } else if (err.request) {
        setSearchError('No response from server. Please check your connection.');
      } else {
        setSearchError('Error setting up search request. Please try again.');
      }
      setProducts([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // Fetch single quotation details
  const fetchQuotationDetails = async (id) => {
    try {
      const response = await api.get(`/quotation/${id}`);
      setViewingQuotation(response.data);
      setShowViewModal(true);
    } catch (err) {
      console.error('Error fetching quotation details:', err);
      setError('Failed to load quotation details');
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
    }
  };

  // Handle back step
  const handleBackStep = () => {
    setModalStep(1);
  };

  // Reset form
  const resetForm = () => {
    setCustomer({ name: "", phone: "", email: "", address: "", gstin: "", attn: "" });
    setProject("");
    setPreparedBy("");
    setItems([]);
    setDiscount(0);
    setDiscountType("fixed");
    setNotes("");
    setQuotationDate(new Date().toISOString().split('T')[0]);
    setValidUntil(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setModalStep(1);
    setCustomerErrors({});
    setSearch("");
    setProducts([]);
    setSearchError("");
    setError('');
    setSuccess('');
    setSavedQuotation(null);
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
      setSuccess(`${product.name} added to quotation`);
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

  // REMOVE PRODUCT
  const removeItem = (index) => {
    const updated = [...items];
    const removedItem = updated[index];
    updated.splice(index, 1);
    setItems(updated);
    setSuccess(`${removedItem.name} removed from quotation`);
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
  const total = subtotal - discountAmount;

  // Calculate GST
  const calculateGST = () => {
    const gstDetails = {};
    items.forEach(item => {
      const gstRate = item.gst || 0;
      const itemTotal = item.price * item.quantity;
      if (!gstDetails[gstRate]) {
        gstDetails[gstRate] = {
          taxable: 0,
          cgst: 0,
          sgst: 0,
          total: 0
        };
      }

      if (gstRate > 0) {
        const taxableValue = itemTotal * (100 / (100 + gstRate));
        const gstAmount = itemTotal - taxableValue;

        gstDetails[gstRate].taxable += taxableValue;
        gstDetails[gstRate].cgst += gstAmount / 2;
        gstDetails[gstRate].sgst += gstAmount / 2;
      } else {
        gstDetails[gstRate].taxable += itemTotal;
      }
      gstDetails[gstRate].total += itemTotal;
    });
    return gstDetails;
  };

  // SAVE QUOTATION
  const saveQuotation = async () => {
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
      attn: (customer.attn || '').trim(),
      customerPhone: customer.phone.trim(),
      customerEmail: customer.email.trim() || '',
      customerAddress: customer.address.trim() || '',
      customerGstin: customer.gstin.trim().toUpperCase() || '',
      project: (project || '').trim(),
      preparedBy: (preparedBy || '').trim(),
      quotationDate,
      validUntil,
      discount: discountAmount,
      discountType,
      discountRate: discount,
      notes: notes.trim() || '',
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unit: item.unit || 'nos',
        price: item.price,
        gst: item.gst || 0
      }))
    };

    console.log('Saving quotation with payload:', payload);

    try {
      const res = await api.post('/quotation', payload);
      console.log('Quotation saved successfully:', res.data);

      setSavedQuotation(res.data.quotation);
      setSuccess(`✅ Quotation Created Successfully!\nQuotation Number: ${res.data.quotationNumber}`);

      fetchQuotations();

      setTimeout(() => {
        if (window.confirm(`Quotation ${res.data.quotationNumber} saved successfully!\n\nDo you want to print it?`)) {
          handlePrintQuotation(res.data.quotation);
        }

        resetForm();
        setShowModal(false);
        setSuccess('');
      }, 2000);

    } catch (err) {
      console.error("Error creating quotation:", err);

      let errorMessage = "Failed to save quotation. ";

      if (err.response) {
        if (err.response.status === 401) {
          errorMessage = "Session expired. Please login again.";
        } else if (err.response.status === 400) {
          errorMessage = err.response.data?.error || "Invalid data. Please check your inputs.";

          if (err.response.data?.errors) {
            const fieldErrors = Object.entries(err.response.data.errors)
              .map(([field, msg]) => `${field}: ${msg}`)
              .join('\n');
            errorMessage += `\n${fieldErrors}`;
          }
        } else if (err.response.status === 422) {
          errorMessage = err.response.data?.error || "Validation failed. Please check your inputs.";
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

  // Function to print quotation
  const handlePrintQuotation = (quotation) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print the quotation');
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

    const items = quotation.items || [];
    const totalRowsCount = Math.max(15, items.length);

    let rowsHtml = '';
    for (let i = 0; i < totalRowsCount; i++) {
      const rowNo = i + 1;
      if (i < items.length) {
        const item = items[i];
        const desc = (item.product_name || item.productName || '') + (item.product_model || item.productModel ? ` (${item.product_model || item.productModel})` : '');
        const qty = item.quantity !== undefined ? item.quantity : '';
        const unit = item.unit || 'nos';
        const price = (typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0).toFixed(2);
        const amount = (typeof item.total === 'number' ? item.total : (parseFloat(item.price) || 0) * (item.quantity || 1)).toFixed(2);
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

    const totalAmount = (typeof quotation.total === 'number' ? quotation.total : parseFloat(quotation.total) || 0).toFixed(2);

    const printContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Quotation ${quotation.quotationNumber || quotation.quotation_number || 'PQM-QT-0001'}</title>
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
            padding: 10px 20px;
            color: #000;
            background: #fff;
            font-size: 11px;
            line-height: 1.25;
          }
          .invoice-container {
            width: 100%;
            max-width: 750px;
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
            width: 110px;
            height: auto;
            display: block;
          }
          .header-center {
            text-align: center;
            vertical-align: middle;
            padding: 0 10px;
          }
          .company-name {
            color: #0b2f6b;
            font-weight: 800;
            font-size: 13pt;
            letter-spacing: 0.5px;
            margin-bottom: 2px;
          }
          .company-tags {
            color: #2575fc;
            font-size: 7.5pt;
            font-weight: bold;
            margin-bottom: 2px;
          }
          .company-info {
            color: #555555;
            font-size: 7.5pt;
            line-height: 1.35;
          }
          .header-right {
            width: 110px;
            vertical-align: middle;
            text-align: right;
          }
          .header-right img {
            width: 90px;
            height: auto;
            display: inline-block;
          }
          /* Divider */
          .divider-container {
            margin: 6px 0 10px 0;
            width: 100%;
          }
          .divider-thick {
            height: 2.5px;
            background-color: #0b2f6b;
            width: 100%;
          }
          .divider-gap {
            height: 2px;
          }
          .divider-thin {
            height: 1px;
            background-color: #38bdf8;
            width: 100%;
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
          /* Terms */
          .section-heading {
            color: #0b2f6b;
            font-size: 9pt;
            font-weight: bold;
            margin-top: 14px;
            margin-bottom: 4px;
            text-transform: uppercase;
          }
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
            margin-top: 32px;
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
            margin-top: 10px;
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
          <div class="doc-title">QUOTATION</div>

          <!-- Metadata Section -->
          <div class="meta-wrapper">
            <table class="meta-table meta-left">
              <tr>
                <td class="meta-label">To:</td>
                <td class="meta-val">${quotation.customerName || quotation.customer_name || ''}</td>
              </tr>
              <tr>
                <td class="meta-label">Attn:</td>
                <td class="meta-val">${quotation.attn || ''}</td>
              </tr>
              <tr>
                <td class="meta-label">Address:</td>
                <td class="meta-val">${quotation.customerAddress || quotation.customer_address || ''}</td>
              </tr>
              <tr>
                <td class="meta-label">Tel:</td>
                <td class="meta-val">${quotation.customerPhone || quotation.customer_phone || ''}</td>
              </tr>
              <tr>
                <td class="meta-label">Email:</td>
                <td class="meta-val">${quotation.customerEmail || quotation.customer_email || ''}</td>
              </tr>
            </table>

            <table class="meta-table meta-right">
              <tr>
                <td class="meta-label">Quotation No.:</td>
                <td class="meta-val">${quotation.quotationNumber || quotation.quotation_number || 'PQM-QT-0001'}</td>
              </tr>
              <tr>
                <td class="meta-label">Date:</td>
                <td class="meta-val">${formatDisplayDate(quotation.quotationDate || quotation.quotation_date)}</td>
              </tr>
              <tr>
                <td class="meta-label">Valid Until:</td>
                <td class="meta-val">${formatDisplayDate(quotation.validUntil || quotation.valid_until)}</td>
              </tr>
              <tr>
                <td class="meta-label">Project:</td>
                <td class="meta-val">${quotation.project || ''}</td>
              </tr>
              <tr>
                <td class="meta-label">Prepared by:</td>
                <td class="meta-val">${quotation.preparedBy || quotation.prepared_by || ''}</td>
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

          <!-- GST Notice & Total -->
          <table class="bottom-bar">
            <tr>
              <td class="gst-note-cell">Not GST-registered &ndash; no GST charged.</td>
              <td class="total-label-cell">TOTAL</td>
              <td class="total-value-cell">${totalAmount}</td>
            </tr>
          </table>

          <!-- Terms & Conditions -->
          <div class="section-heading">TERMS &amp; CONDITIONS</div>
          <ol class="terms-ol">
            <li>This quotation is valid for 30 days from the date above.</li>
            <li>All prices are in Singapore Dollars (SGD). PowerQ Max Engineering Pte Ltd is not GST-registered; no GST is charged.</li>
            <li>Payment shall be made upon completion of works, or according to the payment terms agreed in writing before work commences.</li>
            <li>Late payment may be subject to additional charges.</li>
            <li>Any work or materials not stated in this quotation are excluded. Additional or variation works will be charged separately.</li>
            <li>Works carried out after office hours, on weekends or on public holidays will be charged separately.</li>
            <li>Completion dates depend on site readiness, access and material availability.</li>
            <li>Warranty is as agreed in writing and excludes misuse, power surges, acts of nature and alterations by third parties.</li>
            <li>Acceptance of this quotation, by signature or by purchase order, means agreement to these terms.</li>
          </ol>

          <!-- Signatures -->
          <div class="signatures-container">
            <div class="sig-block">
              <div class="sig-title">For PowerQ Max Engineering Pte Ltd</div>
              <div class="sig-line"></div>
              <div class="sig-legend">Name / Signature / Company Stamp / Date</div>
            </div>
            <div class="sig-block">
              <div class="sig-title">Accepted by Customer</div>
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

  const gstDetails = calculateGST();

  // Show login required message if not authenticated
  if (!isAuthenticated) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h2 style={styles.title}>Quotations</h2>
        </div>
        <div style={styles.authMessage}>
          <h3>🔒 Authentication Required</h3>
          <p style={{ color: '#dc3545', margin: '20px 0' }}>{error || 'Please login to access quotations'}</p>
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
      {/* Header with Create Button and Export Buttons - Logo/Title on Left */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h2 style={styles.title}>Quotations</h2>
        </div>
        <div style={styles.headerButtons}>
          <button
            style={styles.exportButton}
            onClick={handleExportExcel}
            title="Export to Excel"
          >
            📊 Excel
          </button>
          <button
            style={styles.exportButton}
            onClick={handleExportPDF}
            title="Export to PDF"
          >
            📄 PDF
          </button>
          <button
            style={styles.createButton}
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
          >
            + Create New Quotation
          </button>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div style={{ ...styles.alert, ...styles.alertError, marginBottom: '20px' }}>
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div style={{ ...styles.alert, ...styles.alertSuccess, marginBottom: '20px' }}>
          ✅ {success}
        </div>
      )}

      {/* Search and Filter Bar */}
      <div style={styles.filterBar}>
        <div style={styles.searchBox}>
          <input
            type="text"
            style={styles.searchInput}
            placeholder="Search by quotation #, customer name, phone, email..."
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
          onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
          placeholder="From Date"
        />

        <input
          type="date"
          style={styles.filterInput}
          value={dateRange.end}
          onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          placeholder="To Date"
        />

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
      {!quotationsLoading && (
        <div style={styles.resultsCount}>
          Showing {filteredQuotations.length} of {quotations.length} quotations
          {filteredQuotations.length !== quotations.length && (
            <span> (filtered)</span>
          )}
        </div>
      )}

      {/* Quotations Table */}
      <div style={styles.tableContainer}>
        {quotationsLoading ? (
          <div style={styles.loadingState}>Loading quotations...</div>
        ) : filteredQuotations.length === 0 ? (
          <div style={styles.emptyState}>
            <p>No quotations found. Click "Create New Quotation" to get started.</p>
          </div>
        ) : (
          <>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Quotation #</th>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Customer</th>
                  <th style={styles.th}>Phone</th>
                  <th style={styles.th}>Valid Until</th>
                  <th style={styles.th}>Total</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotations.map((quotation) => (
                  <tr key={quotation.id}>
                    <td style={styles.td}>{quotation.quotationNumber}</td>
                    <td style={styles.td}>{new Date(quotation.quotationDate).toLocaleDateString()}</td>
                    <td style={styles.td}>{quotation.customerName}</td>
                    <td style={styles.td}>{quotation.customerPhone}</td>
                    <td style={styles.td}>{new Date(quotation.validUntil).toLocaleDateString()}</td>
                    <td style={styles.td}>₹{quotation.total?.toFixed(2)}</td>
                    <td style={styles.td}>
                      <div style={styles.actionButtons}>
                        <button
                          style={styles.viewButton}
                          onClick={() => fetchQuotationDetails(quotation.id)}
                        >
                          View
                        </button>
                        <button
                          style={styles.printButton}
                          onClick={() => handlePrintQuotation(quotation)}
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
                  Page {pagination.page} of {pagination.pages} (Showing 10 per page)
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

      {/* View Quotation Modal */}
      {showViewModal && viewingQuotation && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modal, maxWidth: '900px' }} ref={viewModalRef}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                Quotation Details - {viewingQuotation.quotationNumber}
              </h3>
              <button
                style={styles.closeButton}
                onClick={() => {
                  setShowViewModal(false);
                  setViewingQuotation(null);
                }}
              >
                ×
              </button>
            </div>

            <div style={styles.modalContent}>
              {/* Company Header */}
              <div style={styles.viewCompanyHeader}>
                <h3 style={{ color: '#3b82f6', margin: 0 }}>{companyDetails.name}</h3>
                <p style={{ margin: '5px 0', color: '#94a3b8' }}>{companyDetails.address}</p>
                <p style={{ margin: 0, color: '#94a3b8' }}>Tel: {companyDetails.phone} | Email: {companyDetails.email}</p>
              </div>

              <div style={styles.viewTwoColumn}>
                <div style={styles.viewColumn}>
                  <div style={styles.viewSection}>
                    <h4 style={styles.viewSectionTitle}>To:</h4>
                    <div style={styles.viewCard}>
                      <p><strong>{viewingQuotation.customerName}</strong></p>
                      {viewingQuotation.attn && <p><strong>Attn:</strong> {viewingQuotation.attn}</p>}
                      <p>Tel: {viewingQuotation.customerPhone}</p>
                      {viewingQuotation.customerEmail && <p>Email: {viewingQuotation.customerEmail}</p>}
                      {viewingQuotation.customerAddress && <p>Address: {viewingQuotation.customerAddress}</p>}
                    </div>
                  </div>
                </div>

                <div style={styles.viewColumn}>
                  <div style={styles.viewSection}>
                    <h4 style={styles.viewSectionTitle}>Quotation Details:</h4>
                    <div style={styles.viewCard}>
                      <p><strong>Quotation No:</strong> {viewingQuotation.quotationNumber}</p>
                      <p><strong>Date:</strong> {viewingQuotation.quotationDate}</p>
                      <p><strong>Valid Until:</strong> {viewingQuotation.validUntil}</p>
                      {viewingQuotation.project && <p><strong>Project:</strong> {viewingQuotation.project}</p>}
                      {viewingQuotation.preparedBy && <p><strong>Prepared by:</strong> {viewingQuotation.preparedBy}</p>}
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
                        <th style={styles.th}>Qty</th>
                        <th style={styles.th}>Unit</th>
                        <th style={styles.th}>Price (SGD)</th>
                        <th style={styles.th}>Total (SGD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingQuotation.items?.map((item, index) => (
                        <tr key={index}>
                          <td style={styles.td}>
                            <div>{item.productName || item.product_name}</div>
                            {(item.productModel || item.product_model) && <small style={{ color: '#94a3b8' }}>{item.productModel || item.product_model}</small>}
                          </td>
                          <td style={styles.td}>{item.quantity}</td>
                          <td style={styles.td}>{item.unit || 'nos'}</td>
                          <td style={styles.td}>${(item.price || 0).toFixed(2)}</td>
                          <td style={styles.td}>${(item.total || (item.price * item.quantity) || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={styles.viewSummary}>
                <div style={styles.viewSummaryItem}>
                  <span>Subtotal:</span>
                  <span>${viewingQuotation.subtotal?.toFixed(2)}</span>
                </div>
                {viewingQuotation.discount > 0 && (
                  <div style={styles.viewSummaryItem}>
                    <span>Discount:</span>
                    <span style={{ color: '#ef4444' }}>-${viewingQuotation.discount?.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ ...styles.viewSummaryItem, ...styles.viewTotal }}>
                  <span>Total (SGD):</span>
                  <span>${viewingQuotation.total?.toFixed(2)}</span>
                </div>
              </div>

              {viewingQuotation.notes && (
                <div style={styles.viewSection}>
                  <h4 style={styles.viewSectionTitle}>Notes / Terms</h4>
                  <div style={styles.viewCard}>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{viewingQuotation.notes}</p>
                  </div>
                </div>
              )}

              <div style={styles.viewActions}>
                <button
                  style={styles.printButton}
                  onClick={() => handlePrintQuotation(viewingQuotation)}
                >
                  🖨️ Print Quotation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Quotation Modal */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal} ref={modalRef}>
            {/* Modal Header */}
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {modalStep === 1 ? "Customer Details" : "Add Products"}
              </h3>
              <div style={styles.stepIndicator}>
                Step {modalStep} of 2
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
                <div style={{ ...styles.alert, ...styles.alertError, marginBottom: '16px' }}>
                  ⚠️ {error}
                </div>
              )}

              {success && (
                <div style={{ ...styles.alert, ...styles.alertSuccess, marginBottom: '16px' }}>
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
                        style={{ ...styles.input, borderColor: customerErrors.name ? '#ef4444' : '#334155' }}
                        value={customer.name}
                        onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                        placeholder="Enter customer name"
                      />
                      {customerErrors.name && (
                        <span style={styles.errorText}>{customerErrors.name}</span>
                      )}
                    </div>

                    <div style={styles.formField}>
                      <label style={styles.label}>Attn</label>
                      <input
                        style={styles.input}
                        value={customer.attn || ''}
                        onChange={(e) => setCustomer({ ...customer, attn: e.target.value })}
                        placeholder="Attention person / department"
                      />
                    </div>

                    <div style={styles.formField}>
                      <label style={styles.label}>Phone / Tel *</label>
                      <input
                        style={{ ...styles.input, borderColor: customerErrors.phone ? '#ef4444' : '#334155' }}
                        value={customer.phone}
                        onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                        placeholder="Enter phone number"
                      />
                      {customerErrors.phone && (
                        <span style={styles.errorText}>{customerErrors.phone}</span>
                      )}
                    </div>

                    <div style={styles.formField}>
                      <label style={styles.label}>Email</label>
                      <input
                        style={{ ...styles.input, borderColor: customerErrors.email ? '#ef4444' : '#334155' }}
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
                      <label style={styles.label}>Project</label>
                      <input
                        style={styles.input}
                        value={project}
                        onChange={(e) => setProject(e.target.value)}
                        placeholder="Project name or reference"
                      />
                    </div>

                    <div style={styles.formField}>
                      <label style={styles.label}>Prepared by</label>
                      <input
                        style={styles.input}
                        value={preparedBy}
                        onChange={(e) => setPreparedBy(e.target.value)}
                        placeholder="Prepared by name"
                      />
                    </div>
                  </div>

                  <div style={styles.dateSection}>
                    <div style={styles.dateField}>
                      <label style={styles.label}>Quotation Date</label>
                      <input
                        type="date"
                        style={styles.dateInput}
                        value={quotationDate}
                        onChange={(e) => setQuotationDate(e.target.value)}
                      />
                    </div>
                    <div style={styles.dateField}>
                      <label style={styles.label}>Valid Until</label>
                      <input
                        type="date"
                        style={styles.dateInput}
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                        min={quotationDate}
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
                              {p.stock !== undefined && (
                                <span style={{ ...styles.stockInfo, color: p.stock < 5 ? '#ef4444' : '#94a3b8' }}>
                                  Stock: {p.stock}
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
                            <th style={styles.th}>Unit</th>
                            <th style={styles.th}>Price</th>
                            <th style={styles.th}>Qty</th>
                            <th style={styles.th}>GST</th>
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
                              <td style={styles.td}>
                                <input
                                  style={{ ...styles.qtyInput, width: '60px' }}
                                  value={item.unit || 'nos'}
                                  onChange={(e) => {
                                    const updated = [...items];
                                    updated[index].unit = e.target.value;
                                    setItems(updated);
                                  }}
                                />
                              </td>
                              <td style={styles.td}>${item.price.toFixed(2)}</td>
                              <td style={styles.td}>
                                <input
                                  type="number"
                                  style={styles.qtyInput}
                                  value={item.quantity}
                                  min="1"
                                  onChange={(e) => changeQty(index, parseInt(e.target.value) || 1)}
                                />
                              </td>
                              <td style={styles.td}>{item.gst}%</td>
                              <td style={styles.td}>${(item.price * item.quantity).toFixed(2)}</td>
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

                      <div style={styles.totalRow}>
                        <span>Total:</span>
                        <span style={styles.totalAmount}>₹{total.toFixed(2)}</span>
                      </div>

                      {Object.keys(gstDetails).length > 0 && Object.keys(gstDetails).some(rate => rate > 0) && (
                        <div style={styles.gstBreakdown}>
                          <hr style={styles.divider} />
                          <h5 style={styles.gstTitle}>GST Breakdown</h5>
                          {Object.entries(gstDetails).map(([rate, details]) => (
                            rate > 0 ? (
                              <div key={rate} style={styles.gstRow}>
                                <span>GST @{rate}%:</span>
                                <span>
                                  CGST: ₹{details.cgst.toFixed(2)} | SGST: ₹{details.sgst.toFixed(2)}
                                </span>
                              </div>
                            ) : null
                          ))}
                        </div>
                      )}
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

                  {items.length === 0 && !searchLoading && !searchError && (
                    <div style={styles.emptyState}>
                      <p>No products added yet. Search and add products above.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={styles.modalFooter}>
              {modalStep === 2 && (
                <button
                  style={styles.backButton}
                  onClick={handleBackStep}
                >
                  Back
                </button>
              )}

              {modalStep === 1 ? (
                <button
                  style={styles.nextButton}
                  onClick={handleNextStep}
                >
                  Next
                </button>
              ) : (
                <button
                  style={styles.saveButton}
                  onClick={saveQuotation}
                  disabled={loading || items.length === 0}
                >
                  {loading ? "Creating..." : "Save Quotation"}
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
  headerLeft: {
    flex: 1,
  },
  headerButtons: {
    display: "flex",
    gap: "10px",
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
  exportButton: {
    background: "#10b981",
    color: "#fff",
    padding: "12px 20px",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background-color 0.2s",
    ":hover": {
      backgroundColor: "#059669",
    },
  },
  filterBar: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
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
  gstBreakdown: {
    marginTop: "12px",
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
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "12px",
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
  // View modal styles
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
  viewActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "20px",
  },
};

export default QuotationPage;