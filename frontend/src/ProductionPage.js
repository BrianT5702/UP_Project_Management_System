import React, { useState, useEffect, useMemo } from 'react';
import { productionAPI, stockAPI } from './apiService';
import './ProductionPage.css';

// ============================================================
// ProductionDetailModal – shows all fields of a production record
// ============================================================
const ProductionDetailModal = ({ isOpen, onClose, record }) => {
  if (!isOpen || !record) return null;

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderField = (label, value) => (
    <div className="detail-field">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value || '—'}</span>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h2>Production Record Details</h2>
          <button type="button" className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="detail-grid">
            {renderField('Reference', record.reference_number)}
            {renderField('Job No', record.job_no)}
            {renderField('Brand', record.brand)}
            {renderField('Type', record.type)}
            {renderField('Panel Thk (mm)', record.panel_thk)}
            {renderField('Joint', record.joint)}
            {renderField('Surface Front', record.surface_front)}
            {renderField('Surface Back', record.surface_back)}
            {renderField('Front Thk (mm)', record.surface_front_thk)}
            {renderField('Back Thk (mm)', record.surface_back_thk)}
            {renderField('Surface Type', record.surface_type)}
            {renderField('Width (mm)', record.width)}
            {renderField('Length (mm)', record.length)}
            {renderField('Application', record.application)}
            {renderField('Cutting', record.cutting)}
            {renderField('Area (m²)', record.area ? record.area.toFixed(3) : '—')}
            {renderField('Number of Panels', record.number_of_panels)}
            {renderField('Balance After', record.balance_after)}
            {renderField('Estimated Delivery', formatDate(record.estimated_delivery))}
            {renderField('Status', record.status)}
            {renderField('Created At', formatDate(record.created_at))}
            {renderField('Updated At', formatDate(record.updated_at))}
            {renderField('Notes', record.notes)}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// AddStockModal – simplified: single entry, no quantity input
// ============================================================
const AddStockModal = ({ isOpen, onClose, record, onSave }) => {
  const [item, setItem] = useState({ quantity: 0, width: '', length: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && record) {
      const panelWidth = parseFloat(record.width) || 0;
      const panelLength = parseFloat(record.length) || 0;
      const totalPanels = parseInt(record.number_of_panels) || 0;
      setItem({
        quantity: totalPanels > 0 ? totalPanels : 1,   // default to total panels
        width: panelWidth > 0 ? panelWidth : '',
        length: panelLength > 0 ? panelLength : '',
      });
      setError('');
    }
  }, [isOpen, record]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setItem(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const qty = parseInt(item.quantity) || 1;
    const width = parseFloat(item.width);
    const length = parseFloat(item.length);

    if (!width || width <= 0) {
      setError('Please enter a valid width.');
      return;
    }
    if (!length || length <= 0) {
      setError('Please enter a valid length.');
      return;
    }

    try {
      await stockAPI.create({
        quantity: qty,
        width: width,
        length: length,
        source: 'production',
        panel_id: record.panel_id || null,
        brand: record.brand || '',
        notes: `From production ${record.production_ref || record.reference_number}`,
      });
      onSave();
      onClose();
    } catch (err) {
      console.error('Failed to add stock:', err);
      setError('Failed to add stock. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h2>Add Stock from Production</h2>
          <button type="button" className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="production-info">
            <p><strong>Job:</strong> {record.job_no || '—'}</p>
            <p><strong>Production Ref:</strong> {record.production_ref || record.reference_number}</p>
            <p><strong>Total Panels Produced:</strong> {record.number_of_panels}</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="stock-item-row" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Width (mm) *</label>
                <input
                  type="number"
                  name="width"
                  min="1"
                  step="any"
                  value={item.width}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Length (mm) *</label>
                <input
                  type="number"
                  name="length"
                  min="1"
                  step="any"
                  value={item.length}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </div>
            </div>

            {error && <div className="alert alert-danger" style={{ marginTop: '1rem' }}>{error}</div>}

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button type="button" className="secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="primary">
                Add to Stock
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Main ProductionPage Component (UPDATED with Pagination)
// ============================================================
const ProductionPage = ({ onBack }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [selectedRecordForStock, setSelectedRecordForStock] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState(null);

  // ============================================================
  // 🚀 PAGINATION STATE
  // ============================================================
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [filters, setFilters] = useState({
    job_no: '',
    status: 'all',
    brand: '',
    type: '',
    joint: '',
    surface_front: '',
    surface_back: '',
    application: '',
    startDate: '',
    endDate: '',
  });
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

  // Fetch records
  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await productionAPI.getAll();
      setRecords(data);
    } catch (err) {
      console.error('Failed to fetch production records:', err);
      setError('Failed to load production records. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Derive unique filter options from the data
  const uniqueOptions = useMemo(() => {
    const types = new Set();
    const joints = new Set();
    const frontSurfaces = new Set();
    const backSurfaces = new Set();
    const applications = new Set();

    records.forEach(r => {
      if (r.type) types.add(r.type);
      if (r.joint) joints.add(r.joint);
      if (r.surface_front) frontSurfaces.add(r.surface_front);
      if (r.surface_back) backSurfaces.add(r.surface_back);
      if (r.application) applications.add(r.application);
    });

    return {
      types: [...types].sort(),
      joints: [...joints].sort(),
      frontSurfaces: [...frontSurfaces].sort(),
      backSurfaces: [...backSurfaces].sort(),
      applications: [...applications].sort(),
    };
  }, [records]);

  // Unique Job Nos and Brands for dropdowns
  const uniqueJobNos = useMemo(() => {
    const jobs = new Set();
    records.forEach(r => { if (r.job_no) jobs.add(r.job_no); });
    return [...jobs].sort();
  }, [records]);

  const uniqueBrands = useMemo(() => {
    const brands = new Set();
    records.forEach(r => { if (r.brand) brands.add(r.brand); });
    return [...brands].sort();
  }, [records]);

  // Filter and sort
  const filteredAndSortedRecords = useMemo(() => {
    let filtered = records.filter(record => {
      if (filters.job_no && record.job_no !== filters.job_no) return false;
      if (filters.status !== 'all' && record.status !== filters.status) return false;
      if (filters.brand && record.brand !== filters.brand) return false;
      if (filters.type && record.type !== filters.type) return false;
      if (filters.joint && record.joint !== filters.joint) return false;
      if (filters.surface_front && record.surface_front !== filters.surface_front) return false;
      if (filters.surface_back && record.surface_back !== filters.surface_back) return false;
      if (filters.application && record.application !== filters.application) return false;
      if (filters.startDate) {
        const recordDate = new Date(record.created_at).toISOString().split('T')[0];
        if (recordDate < filters.startDate) return false;
      }
      if (filters.endDate) {
        const recordDate = new Date(record.created_at).toISOString().split('T')[0];
        if (recordDate > filters.endDate) return false;
      }
      return true;
    });

    // Sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key === 'created_at' || sortConfig.key === 'updated_at' ||
            sortConfig.key === 'delivery_date' || sortConfig.key === 'estimated_delivery') {
          aVal = new Date(aVal || 0).getTime();
          bVal = new Date(bVal || 0).getTime();
        } else if (sortConfig.key === 'number_of_panels' || sortConfig.key === 'balance_after' ||
                   sortConfig.key === 'panel_thk' || sortConfig.key === 'surface_front_thk' ||
                   sortConfig.key === 'surface_back_thk' || sortConfig.key === 'width' ||
                   sortConfig.key === 'length' || sortConfig.key === 'area') {
          aVal = parseFloat(aVal) || 0;
          bVal = parseFloat(bVal) || 0;
        } else {
          aVal = (aVal || '').toString().toLowerCase();
          bVal = (bVal || '').toString().toLowerCase();
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [records, filters, sortConfig]);

  // ============================================================
  // 🚀 PAGINATION COMPUTATIONS
  // ============================================================
  const totalPages = Math.ceil(filteredAndSortedRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRecords = filteredAndSortedRecords.slice(startIndex, endIndex);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Compute summary (based on all filtered records, not just current page)
  const summary = useMemo(() => {
    const totalRecords = filteredAndSortedRecords.length;
    const totalPanels = filteredAndSortedRecords.reduce((sum, r) => sum + (parseInt(r.number_of_panels) || 0), 0);
    const statusCounts = {};
    filteredAndSortedRecords.forEach(r => {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    });
    return { totalRecords, totalPanels, statusCounts };
  }, [filteredAndSortedRecords]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

 const handleStatusChange = async (record, newStatus) => {
    // Save current scroll position
    const scrollY = window.scrollY;

    try {
      await productionAPI.updateStatus(record.id, { status: newStatus });
      await fetchRecords();

      // Restore scroll position after re‑render
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
      });
    } catch (err) {
      console.error('Failed to update status:', err);
      setError('Failed to update status. Please try again.');
    }
  };

  const openAddStockModal = (record) => {
    setSelectedRecordForStock(record);
    setIsStockModalOpen(true);
  };

  const closeAddStockModal = () => {
    setIsStockModalOpen(false);
    setSelectedRecordForStock(null);
  };

  const onStockAdded = () => {
    setSuccess('✅ Stock added successfully!');
    setTimeout(() => setSuccess(null), 5000);
  };

  const openDetailModal = (record) => {
    setSelectedRecordForDetail(record);
    setIsDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedRecordForDetail(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'pending':     return '#ffc107';
      case 'in_progress': return '#17a2b8';
      case 'completed':   return '#28a745';
      case 'cancelled':   return '#dc3545';
      case 'on_hold':     return '#6c757d';
      default:            return '#6c757d';
    }
  };

  const computeArea = (record) => {
    const width  = parseFloat(record.width) || 0;
    const length = parseFloat(record.length) || 0;
    const panels = parseInt(record.number_of_panels) || 0;
    return (width * length * panels) / 1000000;
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '⬆️' : '⬇️';
  };

  return (
    <div className="production-page-container">
      <header className="page-header">
        <div className="header-left">
          {onBack && (
            <button className="back-btn" onClick={onBack}>
              ← Back
            </button>
          )}
          <h1>Production Records</h1>
        </div>
      </header>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-row">
          <div className="filter-group">
            <select name="job_no" value={filters.job_no} onChange={handleFilterChange} className="form-select">
              <option value="">All Jobs</option>
              {uniqueJobNos.map(job => <option key={job} value={job}>{job}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <select name="status" value={filters.status} onChange={handleFilterChange} className="form-select">
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>
          <div className="filter-group">
            <select name="brand" value={filters.brand} onChange={handleFilterChange} className="form-select">
              <option value="">All Brands</option>
              {uniqueBrands.map(brand => <option key={brand} value={brand}>{brand}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <select name="type" value={filters.type} onChange={handleFilterChange} className="form-select">
              <option value="">All Types</option>
              {uniqueOptions.types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <select name="joint" value={filters.joint} onChange={handleFilterChange} className="form-select">
              <option value="">All Joints</option>
              {uniqueOptions.joints.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <select name="surface_front" value={filters.surface_front} onChange={handleFilterChange} className="form-select">
              <option value="">All Front</option>
              {uniqueOptions.frontSurfaces.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <select name="surface_back" value={filters.surface_back} onChange={handleFilterChange} className="form-select">
              <option value="">All Back</option>
              {uniqueOptions.backSurfaces.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <select name="application" value={filters.application} onChange={handleFilterChange} className="form-select">
              <option value="">All Applications</option>
              {uniqueOptions.applications.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>From</label>
            <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="form-input" />
          </div>
          <div className="filter-group">
            <label>To</label>
            <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="form-input" />
          </div>
          <button className="btn btn-secondary" onClick={() => setFilters({
            job_no: '', status: 'all', brand: '', type: '', joint: '',
            surface_front: '', surface_back: '', application: '',
            startDate: '', endDate: '',
          })}>
            Clear Filters
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <span className="summary-label">Total Records</span>
          <span className="summary-value">{summary.totalRecords}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Total Panels Produced</span>
          <span className="summary-value">{summary.totalPanels}</span>
        </div>
        {Object.entries(summary.statusCounts).map(([status, count]) => (
          <div key={status} className="summary-card" style={{ borderLeftColor: getStatusBadgeColor(status) }}>
            <span className="summary-label">{status}</span>
            <span className="summary-value">{count}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-state">Loading production records...</div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="production-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('job_no')} style={{ width: '8%' }}>Job No {renderSortIcon('job_no')}</th>
                  <th onClick={() => handleSort('brand')} style={{ width: '8%' }}>Brand {renderSortIcon('brand')}</th>
                  <th onClick={() => handleSort('type')}>Type {renderSortIcon('type')}</th>
                  <th onClick={() => handleSort('panel_thk')}>Thk {renderSortIcon('panel_thk')}</th>
                  <th onClick={() => handleSort('joint')}>Joint {renderSortIcon('joint')}</th>
                  <th onClick={() => handleSort('surface_front')}>Front {renderSortIcon('surface_front')}</th>
                  <th onClick={() => handleSort('surface_back')}>Back {renderSortIcon('surface_back')}</th>
                  <th onClick={() => handleSort('surface_front_thk')}>F.Thk {renderSortIcon('surface_front_thk')}</th>
                  <th onClick={() => handleSort('surface_back_thk')}>B.Thk {renderSortIcon('surface_back_thk')}</th>
                  <th onClick={() => handleSort('surface_type')}>Finishes {renderSortIcon('surface_type')}</th>
                  <th onClick={() => handleSort('width')}>Width {renderSortIcon('width')}</th>
                  <th onClick={() => handleSort('length')}>Length {renderSortIcon('length')}</th>
                  <th onClick={() => handleSort('application')}>Applic {renderSortIcon('application')}</th>
                  <th onClick={() => handleSort('cutting')}>Cutting {renderSortIcon('cutting')}</th>
                  <th onClick={() => handleSort('area')}>Area (m²) {renderSortIcon('area')}</th>
                  <th onClick={() => handleSort('estimated_delivery')}>Est. Delivery {renderSortIcon('estimated_delivery')}</th>
                  <th style={{ width: '8%' }}>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.length === 0 ? (
                  <tr><td colSpan="18" className="empty-row">No production records found.</td></tr>
                ) : (
                  paginatedRecords.map(record => {
                    const area = computeArea(record);
                    return (
                      <tr key={record.id}>
                        <td>{record.job_no || '—'}</td>
                        <td>{record.brand || '—'}</td>
                        <td>{record.type || '—'}</td>
                        <td>{record.panel_thk ? `${record.panel_thk} mm` : '—'}</td>
                        <td>{record.joint || '—'}</td>
                        <td>{record.surface_front || '—'}</td>
                        <td>{record.surface_back || '—'}</td>
                        <td>{record.surface_front_thk || '—'}</td>
                        <td>{record.surface_back_thk || '—'}</td>
                        <td>{record.surface_type || '—'}</td>
                        <td>{record.width ? `${record.width} mm` : '—'}</td>
                        <td>{record.length ? `${record.length} mm` : '—'}</td>
                        <td>{record.application || '—'}</td>
                        <td>{record.cutting || '—'}</td>
                        <td>{area.toFixed(3)}</td>
                        <td>{formatDate(record.estimated_delivery)}</td>
                        <td>
                          <select
                            className="status-select"
                            value={record.status || 'pending'}
                            style={{
                              borderLeftColor: getStatusBadgeColor(record.status),
                              borderLeftWidth: '4px',
                              borderLeftStyle: 'solid',
                            }}
                            onChange={(e) => handleStatusChange(record, e.target.value)}
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="on_hold">On Hold</option>
                          </select>
                        </td>
                        <td>
                          {record.status === 'completed' ? (
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => openAddStockModal(record)}
                              title="Add these panels to stock"
                            >
                              📦 Add Stock
                            </button>
                          ) : (
                            <button
                              className="btn btn-sm btn-secondary"
                              disabled
                              style={{ opacity: 0.5, cursor: 'not-allowed' }}
                              title="Complete the production record first"
                            >
                              📦 Add Stock
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 📄 Pagination Controls */}
          {filteredAndSortedRecords.length > itemsPerPage && (
            <div className="pagination-container" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 0',
              marginTop: '12px',
              borderTop: '1px solid #e2e8f0',
              flexWrap: 'wrap',
              gap: '12px',
            }}>
              <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                Showing {startIndex + 1}–{Math.min(endIndex, filteredAndSortedRecords.length)} of {filteredAndSortedRecords.length} records
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="btn-ghost btn-sm"
                  style={{
                    padding: '6px 14px',
                    background: currentPage === 1 ? '#f1f5f9' : '#fff',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage === 1 ? 0.5 : 1,
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                  }}
                >
                  ◀ Prev
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                  if (
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 1
                  ) {
                    return (
                      <button
                        key={page}
                        onClick={() => goToPage(page)}
                        className={page === currentPage ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}
                        style={{
                          padding: '6px 12px',
                          minWidth: '36px',
                          borderRadius: '6px',
                          border: page === currentPage ? 'none' : '1px solid #e2e8f0',
                          background: page === currentPage ? '#6366f1' : '#fff',
                          color: page === currentPage ? '#fff' : '#1e293b',
                          cursor: 'pointer',
                        }}
                      >
                        {page}
                      </button>
                    );
                  } else if (page === 2 && currentPage > 3) {
                    return <span key="ellipsis1" style={{ color: '#94a3b8', padding: '0 4px' }}>…</span>;
                  } else if (page === totalPages - 1 && currentPage < totalPages - 2) {
                    return <span key="ellipsis2" style={{ color: '#94a3b8', padding: '0 4px' }}>…</span>;
                  }
                  return null;
                })}

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="btn-ghost btn-sm"
                  style={{
                    padding: '6px 14px',
                    background: currentPage === totalPages ? '#f1f5f9' : '#fff',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage === totalPages ? 0.5 : 1,
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                  }}
                >
                  Next ▶
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Stock Modal */}
      <AddStockModal
        isOpen={isStockModalOpen}
        onClose={closeAddStockModal}
        record={selectedRecordForStock}
        onSave={onStockAdded}
      />

      {/* Production Detail Modal */}
      <ProductionDetailModal
        isOpen={isDetailModalOpen}
        onClose={closeDetailModal}
        record={selectedRecordForDetail}
      />
    </div>
  );
};

export default ProductionPage;