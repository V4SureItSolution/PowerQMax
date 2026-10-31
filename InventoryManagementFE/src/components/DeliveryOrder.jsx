import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  FaTruck,
  FaPlus,
  FaSearch,
  FaPrint,
  FaEye,
  FaEdit,
  FaTrash,
  FaCheckCircle,
  FaClock,
  FaTimes,
  FaBox,
  FaSyncAlt,
  FaBuilding,
  FaClipboardList,
  FaShippingFast,
  FaCalendarAlt,
  FaInfoCircle,
} from "react-icons/fa";
import { POWERQ_LOGO_BASE64, BCA_LOGO_BASE64 } from "../assets/invoiceLogos";

const FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const DeliveryOrderPage = () => {
  const api = axios.create({
    baseURL: "http://localhost:5000/api",
    withCredentials: true,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  // State
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    dispatched: 0,
    delivered: 0,
    cancelled: 0,
    totalUnits: 0,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 10,
    total: 0,
    pages: 1,
  });

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedDO, setSelectedDO] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // Status update form
  const [statusUpdateData, setStatusUpdateData] = useState({
    status: "dispatched",
    driverName: "",
    vehicleNo: "",
    receivedBy: "",
  });

  // Create / Edit Form State
  const [formData, setFormData] = useState({
    doNumber: "",
    doDate: new Date().toISOString().split("T")[0],
    customerName: "",
    attn: "",
    customerPhone: "",
    customerEmail: "",
    customerAddress: "",
    deliveryAddress: "",
    sameAsCompanyAddress: true,
    yourPoNo: "",
    invoiceNo: "",
    quotationNo: "",
    deliveryMethod: "Company Delivery",
    vehicleNo: "",
    driverName: "",
    trackingNo: "",
    status: "pending",
    preparedBy: "",
    deliveredBy: "",
    notes: "",
  });

  const [items, setItems] = useState([
    {
      productId: null,
      productName: "",
      productModel: "",
      hsnCode: "",
      unit: "nos",
      quantity: 1,
      remarks: "",
    },
  ]);

  // Product Autocomplete
  const [productSearchResults, setProductSearchResults] = useState([]);
  const [activeItemIndex, setActiveItemIndex] = useState(null);
  const searchTimeoutRef = useRef(null);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowCreateModal(false);
        setShowViewModal(false);
        setShowStatusModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch data on mount / filters
  useEffect(() => {
    fetchDeliveryOrders();
    fetchStats();
  }, [pagination.page, statusFilter]);

  const fetchStats = async () => {
    try {
      const res = await api.get("/delivery-order/statistics");
      if (res.data && res.data.success) {
        setStats(res.data);
      }
    } catch (err) {
      console.error("Error fetching DO stats:", err);
    }
  };

  const fetchDeliveryOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        per_page: pagination.per_page,
      });

      if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (search) {
        params.append("search", search);
      }

      const res = await api.get(`/delivery-order?${params.toString()}`);
      if (res.data && res.data.success) {
        setDeliveryOrders(res.data.items || []);
        setPagination((prev) => ({
          ...prev,
          total: res.data.total || 0,
          pages: res.data.pages || 1,
        }));
      }
    } catch (err) {
      console.error("Error fetching delivery orders:", err);
      setError(err.response?.data?.error || "Failed to load delivery orders");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchDeliveryOrders();
  };

  const resetForm = async () => {
    let nextDoNumber = "PQM-DO-0001";
    try {
      const res = await api.get("/delivery-order/next-number");
      if (res.data && res.data.nextNumber) {
        nextDoNumber = res.data.nextNumber;
      }
    } catch (err) {
      console.error("Could not fetch next DO number:", err);
    }

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const loggedInName = user?.name || user?.username || "";

    setFormData({
      doNumber: nextDoNumber,
      doDate: new Date().toISOString().split("T")[0],
      customerName: "",
      attn: "",
      customerPhone: "",
      customerEmail: "",
      customerAddress: "",
      deliveryAddress: "",
      sameAsCompanyAddress: true,
      yourPoNo: "",
      invoiceNo: "",
      quotationNo: "",
      deliveryMethod: "Company Delivery",
      vehicleNo: "",
      driverName: "",
      trackingNo: "",
      status: "pending",
      preparedBy: loggedInName,
      deliveredBy: "",
      notes: "",
    });

    setItems([
      {
        productId: null,
        productName: "",
        productModel: "",
        hsnCode: "",
        unit: "nos",
        quantity: 1,
        remarks: "",
      },
    ]);

    setIsEditing(false);
    setSelectedDO(null);
  };

  const handleOpenCreateModal = async () => {
    await resetForm();
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (doObj) => {
    setSelectedDO(doObj);
    setIsEditing(true);

    const isSameAddress =
      !doObj.deliveryAddress ||
      !doObj.delivery_address ||
      doObj.deliveryAddress === doObj.customerAddress ||
      doObj.delivery_address === doObj.customer_address;

    setFormData({
      doNumber: doObj.doNumber || doObj.do_number,
      doDate: (doObj.doDate || doObj.do_date || "").substring(0, 10),
      customerName: doObj.customerName || doObj.customer_name || "",
      attn: doObj.attn || "",
      customerPhone: doObj.customerPhone || doObj.customer_phone || "",
      customerEmail: doObj.customerEmail || doObj.customer_email || "",
      customerAddress: doObj.customerAddress || doObj.customer_address || "",
      deliveryAddress: isSameAddress
        ? ""
        : doObj.deliveryAddress || doObj.delivery_address || "",
      sameAsCompanyAddress: isSameAddress,
      yourPoNo: doObj.yourPoNo || doObj.your_po_no || "",
      invoiceNo: doObj.invoiceNo || doObj.invoice_no || "",
      quotationNo: doObj.quotationNo || doObj.quotation_no || "",
      deliveryMethod:
        doObj.deliveryMethod || doObj.delivery_method || "Company Delivery",
      vehicleNo: doObj.vehicleNo || doObj.vehicle_no || "",
      driverName: doObj.driverName || doObj.driver_name || "",
      trackingNo: doObj.trackingNo || doObj.tracking_no || "",
      status: doObj.status || "pending",
      preparedBy: doObj.preparedBy || doObj.prepared_by || "",
      deliveredBy: doObj.deliveredBy || doObj.delivered_by || "",
      notes: doObj.notes || "",
    });

    if (doObj.items && doObj.items.length > 0) {
      setItems(
        doObj.items.map((it) => ({
          productId: it.productId || it.product_id || null,
          productName: it.productName || it.product_name || it.name || "",
          productModel: it.productModel || it.product_model || it.model || "",
          hsnCode: it.hsnCode || it.hsn_code || "",
          unit: it.unit || "nos",
          quantity: it.quantity || 1,
          remarks: it.remarks || "",
        }))
      );
    } else {
      setItems([
        {
          productId: null,
          productName: "",
          productModel: "",
          hsnCode: "",
          unit: "nos",
          quantity: 1,
          remarks: "",
        },
      ]);
    }

    setShowCreateModal(true);
  };

  // Product Autocomplete handlers
  const handleProductSearchChange = (index, value) => {
    const updated = [...items];
    updated[index].productName = value;
    setItems(updated);
    setActiveItemIndex(index);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!value || value.length < 2) {
      setProductSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await api.get(
          `/billing/search-products?q=${encodeURIComponent(value)}`
        );
        if (Array.isArray(res.data)) {
          setProductSearchResults(res.data);
        }
      } catch (err) {
        console.error("Product search error:", err);
      }
    }, 300);
  };

  const handleSelectProduct = (index, product) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      productId: product.id,
      productName: product.name,
      productModel: product.model || "",
      hsnCode: product.hsnCode || "",
      unit: product.unit || "nos",
    };
    setItems(updated);
    setProductSearchResults([]);
    setActiveItemIndex(null);
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        productId: null,
        productName: "",
        productModel: "",
        hsnCode: "",
        unit: "nos",
        quantity: 1,
        remarks: "",
      },
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) {
      setError("Delivery order must have at least one item");
      setTimeout(() => setError(""), 3000);
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  // Submit DO
  const handleSubmitDO = async (e) => {
    e.preventDefault();

    if (!formData.customerName.trim()) {
      setError("Customer Name is required");
      return;
    }
    if (!formData.customerPhone.trim()) {
      setError("Customer Phone is required");
      return;
    }

    const validItems = items.filter(
      (it) => it.productName && it.productName.trim()
    );
    if (validItems.length === 0) {
      setError("Please add at least one valid item with a description/name");
      return;
    }

    const payload = {
      ...formData,
      deliveryAddress: formData.sameAsCompanyAddress
        ? formData.customerAddress
        : formData.deliveryAddress,
      items: validItems,
    };

    setLoading(true);
    try {
      if (isEditing && selectedDO) {
        const res = await api.put(`/delivery-order/${selectedDO.id}`, payload);
        if (res.data && res.data.success) {
          setSuccess("Delivery order updated successfully!");
          setShowCreateModal(false);
          fetchDeliveryOrders();
          fetchStats();
        }
      } else {
        const res = await api.post("/delivery-order", payload);
        if (res.data && res.data.success) {
          setSuccess(
            `Delivery order ${res.data.doNumber} created successfully!`
          );
          setShowCreateModal(false);
          fetchDeliveryOrders();
          fetchStats();
        }
      }
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      console.error("Error saving delivery order:", err);
      setError(err.response?.data?.error || "Failed to save delivery order");
    } finally {
      setLoading(false);
    }
  };

  // Open Status modal
  const handleOpenStatusModal = (doObj) => {
    setSelectedDO(doObj);
    setStatusUpdateData({
      status: doObj.status || "dispatched",
      driverName: doObj.driverName || doObj.driver_name || "",
      vehicleNo: doObj.vehicleNo || doObj.vehicle_no || "",
      receivedBy: doObj.receivedBy || doObj.received_by || "",
    });
    setShowStatusModal(true);
  };

  const handleSaveStatus = async () => {
    if (!selectedDO) return;
    try {
      setLoading(true);
      const res = await api.patch(
        `/delivery-order/${selectedDO.id}/status`,
        statusUpdateData
      );
      if (res.data && res.data.success) {
        setSuccess(`Delivery status updated to ${statusUpdateData.status}`);
        setShowStatusModal(false);
        fetchDeliveryOrders();
        fetchStats();
        if (showViewModal) {
          setSelectedDO(res.data.deliveryOrder);
        }
      }
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      console.error("Error updating status:", err);
      setError(err.response?.data?.error || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  // Delete DO
  const handleDeleteDO = async (id, doNumber) => {
    if (
      !window.confirm(
        `Are you sure you want to delete Delivery Order ${doNumber}? This action cannot be undone.`
      )
    ) {
      return;
    }
    try {
      setLoading(true);
      const res = await api.delete(`/delivery-order/${id}`);
      if (res.data && res.data.success) {
        setSuccess(`Delivery order ${doNumber} deleted`);
        fetchDeliveryOrders();
        fetchStats();
      }
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      console.error("Error deleting DO:", err);
      setError(err.response?.data?.error || "Failed to delete delivery order");
    } finally {
      setLoading(false);
    }
  };

  // Print Delivery Order
  const handlePrintDO = (doObj) => {
    const doNumber = doObj.doNumber || doObj.do_number || "PQM-DO-0001";
    const doDate = doObj.doDate || doObj.do_date || "";
    const formattedDate = doDate
      ? new Date(doDate).toLocaleDateString("en-GB")
      : "";

    const itemsHtml = (doObj.items || [])
      .map(
        (it, idx) => `
        <tr>
          <td style="text-align: center; border: 1px solid #94a3b8; padding: 7px 6px;">${
            idx + 1
          }</td>
          <td style="border: 1px solid #94a3b8; padding: 7px 8px;">
            <div style="font-weight: 600; color: #0f172a;">${
              it.productName || it.product_name || it.name || ""
            }</div>
            ${
              it.productModel || it.product_model || it.model
                ? `<div style="font-size: 8.5pt; color: #475569;">Model: ${
                    it.productModel || it.product_model || it.model
                  }</div>`
                : ""
            }
          </td>
          <td style="text-align: center; font-weight: 600; border: 1px solid #94a3b8; padding: 7px 6px;">${
            it.quantity || 1
          }</td>
          <td style="text-align: center; text-transform: uppercase; border: 1px solid #94a3b8; padding: 7px 6px;">${
            it.unit || "nos"
          }</td>
          <td style="border: 1px solid #94a3b8; padding: 7px 8px; color: #334155;">${
            it.remarks || "-"
          }</td>
        </tr>
      `
      )
      .join("");

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow pop-ups to print the delivery order");
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Delivery Order - ${doNumber}</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          * {
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            margin: 0;
            padding: 0;
            color: #0f172a;
            font-size: 9.5pt;
            line-height: 1.35;
            background: #fff;
          }
          .do-container {
            max-width: 800px;
            margin: 0 auto;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
          }
          .header-table td {
            vertical-align: middle;
            border: none;
            padding: 0;
          }
          .header-left {
            width: 90px;
            text-align: left;
          }
          .header-left img {
            width: 80px;
            height: auto;
            object-fit: contain;
          }
          .header-center {
            text-align: center;
            padding: 0 10px;
          }
          .header-right {
            width: 85px;
            text-align: right;
          }
          .header-right img {
            width: 75px;
            height: auto;
            object-fit: contain;
          }
          .company-name {
            font-size: 15pt;
            font-weight: 800;
            color: #0b2f6b;
            letter-spacing: 0.5px;
            margin-bottom: 2px;
          }
          .company-tags {
            font-size: 8.5pt;
            font-weight: 700;
            color: #0284c7;
            margin-bottom: 3px;
          }
          .company-info {
            font-size: 8.5pt;
            color: #334155;
            line-height: 1.3;
          }

          /* Dividers */
          .divider-container {
            margin: 10px 0 14px;
          }
          .divider-thick {
            height: 3px;
            background: #0b2f6b;
          }
          .divider-gap {
            height: 2px;
          }
          .divider-thin {
            height: 1px;
            background: #0284c7;
          }

          /* Doc Title */
          .doc-title {
            text-align: center;
            color: #0b2f6b;
            font-size: 16pt;
            font-weight: 800;
            letter-spacing: 2px;
            margin-bottom: 12px;
            text-transform: uppercase;
          }

          /* Meta Table */
          .meta-wrapper {
            display: flex;
            justify-content: space-between;
            margin-bottom: 16px;
            gap: 15px;
          }
          .meta-box {
            width: 49%;
            border: 1px solid #94a3b8;
            border-radius: 4px;
            padding: 8px 10px;
            background: #f8fafc;
          }
          .meta-title {
            font-weight: 700;
            font-size: 9pt;
            color: #0b2f6b;
            text-transform: uppercase;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 4px;
            margin-bottom: 6px;
          }
          .meta-row {
            display: flex;
            font-size: 8.5pt;
            margin-bottom: 3px;
          }
          .meta-label {
            width: 105px;
            font-weight: 700;
            color: #334155;
          }
          .meta-val {
            flex: 1;
            color: #0f172a;
          }

          /* Items Table */
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          .items-table th {
            background: #0b2f6b;
            color: #ffffff;
            font-size: 8.5pt;
            font-weight: 700;
            padding: 8px 6px;
            border: 1px solid #0b2f6b;
            text-transform: uppercase;
          }
          .items-table td {
            font-size: 8.5pt;
          }

          /* Total summary row */
          .total-summary-bar {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          .total-summary-bar td {
            border: 1px solid #94a3b8;
            padding: 7px 10px;
            font-size: 9pt;
          }
          .total-units-label {
            background: #f1f5f9;
            font-weight: 700;
            text-align: right;
            width: 75%;
          }
          .total-units-val {
            background: #e2e8f0;
            font-weight: 800;
            text-align: center;
            color: #0b2f6b;
            width: 25%;
          }

          /* Instructions */
          .notes-box {
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 8px 10px;
            margin-bottom: 22px;
            background: #f8fafc;
            font-size: 8.5pt;
          }
          .notes-title {
            font-weight: 700;
            color: #0b2f6b;
            margin-bottom: 3px;
          }

          /* Signatures Section */
          .signatures-grid {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            margin-top: 25px;
          }
          .sig-box {
            width: 32%;
            border: 1px solid #94a3b8;
            border-radius: 4px;
            padding: 8px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 140px;
            background: #ffffff;
          }
          .sig-header {
            font-size: 8pt;
            font-weight: 700;
            color: #0b2f6b;
            text-transform: uppercase;
            text-align: center;
            border-bottom: 1px dashed #cbd5e1;
            padding-bottom: 4px;
            margin-bottom: 8px;
          }
          .sig-body {
            font-size: 8pt;
            color: #475569;
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            gap: 4px;
          }
          .sig-line {
            border-bottom: 1px solid #94a3b8;
            height: 35px;
            margin-bottom: 4px;
          }
          .sig-label {
            font-size: 7.5pt;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="do-container">
          <!-- Header -->
          <table class="header-table">
            <tr>
              <td class="header-left">
                <img src="${POWERQ_LOGO_BASE64}" alt="PowerQ Max Logo" />
              </td>
              <td class="header-center">
                <div class="company-name">POWERQ MAX ENGINEERING PTE LTD</div>
                <div class="company-tags">
                  Electrical &bull; BMS &bull; ELV &amp; Security &bull; Fire Alarm &bull; Renovation &bull; IT
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
          <div class="doc-title">DELIVERY ORDER</div>

          <!-- Metadata -->
          <div class="meta-wrapper">
            <div class="meta-box">
              <div class="meta-title">Delivery Details &amp; Customer</div>
              <div class="meta-row">
                <span class="meta-label">Customer / To:</span>
                <span class="meta-val"><strong>${
                  doObj.customerName || doObj.customer_name || ""
                }</strong></span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Attn / Person:</span>
                <span class="meta-val">${doObj.attn || "-"}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Tel / Contact:</span>
                <span class="meta-val">${
                  doObj.customerPhone || doObj.customer_phone || ""
                }</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Delivery Address:</span>
                <span class="meta-val">${
                  doObj.deliveryAddress ||
                  doObj.delivery_address ||
                  doObj.customerAddress ||
                  doObj.customer_address ||
                  "-"
                }</span>
              </div>
            </div>

            <div class="meta-box">
              <div class="meta-title">Order References &amp; Transport</div>
              <div class="meta-row">
                <span class="meta-label">DO Number:</span>
                <span class="meta-val"><strong>${doNumber}</strong></span>
              </div>
              <div class="meta-row">
                <span class="meta-label">DO Date:</span>
                <span class="meta-val">${formattedDate}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Your PO No.:</span>
                <span class="meta-val">${
                  doObj.yourPoNo || doObj.your_po_no || "-"
                }</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Invoice Ref:</span>
                <span class="meta-val">${
                  doObj.invoiceNo || doObj.invoice_no || "-"
                }</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Delivery Mode:</span>
                <span class="meta-val">${
                  doObj.deliveryMethod ||
                  doObj.delivery_method ||
                  "Company Delivery"
                }</span>
              </div>
              ${
                doObj.vehicleNo || doObj.vehicle_no
                  ? `<div class="meta-row">
                      <span class="meta-label">Vehicle No.:</span>
                      <span class="meta-val">${
                        doObj.vehicleNo || doObj.vehicle_no
                      }</span>
                    </div>`
                  : ""
              }
            </div>
          </div>

          <!-- Items Table -->
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 6%;">No.</th>
                <th style="width: 50%;">Description / Model</th>
                <th style="width: 10%;">Qty</th>
                <th style="width: 10%;">Unit</th>
                <th style="width: 24%;">Remarks</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <!-- Total Units -->
          <table class="total-summary-bar">
            <tr>
              <td class="total-units-label">TOTAL DELIVERED QUANTITY:</td>
              <td class="total-units-val">${
                doObj.totalQuantity ||
                doObj.total_quantity ||
                (doObj.items || []).reduce(
                  (acc, it) => acc + (it.quantity || 1),
                  0
                )
              } Units</td>
            </tr>
          </table>

          <!-- Instructions / Notes -->
          <div class="notes-box">
            <div class="notes-title">Instructions &amp; Acknowledgement:</div>
            <div>${
              doObj.notes ||
              "Please check all items upon receipt. Any discrepancies must be reported within 24 hours of delivery."
            }</div>
          </div>

          <!-- Signatures (Legal POD 3 boxes) -->
          <div class="signatures-grid">
            <div class="sig-box">
              <div class="sig-header">Issued By / Prepared By</div>
              <div class="sig-body">
                <div><strong>PowerQ Max Engineering Pte Ltd</strong></div>
                <div>Name: ${
                  doObj.preparedBy || doObj.prepared_by || "Authorized Staff"
                }</div>
                <div class="sig-line"></div>
                <div class="sig-label">Authorized Signature &amp; Stamp</div>
                <div>Date: ${formattedDate}</div>
              </div>
            </div>

            <div class="sig-box">
              <div class="sig-header">Delivered By</div>
              <div class="sig-body">
                <div>Driver: ${
                  doObj.driverName ||
                  doObj.driver_name ||
                  doObj.deliveredBy ||
                  doObj.delivered_by ||
                  "Delivery Team"
                }</div>
                <div>Vehicle: ${doObj.vehicleNo || doObj.vehicle_no || "-"}</div>
                <div class="sig-line"></div>
                <div class="sig-label">Driver Signature</div>
                <div>Date: ___________</div>
              </div>
            </div>

            <div class="sig-box">
              <div class="sig-header">Received in Good Condition</div>
              <div class="sig-body">
                <div>Received By: ${
                  doObj.receivedBy || doObj.received_by || "_________________"
                }</div>
                <div>NRIC / IC: _________________</div>
                <div class="sig-line"></div>
                <div class="sig-label">Receiver Signature &amp; Company Stamp</div>
                <div>Date &amp; Time: _______________</div>
              </div>
            </div>
          </div>
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

  // Styles sharing identical system font with the rest of PowerQMax
  const styles = {
    container: {
      padding: "20px",
      color: "#f8fafc",
      maxWidth: "1400px",
      margin: "0 auto",
      fontFamily: FONT_FAMILY,
    },
    headerRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "24px",
      flexWrap: "wrap",
      gap: "16px",
    },
    pageTitle: {
      fontSize: "22px",
      fontWeight: "700",
      color: "#f8fafc",
      display: "flex",
      alignItems: "center",
      gap: "10px",
      margin: 0,
      fontFamily: FONT_FAMILY,
    },
    titleSub: {
      fontSize: "13px",
      color: "#94a3b8",
      marginTop: "4px",
      fontFamily: FONT_FAMILY,
    },
    primaryBtn: {
      background: "linear-gradient(135deg, #0284c7, #0369a1)",
      color: "#ffffff",
      border: "none",
      borderRadius: "6px",
      padding: "9px 18px",
      fontSize: "13px",
      fontWeight: "600",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
      transition: "all 0.2s ease",
      fontFamily: FONT_FAMILY,
    },
    secondaryBtn: {
      background: "#334155",
      color: "#f8fafc",
      border: "none",
      borderRadius: "6px",
      padding: "9px 16px",
      fontSize: "13px",
      fontWeight: "500",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontFamily: FONT_FAMILY,
    },
    statsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: "16px",
      marginBottom: "24px",
    },
    statCard: (borderColor) => ({
      background: "#1e293b",
      border: "1px solid #334155",
      borderLeft: `4px solid ${borderColor}`,
      borderRadius: "8px",
      padding: "16px 18px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }),
    statNumber: {
      fontSize: "24px",
      fontWeight: "700",
      color: "#ffffff",
      marginTop: "4px",
      fontFamily: FONT_FAMILY,
    },
    statLabel: {
      fontSize: "12px",
      color: "#94a3b8",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      fontFamily: FONT_FAMILY,
    },
    filterBar: {
      background: "#1e293b",
      border: "1px solid #334155",
      borderRadius: "8px",
      padding: "14px 18px",
      marginBottom: "20px",
      display: "flex",
      flexWrap: "wrap",
      gap: "12px",
      alignItems: "center",
      justifyContent: "space-between",
    },
    searchForm: {
      display: "flex",
      gap: "8px",
      flex: 1,
      minWidth: "260px",
    },
    input: {
      background: "#0f172a",
      border: "1px solid #334155",
      borderRadius: "6px",
      padding: "9px 12px",
      color: "#f8fafc",
      fontSize: "13px",
      outline: "none",
      width: "100%",
      fontFamily: FONT_FAMILY,
      boxSizing: "border-box",
      transition: "border-color 0.2s ease",
    },
    statusPillGroup: {
      display: "flex",
      gap: "6px",
      flexWrap: "wrap",
    },
    statusPill: (isActive, color) => ({
      background: isActive ? color : "#0f172a",
      color: isActive ? "#ffffff" : "#94a3b8",
      border: `1px solid ${isActive ? color : "#334155"}`,
      padding: "6px 12px",
      borderRadius: "20px",
      fontSize: "12px",
      fontWeight: "600",
      cursor: "pointer",
      transition: "all 0.2s ease",
      fontFamily: FONT_FAMILY,
    }),
    tableWrapper: {
      background: "#1e293b",
      border: "1px solid #334155",
      borderRadius: "8px",
      overflow: "hidden",
      boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      textAlign: "left",
      fontSize: "13px",
      fontFamily: FONT_FAMILY,
    },
    th: {
      background: "#0f172a",
      color: "#94a3b8",
      padding: "12px 14px",
      fontWeight: "600",
      textTransform: "uppercase",
      fontSize: "11px",
      letterSpacing: "0.5px",
      borderBottom: "1px solid #334155",
      fontFamily: FONT_FAMILY,
    },
    td: {
      padding: "12px 14px",
      borderBottom: "1px solid #334155",
      color: "#cbd5e1",
      fontFamily: FONT_FAMILY,
    },
    badge: (status) => {
      const colors = {
        pending: {
          bg: "rgba(245, 158, 11, 0.15)",
          text: "#f59e0b",
          border: "#f59e0b",
        },
        dispatched: {
          bg: "rgba(56, 189, 248, 0.15)",
          text: "#38bdf8",
          border: "#38bdf8",
        },
        delivered: {
          bg: "rgba(16, 185, 129, 0.15)",
          text: "#10b981",
          border: "#10b981",
        },
        cancelled: {
          bg: "rgba(239, 68, 68, 0.15)",
          text: "#ef4444",
          border: "#ef4444",
        },
      };
      const c = colors[status] || colors.pending;
      return {
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        padding: "3px 9px",
        borderRadius: "12px",
        fontSize: "11px",
        fontWeight: "700",
        textTransform: "uppercase",
        display: "inline-block",
        fontFamily: FONT_FAMILY,
      };
    },
    actionBtnGroup: {
      display: "flex",
      gap: "6px",
      alignItems: "center",
    },
    actionBtn: (bgColor) => ({
      background: bgColor,
      color: "#ffffff",
      border: "none",
      borderRadius: "5px",
      padding: "6px 9px",
      cursor: "pointer",
      fontSize: "12px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: FONT_FAMILY,
    }),

    // Modal Styles
    modalOverlay: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.75)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: "20px",
    },
    modalContainer: {
      backgroundColor: "#1e293b",
      border: "1px solid #334155",
      borderRadius: "12px",
      width: "100%",
      maxWidth: "1050px",
      maxHeight: "92vh",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      boxShadow:
        "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)",
      fontFamily: FONT_FAMILY,
    },
    modalHeader: {
      padding: "18px 24px",
      borderBottom: "1px solid #334155",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      background: "#1e293b",
    },
    modalTitle: {
      fontSize: "18px",
      fontWeight: "700",
      color: "#f8fafc",
      margin: 0,
      display: "flex",
      alignItems: "center",
      gap: "10px",
      fontFamily: FONT_FAMILY,
    },
    modalCloseBtn: {
      background: "none",
      border: "none",
      color: "#94a3b8",
      fontSize: "22px",
      cursor: "pointer",
      padding: "0 6px",
      lineHeight: 1,
      display: "flex",
      alignItems: "center",
      transition: "color 0.2s",
      fontFamily: FONT_FAMILY,
    },
    modalBody: {
      padding: "22px 24px",
      overflowY: "auto",
      flex: 1,
    },
    modalFooter: {
      padding: "16px 24px",
      borderTop: "1px solid #334155",
      display: "flex",
      justifyContent: "flex-end",
      gap: "12px",
      background: "#1e293b",
    },

    // Form Section Cards (Perfect Professional Alignment)
    sectionCard: {
      background: "rgba(15, 23, 42, 0.55)",
      border: "1px solid #334155",
      borderRadius: "8px",
      padding: "16px 18px",
      marginBottom: "18px",
    },
    sectionCardHeader: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "12.5px",
      fontWeight: "700",
      color: "#38bdf8",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      paddingBottom: "10px",
      marginBottom: "14px",
      borderBottom: "1px solid rgba(51, 65, 85, 0.6)",
      fontFamily: FONT_FAMILY,
    },

    // Symmetric 3-column & 2-column & 4-column Grids
    grid3: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "16px",
    },
    grid2: {
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: "16px",
    },
    grid4: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "16px",
    },

    formField: {
      display: "flex",
      flexDirection: "column",
      gap: "6px",
    },
    label: {
      fontSize: "12.5px",
      fontWeight: "600",
      color: "#e2e8f0",
      fontFamily: FONT_FAMILY,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    dropdownList: {
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
      background: "#0f172a",
      border: "1px solid #475569",
      borderRadius: "6px",
      maxHeight: "180px",
      overflowY: "auto",
      zIndex: 100,
      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.5)",
      fontFamily: FONT_FAMILY,
    },
    dropdownItem: {
      padding: "9px 12px",
      cursor: "pointer",
      borderBottom: "1px solid #1e293b",
      fontSize: "12px",
      color: "#f8fafc",
      fontFamily: FONT_FAMILY,
    },
    pagination: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "14px",
      borderTop: "1px solid #334155",
      fontSize: "13px",
      color: "#94a3b8",
      fontFamily: FONT_FAMILY,
    },
    paginationBtn: (disabled) => ({
      background: disabled ? "#334155" : "#0284c7",
      color: disabled ? "#64748b" : "#ffffff",
      border: "none",
      borderRadius: "6px",
      padding: "6px 14px",
      cursor: disabled ? "not-allowed" : "pointer",
      fontSize: "12px",
      fontWeight: "600",
      fontFamily: FONT_FAMILY,
    }),
    alertSuccess: {
      background: "rgba(16, 185, 129, 0.15)",
      border: "1px solid #10b981",
      color: "#10b981",
      padding: "10px 14px",
      borderRadius: "8px",
      marginBottom: "16px",
      fontSize: "13px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontFamily: FONT_FAMILY,
    },
    alertError: {
      background: "rgba(239, 68, 68, 0.15)",
      border: "1px solid #ef4444",
      color: "#ef4444",
      padding: "10px 14px",
      borderRadius: "8px",
      marginBottom: "16px",
      fontSize: "13px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontFamily: FONT_FAMILY,
    },
  };

  return (
    <div style={styles.container}>
      {/* Notifications */}
      {success && (
        <div style={styles.alertSuccess}>
          <span>{success}</span>
          <FaTimes
            style={{ cursor: "pointer" }}
            onClick={() => setSuccess("")}
          />
        </div>
      )}
      {error && (
        <div style={styles.alertError}>
          <span>{error}</span>
          <FaTimes style={{ cursor: "pointer" }} onClick={() => setError("")} />
        </div>
      )}

      {/* Page Header */}
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.pageTitle}>
            <FaTruck style={{ color: "#38bdf8" }} />
            Delivery Orders
          </h1>
          <div style={styles.titleSub}>
            Generate, dispatch, and track customer delivery orders and delivery notes
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            style={styles.secondaryBtn}
            onClick={() => {
              fetchDeliveryOrders();
              fetchStats();
            }}
            title="Refresh"
          >
            <FaSyncAlt /> Refresh
          </button>
          <button style={styles.primaryBtn} onClick={handleOpenCreateModal}>
            <FaPlus /> Create Delivery Order
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard("#38bdf8")}>
          <div>
            <div style={styles.statLabel}>Total Orders</div>
            <div style={styles.statNumber}>{stats.total}</div>
          </div>
          <FaClipboardList
            style={{ fontSize: "28px", color: "#38bdf8", opacity: 0.8 }}
          />
        </div>

        <div style={styles.statCard("#f59e0b")}>
          <div>
            <div style={styles.statLabel}>Pending Dispatch</div>
            <div style={styles.statNumber}>{stats.pending}</div>
          </div>
          <FaClock
            style={{ fontSize: "28px", color: "#f59e0b", opacity: 0.8 }}
          />
        </div>

        <div style={styles.statCard("#0284c7")}>
          <div>
            <div style={styles.statLabel}>Dispatched / In Transit</div>
            <div style={styles.statNumber}>{stats.dispatched}</div>
          </div>
          <FaShippingFast
            style={{ fontSize: "28px", color: "#38bdf8", opacity: 0.8 }}
          />
        </div>

        <div style={styles.statCard("#10b981")}>
          <div>
            <div style={styles.statLabel}>Delivered &amp; Signed</div>
            <div style={styles.statNumber}>{stats.delivered}</div>
          </div>
          <FaCheckCircle
            style={{ fontSize: "28px", color: "#10b981", opacity: 0.8 }}
          />
        </div>

        <div style={styles.statCard("#a855f7")}>
          <div>
            <div style={styles.statLabel}>Total Delivered Units</div>
            <div style={styles.statNumber}>{stats.totalUnits}</div>
          </div>
          <FaBox
            style={{ fontSize: "28px", color: "#a855f7", opacity: 0.8 }}
          />
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={styles.filterBar}>
        <form onSubmit={handleSearchSubmit} style={styles.searchForm}>
          <div style={{ position: "relative", width: "100%" }}>
            <input
              style={{ ...styles.input, paddingLeft: "32px" }}
              type="text"
              placeholder="Search DO No, Customer, Phone, PO No, Invoice..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <FaSearch
              style={{
                position: "absolute",
                left: "10px",
                top: "11px",
                color: "#64748b",
                fontSize: "12px",
              }}
            />
          </div>
          <button type="submit" style={styles.secondaryBtn}>
            Search
          </button>
        </form>

        <div style={styles.statusPillGroup}>
          {[
            { id: "all", label: "All Status", color: "#475569" },
            { id: "pending", label: "Pending", color: "#f59e0b" },
            { id: "dispatched", label: "Dispatched", color: "#0284c7" },
            { id: "delivered", label: "Delivered", color: "#10b981" },
            { id: "cancelled", label: "Cancelled", color: "#ef4444" },
          ].map((pill) => (
            <button
              key={pill.id}
              style={styles.statusPill(statusFilter === pill.id, pill.color)}
              onClick={() => {
                setStatusFilter(pill.id);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Delivery Orders Table */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>DO Number</th>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Customer &amp; Attn</th>
              <th style={styles.th}>Ref PO / Invoice</th>
              <th style={styles.th}>Delivery Mode</th>
              <th style={styles.th}>Items / Qty</th>
              <th style={styles.th}>Status</th>
              <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan="8"
                  style={{
                    ...styles.td,
                    textAlign: "center",
                    padding: "30px",
                  }}
                >
                  <FaSyncAlt
                    className="fa-spin"
                    style={{ marginRight: "8px" }}
                  />{" "}
                  Loading delivery orders...
                </td>
              </tr>
            ) : deliveryOrders.length === 0 ? (
              <tr>
                <td
                  colSpan="8"
                  style={{
                    ...styles.td,
                    textAlign: "center",
                    padding: "40px",
                  }}
                >
                  <div style={{ color: "#94a3b8", fontSize: "14px" }}>
                    No delivery orders found.
                  </div>
                  <button
                    style={{ ...styles.primaryBtn, margin: "14px auto 0" }}
                    onClick={handleOpenCreateModal}
                  >
                    <FaPlus /> Create Your First Delivery Order
                  </button>
                </td>
              </tr>
            ) : (
              deliveryOrders.map((doObj) => {
                const doNumber = doObj.doNumber || doObj.do_number;
                const doDate = (
                  doObj.doDate ||
                  doObj.do_date ||
                  ""
                ).substring(0, 10);
                const itemsCount = (doObj.items || []).length;
                const totalQty =
                  doObj.totalQuantity ||
                  doObj.total_quantity ||
                  (doObj.items || []).reduce(
                    (acc, it) => acc + (it.quantity || 1),
                    0
                  );

                return (
                  <tr key={doObj.id} style={{ transition: "background 0.2s" }}>
                    <td
                      style={{
                        ...styles.td,
                        fontWeight: "700",
                        color: "#38bdf8",
                      }}
                    >
                      {doNumber}
                    </td>
                    <td style={styles.td}>{doDate || "N/A"}</td>
                    <td style={styles.td}>
                      <div style={{ fontWeight: "600", color: "#ffffff" }}>
                        {doObj.customerName || doObj.customer_name}
                      </div>
                      {doObj.attn && (
                        <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                          Attn: {doObj.attn}
                        </div>
                      )}
                      <div style={{ fontSize: "11px", color: "#64748b" }}>
                        {doObj.customerPhone || doObj.customer_phone}
                      </div>
                    </td>
                    <td style={styles.td}>
                      {doObj.yourPoNo || doObj.your_po_no ? (
                        <div>
                          <strong style={{ color: "#94a3b8" }}>PO:</strong>{" "}
                          {doObj.yourPoNo || doObj.your_po_no}
                        </div>
                      ) : null}
                      {doObj.invoiceNo || doObj.invoice_no ? (
                        <div style={{ fontSize: "11px", color: "#38bdf8" }}>
                          INV: {doObj.invoiceNo || doObj.invoice_no}
                        </div>
                      ) : null}
                      {!(doObj.yourPoNo || doObj.your_po_no) &&
                        !(doObj.invoiceNo || doObj.invoice_no) &&
                        "-"}
                    </td>
                    <td style={styles.td}>
                      <div>
                        {doObj.deliveryMethod ||
                          doObj.delivery_method ||
                          "Company Delivery"}
                      </div>
                      {doObj.vehicleNo || doObj.vehicle_no ? (
                        <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                          Veh: {doObj.vehicleNo || doObj.vehicle_no}
                        </div>
                      ) : null}
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontWeight: "700", color: "#f8fafc" }}>
                        {totalQty}
                      </span>{" "}
                      units{" "}
                      <span style={{ fontSize: "11px", color: "#64748b" }}>
                        ({itemsCount} items)
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.badge(doObj.status)}>
                        {doObj.status || "pending"}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: "right" }}>
                      <div
                        style={{
                          ...styles.actionBtnGroup,
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          style={styles.actionBtn("#0284c7")}
                          onClick={() => {
                            setSelectedDO(doObj);
                            setShowViewModal(true);
                          }}
                          title="View Details"
                        >
                          <FaEye />
                        </button>

                        <button
                          style={styles.actionBtn("#10b981")}
                          onClick={() => handlePrintDO(doObj)}
                          title="Print Delivery Order"
                        >
                          <FaPrint />
                        </button>

                        <button
                          style={styles.actionBtn("#f59e0b")}
                          onClick={() => handleOpenStatusModal(doObj)}
                          title="Update Delivery Status"
                        >
                          <FaShippingFast />
                        </button>

                        <button
                          style={styles.actionBtn("#475569")}
                          onClick={() => handleOpenEditModal(doObj)}
                          title="Edit"
                        >
                          <FaEdit />
                        </button>

                        <button
                          style={styles.actionBtn("#ef4444")}
                          onClick={() => handleDeleteDO(doObj.id, doNumber)}
                          title="Delete"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div style={styles.pagination}>
          <div>
            Showing {deliveryOrders.length} of {pagination.total} delivery orders
            (Page {pagination.page} of {pagination.pages})
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              style={styles.paginationBtn(pagination.page <= 1)}
              disabled={pagination.page <= 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
            >
              Previous
            </button>
            <button
              style={styles.paginationBtn(pagination.page >= pagination.pages)}
              disabled={pagination.page >= pagination.pages}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ===================== CREATE / EDIT MODAL ===================== */}
      {showCreateModal && (
        <div
          style={styles.modalOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false);
            }
          }}
        >
          <div style={styles.modalContainer}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                <FaTruck style={{ color: "#38bdf8" }} />
                {isEditing
                  ? `Edit Delivery Order: ${formData.doNumber}`
                  : "Create New Delivery Order"}
              </h2>
              <button
                style={styles.modalCloseBtn}
                onClick={() => setShowCreateModal(false)}
                title="Close (Esc)"
              >
                &times;
              </button>
            </div>

            <form
              onSubmit={handleSubmitDO}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                overflow: "hidden",
              }}
            >
              <div style={styles.modalBody}>
                {/* 1. ORDER & REFERENCE INFORMATION (Clean 3-column Grid) */}
                <div style={styles.sectionCard}>
                  <div style={styles.sectionCardHeader}>
                    <FaCalendarAlt /> Order &amp; Reference Information
                  </div>
                  <div style={{ ...styles.grid3, marginBottom: "14px" }}>
                    <div style={styles.formField}>
                      <label style={styles.label}>DO Number *</label>
                      <input
                        style={styles.input}
                        value={formData.doNumber}
                        onChange={(e) =>
                          setFormData({ ...formData, doNumber: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div style={styles.formField}>
                      <label style={styles.label}>DO Date *</label>
                      <input
                        type="date"
                        style={styles.input}
                        value={formData.doDate}
                        onChange={(e) =>
                          setFormData({ ...formData, doDate: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div style={styles.formField}>
                      <label style={styles.label}>Initial Status</label>
                      <select
                        style={styles.input}
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({ ...formData, status: e.target.value })
                        }
                      >
                        <option value="pending">Pending</option>
                        <option value="dispatched">Dispatched</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>

                  <div style={styles.grid3}>
                    <div style={styles.formField}>
                      <label style={styles.label}>Customer PO No.</label>
                      <input
                        style={styles.input}
                        placeholder="e.g. PO-2026-089"
                        value={formData.yourPoNo}
                        onChange={(e) =>
                          setFormData({ ...formData, yourPoNo: e.target.value })
                        }
                      />
                    </div>

                    <div style={styles.formField}>
                      <label style={styles.label}>Invoice Ref No.</label>
                      <input
                        style={styles.input}
                        placeholder="e.g. PQM-INV-0001"
                        value={formData.invoiceNo}
                        onChange={(e) =>
                          setFormData({ ...formData, invoiceNo: e.target.value })
                        }
                      />
                    </div>

                    <div style={styles.formField}>
                      <label style={styles.label}>Quotation Ref No.</label>
                      <input
                        style={styles.input}
                        placeholder="e.g. PQM-QT-0001"
                        value={formData.quotationNo}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            quotationNo: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* 2. CUSTOMER DETAILS (Symmetric 2-column Grid) */}
                <div style={styles.sectionCard}>
                  <div style={styles.sectionCardHeader}>
                    <FaBuilding /> Customer Details
                  </div>
                  <div style={{ ...styles.grid2, marginBottom: "14px" }}>
                    <div style={styles.formField}>
                      <label style={styles.label}>Customer / Company Name *</label>
                      <input
                        style={styles.input}
                        placeholder="Enter customer or company name"
                        value={formData.customerName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customerName: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div style={styles.formField}>
                      <label style={styles.label}>Attn (Contact Person)</label>
                      <input
                        style={styles.input}
                        placeholder="e.g. Mr. John Tan / Site Mgr"
                        value={formData.attn}
                        onChange={(e) =>
                          setFormData({ ...formData, attn: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div style={{ ...styles.grid2, marginBottom: "14px" }}>
                    <div style={styles.formField}>
                      <label style={styles.label}>Phone / Tel *</label>
                      <input
                        style={styles.input}
                        placeholder="Contact phone number"
                        value={formData.customerPhone}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customerPhone: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div style={styles.formField}>
                      <label style={styles.label}>Email Address</label>
                      <input
                        type="email"
                        style={styles.input}
                        placeholder="customer@example.com"
                        value={formData.customerEmail}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customerEmail: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div style={styles.grid2}>
                    <div style={styles.formField}>
                      <label style={styles.label}>Company Billing Address</label>
                      <textarea
                        rows="3"
                        style={{ ...styles.input, resize: "vertical" }}
                        placeholder="Customer registered company address"
                        value={formData.customerAddress}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            customerAddress: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div style={styles.formField}>
                      <div style={styles.label}>
                        <span>Delivery / Site Destination Address</span>
                        <label
                          style={{
                            fontSize: "11.5px",
                            color: "#38bdf8",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            fontWeight: "500",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={formData.sameAsCompanyAddress}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                sameAsCompanyAddress: e.target.checked,
                              })
                            }
                          />
                          Same as company address
                        </label>
                      </div>
                      <textarea
                        rows="3"
                        style={{
                          ...styles.input,
                          resize: "vertical",
                          opacity: formData.sameAsCompanyAddress ? 0.6 : 1,
                        }}
                        disabled={formData.sameAsCompanyAddress}
                        placeholder="Site delivery destination address"
                        value={
                          formData.sameAsCompanyAddress
                            ? formData.customerAddress
                            : formData.deliveryAddress
                        }
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            deliveryAddress: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* 3. LOGISTICS & TRANSPORT DETAILS (Clean 4-column Grid) */}
                <div style={styles.sectionCard}>
                  <div style={styles.sectionCardHeader}>
                    <FaShippingFast /> Logistics &amp; Transport Details
                  </div>
                  <div style={styles.grid4}>
                    <div style={styles.formField}>
                      <label style={styles.label}>Delivery Method</label>
                      <select
                        style={styles.input}
                        value={formData.deliveryMethod}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            deliveryMethod: e.target.value,
                          })
                        }
                      >
                        <option value="Company Delivery">Company Delivery</option>
                        <option value="Self Collection">Self Collection</option>
                        <option value="Courier / Logistics">
                          Courier / Logistics
                        </option>
                        <option value="Direct Site Dispatch">
                          Direct Site Dispatch
                        </option>
                      </select>
                    </div>

                    <div style={styles.formField}>
                      <label style={styles.label}>Vehicle Number</label>
                      <input
                        style={styles.input}
                        placeholder="e.g. GBG 1234 A"
                        value={formData.vehicleNo}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            vehicleNo: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div style={styles.formField}>
                      <label style={styles.label}>Driver / Courier Name</label>
                      <input
                        style={styles.input}
                        placeholder="Driver or courier name"
                        value={formData.driverName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            driverName: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div style={styles.formField}>
                      <label style={styles.label}>Prepared By</label>
                      <input
                        style={styles.input}
                        placeholder="Staff name"
                        value={formData.preparedBy}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            preparedBy: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* 4. LINE ITEMS TABLE */}
                <div style={styles.sectionCard}>
                  <div
                    style={{
                      ...styles.sectionCardHeader,
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <FaBox /> Line Items for Delivery
                    </div>
                    <button
                      type="button"
                      style={{
                        ...styles.primaryBtn,
                        padding: "5px 12px",
                        fontSize: "12px",
                      }}
                      onClick={handleAddItem}
                    >
                      <FaPlus /> Add Line Item
                    </button>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "12.5px",
                        fontFamily: FONT_FAMILY,
                      }}
                    >
                      <thead>
                        <tr style={{ background: "#0f172a" }}>
                          <th style={{ ...styles.th, width: "45px", textAlign: "center" }}>
                            #
                          </th>
                          <th style={{ ...styles.th, width: "35%" }}>
                            Product Description *
                          </th>
                          <th style={{ ...styles.th, width: "18%" }}>Model</th>
                          <th style={{ ...styles.th, width: "100px", textAlign: "center" }}>
                            Qty *
                          </th>
                          <th style={{ ...styles.th, width: "110px" }}>Unit</th>
                          <th style={{ ...styles.th, width: "20%" }}>Remarks</th>
                          <th
                            style={{
                              ...styles.th,
                              width: "45px",
                              textAlign: "center",
                            }}
                          >
                            Act
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr
                            key={idx}
                            style={{ borderBottom: "1px solid #334155" }}
                          >
                            <td
                              style={{
                                padding: "8px",
                                textAlign: "center",
                                color: "#94a3b8",
                                fontWeight: "600",
                              }}
                            >
                              {idx + 1}
                            </td>
                            <td style={{ padding: "8px", position: "relative" }}>
                              <input
                                style={styles.input}
                                placeholder="Search product or enter name..."
                                value={item.productName}
                                onChange={(e) =>
                                  handleProductSearchChange(idx, e.target.value)
                                }
                                onFocus={() => setActiveItemIndex(idx)}
                                required
                              />
                              {activeItemIndex === idx &&
                                productSearchResults.length > 0 && (
                                  <div style={styles.dropdownList}>
                                    {productSearchResults.map((prod) => (
                                      <div
                                        key={prod.id}
                                        style={styles.dropdownItem}
                                        onClick={() =>
                                          handleSelectProduct(idx, prod)
                                        }
                                      >
                                        <strong>{prod.name}</strong>
                                        {prod.model && (
                                          <span
                                            style={{
                                              color: "#94a3b8",
                                              marginLeft: "6px",
                                            }}
                                          >
                                            ({prod.model})
                                          </span>
                                        )}
                                        <div
                                          style={{
                                            fontSize: "11px",
                                            color: "#38bdf8",
                                            marginTop: "2px",
                                          }}
                                        >
                                          Stock Available:{" "}
                                          {prod.stock || prod.quantity || 0}{" "}
                                          units
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                            </td>
                            <td style={{ padding: "8px" }}>
                              <input
                                style={styles.input}
                                placeholder="Model / Spec"
                                value={item.productModel}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    "productModel",
                                    e.target.value
                                  )
                                }
                              />
                            </td>
                            <td style={{ padding: "8px" }}>
                              <input
                                type="number"
                                min="1"
                                style={{
                                  ...styles.input,
                                  textAlign: "center",
                                  fontWeight: "600",
                                }}
                                value={item.quantity}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    "quantity",
                                    parseInt(e.target.value) || 1
                                  )
                                }
                                required
                              />
                            </td>
                            <td style={{ padding: "8px" }}>
                              <input
                                style={styles.input}
                                placeholder="nos / sets"
                                value={item.unit}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    "unit",
                                    e.target.value
                                  )
                                }
                              />
                            </td>
                            <td style={{ padding: "8px" }}>
                              <input
                                style={styles.input}
                                placeholder="e.g. Serial / Batch"
                                value={item.remarks}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    "remarks",
                                    e.target.value
                                  )
                                }
                              />
                            </td>
                            <td style={{ padding: "8px", textAlign: "center" }}>
                              <button
                                type="button"
                                style={{
                                  ...styles.actionBtn("#ef4444"),
                                  margin: "0 auto",
                                }}
                                onClick={() => handleRemoveItem(idx)}
                                title="Remove line item"
                              >
                                <FaTrash />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Line Items Total */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      gap: "10px",
                      paddingTop: "12px",
                      fontSize: "13px",
                      color: "#94a3b8",
                      fontFamily: FONT_FAMILY,
                    }}
                  >
                    <span>Total Quantity:</span>
                    <span
                      style={{
                        fontWeight: "700",
                        color: "#38bdf8",
                        fontSize: "15px",
                        background: "rgba(56, 189, 248, 0.15)",
                        padding: "2px 10px",
                        borderRadius: "6px",
                      }}
                    >
                      {items.reduce((acc, it) => acc + (it.quantity || 1), 0)}{" "}
                      Units
                    </span>
                  </div>
                </div>

                {/* 5. SPECIAL INSTRUCTIONS / NOTES */}
                <div style={{ ...styles.sectionCard, marginBottom: 0 }}>
                  <div style={styles.sectionCardHeader}>
                    <FaInfoCircle /> Special Delivery Instructions / Notes
                  </div>
                  <textarea
                    rows="2"
                    style={{ ...styles.input, resize: "vertical" }}
                    placeholder="e.g. Please call site rep 30 minutes before arrival. Handle fragile panels with care."
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Modal Footer (Pinned to bottom) */}
              <div style={styles.modalFooter}>
                <button
                  type="button"
                  style={styles.secondaryBtn}
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={styles.primaryBtn}
                  disabled={loading}
                >
                  {loading
                    ? "Saving..."
                    : isEditing
                    ? "Update Delivery Order"
                    : "Generate Delivery Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== VIEW MODAL ===================== */}
      {showViewModal && selectedDO && (
        <div
          style={styles.modalOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowViewModal(false);
            }
          }}
        >
          <div style={{ ...styles.modalContainer, maxWidth: "780px" }}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  <FaTruck style={{ color: "#38bdf8" }} />
                  Delivery Order: {selectedDO.doNumber || selectedDO.do_number}
                </h2>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#94a3b8",
                    marginTop: "4px",
                  }}
                >
                  Date:{" "}
                  {(
                    selectedDO.doDate ||
                    selectedDO.do_date ||
                    ""
                  ).substring(0, 10)}{" "}
                  &bull;{" "}
                  <span style={styles.badge(selectedDO.status)}>
                    {selectedDO.status || "pending"}
                  </span>
                </div>
              </div>
              <button
                style={styles.modalCloseBtn}
                onClick={() => setShowViewModal(false)}
                title="Close (Esc)"
              >
                &times;
              </button>
            </div>

            <div style={styles.modalBody}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "14px",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    background: "#0f172a",
                    padding: "14px",
                    borderRadius: "8px",
                    border: "1px solid #334155",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#38bdf8",
                      fontWeight: "700",
                      textTransform: "uppercase",
                    }}
                  >
                    Customer Information
                  </div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: "700",
                      marginTop: "4px",
                      color: "#ffffff",
                    }}
                  >
                    {selectedDO.customerName || selectedDO.customer_name}
                  </div>
                  {selectedDO.attn && (
                    <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                      Attn: {selectedDO.attn}
                    </div>
                  )}
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                    Tel: {selectedDO.customerPhone || selectedDO.customer_phone}
                  </div>
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                    Email:{" "}
                    {selectedDO.customerEmail ||
                      selectedDO.customer_email ||
                      "N/A"}
                  </div>
                </div>

                <div
                  style={{
                    background: "#0f172a",
                    padding: "14px",
                    borderRadius: "8px",
                    border: "1px solid #334155",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#38bdf8",
                      fontWeight: "700",
                      textTransform: "uppercase",
                    }}
                  >
                    Destination &amp; Transport
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      marginTop: "4px",
                      color: "#cbd5e1",
                    }}
                  >
                    <strong>Site:</strong>{" "}
                    {selectedDO.deliveryAddress ||
                      selectedDO.delivery_address ||
                      selectedDO.customerAddress ||
                      "-"}
                  </div>
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                    Mode:{" "}
                    {selectedDO.deliveryMethod ||
                      selectedDO.delivery_method ||
                      "Company Delivery"}
                  </div>
                  {selectedDO.vehicleNo && (
                    <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                      Vehicle: {selectedDO.vehicleNo}
                    </div>
                  )}
                  {selectedDO.yourPoNo && (
                    <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                      PO Ref: {selectedDO.yourPoNo}
                    </div>
                  )}
                </div>
              </div>

              {/* Items */}
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "#f8fafc",
                  margin: "14px 0 8px",
                }}
              >
                Items Delivered ({selectedDO.items?.length || 0})
              </div>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "12.5px",
                  marginBottom: "16px",
                  fontFamily: FONT_FAMILY,
                }}
              >
                <thead>
                  <tr style={{ background: "#0f172a" }}>
                    <th style={styles.th}>No.</th>
                    <th style={styles.th}>Description / Model</th>
                    <th style={styles.th}>Qty</th>
                    <th style={styles.th}>Unit</th>
                    <th style={styles.th}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedDO.items || []).map((it, idx) => (
                    <tr
                      key={idx}
                      style={{ borderBottom: "1px solid #334155" }}
                    >
                      <td style={styles.td}>{idx + 1}</td>
                      <td style={styles.td}>
                        <strong>
                          {it.productName || it.product_name || it.name}
                        </strong>
                        {(it.productModel ||
                          it.product_model ||
                          it.model) && (
                          <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                            Model:{" "}
                            {it.productModel ||
                              it.product_model ||
                              it.model}
                          </div>
                        )}
                      </td>
                      <td style={{ ...styles.td, fontWeight: "700" }}>
                        {it.quantity || 1}
                      </td>
                      <td style={styles.td}>{it.unit || "nos"}</td>
                      <td style={styles.td}>{it.remarks || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedDO.receivedBy && (
                <div
                  style={{
                    background: "rgba(16, 185, 129, 0.1)",
                    border: "1px solid #10b981",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    fontSize: "12.5px",
                    color: "#10b981",
                    marginBottom: "16px",
                  }}
                >
                  <FaCheckCircle style={{ marginRight: "6px" }} />
                  Delivered &amp; Received by:{" "}
                  <strong>{selectedDO.receivedBy}</strong> on{" "}
                  {selectedDO.receivedDate
                    ? new Date(selectedDO.receivedDate).toLocaleString()
                    : "Confirmed"}
                </div>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button
                style={{ ...styles.primaryBtn, background: "#10b981" }}
                onClick={() => handlePrintDO(selectedDO)}
              >
                <FaPrint /> Print Delivery Order
              </button>
              <button
                style={styles.secondaryBtn}
                onClick={() => {
                  setShowViewModal(false);
                  handleOpenStatusModal(selectedDO);
                }}
              >
                <FaShippingFast /> Update Status
              </button>
              <button
                style={styles.secondaryBtn}
                onClick={() => setShowViewModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== STATUS UPDATE MODAL ===================== */}
      {showStatusModal && selectedDO && (
        <div
          style={styles.modalOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowStatusModal(false);
            }
          }}
        >
          <div style={{ ...styles.modalContainer, maxWidth: "450px" }}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                <FaShippingFast style={{ color: "#38bdf8" }} />
                Update Delivery Status
              </h2>
              <button
                style={styles.modalCloseBtn}
                onClick={() => setShowStatusModal(false)}
                title="Close (Esc)"
              >
                &times;
              </button>
            </div>

            <div style={{ padding: "20px 24px" }}>
              <div style={{ marginBottom: "14px", fontSize: "13px" }}>
                Delivery Order:{" "}
                <strong>{selectedDO.doNumber || selectedDO.do_number}</strong>
              </div>

              <div style={styles.formField}>
                <label style={styles.label}>Select Status *</label>
                <select
                  style={styles.input}
                  value={statusUpdateData.status}
                  onChange={(e) =>
                    setStatusUpdateData({
                      ...statusUpdateData,
                      status: e.target.value,
                    })
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="dispatched">
                    Dispatched (Out for Delivery)
                  </option>
                  <option value="delivered">
                    Delivered (Received by Customer)
                  </option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {statusUpdateData.status === "dispatched" && (
                <div
                  style={{
                    marginTop: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={styles.formField}>
                    <label style={styles.label}>Driver Name</label>
                    <input
                      style={styles.input}
                      placeholder="Enter driver name"
                      value={statusUpdateData.driverName}
                      onChange={(e) =>
                        setStatusUpdateData({
                          ...statusUpdateData,
                          driverName: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div style={styles.formField}>
                    <label style={styles.label}>Vehicle Number</label>
                    <input
                      style={styles.input}
                      placeholder="e.g. GBG 1234 A"
                      value={statusUpdateData.vehicleNo}
                      onChange={(e) =>
                        setStatusUpdateData({
                          ...statusUpdateData,
                          vehicleNo: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {statusUpdateData.status === "delivered" && (
                <div
                  style={{
                    marginTop: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={styles.formField}>
                    <label style={styles.label}>
                      Received By (Customer / Site Rep Name) *
                    </label>
                    <input
                      style={styles.input}
                      placeholder="Name of person who signed POD"
                      value={statusUpdateData.receivedBy}
                      onChange={(e) =>
                        setStatusUpdateData({
                          ...statusUpdateData,
                          receivedBy: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button
                type="button"
                style={styles.secondaryBtn}
                onClick={() => setShowStatusModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                style={styles.primaryBtn}
                onClick={handleSaveStatus}
                disabled={loading}
              >
                {loading ? "Updating..." : "Save Status"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryOrderPage;
