import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  FaPlus,
  FaSearch,
  FaFileInvoice,
  FaTrash,
  FaEye,
  FaPrint,
  FaCalendarAlt,
  FaTimes,
  FaEdit,
  FaBoxes,
  FaCheckCircle,
  FaClock,
  FaTimesCircle,
  FaBuilding,
  FaPhoneAlt,
  FaEnvelope,
  FaMapMarkerAlt
} from "react-icons/fa";
import { POWERQ_LOGO_BASE64, BCA_LOGO_BASE64 } from "../assets/invoiceLogos";
import { COMPANY_STAMP_CSS, renderCompanyStampHeading, renderCompanyStamp, renderDocumentFooterHtml, DOC_PRINT_SCRIPT } from "../assets/companyStampHelper";

const DEFAULT_TERMS = `1. Please quote this PO number on all delivery orders and invoices.
2. Goods must match the specifications and quantities stated. PowerQ Max Engineering Pte Ltd may reject any goods that do not.
3. Deliver to the address and on the date stated. Please inform us immediately of any delay.
4. The prices stated are fixed unless agreed otherwise in writing.
5. Payment will be made within 30 days of receiving a correct invoice with a signed delivery order.`;

const DEFAULT_DELIVER_TO = `PowerQ Max Engineering Pte Ltd
10 Jalan Besar, #15-02, Sim Lim Tower, Singapore 208787`;

const PurchaseOrder = () => {
  const api = axios.create({
    baseURL: "http://localhost:5000/api",
    withCredentials: true,
    headers: {
      "Content-Type": "application/json"
    }
  });

  // State
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalAmount: 0,
    issuedOrders: 0,
    completedOrders: 0,
    draftOrders: 0
  });

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Suppliers & Products for Auto-Complete
  const [suppliers, setSuppliers] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);

  // Notifications
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    poNumber: "",
    supplierId: "",
    supplierName: "",
    attn: "",
    supplierAddress: "",
    supplierPhone: "",
    supplierEmail: "",
    poDate: new Date().toISOString().split("T")[0],
    deliveryDate: "",
    deliverTo: DEFAULT_DELIVER_TO,
    yourQuoteRef: "",
    status: "issued",
    terms: DEFAULT_TERMS,
    notes: "",
    items: [
      {
        productId: null,
        description: "Supply & install 13A switched socket outlet (delete or overwrite this row)",
        quantity: 2,
        unit: "nos",
        unitPrice: 45.0
      }
    ]
  });

  const modalRef = useRef(null);
  const viewModalRef = useRef(null);

  useEffect(() => {
    fetchPurchaseOrders();
    fetchStats();
    fetchSuppliers();
    fetchProducts();
  }, [page, statusFilter]);

  // Outside click handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target) && showModal) {
        setShowModal(false);
      }
      if (viewModalRef.current && !viewModalRef.current.contains(event.target) && showViewModal) {
        setShowViewModal(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showModal, showViewModal]);

  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        per_page: 10,
        status: statusFilter,
        search: searchTerm.trim()
      };
      const res = await api.get("/purchase-order", { params });
      if (res.data && res.data.success) {
        setPurchaseOrders(res.data.items || []);
        setTotalPages(res.data.pages || 1);
      }
    } catch (err) {
      console.error("Error fetching POs:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get("/purchase-order/stats/dashboard");
      if (res.data && res.data.success) {
        setStats(res.data.stats || {});
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await api.get("/suppliers-with-items");
      if (res.data && Array.isArray(res.data)) {
        setSuppliers(res.data);
      } else if (res.data && res.data.suppliers) {
        setSuppliers(res.data.suppliers);
      }
    } catch (err) {
      // Fallback
      try {
        const fallbackRes = await api.get("/suppliers");
        if (fallbackRes.data && Array.isArray(fallbackRes.data)) {
          setSuppliers(fallbackRes.data);
        }
      } catch (e) {
        console.error("Error fetching suppliers:", e);
      }
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get("/products");
      if (res.data && res.data.products) {
        setAvailableProducts(res.data.products);
      } else if (Array.isArray(res.data)) {
        setAvailableProducts(res.data);
      }
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  };

  const generateNewPONumber = async () => {
    try {
      const res = await api.get("/purchase-order/number/generate");
      if (res.data && res.data.poNumber) {
        return res.data.poNumber;
      }
    } catch (err) {
      console.error("Error generating PO number:", err);
    }
    return "PQM-PO-0001";
  };

  const handleOpenCreateModal = async () => {
    const nextNo = await generateNewPONumber();
    setFormData({
      poNumber: nextNo,
      supplierId: "",
      supplierName: "",
      attn: "",
      supplierAddress: "",
      supplierPhone: "",
      supplierEmail: "",
      poDate: new Date().toISOString().split("T")[0],
      deliveryDate: "",
      deliverTo: DEFAULT_DELIVER_TO,
      yourQuoteRef: "",
      status: "issued",
      terms: DEFAULT_TERMS,
      notes: "",
      items: [
        {
          productId: null,
          description: "Supply & install 13A switched socket outlet (delete or overwrite this row)",
          quantity: 2,
          unit: "nos",
          unitPrice: 45.0
        }
      ]
    });
    setIsEditing(false);
    setEditingId(null);
    setError("");
    setSuccess("");
    setShowModal(true);
  };

  const handleOpenEditModal = (po) => {
    setFormData({
      poNumber: po.po_number || po.poNumber || "",
      supplierId: po.supplier_id || po.supplierId || "",
      supplierName: po.supplier_name || po.supplierName || "",
      attn: po.attn || "",
      supplierAddress: po.supplier_address || po.supplierAddress || "",
      supplierPhone: po.supplier_phone || po.supplierPhone || "",
      supplierEmail: po.supplier_email || po.supplierEmail || "",
      poDate: po.po_date || po.poDate || new Date().toISOString().split("T")[0],
      deliveryDate: po.delivery_date || po.deliveryDate || "",
      deliverTo: po.deliver_to || po.deliverTo || DEFAULT_DELIVER_TO,
      yourQuoteRef: po.your_quote_ref || po.yourQuoteRef || "",
      status: po.status || "issued",
      terms: po.terms || DEFAULT_TERMS,
      notes: po.notes || "",
      items: (po.items && po.items.length > 0)
        ? po.items.map((item) => ({
            productId: item.product_id || item.productId || null,
            description: item.description || "",
            quantity: item.quantity || 1,
            unit: item.unit || "nos",
            unitPrice: item.unit_price || item.unitPrice || 0
          }))
        : [
            {
              productId: null,
              description: "",
              quantity: 1,
              unit: "nos",
              unitPrice: 0.0
            }
          ]
    });
    setIsEditing(true);
    setEditingId(po.id);
    setError("");
    setSuccess("");
    setShowModal(true);
  };

  const handleSupplierSelect = (supplierId) => {
    if (!supplierId) {
      setFormData((prev) => ({
        ...prev,
        supplierId: "",
        supplierName: "",
        attn: "",
        supplierAddress: "",
        supplierPhone: "",
        supplierEmail: ""
      }));
      return;
    }
    const sup = suppliers.find((s) => String(s.id) === String(supplierId));
    if (sup) {
      setFormData((prev) => ({
        ...prev,
        supplierId: sup.id,
        supplierName: sup.company || sup.name || "",
        attn: sup.name && sup.company ? sup.name : "",
        supplierAddress: sup.address || "",
        supplierPhone: sup.phone || "",
        supplierEmail: sup.email || ""
      }));
    }
  };

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          productId: null,
          description: "",
          quantity: 1,
          unit: "nos",
          unitPrice: 0.0
        }
      ]
    }));
  };

  const handleRemoveItem = (index) => {
    if (formData.items.length === 1) {
      alert("At least one item row is required.");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleItemChange = (index, field, value) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const handleProductSelect = (index, productId) => {
    if (!productId) return;
    const prod = availableProducts.find((p) => String(p.id) === String(productId));
    if (prod) {
      setFormData((prev) => {
        const newItems = [...prev.items];
        const desc = prod.name + (prod.model ? ` (${prod.model})` : "");
        const price = prod.buy_price || prod.sell_price || 0.0;
        newItems[index] = {
          ...newItems[index],
          productId: prod.id,
          description: desc,
          unit: prod.unit || "nos",
          unitPrice: price
        };
        return { ...prev, items: newItems };
      });
    }
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => {
      const q = parseFloat(item.quantity) || 0;
      const p = parseFloat(item.unitPrice) || 0;
      return sum + q * p;
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.supplierName.trim()) {
      setError("Please enter or select a Supplier Name");
      return;
    }
    if (formData.items.length === 0 || !formData.items.some((i) => i.description.trim())) {
      setError("Please add at least one item description");
      return;
    }

    try {
      setError("");
      const payload = {
        poNumber: formData.poNumber.trim(),
        supplierId: formData.supplierId || null,
        supplierName: formData.supplierName.trim(),
        attn: formData.attn.trim(),
        supplierAddress: formData.supplierAddress.trim(),
        supplierPhone: formData.supplierPhone.trim(),
        supplierEmail: formData.supplierEmail.trim(),
        poDate: formData.poDate,
        deliveryDate: formData.deliveryDate || null,
        deliverTo: formData.deliverTo.trim(),
        yourQuoteRef: formData.yourQuoteRef.trim(),
        status: formData.status,
        terms: formData.terms,
        notes: formData.notes.trim(),
        items: formData.items
          .filter((i) => i.description.trim())
          .map((item) => ({
            productId: item.productId || null,
            description: item.description.trim(),
            quantity: parseFloat(item.quantity) || 1,
            unit: item.unit || "nos",
            unitPrice: parseFloat(item.unitPrice) || 0.0
          }))
      };

      if (isEditing) {
        const res = await api.put(`/purchase-order/${editingId}`, payload);
        if (res.data && res.data.success) {
          setSuccess("Purchase order updated successfully!");
          fetchPurchaseOrders();
          fetchStats();
          setTimeout(() => {
            setShowModal(false);
            setSuccess("");
          }, 1200);
        }
      } else {
        const res = await api.post("/purchase-order", payload);
        if (res.data && res.data.success) {
          setSuccess(`Purchase order ${res.data.poNumber} created successfully!`);
          fetchPurchaseOrders();
          fetchStats();
          setTimeout(() => {
            if (window.confirm(`Purchase order ${res.data.poNumber} created!\n\nDo you want to print it now?`)) {
              handlePrintPO(res.data.purchaseOrder);
            }
            setShowModal(false);
            setSuccess("");
          }, 1200);
        }
      }
    } catch (err) {
      console.error("Save error:", err);
      setError(err.response?.data?.error || "Error saving purchase order.");
    }
  };

  const handleDelete = async (id, poNumber) => {
    if (!window.confirm(`Are you sure you want to delete purchase order ${poNumber}?`)) {
      return;
    }
    try {
      const res = await api.delete(`/purchase-order/${id}`);
      if (res.data && res.data.success) {
        fetchPurchaseOrders();
        fetchStats();
      }
    } catch (err) {
      alert(err.response?.data?.error || "Error deleting purchase order.");
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      const res = await api.patch(`/purchase-order/${id}/status`, { status: newStatus });
      if (res.data && res.data.success) {
        fetchPurchaseOrders();
        fetchStats();
      }
    } catch (err) {
      alert("Failed to update status.");
    }
  };

  // Helper date formatter
  const formatDisplayDate = (dateString) => {
    if (!dateString) return "";
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      return dateString;
    }
  };

  // PRINT PURCHASE ORDER (Exact Match to Uploaded Image)
  const handlePrintPO = (po) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow pop-ups to print the purchase order.");
      return;
    }

    const items = po.items || [];
    const totalRowsCount = Math.max(15, items.length);

    let rowsHtml = "";
    for (let i = 0; i < totalRowsCount; i++) {
      const rowNo = i + 1;
      if (i < items.length) {
        const item = items[i];
        const desc = item.description || "";
        const qty = item.quantity !== undefined ? item.quantity : "";
        const unit = item.unit || "nos";
        const price = (parseFloat(item.unit_price || item.unitPrice) || 0).toFixed(2);
        const amt = (parseFloat(item.amount) || ((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price || item.unitPrice) || 0))).toFixed(2);

        rowsHtml += `
          <tr>
            <td class="col-no">${rowNo}</td>
            <td class="col-desc">${desc}</td>
            <td class="col-qty">${qty}</td>
            <td class="col-unit">${unit}</td>
            <td class="col-price">${price}</td>
            <td class="col-amount">${amt}</td>
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

    const totalAmount = (parseFloat(po.total) || 0).toFixed(2);

    const printContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Purchase Order ${po.po_number || po.poNumber || "PQM-PO"}</title>
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
          .po-container {
            width: 100%;
            max-width: 780px;
            margin: 0 auto;
          }
          /* Top Header */
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
            margin-bottom: 14px;
            text-transform: uppercase;
          }
          /* Metadata Section */
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
          /* Total Bar */
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
            vertical-align: middle;
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
            margin-top: 16px;
            margin-bottom: 8px;
            page-break-inside: avoid;
          }
          .sig-block {
            width: 44%;
            position: relative;
          }
          ${COMPANY_STAMP_CSS}
        </style>
      </head>
      <body>
        <div class="po-container">
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
          <div class="doc-title">PURCHASE ORDER</div>

          <!-- Metadata Section -->
          <div class="meta-wrapper">
            <table class="meta-table meta-left">
              <tr>
                <td class="meta-label">Supplier:</td>
                <td class="meta-val">${po.supplier_name || po.supplierName || ""}</td>
              </tr>
              <tr>
                <td class="meta-label">Attn:</td>
                <td class="meta-val">${po.attn || ""}</td>
              </tr>
              <tr>
                <td class="meta-label">Address:</td>
                <td class="meta-val">${po.supplier_address || po.supplierAddress || ""}</td>
              </tr>
              <tr>
                <td class="meta-label">Tel:</td>
                <td class="meta-val">${po.supplier_phone || po.supplierPhone || ""}</td>
              </tr>
              <tr>
                <td class="meta-label">Email:</td>
                <td class="meta-val">${po.supplier_email || po.supplierEmail || ""}</td>
              </tr>
            </table>

            <table class="meta-table meta-right">
              <tr>
                <td class="meta-label">PO No.:</td>
                <td class="meta-val">${po.po_number || po.poNumber || "PQM-PO-0001"}</td>
              </tr>
              <tr>
                <td class="meta-label">Date:</td>
                <td class="meta-val">${formatDisplayDate(po.po_date || po.poDate)}</td>
              </tr>
              <tr>
                <td class="meta-label">Delivery Date:</td>
                <td class="meta-val">${formatDisplayDate(po.delivery_date || po.deliveryDate)}</td>
              </tr>
              <tr>
                <td class="meta-label">Deliver To:</td>
                <td class="meta-val">${(po.deliver_to || po.deliverTo || DEFAULT_DELIVER_TO).replace(/\n/g, "<br/>")}</td>
              </tr>
              <tr>
                <td class="meta-label">Your Quote Ref:</td>
                <td class="meta-val">${po.your_quote_ref || po.yourQuoteRef || ""}</td>
              </tr>
            </table>
          </div>

          <!-- Items Table (15 rows matching template) -->
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
            <li>Please quote this PO number on all delivery orders and invoices.</li>
            <li>Goods must match the specifications and quantities stated. PowerQ Max Engineering Pte Ltd may reject any goods that do not.</li>
            <li>Deliver to the address and on the date stated. Please inform us immediately of any delay.</li>
            <li>The prices stated are fixed unless agreed otherwise in writing.</li>
            <li>Payment will be made within 30 days of receiving a correct invoice with a signed delivery order.</li>
          </ol>

          <!-- Signatures -->
          <div class="signatures-container">
            <div class="sig-block">
              ${renderCompanyStampHeading("For PowerQ Max Engineering Pte Ltd")}
              <div class="sig-space">
                ${renderCompanyStamp()}
              </div>
              <div class="sig-line"></div>
              <div class="sig-legend">This is a computer-generated document. No signature is required.</div>
            </div>
            <div class="sig-block">
              <div class="sig-title">Acknowledged by Supplier</div>
              <div class="sig-space"></div>
              <div class="sig-line"></div>
              <div class="sig-legend">Name / Signature / Company Stamp / Date</div>
            </div>
          </div>
        </div>

        ${renderDocumentFooterHtml()}

        ${DOC_PRINT_SCRIPT}
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return <span style={{ ...styles.badge, background: "#059669", color: "#fff" }}><FaCheckCircle /> Completed</span>;
      case "issued":
        return <span style={{ ...styles.badge, background: "#2563eb", color: "#fff" }}><FaClock /> Issued</span>;
      case "draft":
        return <span style={{ ...styles.badge, background: "#64748b", color: "#fff" }}>Draft</span>;
      case "cancelled":
        return <span style={{ ...styles.badge, background: "#dc2626", color: "#fff" }}><FaTimesCircle /> Cancelled</span>;
      default:
        return <span style={{ ...styles.badge, background: "#475569", color: "#fff" }}>{status}</span>;
    }
  };

  return (
    <div style={styles.container}>
      {/* Page Title & Stats */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Purchase Orders</h2>
          <p style={styles.subtitle}>Create, manage, and print official procurement purchase orders</p>
        </div>
        <button style={styles.primaryButton} onClick={handleOpenCreateModal}>
          <FaPlus /> Create Purchase Order
        </button>
      </div>

      {/* Dashboard KPI Summary Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statIcon}><FaFileInvoice /></div>
          <div>
            <div style={styles.statLabel}>Total Orders</div>
            <div style={styles.statValue}>{stats.totalOrders || 0}</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, background: "#1d4ed8" }}><FaClock /></div>
          <div>
            <div style={styles.statLabel}>Issued Orders</div>
            <div style={styles.statValue}>{stats.issuedOrders || 0}</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, background: "#047857" }}><FaCheckCircle /></div>
          <div>
            <div style={styles.statLabel}>Completed Orders</div>
            <div style={styles.statValue}>{stats.completedOrders || 0}</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statIcon, background: "#d97706" }}>SGD</div>
          <div>
            <div style={styles.statLabel}>Total Value</div>
            <div style={styles.statValue}>SGD {(parseFloat(stats.totalAmount) || 0).toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={styles.toolbar}>
        <div style={styles.searchBox}>
          <FaSearch style={{ color: "#94a3b8" }} />
          <input
            style={styles.searchInput}
            placeholder="Search by PO No, Supplier Name, Quote Ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchPurchaseOrders()}
          />
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <select
            style={styles.select}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Statuses</option>
            <option value="issued">Issued</option>
            <option value="draft">Draft</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button style={styles.secondaryButton} onClick={() => fetchPurchaseOrders()}>
            Search
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>PO Number</th>
              <th style={styles.th}>Supplier</th>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Delivery Date</th>
              <th style={styles.th}>Quote Ref</th>
              <th style={styles.th}>Total (SGD)</th>
              <th style={styles.th}>Status</th>
              <th style={{ ...styles.th, textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ ...styles.td, textAlign: "center", padding: "40px" }}>
                  Loading purchase orders...
                </td>
              </tr>
            ) : purchaseOrders.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ ...styles.td, textAlign: "center", padding: "50px", color: "#94a3b8" }}>
                  No purchase orders found. Click "Create Purchase Order" to generate one.
                </td>
              </tr>
            ) : (
              purchaseOrders.map((po) => (
                <tr key={po.id} style={styles.tr}>
                  <td style={{ ...styles.td, fontWeight: "bold", color: "#38bdf8" }}>
                    {po.po_number || po.poNumber}
                  </td>
                  <td style={styles.td}>
                    <div style={{ fontWeight: "600" }}>{po.supplier_name || po.supplierName}</div>
                    {po.attn && <div style={{ fontSize: "12px", color: "#94a3b8" }}>Attn: {po.attn}</div>}
                  </td>
                  <td style={styles.td}>{formatDisplayDate(po.po_date || po.poDate)}</td>
                  <td style={styles.td}>{formatDisplayDate(po.delivery_date || po.deliveryDate) || "-"}</td>
                  <td style={styles.td}>{po.your_quote_ref || po.yourQuoteRef || "-"}</td>
                  <td style={{ ...styles.td, fontWeight: "600" }}>
                    SGD {(parseFloat(po.total) || 0).toFixed(2)}
                  </td>
                  <td style={styles.td}>{getStatusBadge(po.status)}</td>
                  <td style={{ ...styles.td, textAlign: "center" }}>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                      <button
                        title="Print Purchase Order"
                        style={{ ...styles.actionBtn, background: "#0b2f6b" }}
                        onClick={() => handlePrintPO(po)}
                      >
                        <FaPrint /> Print
                      </button>
                      <button
                        title="View Details"
                        style={{ ...styles.actionBtn, background: "#1e293b", border: "1px solid #334155" }}
                        onClick={() => {
                          setSelectedPO(po);
                          setShowViewModal(true);
                        }}
                      >
                        <FaEye />
                      </button>
                      <button
                        title="Edit"
                        style={{ ...styles.actionBtn, background: "#0284c7" }}
                        onClick={() => handleOpenEditModal(po)}
                      >
                        <FaEdit />
                      </button>
                      <button
                        title="Delete"
                        style={{ ...styles.actionBtn, background: "#dc2626" }}
                        onClick={() => handleDelete(po.id, po.po_number || po.poNumber)}
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button
            style={styles.pageBtn}
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span style={{ color: "#94a3b8", fontSize: "14px" }}>
            Page {page} of {totalPages}
          </span>
          <button
            style={styles.pageBtn}
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContainer} ref={modalRef}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {isEditing ? `Edit Purchase Order (${formData.poNumber})` : "Create Purchase Order"}
              </h3>
              <button style={styles.closeBtn} onClick={() => setShowModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={styles.modalBody}>
              {error && <div style={styles.errorAlert}>{error}</div>}
              {success && <div style={styles.successAlert}>{success}</div>}

              {/* Supplier Section */}
              <div style={styles.formSection}>
                <h4 style={styles.sectionHeading}>
                  <FaBuilding /> Supplier Information
                </h4>
                <div style={styles.grid2}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Select Existing Supplier (Auto-fill)</label>
                    <select
                      style={styles.select}
                      value={formData.supplierId}
                      onChange={(e) => handleSupplierSelect(e.target.value)}
                    >
                      <option value="">-- Choose Supplier (or enter manually) --</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.company || s.name} {s.phone ? `(${s.phone})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Supplier / Company Name *</label>
                    <input
                      style={styles.input}
                      required
                      value={formData.supplierName}
                      onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                      placeholder="e.g. Schneider Electric Singapore Pte Ltd"
                    />
                  </div>
                </div>

                <div style={styles.grid3}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Attn (Contact Person)</label>
                    <input
                      style={styles.input}
                      value={formData.attn}
                      onChange={(e) => setFormData({ ...formData, attn: e.target.value })}
                      placeholder="e.g. Sales Manager"
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Telephone</label>
                    <input
                      style={styles.input}
                      value={formData.supplierPhone}
                      onChange={(e) => setFormData({ ...formData, supplierPhone: e.target.value })}
                      placeholder="+65 6123 4567"
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Email</label>
                    <input
                      style={styles.input}
                      value={formData.supplierEmail}
                      onChange={(e) => setFormData({ ...formData, supplierEmail: e.target.value })}
                      placeholder="sales@supplier.com"
                    />
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Supplier Address</label>
                  <textarea
                    style={{ ...styles.input, minHeight: "50px" }}
                    value={formData.supplierAddress}
                    onChange={(e) => setFormData({ ...formData, supplierAddress: e.target.value })}
                    placeholder="Full supplier billing/office address"
                  />
                </div>
              </div>

              {/* PO Details Section */}
              <div style={styles.formSection}>
                <h4 style={styles.sectionHeading}>
                  <FaFileInvoice /> Purchase Order Details
                </h4>
                <div style={styles.grid4}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>PO Number *</label>
                    <input
                      style={styles.input}
                      required
                      value={formData.poNumber}
                      onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>PO Date *</label>
                    <input
                      type="date"
                      style={styles.input}
                      required
                      value={formData.poDate}
                      onChange={(e) => setFormData({ ...formData, poDate: e.target.value })}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Delivery Date</label>
                    <input
                      type="date"
                      style={styles.input}
                      value={formData.deliveryDate}
                      onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Your Quote Ref</label>
                    <input
                      style={styles.input}
                      value={formData.yourQuoteRef}
                      onChange={(e) => setFormData({ ...formData, yourQuoteRef: e.target.value })}
                      placeholder="e.g. QT-2026-889"
                    />
                  </div>
                </div>

                <div style={styles.grid2}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Deliver To (Delivery Address)</label>
                    <textarea
                      style={{ ...styles.input, minHeight: "55px" }}
                      value={formData.deliverTo}
                      onChange={(e) => setFormData({ ...formData, deliverTo: e.target.value })}
                      placeholder="Address where goods should be delivered"
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>PO Status</label>
                    <select
                      style={styles.select}
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="issued">Issued</option>
                      <option value="draft">Draft</option>
                      <option value="partially_received">Partially Received</option>
                      <option value="completed">Completed / Received</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Line Items Section */}
              <div style={styles.formSection}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h4 style={{ ...styles.sectionHeading, margin: 0 }}>
                    <FaBoxes /> Items List ({formData.items.length})
                  </h4>
                  <button type="button" style={styles.secondaryButton} onClick={handleAddItem}>
                    <FaPlus /> Add Line Item
                  </button>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ ...styles.table, fontSize: "13px" }}>
                    <thead>
                      <tr>
                        <th style={{ ...styles.th, width: "5%" }}>No.</th>
                        <th style={{ ...styles.th, width: "45%" }}>Description *</th>
                        <th style={{ ...styles.th, width: "10%" }}>Qty</th>
                        <th style={{ ...styles.th, width: "10%" }}>Unit</th>
                        <th style={{ ...styles.th, width: "15%" }}>Unit Price (SGD)</th>
                        <th style={{ ...styles.th, width: "15%" }}>Amount (SGD)</th>
                        <th style={{ ...styles.th, width: "5%" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, idx) => {
                        const amt = ((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)).toFixed(2);
                        return (
                          <tr key={idx} style={styles.tr}>
                            <td style={{ ...styles.td, textAlign: "center" }}>{idx + 1}</td>
                            <td style={styles.td}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                {availableProducts.length > 0 && (
                                  <select
                                    style={{ ...styles.select, padding: "4px 8px", fontSize: "12px" }}
                                    value={item.productId || ""}
                                    onChange={(e) => handleProductSelect(idx, e.target.value)}
                                  >
                                    <option value="">-- Or choose from catalog --</option>
                                    {availableProducts.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name} {p.model ? `(${p.model})` : ""}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                <textarea
                                  style={{ ...styles.input, minHeight: "45px", resize: "vertical" }}
                                  required
                                  value={item.description}
                                  onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                                  placeholder="Item / service description"
                                />
                              </div>
                            </td>
                            <td style={styles.td}>
                              <input
                                type="number"
                                step="any"
                                min="0.01"
                                style={{ ...styles.input, textAlign: "center" }}
                                value={item.quantity}
                                onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                              />
                            </td>
                            <td style={styles.td}>
                              <input
                                style={{ ...styles.input, textAlign: "center" }}
                                value={item.unit}
                                onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                                placeholder="nos"
                              />
                            </td>
                            <td style={styles.td}>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                style={{ ...styles.input, textAlign: "right" }}
                                value={item.unitPrice}
                                onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                              />
                            </td>
                            <td style={{ ...styles.td, textAlign: "right", fontWeight: "bold" }}>
                              {amt}
                            </td>
                            <td style={{ ...styles.td, textAlign: "center" }}>
                              <button
                                type="button"
                                style={{ ...styles.actionBtn, background: "#dc2626", padding: "6px" }}
                                onClick={() => handleRemoveItem(idx)}
                              >
                                <FaTrash />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Total summary bar */}
                <div style={styles.totalBar}>
                  <div style={{ fontStyle: "italic", color: "#94a3b8", fontSize: "13px" }}>
                    Not GST-registered – no GST charged.
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: "#38bdf8" }}>
                    TOTAL: SGD {calculateTotal().toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Terms and Conditions */}
              <div style={styles.formSection}>
                <h4 style={styles.sectionHeading}>Terms &amp; Conditions</h4>
                <textarea
                  style={{ ...styles.input, minHeight: "100px", fontFamily: "monospace", fontSize: "12px" }}
                  value={formData.terms}
                  onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                />
              </div>

              {/* Modal Footer Actions */}
              <div style={styles.modalFooter}>
                <button type="button" style={styles.cancelBtn} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" style={styles.primaryButton}>
                  {isEditing ? "Save Changes" : "Save & Place Purchase Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW MODAL */}
      {showViewModal && selectedPO && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContainer, maxWidth: "800px" }} ref={viewModalRef}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Purchase Order - {selectedPO.po_number || selectedPO.poNumber}</h3>
              <button style={styles.closeBtn} onClick={() => setShowViewModal(false)}>
                <FaTimes />
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                <div>
                  <h4 style={{ color: "#38bdf8", margin: "0 0 6px 0" }}>{selectedPO.supplier_name || selectedPO.supplierName}</h4>
                  {selectedPO.attn && <p style={{ margin: "2px 0", color: "#94a3b8" }}>Attn: {selectedPO.attn}</p>}
                  <p style={{ margin: "2px 0", color: "#94a3b8" }}>{selectedPO.supplier_address || selectedPO.supplierAddress}</p>
                  <p style={{ margin: "2px 0", color: "#94a3b8" }}>Tel: {selectedPO.supplier_phone || selectedPO.supplierPhone}</p>
                  <p style={{ margin: "2px 0", color: "#94a3b8" }}>Email: {selectedPO.supplier_email || selectedPO.supplierEmail}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: "2px 0" }}><strong>Date:</strong> {formatDisplayDate(selectedPO.po_date || selectedPO.poDate)}</p>
                  <p style={{ margin: "2px 0" }}><strong>Delivery Date:</strong> {formatDisplayDate(selectedPO.delivery_date || selectedPO.deliveryDate) || "-"}</p>
                  <p style={{ margin: "2px 0" }}><strong>Quote Ref:</strong> {selectedPO.your_quote_ref || selectedPO.yourQuoteRef || "-"}</p>
                  <p style={{ margin: "2px 0" }}><strong>Status:</strong> {getStatusBadge(selectedPO.status)}</p>
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <strong>Deliver To:</strong>
                <p style={{ whiteSpace: "pre-line", color: "#cbd5e1", margin: "4px 0" }}>
                  {selectedPO.deliver_to || selectedPO.deliverTo || DEFAULT_DELIVER_TO}
                </p>
              </div>

              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>No.</th>
                    <th style={styles.th}>Description</th>
                    <th style={styles.th}>Qty</th>
                    <th style={styles.th}>Unit</th>
                    <th style={styles.th}>Unit Price (SGD)</th>
                    <th style={styles.th}>Amount (SGD)</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedPO.items || []).map((it, idx) => (
                    <tr key={idx} style={styles.tr}>
                      <td style={styles.td}>{idx + 1}</td>
                      <td style={styles.td}>{it.description}</td>
                      <td style={styles.td}>{it.quantity}</td>
                      <td style={styles.td}>{it.unit || "nos"}</td>
                      <td style={{ ...styles.td, textAlign: "right" }}>{(parseFloat(it.unit_price || it.unitPrice) || 0).toFixed(2)}</td>
                      <td style={{ ...styles.td, textAlign: "right", fontWeight: "bold" }}>
                        {(parseFloat(it.amount) || ((parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price || it.unitPrice) || 0))).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ textAlign: "right", marginTop: "16px", fontSize: "18px", fontWeight: "bold", color: "#38bdf8" }}>
                TOTAL: SGD {(parseFloat(selectedPO.total) || 0).toFixed(2)}
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button
                style={styles.primaryButton}
                onClick={() => handlePrintPO(selectedPO)}
              >
                <FaPrint /> Print Official Purchase Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: "10px",
    color: "#e2e8f0"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px"
  },
  title: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#f8fafc",
    margin: 0
  },
  subtitle: {
    fontSize: "14px",
    color: "#94a3b8",
    margin: "4px 0 0 0"
  },
  primaryButton: {
    background: "#0284c7",
    color: "#fff",
    border: "none",
    padding: "10px 18px",
    borderRadius: "6px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    transition: "background 0.2s"
  },
  secondaryButton: {
    background: "#334155",
    color: "#f8fafc",
    border: "none",
    padding: "9px 16px",
    borderRadius: "6px",
    fontWeight: "500",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    cursor: "pointer"
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "16px",
    marginBottom: "24px"
  },
  statCard: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "16px",
    display: "flex",
    alignItems: "center",
    gap: "14px"
  },
  statIcon: {
    width: "44px",
    height: "44px",
    borderRadius: "8px",
    background: "#0f766e",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    fontWeight: "bold"
  },
  statLabel: {
    fontSize: "12px",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.5px"
  },
  statValue: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#f8fafc",
    marginTop: "2px"
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
    flexWrap: "wrap"
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "8px 14px",
    flex: 1,
    maxWidth: "420px"
  },
  searchInput: {
    background: "transparent",
    border: "none",
    color: "#fff",
    outline: "none",
    fontSize: "14px",
    width: "100%"
  },
  select: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "8px 12px",
    color: "#fff",
    outline: "none",
    fontSize: "14px"
  },
  tableWrapper: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "8px",
    overflow: "hidden"
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left"
  },
  th: {
    background: "#0f172a",
    color: "#94a3b8",
    padding: "12px 14px",
    fontSize: "13px",
    fontWeight: "600",
    borderBottom: "1px solid #334155"
  },
  tr: {
    borderBottom: "1px solid #334155",
    transition: "background 0.15s"
  },
  td: {
    padding: "12px 14px",
    fontSize: "14px",
    color: "#e2e8f0"
  },
  actionBtn: {
    border: "none",
    color: "#fff",
    padding: "6px 10px",
    borderRadius: "4px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "12px",
    fontWeight: "500"
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "4px 8px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: "600",
    textTransform: "capitalize"
  },
  pagination: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: "12px",
    marginTop: "16px"
  },
  pageBtn: {
    background: "#1e293b",
    border: "1px solid #334155",
    color: "#fff",
    padding: "6px 12px",
    borderRadius: "4px",
    cursor: "pointer"
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px"
  },
  modalContainer: {
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "10px",
    width: "100%",
    maxWidth: "950px",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)"
  },
  modalHeader: {
    padding: "16px 20px",
    borderBottom: "1px solid #334155",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  modalTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#f8fafc",
    margin: 0
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    fontSize: "18px",
    cursor: "pointer"
  },
  modalBody: {
    padding: "20px",
    overflowY: "auto",
    flex: 1
  },
  modalFooter: {
    padding: "16px 20px",
    borderTop: "1px solid #334155",
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px"
  },
  cancelBtn: {
    background: "#334155",
    color: "#f8fafc",
    border: "none",
    padding: "10px 18px",
    borderRadius: "6px",
    fontWeight: "500",
    cursor: "pointer"
  },
  formSection: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "16px"
  },
  sectionHeading: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#38bdf8",
    marginBottom: "14px",
    display: "flex",
    alignItems: "center",
    gap: "8px"
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginBottom: "12px"
  },
  label: {
    fontSize: "13px",
    fontWeight: "500",
    color: "#94a3b8"
  },
  input: {
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "6px",
    padding: "8px 12px",
    color: "#fff",
    fontSize: "14px",
    outline: "none"
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px"
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "14px"
  },
  grid4: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1fr",
    gap: "14px"
  },
  totalBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 14px",
    background: "#0f172a",
    borderRadius: "6px",
    marginTop: "12px",
    border: "1px solid #334155"
  },
  errorAlert: {
    background: "#7f1d1d",
    color: "#fecaca",
    padding: "10px 14px",
    borderRadius: "6px",
    marginBottom: "14px",
    fontSize: "14px"
  },
  successAlert: {
    background: "#065f46",
    color: "#a7f3d0",
    padding: "10px 14px",
    borderRadius: "6px",
    marginBottom: "14px",
    fontSize: "14px"
  }
};

export default PurchaseOrder;
