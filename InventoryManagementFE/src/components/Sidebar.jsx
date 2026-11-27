import React from "react";
import { NavLink } from "react-router-dom";
import {
  FaTachometerAlt,
  FaBoxOpen,
  FaFileInvoice,
  FaFileAlt,
  FaTruck,
  FaList,
  FaArrowDown,
  FaTags,
  FaExclamationTriangle,
  FaArrowUp,
  FaClipboardList,
  FaFileInvoiceDollar,
  FaUsers,
  FaBoxes,
  FaShoppingCart,
  FaUserCheck,
  FaUserCog,
  FaCog,
  FaPercent,
  FaClipboardCheck,
  FaCheckCircle,
  FaShieldAlt,
  FaPlusCircle,
  FaListAlt,
  FaMoneyBillWave,
  FaUserPlus,
  FaUserTag,
  FaCalendarCheck,
  FaBuilding,
  FaPhoneAlt,
  FaUserCircle,
  FaFileContract,
  FaReceipt,
  FaChartLine,
  FaBell,
  FaMoneyCheckAlt,
} from "react-icons/fa";

const Sidebar = ({ isOpen }) => {
  const HEADER_HEIGHT = "65px";

  // Get user and permissions from localStorage
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userPermissions = user?.permissions || [];
  const userType = user?.user_type || "";

  // Helper to check if a submodule is permitted
  const hasPermission = (submodule_id) => {
    // Case-insensitive check for Admin role or fallback to admin email
    const isAdmin = userType?.toLowerCase() === 'admin' || user?.email === 'admin@m3cars.com';

    if (isAdmin) return true;

    // For other roles, check the permissions array
    if (!Array.isArray(userPermissions)) return false;

    // Quotation approval permission can inherit from quotations if not explicitly set
    if (submodule_id === "quotation_approval") {
      const hasDirect = userPermissions.some(p => p.submodule_id === "quotation_approval" && p.view === true);
      if (hasDirect) return true;
      return userPermissions.some(p => p.submodule_id === "quotations" && p.view === true);
    }

    // Progress claim inherits from quotation_approval or quotations
    if (submodule_id === "progress_claim") {
      const hasDirect = userPermissions.some(p => p.submodule_id === "progress_claim" && p.view === true);
      if (hasDirect) return true;
      return userPermissions.some(p => (p.submodule_id === "quotation_approval" || p.submodule_id === "quotations") && p.view === true);
    }

    // Delivery orders permission can also inherit from invoices/quotations if not explicitly set
    if (submodule_id === "delivery_orders") {
      const hasDirect = userPermissions.some(p => p.submodule_id === "delivery_orders" && p.view === true);
      if (hasDirect) return true;
      return userPermissions.some(p => (p.submodule_id === "invoices" || p.submodule_id === "quotations") && p.view === true);
    }

    // Purchase orders permission can also inherit from invoices/quotations/supplier_list if not explicitly set
    if (submodule_id === "purchase_orders") {
      const hasDirect = userPermissions.some(p => p.submodule_id === "purchase_orders" && p.view === true);
      if (hasDirect) return true;
      return userPermissions.some(p => (p.submodule_id === "invoices" || p.submodule_id === "quotations" || p.submodule_id === "supplier_list") && p.view === true);
    }

    // Payment tracking permission can inherit from supplier_list, add_supplier, or invoices if not explicitly set
    if (submodule_id === "payment_tracking") {
      const hasDirect = userPermissions.some(p => p.submodule_id === "payment_tracking" && p.view === true);
      if (hasDirect) return true;
      return userPermissions.some(p => (p.submodule_id === "supplier_list" || p.submodule_id === "add_supplier" || p.submodule_id === "invoices") && p.view === true);
    }

    const perm = userPermissions.find(p => p.submodule_id === submodule_id);
    return perm ? perm.view === true : false;
  };

  // Helper to check if a section should be visible
  const isSectionVisible = (submodule_ids) => {
    const isAdmin = userType?.toLowerCase() === 'admin' || user?.email === 'admin@m3cars.com';
    if (isAdmin) return true;
    return submodule_ids.some(id => hasPermission(id));
  };

  const styles = {
    sidebar: {
      width: isOpen ? "230px" : "60px",
      height: `calc(100vh - ${HEADER_HEIGHT})`,
      background: "linear-gradient(180deg, #111827, #0f172a)",
      color: "#fff",
      padding: "20px 8px",
      position: "fixed",
      top: HEADER_HEIGHT,
      left: 0,
      transition: "all 0.3s ease",
      overflowY: "auto",
      overflowX: "hidden",
      display: "flex",
      flexDirection: "column",
      boxShadow: "4px 0 20px rgba(0,0,0,0.4)",
      scrollbarWidth: "thin",
      scrollbarColor: "#4da6ff #1f2937",
    },

    logoSection: {
      marginBottom: "25px",
      fontSize: isOpen ? "18px" : "14px",
      fontWeight: "600",
      letterSpacing: "1px",
      textAlign: "center",
      padding: "8px 4px",
      color: "#4da6ff",
      borderBottom: "1px solid rgba(77, 166, 255, 0.2)",
      whiteSpace: "nowrap",
      transition: "all 0.3s ease",
    },

    navContainer: {
      display: "flex",
      flexDirection: "column",
      gap: "4px",
      flex: 1,
    },

    link: {
      display: "flex",
      alignItems: "center",
      justifyContent: isOpen ? "flex-start" : "center",
      gap: "12px",
      padding: "10px 12px",
      color: "#9ca3af",
      textDecoration: "none",
      borderRadius: "8px",
      transition: "all 0.2s ease",
      fontSize: "14px",
      fontWeight: "500",
      whiteSpace: "nowrap",
      minHeight: "40px",
    },

    activeLink: {
      background: "rgba(77, 166, 255, 0.15)",
      color: "#4da6ff",
    },

    icon: {
      fontSize: "18px",
      minWidth: "20px",
    },

    text: {
      display: isOpen ? "inline" : "none",
      opacity: isOpen ? 1 : 0,
      transition: "opacity 0.2s ease",
    },

    divider: {
      height: "1px",
      background: "rgba(255,255,255,0.1)",
      margin: "12px 0",
    },

    sectionTitle: {
      fontSize: "11px",
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      color: "#6b7280",
      padding: "8px 12px 4px",
      display: isOpen ? "block" : "none",
    },
  };

  // Custom scrollbar styles for webkit browsers
  const scrollbarStyles = `
    .sidebar::-webkit-scrollbar {
      width: 4px;
    }
    .sidebar::-webkit-scrollbar-track {
      background: #1f2937;
    }
    .sidebar::-webkit-scrollbar-thumb {
      background: #4da6ff;
      border-radius: 4px;
    }
    .sidebar::-webkit-scrollbar-thumb:hover {
      background: #3b82f6;
    }
  `;

  const getLinkStyle = ({ isActive }) =>
    isActive
      ? { ...styles.link, ...styles.activeLink }
      : styles.link;

  return (
    <>
      <style>{scrollbarStyles}</style>
      <div style={styles.sidebar} className="sidebar">
        <div style={styles.logoSection}>
          {isOpen ? "PowerQMax" : "PQM"}
        </div>

        <div style={styles.navContainer}>
          {/* Main Navigation */}
          {isSectionVisible(["dashboard"]) && (
            <>
              <div style={styles.sectionTitle}>Main</div>
              {hasPermission("dashboard") && (
                <NavLink to="/dashboard" style={getLinkStyle}>
                  <FaTachometerAlt style={styles.icon} />
                  <span style={styles.text}>Dashboard</span>
                </NavLink>
              )}
            </>
          )}

          {/* Billing Section */}
          {isSectionVisible(["service_bill", "service_bills", "quotations", "quotation_approval", "progress_claim", "invoices", "delivery_orders", "purchase_orders", "discount"]) && (
            <>
              <div style={styles.sectionTitle}>Billing</div>
              {hasPermission("service_bill") && (
                <NavLink to="/service" style={getLinkStyle}>
                  <FaShoppingCart style={styles.icon} />
                  <span style={styles.text}>Service Bill</span>
                </NavLink>
              )}

              {hasPermission("service_bills") && (
                <NavLink to="/serviceBillView" style={getLinkStyle}>
                  <FaFileContract style={styles.icon} />
                  <span style={styles.text}>Service Bills</span>
                </NavLink>
              )}

              {hasPermission("quotations") && (
                <NavLink to="/quotation" style={getLinkStyle}>
                  <FaClipboardList style={styles.icon} />
                  <span style={styles.text}>Quotations</span>
                </NavLink>
              )}

              {hasPermission("quotation_approval") && (
                <NavLink to="/quotation-approval" style={getLinkStyle}>
                  <FaCheckCircle style={styles.icon} />
                  <span style={styles.text}>Quotation Approval</span>
                </NavLink>
              )}

              {hasPermission("progress_claim") && (
                <NavLink to="/progress-claim" style={getLinkStyle}>
                  <FaChartLine style={styles.icon} />
                  <span style={styles.text}>Progress Claims</span>
                </NavLink>
              )}

              {hasPermission("delivery_orders") && (
                <NavLink to="/delivery-order" style={getLinkStyle}>
                  <FaTruck style={styles.icon} />
                  <span style={styles.text}>Work Completion</span>
                </NavLink>
              )}

              {hasPermission("purchase_orders") && (
                <NavLink to="/purchase-order" style={getLinkStyle}>
                  <FaClipboardCheck style={styles.icon} />
                  <span style={styles.text}>Purchase Orders</span>
                </NavLink>
              )}

              {hasPermission("invoices") && (
                <NavLink to="/invoice" style={getLinkStyle}>
                  <FaFileInvoiceDollar style={styles.icon} />
                  <span style={styles.text}>Invoices</span>
                </NavLink>
              )}
            </>
          )}

          {/* Supplier & HR Section */}
          {isSectionVisible(["add_supplier", "supplier_list", "payment_tracking", "employee", "user_type", "attendance", "salary"]) && (
            <>
              <div style={styles.sectionTitle}>Suppliers & HR</div>
              {hasPermission("add_supplier") && (
                <NavLink to="/supplier" style={getLinkStyle}>
                  <FaPlusCircle style={styles.icon} />
                  <span style={styles.text}>Add Supplier</span>
                </NavLink>
              )}

              {hasPermission("supplier_list") && (
                <NavLink to="/supplierList" style={getLinkStyle}>
                  <FaListAlt style={styles.icon} />
                  <span style={styles.text}>Supplier List</span>
                </NavLink>
              )}

              {hasPermission("payment_tracking") && (
                <NavLink to="/paymenttracking" style={getLinkStyle}>
                  <FaMoneyBillWave style={styles.icon} />
                  <span style={styles.text}>Payment Tracking</span>
                </NavLink>
              )}

              {hasPermission("employee") && (
                <NavLink to="/employee" style={getLinkStyle}>
                  <FaUserPlus style={styles.icon} />
                  <span style={styles.text}>Employee</span>
                </NavLink>
              )}

              {hasPermission("user_type") && (
                <NavLink to="/usertype" style={getLinkStyle}>
                  <FaUserTag style={styles.icon} />
                  <span style={styles.text}>User Type</span>
                </NavLink>
              )}

              {hasPermission("attendance") && (
                <NavLink to="/attendance" style={getLinkStyle}>
                  <FaCalendarCheck style={styles.icon} />
                  <span style={styles.text}>Attendance</span>
                </NavLink>
              )}

              {hasPermission("salary") && (
                <NavLink to="/salary" style={getLinkStyle}>
                  <FaMoneyCheckAlt style={styles.icon} />
                  <span style={styles.text}>Salary</span>
                </NavLink>
              )}
            </>
          )}

          {/* CRM Section */}
          {isSectionVisible(["reminders", "enquiries", "customer_details", "usersettings"]) && (
            <>
              <div style={styles.sectionTitle}>CRM</div>
              {(hasPermission("reminders") || hasPermission("enquiries")) && (
                <NavLink to="/reminders" style={getLinkStyle}>
                  <FaBell style={styles.icon} />
                  <span style={styles.text}>Reminders</span>
                </NavLink>
              )}

              {hasPermission("customer_details") && (
                <NavLink to="/customer" style={getLinkStyle}>
                  <FaUsers style={styles.icon} />
                  <span style={styles.text}>Customer Details</span>
                </NavLink>
              )}

              {hasPermission("usersettings") && (
                <NavLink to="/usersettings" style={getLinkStyle}>
                  <FaUserCog style={styles.icon} />
                  <span style={styles.text}>User Settings</span>
                </NavLink>
              )}
            </>
          )}
        </div>

        {isOpen && (
          <div style={{
            fontSize: "10px",
            color: "#6b7280",
            textAlign: "center",
            padding: "16px 0 8px",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            marginTop: "auto"
          }}>
            v1.0.0
          </div>
        )}
      </div>
    </>
  );
};

export default Sidebar;
