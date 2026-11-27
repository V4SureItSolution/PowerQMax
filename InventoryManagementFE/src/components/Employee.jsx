// Employee.jsx - Singapore MOM Work Pass & Employee Management
import React, { useState, useEffect, useRef } from 'react';
import {
  FaUser, FaCamera, FaIdCard, FaCheckCircle, FaTrash, FaEye, FaEdit,
  FaDownload, FaTimes, FaPassport, FaBuilding, FaBriefcase, FaCalendarAlt,
  FaPhone, FaEnvelope, FaLock, FaMapMarkerAlt, FaFileAlt, FaPrint
} from 'react-icons/fa';

const EmployeeManager = () => {
  // State for employee list
  const [employees, setEmployees] = useState([]);
  const [userTypes, setUserTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);

  // Photo & file states
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [workPassFile, setWorkPassFile] = useState(null);
  const fileInputRef = useRef(null);

  // Form state matching MOM Work Pass + System fields
  const [formData, setFormData] = useState({
    employee_id: '',
    full_name: '',
    fin_number: '',
    work_permit_number: '',
    card_serial_number: '',
    pass_status: 'Valid',
    pass_expiry_date: '',
    employer: '',
    occupation: '',
    sector: '',
    date_of_application: '',
    pass_issued_date: '',
    pass_renewed_date: '',
    multiple_journey_visa: 'Issued',
    email: '',
    password: '',
    phone_number: '',
    department: '',
    designation: '',
    date_of_joining: '',
    user_type: '',
    current_company: '',
    address: ''
  });

  const [existingFiles, setExistingFiles] = useState({
    photo: null,
    work_pass_attachment: null
  });

  const API_BASE_URL = 'http://localhost:5000/api';

  useEffect(() => {
    fetchEmployees();
    fetchUserTypes();
  }, []);

  // Fetch all employees
  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/employees`);
      if (!response.ok) throw new Error('Failed to fetch employees');
      const data = await response.json();
      setEmployees(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch user types
  const fetchUserTypes = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/employees/user-types`);
      if (!response.ok) throw new Error('Failed to fetch user types');
      const data = await response.json();
      const userTypeNames = data.user_types || [];
      setUserTypes(userTypeNames);
      if (userTypeNames.length > 0 && !formData.user_type) {
        setFormData(prev => ({ ...prev, user_type: userTypeNames[0] }));
      }
    } catch (err) {
      console.error('Error fetching user types:', err);
      setUserTypes(['admin', 'employee', 'manager']);
    }
  };

  // Form input handler (employer automatically syncs with current_company)
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'employer' ? { current_company: value } : {}),
      ...(name === 'occupation' ? { designation: value } : {})
    }));
  };

  // Photo upload handler
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('Photo size should be less than 10MB');
        return;
      }
      setPhotoFile(file);
      const previewUrl = URL.createObjectURL(file);
      setPhotoPreview(previewUrl);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setExistingFiles(prev => ({ ...prev, photo: null }));
  };

  // Work Pass Document upload handler
  const handleWorkPassFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        alert('File size should be less than 20MB');
        return;
      }
      setWorkPassFile(file);
    }
  };

  // Reset form with clean fields (no hardcoded personal dummy examples)
  const resetForm = () => {
    setFormData({
      employee_id: '',
      full_name: '',
      fin_number: '',
      work_permit_number: '',
      card_serial_number: '',
      pass_status: 'Valid',
      pass_expiry_date: '',
      employer: '',
      occupation: '',
      sector: '',
      date_of_application: '',
      pass_issued_date: '',
      pass_renewed_date: '',
      multiple_journey_visa: 'Issued',
      email: '',
      password: '',
      phone_number: '',
      department: '',
      designation: '',
      date_of_joining: '',
      user_type: userTypes.length > 0 ? userTypes[0] : 'employee',
      current_company: '',
      address: ''
    });
    setPhotoFile(null);
    setPhotoPreview(null);
    setWorkPassFile(null);
    setEditingId(null);
    setExistingFiles({ photo: null, work_pass_attachment: null });
    setShowPassword(false);
  };

  // Open modal to add new employee
  const openAddModal = () => {
    resetForm();
    setShowFormModal(true);
  };

  // Handle submit (Create or Update)
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.full_name || !formData.email) {
      alert('Please fill in Full Name and Email');
      return;
    }

    if (!editingId && !formData.password) {
      alert('Please enter a password for the new employee');
      return;
    }

    setLoading(true);

    try {
      const formDataToSend = new FormData();

      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== undefined && key !== 'employee_id') {
          formDataToSend.append(key, formData[key]);
        }
      });

      if (photoFile) {
        formDataToSend.append('photo', photoFile);
      }
      if (workPassFile) {
        formDataToSend.append('work_pass_attachment', workPassFile);
      }

      let url = `${API_BASE_URL}/employees`;
      let method = 'POST';

      if (editingId) {
        url = `${API_BASE_URL}/employees/${editingId}`;
        method = 'PUT';
        if (formData.employee_id) {
          formDataToSend.append('employee_id', formData.employee_id);
        }
      }

      const response = await fetch(url, {
        method,
        body: formDataToSend
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save employee');
      }

      await fetchEmployees();
      resetForm();
      setShowFormModal(false);
      alert(`Employee ${editingId ? 'updated' : 'added'} successfully!`);
    } catch (err) {
      alert('Error: ' + err.message);
      console.error('Save error:', err);
    } finally {
      setLoading(false);
    }
  };

  // View employee modal
  const viewEmployee = (employee) => {
    setSelectedEmployee(employee);
    setShowViewModal(true);
  };

  // Edit employee
  const editEmployee = (employee) => {
    setEditingId(employee.id);
    setFormData({
      employee_id: employee.employee_id || '',
      full_name: employee.full_name || '',
      fin_number: employee.fin_number || employee.aadhar_card_number || '',
      work_permit_number: employee.work_permit_number || '',
      card_serial_number: employee.card_serial_number || employee.pan_card_number || '',
      pass_status: employee.pass_status || 'Valid',
      pass_expiry_date: employee.pass_expiry_date || '',
      employer: employee.employer || employee.current_company || '',
      occupation: employee.occupation || employee.designation || '',
      sector: employee.sector || '',
      date_of_application: employee.date_of_application || '',
      pass_issued_date: employee.pass_issued_date || '',
      pass_renewed_date: employee.pass_renewed_date || '',
      multiple_journey_visa: employee.multiple_journey_visa || 'Issued',
      email: employee.email || '',
      password: '',
      phone_number: employee.phone_number || '',
      department: employee.department || '',
      designation: employee.designation || employee.occupation || '',
      date_of_joining: employee.date_of_joining || '',
      user_type: employee.user_type || (userTypes.length > 0 ? userTypes[0] : 'employee'),
      current_company: employee.current_company || employee.employer || '',
      address: employee.address || ''
    });

    setExistingFiles({
      photo: employee.photo || null,
      work_pass_attachment: employee.work_pass_attachment || employee.aadhar_attachment || null
    });

    if (employee.photo) {
      setPhotoPreview(`${API_BASE_URL}/view-file/${employee.photo}`);
    } else {
      setPhotoPreview(null);
    }

    setPhotoFile(null);
    setWorkPassFile(null);
    setShowFormModal(true);
  };

  // Confirm delete
  const confirmDelete = (id) => {
    setEmployeeToDelete(id);
    setShowDeleteConfirm(true);
  };

  // Delete employee
  const deleteEmployee = async () => {
    if (!employeeToDelete) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/employees/${employeeToDelete}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete employee');
      }
      setEmployees(employees.filter(emp => emp.id !== employeeToDelete));
      alert('Employee deleted successfully!');
      if (editingId === employeeToDelete) resetForm();
      setShowDeleteConfirm(false);
      setEmployeeToDelete(null);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Download attachment
  const downloadAttachment = async (filename, type) => {
    try {
      const response = await fetch(`${API_BASE_URL}/download/${filename}`);
      if (!response.ok) throw new Error('Failed to download file');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_${filename}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert('Error downloading file: ' + err.message);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString + 'T00:00:00');
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  // Print Singapore MOM Digital Work Pass Card (Exact card replica from PDF)
  const printMOMCard = (emp) => {
    if (!emp) return;
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      alert('Please allow popups in your browser to print the MOM Work Pass Card.');
      return;
    }

    const photoSrc = emp.photo ? `${API_BASE_URL}/view-file/${emp.photo}` : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>MOM Work Pass Card - ${emp.full_name || 'Employee'}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f1f5f9;
            color: #0f172a;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 20px;
          }
          .pass-container {
            width: 390px;
            background: #ffffff;
            border-radius: 16px;
            border: 1px solid #cbd5e1;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            overflow: hidden;
            position: relative;
          }
          .top-bar {
            height: 6px;
            background: #0284c7;
          }
          .card-header {
            padding: 16px 20px 8px 20px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .card-icon {
            width: 26px;
            height: 18px;
            border: 1.5px solid #0f172a;
            border-radius: 4px;
            position: relative;
            display: inline-block;
          }
          .card-icon::after {
            content: '';
            position: absolute;
            left: 3px;
            bottom: 3px;
            width: 8px;
            height: 6px;
            background: #0f172a;
            border-radius: 1px;
          }
          .check-icon {
            width: 18px;
            height: 18px;
            background: #16a34a;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: 11px;
            font-weight: 900;
          }
          .status-text {
            color: #16a34a;
            font-size: 17px;
            font-weight: 700;
          }
          .photo-container {
            text-align: left;
            padding: 10px 20px 14px 20px;
          }
          .photo-box {
            width: 95px;
            height: 120px;
            border-radius: 6px;
            overflow: hidden;
            border: 1px solid #e2e8f0;
            background-color: #f8fafc;
            display: inline-block;
          }
          .photo-box img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .field-list {
            padding: 0 20px 24px 20px;
            display: flex;
            flex-direction: column;
            gap: 13px;
          }
          .field-group {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .field-label {
            font-size: 12.5px;
            color: #64748b;
            font-weight: 500;
          }
          .field-value {
            font-size: 15px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: 0.2px;
            word-break: break-word;
          }
          @media print {
            body {
              background: transparent;
              padding: 0;
            }
            .pass-container {
              border: 1px solid #cbd5e1;
              box-shadow: none;
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="pass-container">
          <div class="top-bar"></div>
          <div class="card-header">
            <span class="card-icon"></span>
            <span class="check-icon">&#10003;</span>
            <span class="status-text">${emp.pass_status || 'Valid'}</span>
          </div>
          
          <div class="photo-container">
            <div class="photo-box">
              ${photoSrc ? `<img src="${photoSrc}" alt="Employee Photo" />` : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:12px;">No Photo</div>`}
            </div>
          </div>

          <div class="field-list">
            <div class="field-group">
              <div class="field-label">Name</div>
              <div class="field-value">${emp.full_name || '—'}</div>
            </div>

            <div class="field-group">
              <div class="field-label">FIN</div>
              <div class="field-value">${emp.fin_number || emp.aadhar_card_number || '—'}</div>
            </div>

            ${emp.work_permit_number ? `
            <div class="field-group">
              <div class="field-label">Work Permit Number</div>
              <div class="field-value">${emp.work_permit_number}</div>
            </div>` : ''}

            <div class="field-group">
              <div class="field-label">Pass Expires On</div>
              <div class="field-value">${formatDate(emp.pass_expiry_date)}</div>
            </div>

            <div class="field-group">
              <div class="field-label">Employer</div>
              <div class="field-value">${emp.employer || emp.current_company || '—'}</div>
            </div>

            <div class="field-group">
              <div class="field-label">Occupation</div>
              <div class="field-value">${emp.occupation || emp.designation || '—'}</div>
            </div>

            <div class="field-group">
              <div class="field-label">Sector</div>
              <div class="field-value">${emp.sector || '—'}</div>
            </div>

            <div class="field-group">
              <div class="field-label">Date of Application</div>
              <div class="field-value">${formatDate(emp.date_of_application)}</div>
            </div>

            <div class="field-group">
              <div class="field-label">Pass Issued On</div>
              <div class="field-value">${formatDate(emp.pass_issued_date)}</div>
            </div>

            <div class="field-group">
              <div class="field-label">Pass Renewed On</div>
              <div class="field-value">${formatDate(emp.pass_renewed_date)}</div>
            </div>

            <div class="field-group">
              <div class="field-label">Multiple Journey Visa</div>
              <div class="field-value">${emp.multiple_journey_visa || '—'}</div>
            </div>

            <div class="field-group">
              <div class="field-label">Card Serial Number</div>
              <div class="field-value">${emp.card_serial_number || emp.pan_card_number || '—'}</div>
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
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Employee & Work Pass Management</h1>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '4px 0 0 0' }}>
              Singapore MOM digital work pass records and employee credentials
            </p>
          </div>
          <button onClick={openAddModal} style={styles.addButton}>
            + Add New Employee
          </button>
        </div>

        {error && (
          <div style={styles.errorMessage}>
            {error}
            <button onClick={() => setError('')} style={styles.closeButton}>×</button>
          </div>
        )}

        <div style={styles.tableContainer}>
          <h2 style={styles.subtitle}>Registered Employees ({employees.length})</h2>
          {loading && employees.length === 0 ? (
            <p style={styles.loadingMessage}>Loading employees...</p>
          ) : employees.length === 0 ? (
            <p style={styles.emptyMessage}>No employees found. Click "+ Add New Employee" to register one with Work Pass details!</p>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeaderRow}>
                    <th style={styles.tableHeader}>Photo</th>
                    <th style={styles.tableHeader}>Employee Name</th>
                    <th style={styles.tableHeader}>FIN / NRIC</th>
                    <th style={styles.tableHeader}>Work Permit No</th>
                    <th style={styles.tableHeader}>Status</th>
                    <th style={styles.tableHeader}>Employer</th>
                    <th style={styles.tableHeader}>Occupation</th>
                    <th style={styles.tableHeader}>Pass Expiry</th>
                    <th style={styles.tableHeader}>Contact</th>
                    <th style={styles.tableHeader}>Work Pass Doc</th>
                    <th style={styles.tableHeader}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const isPassValid = (emp.pass_status || 'Valid').toLowerCase() === 'valid';
                    return (
                      <tr key={emp.id} style={styles.tableRow}>
                        <td style={styles.tableCell}>
                          <div style={styles.avatarWrap}>
                            {emp.photo ? (
                              <img
                                src={`${API_BASE_URL}/view-file/${emp.photo}`}
                                alt={emp.full_name}
                                style={styles.avatarImg}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div style={{ ...styles.avatarFallback, display: emp.photo ? 'none' : 'flex' }}>
                              <FaUser style={{ color: '#94a3b8', fontSize: '13px' }} />
                            </div>
                          </div>
                        </td>
                        <td style={styles.tableCell}>
                          <strong style={styles.whiteText}>{emp.full_name}</strong>
                          <div style={styles.smallText}>{emp.email}</div>
                        </td>
                        <td style={styles.tableCell}>
                          <span style={styles.finBadge}>
                            {emp.fin_number || emp.aadhar_card_number || '—'}
                          </span>
                        </td>
                        <td style={styles.tableCell}>
                          <span style={{ color: '#cbd5e1', fontWeight: '500' }}>
                            {emp.work_permit_number || '—'}
                          </span>
                        </td>
                        <td style={styles.tableCell}>
                          <span style={isPassValid ? styles.statusBadgeValid : styles.statusBadgeOther}>
                            ● {emp.pass_status || 'Valid'}
                          </span>
                        </td>
                        <td style={styles.tableCell}>
                          <span style={styles.companyBadge}>
                            {emp.employer || emp.current_company || '—'}
                          </span>
                        </td>
                        <td style={styles.tableCell}>
                          <div style={{ color: '#f8fafc', fontWeight: '500' }}>{emp.occupation || emp.designation || '—'}</div>
                          {emp.sector && <div style={styles.smallText}>{emp.sector}</div>}
                        </td>
                        <td style={styles.tableCell}>
                          <span style={styles.expiryBadge}>
                            {formatDate(emp.pass_expiry_date)}
                          </span>
                        </td>
                        <td style={styles.tableCell}>
                          <div>{emp.phone_number || '—'}</div>
                          <div style={styles.smallText}>{emp.user_type || 'employee'}</div>
                        </td>
                        <td style={styles.tableCell}>
                          {emp.work_pass_attachment || emp.aadhar_attachment ? (
                            <button
                              onClick={() => downloadAttachment(emp.work_pass_attachment || emp.aadhar_attachment, 'work_pass')}
                              style={styles.docButton}
                              title="Download Work Pass Document"
                            >
                              <FaDownload style={{ marginRight: '4px' }} /> Work Pass
                            </button>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '12px' }}>No doc</span>
                          )}
                        </td>
                        <td style={styles.tableCell}>
                          <div style={styles.actionButtons}>
                            <button
                              onClick={() => viewEmployee(emp)}
                              style={{ ...styles.actionButton, ...styles.viewButton }}
                              title="View Work Pass & Details"
                            >
                              <FaEye />
                            </button>
                            <button
                              onClick={() => printMOMCard(emp)}
                              style={{ ...styles.actionButton, ...styles.printButton }}
                              title="Print MOM Work Pass Card"
                            >
                              <FaPrint />
                            </button>
                            <button
                              onClick={() => editEmployee(emp)}
                              style={{ ...styles.actionButton, ...styles.editButton }}
                              title="Edit Employee"
                            >
                              <FaEdit />
                            </button>
                            <button
                              onClick={() => confirmDelete(emp.id)}
                              style={{ ...styles.actionButton, ...styles.deleteButton }}
                              title="Delete Employee"
                            >
                              <FaTrash />
                            </button>
                          </div>
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

      {/* ==================== CREATE / EDIT MODAL ==================== */}
      {showFormModal && (
        <div style={styles.modalOverlay} onClick={() => setShowFormModal(false)}>
          <div style={styles.modalLarge} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FaIdCard style={{ color: '#38bdf8', fontSize: '22px' }} />
                <h2 style={styles.modalTitle}>
                  {editingId ? 'Edit Employee & Work Pass' : 'Add Employee & Work Pass'}
                </h2>
              </div>
              <button onClick={() => setShowFormModal(false)} style={styles.modalClose}>×</button>
            </div>

            <form onSubmit={handleSubmit} style={styles.modalBody}>
              {/* Photo Upload Header Box */}
              <div style={styles.photoUploadCard}>
                <div style={styles.photoPreviewBox}>
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" style={styles.photoPreviewImg} />
                  ) : (
                    <div style={styles.photoPlaceholder}>
                      <FaUser style={{ fontSize: '32px', color: '#64748b' }} />
                    </div>
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 6px 0', color: '#f8fafc', fontSize: '15px' }}>
                    Employee Photo
                  </h4>
                  <p style={{ margin: '0 0 12px 0', color: '#94a3b8', fontSize: '12px' }}>
                    Upload portrait photo for the MOM digital Work Pass (JPG, PNG or WEBP, max 10MB)
                  </p>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handlePhotoChange}
                      accept="image/*"
                      style={{ display: 'none' }}
                      id="employee-photo-input"
                    />
                    <label htmlFor="employee-photo-input" style={styles.uploadBtnLabel}>
                      <FaCamera style={{ marginRight: '6px' }} />
                      {photoPreview ? 'Change Photo' : 'Upload Photo'}
                    </label>
                    {photoPreview && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        style={styles.removePhotoBtn}
                      >
                        <FaTimes style={{ marginRight: '4px' }} /> Remove
                      </button>
                    )}
                  </div>
                </div>

                <div style={styles.statusBox}>
                  <label style={styles.label}>Pass Status</label>
                  <select
                    name="pass_status"
                    value={formData.pass_status}
                    onChange={handleInputChange}
                    style={{ ...styles.input, fontWeight: '700', color: formData.pass_status === 'Valid' ? '#86efac' : '#fca5a5' }}
                  >
                    <option value="Valid">● Valid (Active)</option>
                    <option value="Expired">● Expired</option>
                    <option value="Pending">● Pending</option>
                    <option value="Cancelled">● Cancelled</option>
                  </select>
                </div>
              </div>

              {/* SECTION 1: Singapore MOM Work Pass Details */}
              <div style={styles.sectionHeaderRow}>
                <FaPassport style={{ color: '#38bdf8' }} />
                <h3 style={styles.sectionTitle}>Singapore Work Pass Details (MOM)</h3>
              </div>

              <div style={styles.formGrid}>
                {/* Name */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Name *</label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    placeholder="Enter Full Name"
                    required
                    style={styles.input}
                  />
                </div>

                {/* FIN */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>FIN (Foreign Identification Number) *</label>
                  <input
                    type="text"
                    name="fin_number"
                    value={formData.fin_number}
                    onChange={handleInputChange}
                    placeholder="Enter FIN Number"
                    style={{ ...styles.input, textTransform: 'uppercase', letterSpacing: '0.5px' }}
                  />
                </div>

                {/* Work Permit Number */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Work Permit Number</label>
                  <input
                    type="text"
                    name="work_permit_number"
                    value={formData.work_permit_number}
                    onChange={handleInputChange}
                    placeholder="Enter Work Permit Number"
                    style={styles.input}
                  />
                </div>

                {/* Pass Expires On */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Pass Expires On</label>
                  <input
                    type="date"
                    name="pass_expiry_date"
                    value={formData.pass_expiry_date}
                    onChange={handleInputChange}
                    style={styles.input}
                  />
                </div>

                {/* Employer (Company Name) - ONLY Text Entry */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Employer (Company Name) *</label>
                  <input
                    type="text"
                    name="employer"
                    value={formData.employer}
                    onChange={handleInputChange}
                    placeholder="Enter Employer / Company Name"
                    style={styles.input}
                  />
                </div>

                {/* Occupation */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Occupation</label>
                  <input
                    type="text"
                    name="occupation"
                    value={formData.occupation}
                    onChange={handleInputChange}
                    placeholder="Enter Occupation"
                    style={styles.input}
                  />
                </div>

                {/* Sector */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Sector</label>
                  <input
                    type="text"
                    name="sector"
                    value={formData.sector}
                    onChange={handleInputChange}
                    placeholder="Enter Sector"
                    style={styles.input}
                  />
                </div>

                {/* Date of Application */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Date of Application</label>
                  <input
                    type="date"
                    name="date_of_application"
                    value={formData.date_of_application}
                    onChange={handleInputChange}
                    style={styles.input}
                  />
                </div>

                {/* Pass Issued On */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Pass Issued On</label>
                  <input
                    type="date"
                    name="pass_issued_date"
                    value={formData.pass_issued_date}
                    onChange={handleInputChange}
                    style={styles.input}
                  />
                </div>

                {/* Pass Renewed On */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Pass Renewed On</label>
                  <input
                    type="date"
                    name="pass_renewed_date"
                    value={formData.pass_renewed_date}
                    onChange={handleInputChange}
                    style={styles.input}
                  />
                </div>

                {/* Multiple Journey Visa */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Multiple Journey Visa</label>
                  <select
                    name="multiple_journey_visa"
                    value={formData.multiple_journey_visa}
                    onChange={handleInputChange}
                    style={styles.input}
                  >
                    <option value="Issued">Issued</option>
                    <option value="Not Required">Not Required</option>
                    <option value="Pending">Pending</option>
                    <option value="N/A">N/A</option>
                  </select>
                </div>

                {/* Card Serial Number */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Card Serial Number</label>
                  <input
                    type="text"
                    name="card_serial_number"
                    value={formData.card_serial_number}
                    onChange={handleInputChange}
                    placeholder="Enter Card Serial Number"
                    style={{ ...styles.input, textTransform: 'uppercase' }}
                  />
                </div>

                {/* Work Pass Attachment */}
                <div style={{ ...styles.formGroup, gridColumn: 'span 2' }}>
                  <label style={styles.label}>Work Pass Attachment (PDF/Image)</label>
                  <input
                    type="file"
                    onChange={handleWorkPassFileChange}
                    accept=".pdf,.jpg,.jpeg,.png"
                    style={styles.fileInput}
                  />
                  {existingFiles.work_pass_attachment && (
                    <div style={{ marginTop: '6px', fontSize: '12px', color: '#38bdf8' }}>
                      Current file: {existingFiles.work_pass_attachment}
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 2: System Login & Contact Details */}
              <div style={{ ...styles.sectionHeaderRow, marginTop: '24px' }}>
                <FaLock style={{ color: '#38bdf8' }} />
                <h3 style={styles.sectionTitle}>System Access & Contact Information</h3>
              </div>

              <div style={styles.formGrid}>
                {/* Email */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Email Address (Login Username) *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Enter Email Address"
                    required
                    style={styles.input}
                  />
                </div>

                {/* Password */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    {editingId ? 'Password (Leave blank to keep current)' : 'Password *'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder={editingId ? 'Enter new password to update' : 'Enter login password'}
                      required={!editingId}
                      style={{ ...styles.input, paddingRight: '45px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      style={styles.eyeBtn}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                {/* Phone */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Phone Number</label>
                  <input
                    type="tel"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 10) handleInputChange({ target: { name: 'phone_number', value: val } });
                    }}
                    placeholder="Enter 10-digit Phone Number"
                    maxLength="10"
                    style={styles.input}
                  />
                </div>

                {/* User Type */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>User Type / Role *</label>
                  <select
                    name="user_type"
                    value={formData.user_type}
                    onChange={handleInputChange}
                    style={styles.input}
                  >
                    {userTypes.map(ut => (
                      <option key={ut} value={ut}>
                        {ut.charAt(0).toUpperCase() + ut.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date of Joining */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Date of Joining</label>
                  <input
                    type="date"
                    name="date_of_joining"
                    value={formData.date_of_joining}
                    onChange={handleInputChange}
                    style={styles.input}
                  />
                </div>

                {/* Address */}
                <div style={{ ...styles.formGroup, gridColumn: 'span 2' }}>
                  <label style={styles.label}>Address / Dormitory Location</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Enter Residential / Dormitory Address"
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  style={styles.cancelButton}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={styles.submitButton}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : editingId ? 'Update Employee' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== VIEW MODAL (Singapore MOM Digital Work Pass) ==================== */}
      {showViewModal && selectedEmployee && (
        <div style={styles.modalOverlay} onClick={() => setShowViewModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FaIdCard style={{ color: '#38bdf8', fontSize: '18px' }} />
                <h2 style={styles.modalTitle}>Singapore MOM Digital Work Pass</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => printMOMCard(selectedEmployee)}
                  style={styles.printCardBtn}
                  title="Print MOM Work Pass Card"
                >
                  <FaPrint style={{ marginRight: '6px' }} /> Print Card
                </button>
                <button onClick={() => setShowViewModal(false)} style={styles.modalClose}>×</button>
              </div>
            </div>

            <div style={styles.modalBody}>
              {/* MOM Digital Pass Card View (Exact replica from PDF) */}
              <div style={styles.momCard}>
                {/* Top status bar */}
                <div style={styles.momStatusBar}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={styles.cardHeaderIcon}>
                      <span style={styles.cardHeaderIconInner} />
                    </span>
                    <span style={styles.checkCircleIcon}>✓</span>
                    <span style={{ color: '#16a34a', fontWeight: '700', fontSize: '16px' }}>
                      {selectedEmployee.pass_status || 'Valid'}
                    </span>
                  </div>
                </div>

                {/* Photo Portrait */}
                <div style={styles.momPhotoWrap}>
                  {selectedEmployee.photo ? (
                    <img
                      src={`${API_BASE_URL}/view-file/${selectedEmployee.photo}`}
                      alt={selectedEmployee.full_name}
                      style={styles.momPhotoImg}
                    />
                  ) : (
                    <div style={styles.momPhotoPlaceholder}>
                      <FaUser style={{ fontSize: '42px', color: '#64748b' }} />
                    </div>
                  )}
                </div>

                {/* MOM Key Information List */}
                <div style={styles.momFieldList}>
                  <div style={styles.momField}>
                    <div style={styles.momLabel}>Name</div>
                    <div style={styles.momValueBold}>{selectedEmployee.full_name || '—'}</div>
                  </div>

                  <div style={styles.momField}>
                    <div style={styles.momLabel}>FIN</div>
                    <div style={styles.momValueBold}>{selectedEmployee.fin_number || selectedEmployee.aadhar_card_number || '—'}</div>
                  </div>

                  {selectedEmployee.work_permit_number && (
                    <div style={styles.momField}>
                      <div style={styles.momLabel}>Work Permit Number</div>
                      <div style={styles.momValueBold}>{selectedEmployee.work_permit_number}</div>
                    </div>
                  )}

                  <div style={styles.momField}>
                    <div style={styles.momLabel}>Pass Expires On</div>
                    <div style={styles.momValueBold}>{formatDate(selectedEmployee.pass_expiry_date)}</div>
                  </div>

                  <div style={styles.momField}>
                    <div style={styles.momLabel}>Employer</div>
                    <div style={styles.momValueBold}>{selectedEmployee.employer || selectedEmployee.current_company || '—'}</div>
                  </div>

                  <div style={styles.momField}>
                    <div style={styles.momLabel}>Occupation</div>
                    <div style={styles.momValueBold}>{selectedEmployee.occupation || selectedEmployee.designation || '—'}</div>
                  </div>

                  <div style={styles.momField}>
                    <div style={styles.momLabel}>Sector</div>
                    <div style={styles.momValueBold}>{selectedEmployee.sector || '—'}</div>
                  </div>

                  <div style={styles.momField}>
                    <div style={styles.momLabel}>Date of Application</div>
                    <div style={styles.momValueBold}>{formatDate(selectedEmployee.date_of_application)}</div>
                  </div>

                  <div style={styles.momField}>
                    <div style={styles.momLabel}>Pass Issued On</div>
                    <div style={styles.momValueBold}>{formatDate(selectedEmployee.pass_issued_date)}</div>
                  </div>

                  <div style={styles.momField}>
                    <div style={styles.momLabel}>Pass Renewed On</div>
                    <div style={styles.momValueBold}>{formatDate(selectedEmployee.pass_renewed_date)}</div>
                  </div>

                  <div style={styles.momField}>
                    <div style={styles.momLabel}>Multiple Journey Visa</div>
                    <div style={styles.momValueBold}>{selectedEmployee.multiple_journey_visa || '—'}</div>
                  </div>

                  <div style={styles.momField}>
                    <div style={styles.momLabel}>Card Serial Number</div>
                    <div style={styles.momValueBold}>{selectedEmployee.card_serial_number || selectedEmployee.pan_card_number || '—'}</div>
                  </div>
                </div>

                {/* System & Contact Details */}
                <div style={styles.momSystemInfo}>
                  <div style={{ color: '#64748b', fontSize: '12px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Contact & Account Information
                  </div>
                  <div style={styles.detailGrid2}>
                    <div><strong style={{ color: '#475569' }}>Email:</strong> <span style={{ color: '#0f172a', fontWeight: '600' }}>{selectedEmployee.email}</span></div>
                    <div><strong style={{ color: '#475569' }}>Phone:</strong> <span style={{ color: '#0f172a', fontWeight: '600' }}>{selectedEmployee.phone_number || '—'}</span></div>
                    <div><strong style={{ color: '#475569' }}>Role:</strong> <span style={{ color: '#0f172a', fontWeight: '600' }}>{selectedEmployee.user_type || 'employee'}</span></div>
                    <div><strong style={{ color: '#475569' }}>Date of Joining:</strong> <span style={{ color: '#0f172a', fontWeight: '600' }}>{formatDate(selectedEmployee.date_of_joining)}</span></div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <strong style={{ color: '#475569' }}>Address:</strong> <span style={{ color: '#0f172a', fontWeight: '600' }}>{selectedEmployee.address || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Attachment action */}
                {(selectedEmployee.work_pass_attachment || selectedEmployee.aadhar_attachment) && (
                  <div style={{ marginTop: '16px', textAlign: 'center' }}>
                    <button
                      onClick={() => downloadAttachment(selectedEmployee.work_pass_attachment || selectedEmployee.aadhar_attachment, 'work_pass')}
                      style={styles.modalDownloadBtn}
                    >
                      <FaDownload style={{ marginRight: '6px' }} /> Download Attached Work Pass Document
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                onClick={() => printMOMCard(selectedEmployee)}
                style={styles.printCardBtn}
              >
                <FaPrint style={{ marginRight: '6px' }} /> Print Card
              </button>
              <button onClick={() => setShowViewModal(false)} style={styles.cancelButton}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== DELETE CONFIRM MODAL ==================== */}
      {showDeleteConfirm && (
        <div style={styles.modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
          <div style={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: '#f8fafc', margin: '0 0 10px 0', fontSize: '18px' }}>Delete Employee?</h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.5', margin: '0 0 20px 0' }}>
              Are you sure you want to remove this employee and their Work Pass records? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={styles.cancelButton}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={deleteEmployee}
                style={{ ...styles.actionButton, ...styles.deleteButton, padding: '8px 16px', fontSize: '14px' }}
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== STYLES ====================
const styles = {
  container: {
    padding: '24px',
    backgroundColor: '#0f172a',
    minHeight: '100vh',
    color: '#e2e8f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: '14px',
    border: '1px solid #334155',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
    overflow: 'hidden'
  },
  header: {
    padding: '24px 28px',
    borderBottom: '1px solid #334155',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px'
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#f8fafc',
    margin: 0
  },
  subtitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#f8fafc',
    margin: '0 0 16px 0'
  },
  addButton: {
    backgroundColor: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
    transition: 'background-color 0.2s'
  },
  errorMessage: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: '#fca5a5',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    padding: '12px 18px',
    margin: '20px 28px 0 28px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#fca5a5',
    fontSize: '20px',
    cursor: 'pointer'
  },
  tableContainer: {
    padding: '24px 28px'
  },
  tableWrapper: {
    overflowX: 'auto',
    borderRadius: '10px',
    border: '1px solid #334155'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '13.5px'
  },
  tableHeaderRow: {
    backgroundColor: '#0f172a',
    borderBottom: '1px solid #334155'
  },
  tableHeader: {
    padding: '14px 16px',
    fontWeight: '600',
    color: '#94a3b8',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  tableRow: {
    borderBottom: '1px solid #334155',
    transition: 'background-color 0.15s'
  },
  tableCell: {
    padding: '12px 16px',
    color: '#cbd5e1',
    verticalAlign: 'middle'
  },
  whiteText: {
    color: '#f8fafc',
    fontSize: '14px'
  },
  smallText: {
    fontSize: '11.5px',
    color: '#64748b',
    marginTop: '2px'
  },
  avatarWrap: {
    width: '38px',
    height: '46px',
    borderRadius: '6px',
    overflow: 'hidden',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  finBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    border: '1px solid rgba(56, 189, 248, 0.3)',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '700',
    color: '#38bdf8',
    letterSpacing: '0.5px'
  },
  statusBadgeValid: {
    display: 'inline-block',
    padding: '3px 8px',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '700',
    color: '#4ade80'
  },
  statusBadgeOther: {
    display: 'inline-block',
    padding: '3px 8px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '700',
    color: '#f87171'
  },
  companyBadge: {
    display: 'inline-block',
    padding: '3px 8px',
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#e2e8f0',
    fontWeight: '500'
  },
  expiryBadge: {
    color: '#fbbf24',
    fontWeight: '600',
    fontSize: '12.5px'
  },
  docButton: {
    padding: '5px 10px',
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    border: '1px solid rgba(2, 132, 199, 0.3)',
    borderRadius: '6px',
    color: '#38bdf8',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center'
  },
  actionButtons: {
    display: 'flex',
    gap: '6px'
  },
  actionButton: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    transition: 'opacity 0.2s'
  },
  viewButton: {
    backgroundColor: '#0284c7',
    color: '#ffffff'
  },
  printButton: {
    backgroundColor: '#059669',
    color: '#ffffff'
  },
  editButton: {
    backgroundColor: '#f59e0b',
    color: '#ffffff'
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    color: '#ffffff'
  },
  loadingMessage: {
    color: '#94a3b8',
    padding: '30px',
    textAlign: 'center'
  },
  emptyMessage: {
    color: '#94a3b8',
    padding: '40px',
    textAlign: 'center',
    fontStyle: 'italic'
  },

  // Modal styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 99999,
    padding: '85px 16px 40px 16px',
    overflowY: 'auto'
  },
  modalLarge: {
    backgroundColor: '#1e293b',
    borderRadius: '14px',
    border: '1px solid #334155',
    width: '100%',
    maxWidth: '920px',
    maxHeight: 'calc(100vh - 130px)',
    overflowY: 'auto',
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.6)',
    margin: '0 auto'
  },
  modal: {
    backgroundColor: '#1e293b',
    borderRadius: '14px',
    border: '1px solid #334155',
    width: '100%',
    maxWidth: '480px',
    maxHeight: 'calc(100vh - 130px)',
    overflowY: 'auto',
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.6)',
    margin: '0 auto'
  },
  confirmModal: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    border: '1px solid #334155',
    width: '100%',
    maxWidth: '420px',
    padding: '24px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
  },
  modalHeader: {
    padding: '18px 24px',
    borderBottom: '1px solid #334155',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#f8fafc',
    margin: 0
  },
  modalClose: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '24px',
    cursor: 'pointer'
  },
  modalBody: {
    padding: '24px'
  },
  modalFooter: {
    padding: '16px 24px',
    borderTop: '1px solid #334155',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px'
  },

  // Photo Upload Card
  photoUploadCard: {
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap'
  },
  photoPreviewBox: {
    width: '84px',
    height: '104px',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#1e293b',
    border: '2px dashed #475569',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  photoPreviewImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  photoPlaceholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  uploadBtnLabel: {
    backgroundColor: '#0284c7',
    color: '#ffffff',
    padding: '8px 14px',
    borderRadius: '6px',
    fontSize: '12.5px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center'
  },
  removePhotoBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
    padding: '7px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center'
  },
  statusBox: {
    minWidth: '170px'
  },

  // Form Grids & Sections
  sectionHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '14px',
    paddingBottom: '8px',
    borderBottom: '1px solid #334155'
  },
  sectionTitle: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#38bdf8',
    margin: 0
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '16px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.4px'
  },
  input: {
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '9px 12px',
    color: '#f8fafc',
    fontSize: '13.5px',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  fileInput: {
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '6px 10px',
    color: '#94a3b8',
    fontSize: '12px'
  },
  eyeBtn: {
    position: 'absolute',
    right: '8px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: '#38bdf8',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  cancelButton: {
    backgroundColor: '#334155',
    color: '#e2e8f0',
    border: 'none',
    borderRadius: '6px',
    padding: '9px 18px',
    fontSize: '13.5px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  submitButton: {
    backgroundColor: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '9px 20px',
    fontSize: '13.5px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  printCardBtn: {
    backgroundColor: '#059669',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center'
  },

  // View Modal - MOM Card Layout (Clean White Pass Card matching MOM PDF)
  momCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '14px',
    padding: '20px',
    color: '#0f172a',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
  },
  momStatusBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '10px'
  },
  cardHeaderIcon: {
    width: '24px',
    height: '16px',
    border: '1.5px solid #0f172a',
    borderRadius: '3px',
    position: 'relative',
    display: 'inline-block'
  },
  cardHeaderIconInner: {
    position: 'absolute',
    left: '2px',
    bottom: '2px',
    width: '7px',
    height: '5px',
    background: '#0f172a',
    borderRadius: '1px'
  },
  checkCircleIcon: {
    width: '18px',
    height: '18px',
    backgroundColor: '#16a34a',
    borderRadius: '50%',
    color: '#ffffff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: '900'
  },
  momPhotoWrap: {
    width: '90px',
    height: '115px',
    borderRadius: '6px',
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    margin: '10px 0 16px 0',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
  },
  momPhotoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  momPhotoPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  momFieldList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingBottom: '16px',
    borderBottom: '1px solid #e2e8f0'
  },
  momField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  momLabel: {
    fontSize: '12px',
    color: '#64748b',
    fontWeight: '500'
  },
  momValueBold: {
    fontSize: '14.5px',
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: '0.2px'
  },
  momSystemInfo: {
    marginTop: '16px',
    padding: '12px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0'
  },
  detailGrid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '6px',
    fontSize: '12px'
  },
  modalDownloadBtn: {
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    border: '1px solid #0284c7',
    color: '#0284c7',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center'
  }
};

export default EmployeeManager;
