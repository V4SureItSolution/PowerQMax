// CustomerDetailsPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = 'http://localhost:5000/api';

const CustomerDetailsPage = () => {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerType, setSelectedCustomerType] = useState('all');
  
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
            customerGST: bill.customer?.gst || bill.customerGST || '',
            customerAddress: bill.customer?.address || bill.customerAddress || '',
            customerType: bill.customer?.type || bill.customerType || 'regular',
            vehicleName: bill.vehicle?.name || bill.vehicleName || '',
            vehicleNumber: bill.vehicle?.number || bill.vehicleNumber || '',
            totalSpent: bill.summary?.total || bill.total || 0,
            billCount: 1,
            lastBillDate: bill.createdAt || new Date().toISOString()
          });
        } else {
          const existing = customerMap.get(customerKey);
          existing.totalSpent += (bill.summary?.total || bill.total || 0);
          existing.billCount += 1;
          
          // Update last bill date if newer
          if (bill.createdAt && new Date(bill.createdAt) > new Date(existing.lastBillDate)) {
            existing.lastBillDate = bill.createdAt;
          }
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
        (customer.vehicleNumber && customer.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (customer.customerGST && customer.customerGST.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    // Filter by customer type (only regular and internal)
    if (selectedCustomerType !== 'all') {
      filtered = filtered.filter(customer => customer.customerType === selectedCustomerType);
    }
    
    setFilteredCustomers(filtered);
    setCurrentPage(1);
  }, [searchTerm, selectedCustomerType, customers]);
  
  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCustomers = filteredCustomers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return 'Invalid Date';
    }
  };
  
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₹0.00';
    return `₹${amount.toFixed(2)}`;
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
  
  const getCustomerTypeBadgeStyle = (type) => {
    const styles = {
      regular: {
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.1))',
        color: '#ffffff',
        border: '1px solid rgba(59, 130, 246, 0.5)'
      },
      internal: {
        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(168, 85, 247, 0.1))',
        color: '#ffffff',
        border: '1px solid rgba(168, 85, 247, 0.5)'
      }
    };
    return styles[type] || styles.regular;
  };
  
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '60px', 
            height: '60px', 
            border: '4px solid rgba(255, 255, 255, 0.3)',
            borderTopColor: '#ffffff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }}></div>
          <p style={{ marginTop: '20px', color: '#ffffff', fontSize: '16px', fontWeight: '500' }}>Loading customer details...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '32px 24px'
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
          background: rgba(0, 0, 0, 0.8);
 backdrop-filter: blur(8px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease;
        }
        .modal-content {
          background: white;
          border-radius: 20px;
          max-width: 95%;
          width: 1000px;
          max-height: 90vh;
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
      
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ 
          marginBottom: '32px',
          animation: 'fadeIn 0.5s ease'
        }}>
          <h1 style={{ 
            fontSize: '42px', 
            fontWeight: 'bold', 
            color: '#ffffff', 
            marginBottom: '8px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.2)'
          }}>
            Customer Details
          </h1>
          <p style={{ color: '#e0e7ff', marginTop: '8px', fontSize: '16px' }}>
            View and manage all customer information
          </p>
        </div>
        
        {/* Filters */}
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          padding: '20px',
          marginBottom: '24px',
          animation: 'fadeIn 0.5s ease 0.1s backwards'
        }}>
          <div className="filter-grid" style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#f3f4f6', marginBottom: '8px' }}>
                🔍 Search Customer
              </label>
              <input
                type="text"
                placeholder="Search by name, phone, email, GST, or vehicle..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '12px',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: '14px',
                  backdropFilter: 'blur(5px)'
                }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#f3f4f6', marginBottom: '8px' }}>
                🏷️ Customer Type
              </label>
              <select
                value={selectedCustomerType}
                onChange={(e) => setSelectedCustomerType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '12px',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: '14px',
                  cursor: 'pointer',
                  backdropFilter: 'blur(5px)'
                }}
              >
                <option value="all" style={{ background: '#4a5568' }}>All Types</option>
                <option value="regular" style={{ background: '#4a5568' }}>Regular</option>
                <option value="internal" style={{ background: '#4a5568' }}>Internal</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Error Message */}
        {error && (
          <div style={{ 
            marginBottom: '24px', 
            background: 'rgba(239, 68, 68, 0.2)', 
            border: '1px solid rgba(239, 68, 68, 0.5)', 
            borderRadius: '12px', 
            padding: '16px',
            animation: 'fadeIn 0.3s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ flexShrink: 0 }}>
                <svg style={{ width: '20px', height: '20px', color: '#fecaca' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div style={{ marginLeft: '12px' }}>
                <p style={{ fontSize: '14px', color: '#fecaca' }}>{error}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Customers Table */}
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          overflow: 'hidden',
          animation: 'fadeIn 0.5s ease 0.2s backwards'
        }}>
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'rgba(0, 0, 0, 0.3)' }}>
                <tr>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#e0e7ff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>S.No</th>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#e0e7ff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Customer Name</th>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#e0e7ff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact Info</th>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#e0e7ff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>GST Number</th>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#e0e7ff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Customer Type</th>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#e0e7ff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vehicle Details</th>
                  <th style={{ padding: '16px 20px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#e0e7ff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Spent</th>
                  <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#e0e7ff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Bill Count</th>
                  <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#e0e7ff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Last Bill Date</th>
                  <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#e0e7ff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentCustomers.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ padding: '60px 24px', textAlign: 'center', color: '#e0e7ff', fontSize: '16px' }}>
                      <div style={{ textAlign: 'center' }}>
                        <svg style={{ width: '64px', height: '64px', margin: '0 auto 16px', opacity: 0.5 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p>No customers found</p>
                      </div>
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
                          borderTop: '1px solid rgba(255, 255, 255, 0.1)', 
                          transition: 'all 0.3s ease',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>
                          <span style={{ 
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            background: 'rgba(59, 130, 246, 0.3)',
                            borderRadius: '8px',
                            fontWeight: '600',
                            color: '#ffffff',
                            fontSize: '14px'
                          }}>
                            {serialNumber}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: '15px', fontWeight: '600', color: '#ffffff' }}>{customer.customerName}</div>
                          {customer.customerAddress && (
                            <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
                              📍 {customer.customerAddress.length > 30 ? customer.customerAddress.substring(0, 30) + '...' : customer.customerAddress}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          {customer.customerPhone && (
                            <div style={{ fontSize: '13px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              📞 {customer.customerPhone}
                            </div>
                          )}
                          {customer.customerEmail && (
                            <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px' }}>
                              ✉️ {customer.customerEmail}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>
                          {customer.customerGST ? (
                            <span style={{ 
                              fontSize: '13px', 
                              color: '#fbbf24',
                              fontFamily: 'monospace',
                              fontWeight: '500'
                            }}>
                              {customer.customerGST}
                            </span>
                          ) : (
                            <span style={{ fontSize: '13px', color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>
                          <span className="badge" style={getCustomerTypeBadgeStyle(customer.customerType)}>
                            {customer.customerType === 'regular' ? '👤 Regular' : '🏢 Internal'}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          {customer.vehicleNumber && (
                            <div style={{ fontSize: '13px', color: '#ffffff', fontFamily: 'monospace' }}>
                              🚗 {customer.vehicleNumber}
                            </div>
                          )}
                          {customer.vehicleName && (
                            <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>
                              {customer.vehicleName}
                            </div>
                          )}
                          {!customer.vehicleNumber && (
                            <span style={{ fontSize: '13px', color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#86efac' }}>
                            {formatCurrency(customer.totalSpent)}
                          </div>
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{ 
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(59, 130, 246, 0.2)',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#ffffff'
                          }}>
                            {customer.billCount}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: '13px', color: '#ffffff' }}>
                            📅 {formatDate(customer.lastBillDate)}
                          </div>
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => handleViewCustomerBills(customer)}
                            style={{ 
                              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(59, 130, 246, 0.6))',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '13px',
                              padding: '8px 16px',
                              borderRadius: '10px',
                              color: '#ffffff',
                              fontWeight: '500',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          >
                            📋 View Bills
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
              background: 'rgba(0, 0, 0, 0.3)', 
              padding: '16px 24px', 
              borderTop: '1px solid rgba(255, 255, 255, 0.1)' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    style={{
                      padding: '8px 20px',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: '#ffffff',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      opacity: currentPage === 1 ? 0.5 : 1,
                      fontWeight: '500',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    ← Previous
                  </button>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[...Array(Math.min(5, totalPages))].map((_, i) => {
                      let pageNumber;
                      if (totalPages <= 5) {
                        pageNumber = i + 1;
                      } else if (currentPage <= 3) {
                        pageNumber = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + i;
                      } else {
                        pageNumber = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(pageNumber)}
                          style={{
                            padding: '8px 16px',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: '10px',
                            background: currentPage === pageNumber ? 'rgba(59, 130, 246, 0.6)' : 'rgba(255, 255, 255, 0.1)',
                            color: '#ffffff',
                            cursor: 'pointer',
                            fontWeight: currentPage === pageNumber ? '600' : '400',
                            transition: 'all 0.3s ease'
                          }}
                          onMouseEnter={(e) => {
                            if (currentPage !== pageNumber) {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (currentPage !== pageNumber) {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                            }
                          }}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: '8px 20px',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: '#ffffff',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      opacity: currentPage === totalPages ? 0.5 : 1,
                      fontWeight: '500',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    Next →
                  </button>
                </div>
                <div>
                  <p style={{ fontSize: '14px', color: '#e0e7ff', fontWeight: '500' }}>
                    Showing {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filteredCustomers.length)} of {filteredCustomers.length} customers
                  </p>
                </div>
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
              padding: '24px 28px', 
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '20px 20px 0 0'
            }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff', marginBottom: '8px' }}>
                  Bill Details
                </h2>
                <p style={{ fontSize: '14px', color: '#e0e7ff' }}>
                  {selectedCustomer.customerName}
                </p>
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '13px', color: '#f3f4f6' }}>
                  <span>📞 {selectedCustomer.customerPhone || 'N/A'}</span>
                  <span>🏷️ GST: {selectedCustomer.customerGST || 'N/A'}</span>
                  <span>📄 Total Bills: {customerBills.length}</span>
                </div>
              </div>
              <button
                onClick={closeBillModal}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#ffffff',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  transition: 'all 0.3s ease',
                  fontWeight: 'bold'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
              >
                ✕
              </button>
            </div>
            
            <div style={{ padding: '24px' }}>
              {loadingBills ? (
                <div style={{ textAlign: 'center', padding: '60px' }}>
                  <div style={{ 
                    width: '50px', 
                    height: '50px', 
                    border: '3px solid #e5e7eb',
                    borderTopColor: '#667eea',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto'
                  }}></div>
                  <p style={{ marginTop: '20px', color: '#6b7280', fontSize: '14px' }}>Loading bills...</p>
                </div>
              ) : customerBills.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
                  <svg style={{ width: '80px', height: '80px', margin: '0 auto 20px', opacity: 0.5 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>No bills found for this customer</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ padding: '14px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151' }}>S.No</th>
                        <th style={{ padding: '14px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151' }}>Bill ID</th>
                        <th style={{ padding: '14px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151' }}>Bill Number</th>
                        <th style={{ padding: '14px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151' }}>Date</th>
                        <th style={{ padding: '14px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151' }}>Vehicle</th>
                        <th style={{ padding: '14px 12px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#374151' }}>Total</th>
                        <th style={{ padding: '14px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerBills.map((bill, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #f3f4f6', transition: 'background 0.2s' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>{index + 1}</td>
                          <td style={{ padding: '12px', fontSize: '14px', fontWeight: '500', color: '#111827' }}>#{bill.id}</td>
                          <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>{bill.billNumber || 'N/A'}</td>
                          <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>{formatDate(bill.createdAt)}</td>
                          <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>
                            {bill.vehicle?.number || bill.vehicleNumber || '—'}
                            {bill.vehicle?.name && ` (${bill.vehicle.name})`}
                            {!bill.vehicle?.number && bill.vehicleName && ` (${bill.vehicleName})`}
                          </td>
                          <td style={{ padding: '12px', fontSize: '14px', fontWeight: '600', color: '#10b981', textAlign: 'right' }}>
                            {formatCurrency(bill.summary?.total || bill.total || 0)}
                          </td>
                          <td style={{ padding: '12px', fontSize: '14px' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '4px 12px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: '500',
                              background: (bill.payment?.status || bill.paymentStatus) === 'paid' ? '#d1fae5' : 
                                         (bill.payment?.status || bill.paymentStatus) === 'partial' ? '#fed7aa' : '#fee2e2',
                              color: (bill.payment?.status || bill.paymentStatus) === 'paid' ? '#065f46' : 
                                    (bill.payment?.status || bill.paymentStatus) === 'partial' ? '#92400e' : '#991b1b'
                            }}>
                              {(bill.payment?.status || bill.paymentStatus || 'pending').charAt(0).toUpperCase() + 
                               (bill.payment?.status || bill.paymentStatus || 'pending').slice(1)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                        <td colSpan="5" style={{ padding: '16px 12px', fontSize: '16px', fontWeight: '600', color: '#111827', textAlign: 'right' }}>
                          Total Spent:
                        </td>
                        <td style={{ padding: '16px 12px', fontSize: '20px', fontWeight: 'bold', color: '#10b981', textAlign: 'right' }}>
                          {formatCurrency(selectedCustomer.totalSpent)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
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