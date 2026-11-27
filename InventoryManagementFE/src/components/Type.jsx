// Type.jsx - Unified Category & Stock Hub (Less Detail)
import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  FaTags,
  FaArrowDown,
  FaArrowUp,
  FaExclamationTriangle,
  FaShieldAlt,
  FaSearch,
  FaSyncAlt,
  FaArrowLeft,
  FaCheckCircle,
  FaTimesCircle,
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

export default function Type({ initialTab }) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Determine active tab from URL query params or initialTab prop
  const urlTab = searchParams.get("tab");
  const defaultTab = initialTab || urlTab || "categories";
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Sync state if prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    } else if (urlTab) {
      setActiveTab(urlTab);
    }
  }, [initialTab, urlTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
    setSelectedCategory(null);
    setSearchQuery("");
  };

  // General loading & search states
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // 1. Categories State
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // 2. Stock In State
  const [stockInItems, setStockInItems] = useState([]);

  // 3. Stock Out State
  const [stockOutItems, setStockOutItems] = useState([]);

  // 4. Low Stock State
  const [lowStockItems, setLowStockItems] = useState([]);

  // 5. Warranty State
  const [warrantyItems, setWarrantyItems] = useState([]);

  // Fetch products and categories
  const fetchProductsAndCategories = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/products?per_page=1000`);
      let itemsList = [];
      if (res.data && Array.isArray(res.data.items)) {
        itemsList = res.data.items;
      } else if (Array.isArray(res.data)) {
        itemsList = res.data;
      }

      setProducts(itemsList);

      // Group categories
      const catMap = {};
      itemsList.forEach((prod) => {
        const cat = (prod.type || "General").trim();
        if (!catMap[cat]) {
          catMap[cat] = { name: cat, count: 0, totalQty: 0 };
        }
        catMap[cat].count += 1;
        catMap[cat].totalQty += parseInt(prod.quantity) || 0;
      });

      setCategories(Object.values(catMap).sort((a, b) => a.name.localeCompare(b.name)));

      // Extract low stock items (< 10)
      const lowStock = itemsList
        .filter((p) => (parseInt(p.quantity) || 0) <= 10)
        .sort((a, b) => (parseInt(a.quantity) || 0) - (parseInt(b.quantity) || 0));
      setLowStockItems(lowStock);
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Stock In items
  const fetchStockInData = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/suppliers-with-items`);
      if (res.data?.success && Array.isArray(res.data.suppliers)) {
        const inItems = [];
        res.data.suppliers.forEach((supp) => {
          if (supp.items && Array.isArray(supp.items)) {
            supp.items.forEach((item) => {
              inItems.push({
                id: item.id || Math.random(),
                name: item.name || item.product_name || "Item",
                category: item.type || item.category || "General",
                quantity: item.quantity || item.qty || 1,
                supplier: supp.name || supp.company || "Supplier",
                date: item.created_at || new Date().toISOString(),
              });
            });
          }
        });
        setStockInItems(inItems);
      }
    } catch (err) {
      console.warn("Could not load stock in items:", err);
    }
  };

  // Fetch Stock Out and Warranty data from bills
  const fetchBillsAndStockOut = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/billing/bills?per_page=100`);
      let bills = [];
      if (res.data?.bills && Array.isArray(res.data.bills)) {
        bills = res.data.bills;
      }

      const outList = [];
      const warList = [];

      for (const bill of bills) {
        // Attempt to fetch detailed items for each bill
        try {
          const detailRes = await axios.get(`${API_BASE_URL}/api/billing/bills/${bill.id}`);
          const detailed = detailRes.data;
          const items = detailed.items || [];

          items.forEach((item) => {
            // Stock Out Item
            outList.push({
              id: `${bill.id}-${item.id}`,
              billNumber: bill.billNumber || `BILL-${bill.id}`,
              customerName: bill.customerName || "Customer",
              productName: item.product_name || item.name || "Product",
              category: item.product_type || item.type || "General",
              quantity: item.quantity || 1,
              sellPrice: item.sell_price || item.price || 0,
              date: bill.createdAt,
            });

            // Warranty Item
            // Calculate 1 year warranty from created_at
            const purchaseDate = new Date(bill.createdAt || Date.now());
            const expiryDate = new Date(purchaseDate);
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
            const isExpired = new Date() > expiryDate;

            warList.push({
              id: `${bill.id}-${item.id}-war`,
              billNumber: bill.billNumber || `BILL-${bill.id}`,
              customerName: bill.customerName || "Customer",
              productName: item.product_name || item.name || "Product",
              category: item.product_type || item.type || "General",
              purchaseDate: bill.createdAt,
              period: "1 Year",
              expiryDate: expiryDate.toISOString(),
              isExpired: isExpired,
            });
          });
        } catch {
          // Fallback if detail fetch fails
        }
      }

      setStockOutItems(outList);
      setWarrantyItems(warList);
    } catch (err) {
      console.warn("Could not load bills for stock out/warranty:", err);
    }
  };

  useEffect(() => {
    fetchProductsAndCategories();
    fetchStockInData();
    fetchBillsAndStockOut();
  }, []);

  // Filtered Categories
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories;
    return categories.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [categories, searchQuery]);

  // Products under selected category
  const productsInSelectedCategory = useMemo(() => {
    if (!selectedCategory) return [];
    return products.filter(
      (p) => (p.type || "General").trim().toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [products, selectedCategory]);

  // Filtered Stock In Items
  const filteredStockIn = useMemo(() => {
    if (!searchQuery) return stockInItems;
    const q = searchQuery.toLowerCase();
    return stockInItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.supplier.toLowerCase().includes(q)
    );
  }, [stockInItems, searchQuery]);

  // Filtered Stock Out Items
  const filteredStockOut = useMemo(() => {
    if (!searchQuery) return stockOutItems;
    const q = searchQuery.toLowerCase();
    return stockOutItems.filter(
      (item) =>
        item.productName.toLowerCase().includes(q) ||
        item.billNumber.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q)
    );
  }, [stockOutItems, searchQuery]);

  // Filtered Low Stock Items
  const filteredLowStock = useMemo(() => {
    if (!searchQuery) return lowStockItems;
    const q = searchQuery.toLowerCase();
    return lowStockItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.type && item.type.toLowerCase().includes(q)) ||
        (item.model && item.model.toLowerCase().includes(q))
    );
  }, [lowStockItems, searchQuery]);

  // Filtered Warranty Items
  const filteredWarranty = useMemo(() => {
    if (!searchQuery) return warrantyItems;
    const q = searchQuery.toLowerCase();
    return warrantyItems.filter(
      (item) =>
        item.billNumber.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        item.productName.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [warrantyItems, searchQuery]);

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
      flexWrap: "wrap",
      gap: "16px",
      marginBottom: "20px",
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
    tabsContainer: {
      display: "flex",
      gap: "8px",
      backgroundColor: "#1e293b",
      padding: "6px",
      borderRadius: "12px",
      border: "1px solid #334155",
      marginBottom: "20px",
      flexWrap: "wrap",
    },
    tabButton: (isActive) => ({
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "8px 16px",
      borderRadius: "8px",
      border: "none",
      cursor: "pointer",
      fontSize: "13px",
      fontWeight: "600",
      backgroundColor: isActive ? "#2563eb" : "transparent",
      color: isActive ? "#ffffff" : "#94a3b8",
      transition: "all 0.2s",
    }),
    controlsRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "12px",
      marginBottom: "16px",
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
      width: "300px",
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
    tableCard: {
      backgroundColor: "#1e293b",
      borderRadius: "12px",
      border: "1px solid #334155",
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
      padding: "12px 16px",
      backgroundColor: "#111827",
      color: "#94a3b8",
      fontSize: "11px",
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      borderBottom: "1px solid #334155",
    },
    td: {
      padding: "12px 16px",
      borderBottom: "1px solid #334155",
    },
    badge: {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      padding: "2px 8px",
      borderRadius: "12px",
      fontSize: "11px",
      fontWeight: "600",
    },
    gridCards: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
      gap: "16px",
    },
    categoryCard: {
      backgroundColor: "#1e293b",
      border: "1px solid #334155",
      borderRadius: "12px",
      padding: "18px",
      cursor: "pointer",
      transition: "transform 0.15s, border-color 0.15s",
    },
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>
            <FaTags color="#3b82f6" />
            Category & Stock Management
          </h2>
          <p style={styles.subtitle}>
            Streamlined overview of inventory categories, stock flows, and warranties
          </p>
        </div>
        <button
          onClick={() => {
            fetchProductsAndCategories();
            fetchStockInData();
            fetchBillsAndStockOut();
          }}
          style={{
            backgroundColor: "#334155",
            color: "#ffffff",
            border: "none",
            padding: "8px 14px",
            borderRadius: "8px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
          }}
          title="Refresh Data"
        >
          {loading ? <FaSpinner className="animate-spin" /> : <FaSyncAlt />} Refresh
        </button>
      </div>

      {/* 5 Tab Navigation: Categories, Stock In, Stock Out, Low Stock, Warranty */}
      <div style={styles.tabsContainer}>
        <button
          style={styles.tabButton(activeTab === "categories")}
          onClick={() => handleTabChange("categories")}
        >
          <FaTags size={14} /> Categories ({categories.length})
        </button>

        <button
          style={styles.tabButton(activeTab === "stockin")}
          onClick={() => handleTabChange("stockin")}
        >
          <FaArrowDown size={14} /> Stock In ({stockInItems.length})
        </button>

        <button
          style={styles.tabButton(activeTab === "stockout")}
          onClick={() => handleTabChange("stockout")}
        >
          <FaArrowUp size={14} /> Stock Out ({stockOutItems.length})
        </button>

        <button
          style={styles.tabButton(activeTab === "lowstock")}
          onClick={() => handleTabChange("lowstock")}
        >
          <FaExclamationTriangle size={14} /> Low Stock ({lowStockItems.length})
        </button>

        <button
          style={styles.tabButton(activeTab === "warranty")}
          onClick={() => handleTabChange("warranty")}
        >
          <FaShieldAlt size={14} /> Warranty ({warrantyItems.length})
        </button>
      </div>

      {/* Search and Action Bar */}
      <div style={styles.controlsRow}>
        <div style={styles.searchBox}>
          <FaSearch color="#64748b" />
          <input
            type="text"
            placeholder={
              activeTab === "categories"
                ? "Search categories..."
                : activeTab === "stockin"
                ? "Search stock-in items/supplier..."
                : activeTab === "stockout"
                ? "Search stock-out items/bill..."
                : activeTab === "lowstock"
                ? "Search low stock products..."
                : "Search warranty by bill/customer..."
            }
            style={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {activeTab === "categories" && selectedCategory && (
          <button
            onClick={() => setSelectedCategory(null)}
            style={{
              backgroundColor: "#334155",
              color: "#ffffff",
              border: "none",
              padding: "8px 14px",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
            }}
          >
            <FaArrowLeft /> Back to All Categories
          </button>
        )}
      </div>

      {/* TAB 1: CATEGORIES (Less Detail) */}
      {activeTab === "categories" && (
        <>
          {selectedCategory ? (
            /* Selected Category Product Drill-Down */
            <div style={styles.tableCard}>
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid #334155",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", color: "#ffffff" }}>
                    Category: <span style={{ color: "#38bdf8" }}>{selectedCategory}</span>
                  </h3>
                  <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
                    {productsInSelectedCategory.length} products listed under this category
                  </div>
                </div>
              </div>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Product Name</th>
                    <th style={styles.th}>Model</th>
                    <th style={styles.th}>Category</th>
                    <th style={styles.th}>Sell Price (SGD)</th>
                    <th style={styles.th}>In Stock</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {productsInSelectedCategory.length > 0 ? (
                    productsInSelectedCategory.map((prod) => (
                      <tr key={prod.id}>
                        <td style={styles.td}>
                          <span style={{ fontWeight: "600", color: "#ffffff" }}>
                            {prod.name}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={{ color: "#94a3b8" }}>{prod.model || "-"}</span>
                        </td>
                        <td style={styles.td}>
                          <span style={{ color: "#38bdf8" }}>{prod.type || "General"}</span>
                        </td>
                        <td style={styles.td}>
                          <span style={{ color: "#ffffff" }}>
                            {formatSGD(prod.sellPrice || prod.sell_price || 0)}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              fontWeight: "700",
                              color: prod.quantity > 5 ? "#10b981" : "#ef4444",
                            }}
                          >
                            {prod.quantity}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.badge,
                              backgroundColor:
                                prod.quantity > 5
                                  ? "rgba(16,185,129,0.15)"
                                  : "rgba(239,68,68,0.15)",
                              color: prod.quantity > 5 ? "#10b981" : "#ef4444",
                            }}
                          >
                            {prod.quantity > 5 ? "In Stock" : "Low Stock"}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                        No products found in this category.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Category Cards View */
            <div style={styles.gridCards}>
              {filteredCategories.map((cat, idx) => (
                <div
                  key={idx}
                  style={styles.categoryCard}
                  onClick={() => setSelectedCategory(cat.name)}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "12px",
                    }}
                  >
                    <span
                      style={{
                        padding: "8px",
                        borderRadius: "8px",
                        backgroundColor: "rgba(59, 130, 246, 0.15)",
                        color: "#3b82f6",
                      }}
                    >
                      <FaTags size={16} />
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        backgroundColor: "rgba(255,255,255,0.06)",
                        padding: "3px 8px",
                        borderRadius: "12px",
                        color: "#94a3b8",
                      }}
                    >
                      {cat.count} items
                    </span>
                  </div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "16px", color: "#ffffff" }}>
                    {cat.name}
                  </h4>
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                    Total Units in Stock:{" "}
                    <strong style={{ color: "#38bdf8" }}>{cat.totalQty}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 2: STOCK IN (Less Detail) */}
      {activeTab === "stockin" && (
        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Product Name</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Added Qty</th>
                <th style={styles.th}>Supplier</th>
              </tr>
            </thead>
            <tbody>
              {filteredStockIn.length > 0 ? (
                filteredStockIn.map((item, idx) => (
                  <tr key={idx}>
                    <td style={styles.td}>
                      <span style={{ color: "#94a3b8" }}>{formatDate(item.date)}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontWeight: "600", color: "#ffffff" }}>
                        {item.name}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ color: "#38bdf8" }}>{item.category}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontWeight: "700", color: "#10b981" }}>
                        +{item.quantity}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ color: "#cbd5e1" }}>{item.supplier}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                    No stock-in records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: STOCK OUT (Less Detail) */}
      {activeTab === "stockout" && (
        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Bill #</th>
                <th style={styles.th}>Product Name</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Qty Out</th>
                <th style={styles.th}>Customer</th>
              </tr>
            </thead>
            <tbody>
              {filteredStockOut.length > 0 ? (
                filteredStockOut.map((item, idx) => (
                  <tr key={idx}>
                    <td style={styles.td}>
                      <span style={{ color: "#94a3b8" }}>{formatDate(item.date)}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontWeight: "600", color: "#38bdf8" }}>
                        {item.billNumber}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontWeight: "500", color: "#ffffff" }}>
                        {item.productName}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ color: "#cbd5e1" }}>{item.category}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontWeight: "700", color: "#f87171" }}>
                        -{item.quantity}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ color: "#94a3b8" }}>{item.customerName}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                    No stock-out records found from recent bills.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: LOW STOCK (Less Detail) */}
      {activeTab === "lowstock" && (
        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Product Name</th>
                <th style={styles.th}>Model</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Current Stock</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLowStock.length > 0 ? (
                filteredLowStock.map((item) => (
                  <tr key={item.id}>
                    <td style={styles.td}>
                      <span style={{ fontWeight: "600", color: "#ffffff" }}>
                        {item.name}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ color: "#94a3b8" }}>{item.model || "-"}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ color: "#38bdf8" }}>{item.type || "General"}</span>
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          fontWeight: "700",
                          color: item.quantity === 0 ? "#ef4444" : "#f59e0b",
                        }}
                      >
                        {item.quantity} units
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          backgroundColor:
                            item.quantity === 0
                              ? "rgba(239, 68, 68, 0.2)"
                              : "rgba(245, 158, 11, 0.2)",
                          color: item.quantity === 0 ? "#ef4444" : "#f59e0b",
                          border: `1px solid ${
                            item.quantity === 0
                              ? "rgba(239,68,68,0.4)"
                              : "rgba(245,158,11,0.4)"
                          }`,
                        }}
                      >
                        {item.quantity === 0 ? "Out of Stock" : "Low Stock"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                    <FaCheckCircle color="#10b981" size={24} style={{ marginBottom: "8px" }} />
                    <div>All products are adequately stocked!</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 5: WARRANTY (Less Detail) */}
      {activeTab === "warranty" && (
        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Bill #</th>
                <th style={styles.th}>Customer</th>
                <th style={styles.th}>Product</th>
                <th style={styles.th}>Category</th>
                <th style={styles.th}>Purchase Date</th>
                <th style={styles.th}>Warranty Period</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredWarranty.length > 0 ? (
                filteredWarranty.map((item, idx) => (
                  <tr key={idx}>
                    <td style={styles.td}>
                      <span style={{ fontWeight: "600", color: "#38bdf8" }}>
                        {item.billNumber}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ color: "#ffffff" }}>{item.customerName}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ color: "#cbd5e1" }}>{item.productName}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ color: "#94a3b8" }}>{item.category}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ color: "#94a3b8" }}>
                        {formatDate(item.purchaseDate)}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ color: "#e2e8f0" }}>{item.period}</span>
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          backgroundColor: item.isExpired
                            ? "rgba(239,68,68,0.15)"
                            : "rgba(16,185,129,0.15)",
                          color: item.isExpired ? "#ef4444" : "#10b981",
                          border: `1px solid ${
                            item.isExpired
                              ? "rgba(239,68,68,0.3)"
                              : "rgba(16,185,129,0.3)"
                          }`,
                        }}
                      >
                        {item.isExpired ? (
                          <>
                            <FaTimesCircle size={10} /> Expired
                          </>
                        ) : (
                          <>
                            <FaCheckCircle size={10} /> Active
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                    No warranty records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
