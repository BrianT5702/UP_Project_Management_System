import React, { useState, useEffect, useMemo } from 'react';
import { stockAPI } from './apiService';
import './StockPage.css';

const StockPage = () => {
  const [stockItems, setStockItems] = useState([]);
  const [form, setForm] = useState({ quantity: '', width: '', length: '', source: 'cutting' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({ width: '', length: '' }); // only width and length
  const [isUpdating, setIsUpdating] = useState(false);

  // ============================================================
  // 🚀 PAGINATION STATE
  // ============================================================
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Filters
  const [filters, setFilters] = useState({
    width: 'all',
    length: 'all',
    source: 'all',
  });

  // ---- Fetch stock ----
  const fetchStock = async () => {
    try {
      const data = await stockAPI.getAll();
      setStockItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Could not load stock data.');
      setStockItems([]);
    }
  };

  useEffect(() => {
    fetchStock();
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // ---- Unique values for dropdowns ----
  const uniqueWidths = useMemo(() => {
    const widths = stockItems.map(item => Number(item.width));
    return [...new Set(widths)].sort((a, b) => a - b);
  }, [stockItems]);

  const uniqueLengths = useMemo(() => {
    const lengths = stockItems.map(item => Number(item.length));
    return [...new Set(lengths)].sort((a, b) => a - b);
  }, [stockItems]);

  // ---- Filter logic ----
  const filteredItems = useMemo(() => {
    return stockItems.filter(item => {
      const w = Number(item.width);
      const l = Number(item.length);
      const widthMatch = filters.width === 'all' || w === Number(filters.width);
      const lengthMatch = filters.length === 'all' || l === Number(filters.length);
      const sourceMatch = filters.source === 'all' || item.source === filters.source;
      return widthMatch && lengthMatch && sourceMatch;
    });
  }, [stockItems, filters]);

  // ============================================================
  // 🚀 PAGINATION COMPUTATIONS
  // ============================================================
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({ width: 'all', length: 'all', source: 'all' });
  };

  // ---- CRUD ----
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const newItem = await stockAPI.create(form);
      setStockItems(prev => [newItem, ...prev]);
      setForm({ quantity: '', width: '', length: '', source: 'cutting' });
      setSuccess('Stock item added successfully!');
    } catch (err) {
      setError(err.message || 'Failed to add stock');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this stock item?')) return;
    try {
      await stockAPI.delete(id);
      setStockItems(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      setError('Failed to delete item.');
    }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setEditForm({
      width: item.width,
      length: item.length,
    });
  };

  const closeModal = () => {
    setEditingItem(null);
    setEditForm({ width: '', length: '' });
    setIsUpdating(false);
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsUpdating(true);
    setError('');
    setSuccess('');
    try {
      // Keep the original quantity and source from the item
      const updated = await stockAPI.update(editingItem.id, {
        quantity: editingItem.quantity,
        width: parseFloat(editForm.width),
        length: parseFloat(editForm.length),
        source: editingItem.source,
        panel_id: editingItem.panel_id,
        brand: editingItem.brand,
      });
      setStockItems(prev =>
        prev.map(item => (item.id === updated.id ? updated : item))
      );
      setSuccess('Stock item updated successfully!');
      closeModal();
    } catch (err) {
      setError(err.message || 'Update failed');
    } finally {
      setIsUpdating(false);
    }
  };

  // Helper: display '—' for null/undefined panel fields
  const renderPanelField = (value) => (value ? value : '—');

  // Compute area in m² (width * length * quantity / 10000, since cm → m²)
  const computeArea = (item) => {
    const w = Number(item.width) || 0;
    const l = Number(item.length) || 0;
    const qty = Number(item.quantity) || 0;
    return (w * l * qty) / 10000;
  };

  return (
    <div className="stock-container">
      <h2>📦 Stock Management</h2>

      {/* Filters */}
      <div className="filter-section">
        <h3>Filter Stock</h3>
        <div className="filter-row">
          <div className="filter-group">
            <label>Width (cm)</label>
            <select name="width" value={filters.width} onChange={handleFilterChange}>
              <option value="all">All</option>
              {uniqueWidths.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Length (cm)</label>
            <select name="length" value={filters.length} onChange={handleFilterChange}>
              <option value="all">All</option>
              {uniqueLengths.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <button className="clear-filters-btn" onClick={clearFilters}>Clear Filters</button>
        </div>
      </div>

      {/* Stock Table */}
      <div className="stock-list">
        <div className="list-header">
          <h3>Current Stock</h3>
          <span className="item-count">{filteredItems.length} items</span>
        </div>
        {filteredItems.length === 0 ? (
          <p>No stock items match your filters.</p>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>JOINT</th>
                  <th>TYPE</th>
                  <th>THK</th>
                  <th>FRONT</th>
                  <th>BACK</th>
                  <th>FR THK</th>
                  <th>BK THK</th>
                  <th>FINISH</th>
                  <th>WIDTH</th>
                  <th>LENGTH</th>
                  <th>APPLIC</th>
                  <th>AREA</th>
                  <th>CUTTING</th>
                  <th>BRAND</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map(item => {
                  const area = computeArea(item);
                  return (
                    <tr key={item.id}>
                      <td>{renderPanelField(item.joint)}</td>
                      <td>{renderPanelField(item.type)}</td>
                      <td>{renderPanelField(item.panel_thk)}</td>
                      <td>{renderPanelField(item.surface_front)}</td>
                      <td>{renderPanelField(item.surface_back)}</td>
                      <td>{renderPanelField(item.surface_front_thk)}</td>
                      <td>{renderPanelField(item.surface_back_thk)}</td>
                      <td>{renderPanelField(item.surface_type)}</td>
                      <td>{renderPanelField(item.width)}</td>
                      <td>{renderPanelField(item.length)}</td>
                      <td>{renderPanelField(item.application)}</td>
                      <td>{area.toFixed(3)}</td>
                      <td>{renderPanelField(item.cutting)}</td>
                      <td>{renderPanelField(item.brand)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button onClick={() => openEditModal(item)} className="action-btn edit-btn" title="Edit">✏️</button>
                          <button onClick={() => handleDelete(item.id)} className="action-btn delete-btn" title="Delete">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 📄 Pagination Controls */}
        {filteredItems.length > itemsPerPage && (
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
              Showing {startIndex + 1}–{Math.min(endIndex, filteredItems.length)} of {filteredItems.length} items
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
      </div>

      {/* Edit Modal – only width and length */}
      {editingItem && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Stock Item</h3>
              <button className="close-modal" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleUpdateSubmit}>
              <div className="modal-body">
                <div className="form-row" style={{ display: 'flex', gap: '1rem' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Width (cm) *</label>
                    <input
                      type="number"
                      name="width"
                      placeholder="Width"
                      value={editForm.width}
                      onChange={handleEditChange}
                      required
                      step="0.01"
                      min="0.01"
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Length (cm) *</label>
                    <input
                      type="number"
                      name="length"
                      placeholder="Length"
                      value={editForm.length}
                      onChange={handleEditChange}
                      required
                      step="0.01"
                      min="0.01"
                    />
                  </div>
                </div>
                {editingItem.panel_id && (
                  <div className="panel-info" style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#555' }}>
                    <p><strong>Linked Panel:</strong> {editingItem.panel_ref || '—'}
                      {editingItem.brand && ` (${editingItem.brand})`}
                    </p>
                  </div>
                )}
                {error && <div className="error-msg">{error}</div>}
                {success && <div className="success-msg">{success}</div>}
              </div>
              <div className="modal-actions">
                <button type="button" onClick={closeModal} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-primary" disabled={isUpdating}>
                  {isUpdating ? 'Updating...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockPage;