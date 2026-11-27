import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import "./App.css";
import Login from "./Login";
import Dashboard from "./components/Dashboard";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import SupplierPage from "./components/Supplier";
import SupplierDuplicatePage from "./components/SupplierList";
import Quotation from "./components/Quotation";
import QuotationApproval from "./components/QuotationApproval";
import Invoice from "./components/Invoice";
import DeliveryOrder from "./components/DeliveryOrder";
import PurchaseOrder from "./components/PurchaseOrder";
import Service from "./components/ServiceBill";
import ServiceBillView from "./components/ServiceBillView";
import UserType from "./components/UserType";
import Employee from "./components/Employee";
import Attendance from "./components/Attendance";
import Salary from "./components/Salary";
import UserSettings from "./components/UserSetting";
import DiscountPage from "./components/DiscountPage";
import EnquiryPage from "./components/Enquiry";
import CustomerPage from "./components/Customer";
import PaymentTracking from "./components/PaymentTracking";
import ProgressClaim from "./components/ProgressClaim";

function Layout() {
  const location = useLocation();

  // Hide layout on login page
  const hideLayout = location.pathname === "/";

  const [isOpen, setIsOpen] = useState(true);

  const toggleSidebar = () => {
    setIsOpen((prev) => !prev);
  };

  const contentStyle = {
    marginLeft: hideLayout ? "0" : isOpen ? "220px" : "70px",
    padding: hideLayout ? "0" : "80px 20px 20px 20px",
    minHeight: "100vh",
    background: "#0f172a", // Solid dark background (no white)
    transition: "all 0.3s ease",
  };

  return (
    <>
      {!hideLayout && <Sidebar isOpen={isOpen} />}

      <div style={contentStyle}>
        {!hideLayout && (
          <Header
            toggleSidebar={toggleSidebar}
            isOpen={isOpen}
          />
        )}

        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/supplier" element={<SupplierPage />} />
          <Route path="/supplierList" element={<SupplierDuplicatePage />} />
          <Route path="/quotation" element={<Quotation />} />
          <Route path="/quotation-approval" element={<QuotationApproval />} />
          <Route path="/quotationapproval" element={<QuotationApproval />} />
          <Route path="/invoice" element={<Invoice />} />
          <Route path="/delivery-order" element={<DeliveryOrder />} />
          <Route path="/deliveryorder" element={<DeliveryOrder />} />
          <Route path="/purchase-order" element={<PurchaseOrder />} />
          <Route path="/purchaseorder" element={<PurchaseOrder />} />
          <Route path="/service" element={<Service/>}/>
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/salary" element={<Salary />} />
          <Route path="/userSettings" element={<UserSettings />} />

          <Route path="/enquiry" element={<EnquiryPage />} />
          <Route path="/reminders" element={<EnquiryPage />} />
          <Route path="/customer" element={<CustomerPage />} />
          <Route path="/employee" element={<Employee />} />
          <Route path="/usertype" element={<UserType />} />
          <Route path="/serviceBillView" element={<ServiceBillView />} />
          <Route path="/paymenttracking" element={<PaymentTracking />} />
          <Route path="/payment-tracking" element={<PaymentTracking />} />
          <Route path="/paymentTracking" element={<PaymentTracking />} />
          <Route path="/progress-claim" element={<ProgressClaim />} />
          <Route path="/progressclaim" element={<ProgressClaim />} />
        </Routes>
      </div>
    </>
  );
}

function App() {
  return (
    <Router>
      <Layout />
    </Router>
  );
}

export default App;
