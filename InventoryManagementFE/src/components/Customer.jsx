// CustomerDetailsPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaUsers,
  FaSearch,
  FaFileInvoice,
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt,
  FaTimes,
  FaCalendarAlt,
  FaTag,
  FaCheckCircle,
  FaSyncAlt,
  FaBuilding,
  FaStar,
  FaUserTag
} from 'react-icons/fa';

const API_BASE_URL = 'http://localhost:5000/api';

const CustomerDetailsPage = () => {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerCategory, setSelectedCustomerCategory] = useState('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Bill modal state
  const [showBillModal, setShowBillModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerBills, setCustomerBills] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);

  // Fetch all bills and extract unique customers
  useEffect(() => {
    fetchAllCustomers();
  }, []);

  const fetchAllCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all bills with pagination to get all customers
      let allBills = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const response = await fetch(`${API_BASE_URL}/billing/bills?page=${page}&per_page=100`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch bills');
        }
        
        const data = await response.json();
        allBills = [...allBills, ...data.bills];
        
        hasMore = page < data.pages;
        page++;
      }
      
      // Extract unique customers by phone number or name combination
      const customerMap = new Map();
      
      allBills.forEach(bill => {
        // Use customer phone as primary key, fallback to name
        const customerKey = bill.customer?.phone || bill.customer?.name || bill.customerName;
        
        if (!customerMap.has(customerKey)) {
          customerMap.set(customerKey, {
            id: bill.id,
            customerName: bill.customer?.name || bill.customerName || 'Unknown',
            customerPhone: bill.customer?.phone || bill.customerPhone || '',
            customerEmail: bill.customer?.email || bill.customerEmail || '',
            customerAddress: bill.customer?.address || bill.customerAddress || '',
            customerCategory: bill.customer?.category || bill.customer?.type || bill.customerCategory || bill.customerType || 'regular',
            billCount: 1
          });
        } else {
          const existing = customerMap.get(customerKey);
          existing.billCount += 1;
        }
      });
      
      const customersList = Array.from(customerMap.values());
      setCustomers(customersList);
      setFilteredCustomers(customersList);
      
    } catch (err) {
      setError(err.message);
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Filter customers based on search and filters
  useEffect(() => {
    let filtered = [...customers];
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(customer =>
        (customer.customerName && customer.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (customer.customerPhone && customer.customerPhone.includes(searchTerm)) ||
        (customer.customerEmail && customer.customerEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (customer.customerAddress && customer.customerAddress.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (customer.customerCategory && customer.customerCategory.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    // Filter by customer category
    if (selectedCustomerCategory !== 'all') {
      filtered = filtered.filter(customer => 
        (customer.customerCategory || 'regular').toLowerCase() === selectedCustomerCategory.toLowerCase()
      );
    }
    
    setFilteredCustomers(filtered);
    setCurrentPage(1);
  }, [searchTerm, selectedCustomerCategory, customers]);
  
  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCustomers = filteredCustomers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-SG', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return 'Invalid Date';
    }
  };
  
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '$0.00';
    return `$${amount.toFixed(2)}`;
  };
  
  const handleViewCustomerBills = async (customer) => {
    setSelectedCustomer(customer);
    setShowBillModal(true);
    setLoadingBills(true);
    
    try {
      // Fetch all bills for this customer
      let allBills = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const response = await fetch(`${API_BASE_URL}/billing/bills?page=${page}&per_page=100`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch bills');
        }
        
        const data = await response.json();
        
        // Filter bills for this customer by phone number or name
        const customerBillsData = data.bills.filter(bill => {
          const billPhone = bill.customer?.phone || bill.customerPhone;
          const billName = bill.customer?.name || bill.customerName;
          
          return (billPhone && billPhone === customer.customerPhone) ||
                 (billName && billName === customer.customerName);
        });
        
        allBills = [...allBills, ...customerBillsData];
        
        hasMore = page < data.pages;
        page++;
      }
      
      setCustomerBills(allBills);
    } catch (err) {
      console.error('Error fetching customer bills:', err);
      setError('Failed to fetch customer bills');
    } finally {
      setLoadingBills(false);
    }
  };
  
  const closeBillModal = () => {
    setShowBillModal(false);
    setSelectedCustomer(null);
    setCustomerBills([]);
  };
  
  const getCustomerCategoryBadgeStyle = (category) => {
    const cat = (category || 'regular').toLowerCase();
    const styles = {
      regular: {
        background: 'rgba(59, 130, 246, 0.15)',
        color: '#60a5fa',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      },
      internal: {
        background: 'rgba(148, 163, 184, 0.15)',
        color: '#cbd5e1',
        border: '1px solid rgba(148, 163, 184, 0.3)'
      },
      corporate: {
        background: 'rgba(16, 185, 129, 0.15)',
        color: '#34d399',
        border: '1px solid rgba(16, 185, 129, 0.3)'
      },
      vip: {
        background: 'rgba(245, 158, 11, 0.15)',
        color: '#fbbf24',
        border: '1px solid rgba(245, 158, 11, 0.3)'
      },
      wholesale: {
        background: 'rgba(168, 85, 247, 0.15)',
        color: '#c084fc',
        border: '1px solid rgba(168, 85, 247, 0.3)'
      }
    };
    return styles[cat] || styles.regular;
  };

  const stats = {
    total: customers.length,
    regular: customers.filter(c => (c.customerCategory || 'regular').toLowerCase() === 'regular').length,
    corporate: customers.filter(c => (c.customerCategory || '').toLowerCase() === 'corporate').length,
    vip: customers.filter(c => ['vip', 'wholesale', 'internal'].includes((c.customerCategory || '').toLowerCase())).length,
  };
  
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '60vh',
        color: '#ffffff'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '48px', 
            height: '48px', 
            border: '3px solid #334155',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }}></div>
          <p style={{ marginTop: '16px', color: '#94a3b8', fontSize: '14px', fontWeight: '500' }}>Loading customer details...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div style={{ 
      minHeight: '100vh',
      color: '#ffffff',
      padding: '0'
    }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .table-container {
          overflow-x: auto;
          animation: fadeIn 0.5s ease;
        }
        .customer-row {
          transition: all 0.3s ease;
        }
        .customer-row:hover {
          transform: translateX(5px);
          background: rgba(255, 255, 255, 0.15) !important;
        }
        @media (max-width: 768px) {
          .filter-grid {
            grid-template-columns: 1fr !important;
          }
          .stats-grid {
            grid-template-columns: 1fr !important;
          }
        }
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10000;
          animation: fadeIn 0.25s ease;
        }
        .modal-content {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 14px;
          max-width: 95%;
          width: 950px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          color: #ffffff;
        }
          overflow-y: auto;
          animation: slideIn 0.4s ease;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        .modal-content::-webkit-scrollbar {
          width: 8px;
        }
        .modal-content::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .modal-content::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 10px;
        }
        .modal-content::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.3s ease;
        }
        .badge:hover {
          transform: scale(1.05);
        }
        button {
          transition: all 0.3s ease;
        }
        button:active {
          transform: scale(0.95);
        }
        input, select {
          transition: all 0.3s ease;
        }
        input:focus, select:focus {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
      `}</style>
      
      <div>
        {/* Header */}
        <div style={{ 
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <h1 style={{ 
              fontSize: '22px', 
              fontWeight: '700', 
              color: '#ffffff', 
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <FaUsers color="#3b82f6" /> Customer Details
            </h1>
            <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: '13px' }}>
              View and manage customer profiles, categories and transaction histories
            </p>
          </div>
          <button
            onClick={fetchAllCustomers}
            style={{
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FaSyncAlt size={11} /> Refresh List
          </button>
        </div>

        {/* Stats Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '14px', 
          marginBottom: '20px' 
        }}>
          {[
            { label: 'Total Customers', value: stats.total, color: '#38bdf8', icon: <FaUsers /> },
            { label: 'Regular Customers', value: stats.regular, color: '#60a5fa', icon: <FaUserTag /> },
            { label: 'Corporate Clients', value: stats.corporate, color: '#34d399', icon: <FaBuilding /> },
            { label: 'VIP / Other Tier', value: stats.vip, color: '#fbbf24', icon: <FaStar /> },
          ].map((s, idx) => (
            <div key={idx} style={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid #334155', 
              borderRadius: '12px', 
              padding: '16px 18px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>{s.label}</span>
                <span style={{ color: s.color, fontSize: '16px' }}>{s.icon}</span>
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#ffffff', marginTop: '6px' }}>{s.value}</div>
            </div>
          ))}
        </div>
        
        {/* Filters Card */}
        <div style={{ 
          background: '#1e293b',
          borderRadius: '12px',
          border: '1px solid #334155',
          padding: '16px 20px',
          marginBottom: '20px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
        }}>
          <div className="filter-grid" style={{ 
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            gap: '16px',
            alignItems: 'center'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px' }}>
                Search Customers
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search by name, phone, email, address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 34px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    outline: 'none',
                    color: '#ffffff',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
                <FaSearch style={{ position: 'absolute', left: '12px', top: '11px', color: '#64748b', fontSize: '12px' }} />
              </div>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px' }}>
                Customer Category
              </label>
              <select
                value={selectedCustomerCategory}
                onChange={(e) => setSelectedCustomerCategory(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxSizing: 'border-box'
                }}
              >
                <option value="all">All Categories</option>
                <option value="regular">Regular</option>
                <option value="internal">Internal</option>
                <option value="corporate">Corporate</option>
                <option value="vip">VIP</option>
                <option value="wholesale">Wholesale</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Error Message */}
        {error && (
          <div style={{ 
            marginBottom: '20px', 
            background: 'rgba(239, 68, 68, 0.15)', 
            border: '1px solid rgba(239, 68, 68, 0.3)', 
            borderRadius: '10px', 
            padding: '12px 16px',
            color: '#f87171',
            fontSize: '13px'
          }}>
            {error}
          </div>
        )}
        
        {/* Customers Table */}
        <div style={{ 
          background: '#1e293b',
          borderRadius: '12px',
          border: '1px solid #334155',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)'
        }}>
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#111827', borderBottom: '1px solid #334155' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>S.No</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>Customer Name</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>Contact Info</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>Category</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>Bills</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentCustomers.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '60px 24px', textAlign: 'center', color: '#94a3b8' }}>
                      <FaUsers size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                      <p style={{ margin: 0 }}>No customers found matching your criteria</p>
                    </td>
                  </tr>
                ) : (
                  currentCustomers.map((customer, index) => {
                    const serialNumber = indexOfFirstItem + index + 1;
                    return (
                      <tr 
                        key={index} 
                        className="customer-row"
                        style={{ 
                          borderBottom: '1px solid #334155', 
                          transition: 'background 0.2s ease'
                        }}
                      >
                        <td style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: '600' }}>
                          {serialNumber}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: '600', color: '#ffffff' }}>{customer.customerName}</div>
                          {customer.customerAddress && (
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <FaMapMarkerAlt size={10} color="#64748b" />
                              {customer.customerAddress.length > 40 ? customer.customerAddress.substring(0, 40) + '...' : customer.customerAddress}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {customer.customerPhone && (
                            <div style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <FaPhone size={10} /> {customer.customerPhone}
                            </div>
                          )}
                          {customer.customerEmail && (
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <FaEnvelope size={10} /> {customer.customerEmail}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className="badge" style={getCustomerCategoryBadgeStyle(customer.customerCategory)}>
                            {(customer.customerCategory || 'regular').toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{ 
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#60a5fa',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            padding: '2px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600'
                          }}>
                            {customer.billCount}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleViewCustomerBills(customer)}
                            style={{ 
                              background: '#2563eb',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '12px',
                              padding: '6px 14px',
                              borderRadius: '6px',
                              color: '#ffffff',
                              fontWeight: '500',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <FaFileInvoice size={11} /> View Bills
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 20px',
              borderTop: '1px solid #334155',
              background: '#0f172a',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    background: '#1e293b',
                    color: '#ffffff',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage === 1 ? 0.4 : 1,
                    fontSize: '12px'
                  }}
                >
                  ← Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                  if (
                    pageNum === 1 ||
                    pageNum === totalPages ||
                    (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        style={{
                          padding: '6px 12px',
                          border: pageNum === currentPage ? '1px solid #3b82f6' : '1px solid #334155',
                          borderRadius: '6px',
                          background: pageNum === currentPage ? '#2563eb' : '#1e293b',
                          color: '#ffffff',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: pageNum === currentPage ? '600' : '400'
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                  return null;
                })}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    background: '#1e293b',
                    color: '#ffffff',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage === totalPages ? 0.4 : 1,
                    fontSize: '12px'
                  }}
                >
                  Next →
                </button>
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Showing {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filteredCustomers.length)} of {filteredCustomers.length} customers
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Bill Details Modal */}
      {showBillModal && selectedCustomer && (
        <div className="modal-overlay" onClick={closeBillModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ 
              padding: '18px 24px', 
              borderBottom: '1px solid #334155',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#111827'
            }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FaFileInvoice color="#3b82f6" /> Customer Bills: {selectedCustomer.customerName}
                </h2>
                <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '12px', color: '#94a3b8' }}>
                  <span>📞 {selectedCustomer.customerPhone || 'N/A'}</span>
                  <span>🏷️ Category: {(selectedCustomer.customerCategory || 'regular').toUpperCase()}</span>
                  <span>📄 Total Bills: {customerBills.length}</span>
                </div>
              </div>
              <button
                onClick={closeBillModal}
                style={{
                  background: '#334155',
                  border: 'none',
                  fontSize: '14px',
                  cursor: 'pointer',
                  color: '#ffffff',
                  padding: '6px 10px',
                  borderRadius: '6px'
                }}
              >
                <FaTimes />
              </button>
            </div>
            
            <div style={{ padding: '20px' }}>
              {loadingBills ? (
                <div style={{ textAlign: 'center', padding: '50px' }}>
                  <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    border: '3px solid #334155',
                    borderTopColor: '#3b82f6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto'
                  }}></div>
                  <p style={{ marginTop: '16px', color: '#94a3b8', fontSize: '13px' }}>Loading customer bills...</p>
                </div>
              ) : customerBills.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px', color: '#94a3b8' }}>
                  <FaFileInvoice size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                  <p style={{ margin: 0 }}>No billing history found for this customer</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid #334155', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>S.No</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>Bill ID</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>Bill Number</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>Date</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>Total</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#94a3b8' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerBills.map((bill, index) => {
                        const pStatus = (bill.payment?.status || bill.paymentStatus || 'paid').toLowerCase();
                        return (
                          <tr key={index} style={{ borderBottom: '1px solid #334155', background: '#1e293b' }}>
                            <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{index + 1}</td>
                            <td style={{ padding: '10px 14px', fontWeight: '600', color: '#38bdf8' }}>#{bill.id}</td>
                            <td style={{ padding: '10px 14px', color: '#cbd5e1' }}>{bill.billNumber || bill.bill_number || `PQM-B-${bill.id}`}</td>
                            <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{formatDate(bill.createdAt || bill.created_at)}</td>
                            <td style={{ padding: '10px 14px', fontWeight: '600', color: '#ffffff', textAlign: 'right' }}>
                              {formatCurrency(bill.summary?.total || bill.total || 0)}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '600',
                                textTransform: 'capitalize',
                                background: pStatus === 'paid' ? 'rgba(16, 185, 129, 0.15)' : 
                                           pStatus === 'partial' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: pStatus === 'paid' ? '#10b981' : 
                                       pStatus === 'partial' ? '#f59e0b' : '#ef4444',
                                border: `1px solid ${pStatus === 'paid' ? 'rgba(16, 185, 129, 0.3)' : 
                                                    pStatus === 'partial' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                              }}>
                                {pStatus}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDetailsPage;