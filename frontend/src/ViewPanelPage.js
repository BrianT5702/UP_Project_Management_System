import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { viewPanelAPI, productionAPI, projectsAPI } from '../src/apiService';
import './ViewPanelPage.css';

const generateReferenceNumber = (existingReferences = []) => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayPrefix = `REF-${year}${month}${day}`;
    const todayRefs = existingReferences.filter(ref => ref && ref.startsWith(todayPrefix));
    let sequence = 1;
    if (todayRefs.length > 0) {
        const sequences = todayRefs.map(ref => {
            const match = ref.match(/\d+$/);
            return match ? parseInt(match[0]) : 0;
        });
        sequence = Math.max(...sequences) + 1;
    }
    return `${todayPrefix}-${String(sequence).padStart(3, '0')}`;
};

const generateProductionRef = (existingRecords = []) => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayPrefix = `PRF-${year}${month}${day}`;
    const todayRefs = existingRecords.filter(r => r.reference_number && r.reference_number.startsWith(todayPrefix));
    let seq = 1;
    if (todayRefs.length > 0) {
        const nums = todayRefs.map(r => {
            const match = r.reference_number.match(/\d+$/);
            return match ? parseInt(match[0]) : 0;
        });
        seq = Math.max(...nums) + 1;
    }
    return `${todayPrefix}-${String(seq).padStart(3, '0')}`;
};

const ProductionDetailsModal = ({ panel, onClose, formatNumber, formatDate }) => {
    const [productionRecords, setProductionRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');

    useEffect(() => {
        const fetchRecords = async () => {
            setIsLoading(true);
            try {
                const data = await productionAPI.getByPanelId(panel.id);
                setProductionRecords(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Failed to fetch production records:', err);
                setProductionRecords([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchRecords();
    }, [panel.id]);

    const filteredRecords = useMemo(() => {
        if (activeTab === 'all') return productionRecords.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
        return productionRecords.filter(r => r.status === activeTab).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [productionRecords, activeTab]);

    const totals = useMemo(() => {
        let panels = 0, length = 0;
        productionRecords.forEach(r => {
            const p = parseInt(r.number_of_panels) || 0;
            panels += p;
            length += p * (parseFloat(r.panel_length) || 0);
        });
        return { panels, length: length / 1000 };
    }, [productionRecords]);

    return (
        <div className="modal-overlay production-modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
            <div className="modal-content large-modal" onClick={e => e.stopPropagation()} style={{ width: '95vw', maxWidth: '1600px', height: '95vh', zIndex: 10001 }}>
                <div className="modal-header">
                    <h2>Production Records: {panel.reference_number}</h2>
                    <button type="button" className="close-button" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    <div className="production-modal-content">
                        <div className="overall-production-summary">
                            <div className="summary-stats-grid">
                                <div className="summary-stat total-quantity">
                                    <div className="summary-icon">📊</div>
                                    <div className="summary-details">
                                        <div className="summary-label">Total Produced</div>
                                        <div className="summary-value">{totals.panels}</div>
                                        <div className="summary-description">{totals.length.toFixed(2)} m</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="production-records-section">
                            <div className="records-header">
                                <h3>Production Records <span className="records-count">({productionRecords.length} total)</span></h3>
                                <div className="status-tabs">
                                    <button className={`status-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>All ({productionRecords.length})</button>
                                    <button className={`status-tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>⏳ Pending</button>
                                    <button className={`status-tab ${activeTab === 'in_progress' ? 'active' : ''}`} onClick={() => setActiveTab('in_progress')}>⚙️ In Progress</button>
                                    <button className={`status-tab ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>✅ Completed</button>
                                </div>
                            </div>
                            {isLoading ? (
                                <div className="loading-state"><div className="loading-spinner"></div><p>Loading records...</p></div>
                            ) : filteredRecords.length === 0 ? (
                                <div className="empty-state"><p>No production records found.</p></div>
                            ) : (
                                <div className="records-table-container">
                                    <table className="records-table">
                                        <thead>
                                            <tr>
                                                <th>Production Ref</th>
                                                <th>Panels</th>
                                                <th>Brand</th>
                                                <th>Status</th>
                                                <th>Length (m)</th>
                                                <th>Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredRecords.map(record => {
                                                const len = ((parseInt(record.number_of_panels) || 0) * (parseFloat(record.panel_length) || 0)) / 1000;
                                                return (
                                                    <tr key={record.id}>
                                                        <td><strong>{record.reference_number}</strong></td>
                                                        <td>{record.number_of_panels}</td>
                                                        <td>{record.brand || 'N/A'}</td>
                                                        <td><span className={`status-badge ${record.status}`}>{record.status}</span></td>
                                                        <td>{len.toFixed(2)}</td>
                                                        <td>{formatDate(record.created_at)}</td>
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
            </div>
        </div>
    );
};

const JobOverviewContent = ({
    job,
    panels,
    editingRowId,
    editedRowData,
    handleCellClick,
    handleEditedFieldChange,
    handleSaveEdit,
    handleCancelEdit,
    formatDate,
    calculateArea,
    visibleColumns,
    openDuplicateModal,
    handlePrint,
    handleDeletePanel,
    isAddingNew,
    newRowData,
    setNewRowData,
    handleSaveNewPanel,
    onCancelNewPanel,
    onDeleteAllByJob,
    productionRecords = [],
    stickyTop = 0,
    onToggleProduction,
}) => {
    const [jobFilters, setJobFilters] = useState({});
    const [activeFilterCol, setActiveFilterCol] = useState(null);
    const [filterDropdownPos, setFilterDropdownPos] = useState({ top: 0, left: 0 });
    const filterDropdownRef = useRef(null);
    const [productionDateFilter, setProductionDateFilter] = useState('');

    const headerColors = [
        '#f8d7da', '#fff3cd', '#d1e7dd', '#cfe2ff', '#e2d1f0', '#f9e1d2', '#d2d2d2',
        '#fadadd', '#c9e4f0', '#fce4d6', '#e6d5b8', '#d9ead3', '#ffe5b4', '#dcd3ff', '#ffd1dc',
    ];

    const panelsWithProd = useMemo(() => {
        return panels.map(panel => {
            const qty = parseInt(panel.qty) || 0;
            const panelRecords = productionRecords.filter(r => r.panel_id === panel.id);
            const produced = panelRecords.reduce((sum, r) => sum + (parseInt(r.number_of_panels) || 0), 0);
            const remaining = Math.max(0, qty - produced);
            const hasProduction = panelRecords.length > 0;
            const isCompleted = panelRecords.some(r => r.status === 'completed');
            return { ...panel, produced, remaining, hasProduction, isCompleted };
        });
    }, [panels, productionRecords]);

    const uniqueValues = useMemo(() => {
        const uniques = {};
        visibleColumns.forEach(col => {
            if (col.type === 'computed' || col.key === 'produced' || col.key === 'remaining' || col.key === 'prod') return;
            const values = panelsWithProd
                .map(p => {
                    let val = p[col.key];
                    if (col.type === 'date' && val) val = new Date(val).toISOString().split('T')[0];
                    else if (col.type === 'number' && val != null && val !== '') val = Math.round(parseFloat(val));
                    return val?.toString().trim() || null;
                })
                .filter(v => v != null && v !== '');
            uniques[col.key] = [...new Set(values)].sort();
        });
        return uniques;
    }, [panelsWithProd, visibleColumns]);

   const filteredByColumn = useMemo(() => {
        return panelsWithProd.filter(panel => {
            for (let [key, filterVal] of Object.entries(jobFilters)) {
                if (!filterVal) continue;
                let panelVal = panel[key];
                if (key === 'created_at' || key === 'estimated_delivery') {
                    panelVal = panelVal ? new Date(panelVal).toISOString().split('T')[0] : '';
                } else {
                    panelVal = panelVal?.toString().trim() || '';
                }
                if (panelVal !== filterVal) return false;
            }
            return true;
        });
    }, [panelsWithProd, jobFilters]);

    const panelsWithProductionOnDate = useMemo(() => {
        if (!productionDateFilter) return filteredByColumn;
        const panelIdsWithProduction = new Set(
            productionRecords
                .filter(record => {
                    if (!record.created_at) return false;
                    const recordDate = new Date(record.created_at);
                    const localDate = new Date(recordDate.getTime() + 8 * 60 * 60 * 1000);
                    const localDateStr = localDate.toISOString().split('T')[0];
                    return localDateStr === productionDateFilter;
                })
                .map(record => record.panel_id)
                .filter(id => id)
        );
        return filteredByColumn.filter(panel => panelIdsWithProduction.has(panel.id));
    }, [productionDateFilter, filteredByColumn, productionRecords]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
                setActiveFilterCol(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleFilterSelect = (key, value) => {
        setJobFilters(prev => ({ ...prev, [key]: value }));
        setActiveFilterCol(null);
    };

    const clearFilter = (key) => {
        setJobFilters(prev => {
            const newFilters = { ...prev };
            delete newFilters[key];
            return newFilters;
        });
    };

    const handleNewRowFieldChange = (field, value) => {
        setNewRowData(prev => ({ ...prev, [field]: value }));
    };

    const formatTwoDecimals = (val) => {
        if (val === null || val === undefined || val === '') return 'null';
        const num = parseFloat(val);
        if (isNaN(num)) return 'null';
        return Math.round(num).toString();
    };

    const formatInteger = (val) => {
        if (val === null || val === undefined || val === '') return 'null';
        const num = parseFloat(val);
        if (isNaN(num)) return 'null';
        return Math.round(num).toString();
    };

    // 📐 Width logic – title column is now wider (120px)
    const getMinWidth = (col) => {
        // Make 'title' column wider (was 40px, now 120px)
        if (col.key === 'title') {
            return '120px';
        }
        // Text-heavy columns (narrower)
        if (['joint', 'type', 'salesman', 'application', 'cutting', 'brand'].includes(col.key)) {
            return '50px';
        }
        // Numeric columns
        if (['panel_thk', 'surface_front_thk', 'surface_back_thk', 'width', 'length', 'qty', 'area', 'production_meter', 'remaining_meter'].includes(col.key)) {
            return '50px';
        }
        // Date columns
        if (col.type === 'date' || col.key === 'created_at' || col.key === 'estimated_delivery') {
            return '75px';
        }
        return '50px';
    };

    return (
        <div className="job-panels-table" style={{ width: '100%', overflow: 'visible' }}>
            <div className="production-date-filter" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap',
                marginBottom: '0.5rem',
                padding: '0 0.25rem'
            }}>
                <h2 style={{ margin: 0, whiteSpace: 'nowrap', fontSize: '0.8rem', color: '#555' }}>
                    Meter=Production Meter &nbsp;|&nbsp; Date=Production Date &nbsp;|&nbsp; Applic=Application &nbsp;|&nbsp; Delivery=Est. Delivery
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#666', fontSize: '0.8rem' }}>
                        {productionDateFilter
                            ? `Showing ${panelsWithProductionOnDate.length} of ${filteredByColumn.length} panels`
                            : `Showing all ${filteredByColumn.length} panels`}
                    </span>
                    <input
                        type="date"
                        value={productionDateFilter}
                        onChange={(e) => setProductionDateFilter(e.target.value)}
                        className="form-input"
                        style={{ width: 'auto', flexShrink: 0, fontSize: '12px', padding: '2px 6px' }}
                    />
                    {productionDateFilter && (
                        <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => setProductionDateFilter('')}
                            style={{ flexShrink: 0, fontSize: '11px', padding: '2px 8px' }}
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Main table container – no horizontal scroll */}
            <div style={{ overflowX: 'hidden', overflowY: 'auto', maxHeight: '600px', width: '100%' }}>
                <table style={{
                    width: '100%',
                    tableLayout: 'fixed',          // enforce column widths
                    borderCollapse: 'collapse',
                    fontSize: '11px',
                    minWidth: 'auto',
                }}>
                    <thead>
                        <tr>
                            {visibleColumns.map((col, index) => (
                                <th
                                    key={col.key}
                                    id={`th-${col.key}`}
                                    onClick={() => {
                                        if (col.type !== 'computed' && col.filterable !== false && col.key !== 'prod') {
                                            const rect = document.getElementById(`th-${col.key}`)?.getBoundingClientRect();
                                            if (rect) {
                                                setFilterDropdownPos({
                                                    top: rect.bottom + window.scrollY,
                                                    left: rect.left + window.scrollX
                                                });
                                                setActiveFilterCol(activeFilterCol === col.key ? null : col.key);
                                            }
                                        }
                                    }}
                                    style={{
                                        padding: '4px 6px',
                                        border: '1px solid #ccc',
                                        whiteSpace: 'nowrap',
                                        cursor: col.type !== 'computed' && col.key !== 'prod' ? 'pointer' : 'default',
                                        position: 'sticky',
                                        top: stickyTop,
                                        zIndex: 2,
                                        backgroundColor: headerColors[index % headerColors.length],
                                        boxShadow: '0 2px 2px -1px rgba(0,0,0,0.1)',
                                        fontSize: '10px',
                                        minWidth: getMinWidth(col),
                                        width: getMinWidth(col),
                                        textAlign: 'left',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        {col.label}
                                        {jobFilters[col.key] && (
                                            <span
                                                style={{ marginLeft: '2px', fontSize: '10px', cursor: 'pointer' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    clearFilter(col.key);
                                                }}
                                                title="Clear filter"
                                            >
                                                ✕
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                            <th
                                style={{
                                    padding: '4px 6px',
                                    border: '1px solid #ccc',
                                    whiteSpace: 'nowrap',
                                    position: 'sticky',
                                    top: stickyTop,
                                    zIndex: 2,
                                    backgroundColor: headerColors[visibleColumns.length % headerColors.length],
                                    boxShadow: '0 2px 2px -1px rgba(0,0,0,0.1)',
                                    fontSize: '10px',
                                    width: '65px',
                                    minWidth: '65px',
                                    textAlign: 'center',
                                }}
                            >
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {panelsWithProductionOnDate.map(panel => {
                            const isEditing = editingRowId === panel.id;
                            const qty = parseInt(panel.qty) || 0;
                            const produced = panel.produced || 0;
                            const remaining = panel.remaining || 0;
                            const hasProduction = panel.hasProduction || false;
                            const isCompleted = panel.isCompleted || false;
                            const length = parseFloat(panel.length) || 0;
                            const width = parseFloat(panel.width) || 0;
                            const prodMeter = produced * length;
                            const area = calculateArea(width, length, qty) / 1000000;

                            return (
                                <tr key={panel.id}>
                                    {visibleColumns.map(col => {
                                        let value;
                                        let inputElement = null;

                                        if (col.key === 'area') {
                                            value = Math.round(area).toString();
                                        } else if (col.key === 'production_meter') {
                                            value = prodMeter.toFixed(0);
                                        } else if (col.key === 'remaining_meter') {
                                            const remainingMeter = remaining * length;
                                            value = Math.round(remainingMeter).toString();
                                        } else if (col.key === 'produced') {
                                            value = produced;
                                        } else if (col.key === 'prod') {
                                            return (
                                                <td key={col.key} style={{ padding: '4px 6px', border: '1px solid #ccc', textAlign: 'center', minWidth: '65px' }}>
                                                    <button
                                                        className={`btn btn-sm ${
                                                            isCompleted ? 'btn-primary' : hasProduction ? 'btn-warning' : 'btn-success'
                                                        }`}
                                                        onClick={() => onToggleProduction(panel)}
                                                        style={{
                                                            fontSize: '10px',
                                                            padding: '2px 6px',
                                                            minWidth: '40px',
                                                            ...(hasProduction && !isCompleted ? {
                                                                backgroundColor: '#d35400',
                                                                borderColor: '#d35400',
                                                                color: '#fff',
                                                                fontWeight: 'bold'
                                                            } : {})
                                                        }}
                                                    >
                                                        {isCompleted ? 'Done' : hasProduction ? 'In Prod' : 'Go'}
                                                    </button>
                                                </td>
                                            );
                                        } else if (col.key === 'created_at' || col.key === 'estimated_delivery') {
                                            value = formatDate(panel[col.key]);
                                        } else if (col.key === 'panel_thk' || col.key === 'surface_front_thk' || col.key === 'surface_back_thk') {
                                            value = formatTwoDecimals(panel[col.key]);
                                        } else if (col.key === 'width' || col.key === 'length') {
                                            value = formatInteger(panel[col.key]);
                                        } else {
                                            value = panel[col.key] ?? 'null';
                                        }

                                        if (isEditing && col.type !== 'computed' && col.key !== 'produced' && col.key !== 'remaining' && col.key !== 'prod') {
                                            if (col.editable === false) {
                                                return <td key={col.key} style={{ padding: '4px 6px', border: '1px solid #ccc', minWidth: getMinWidth(col), width: getMinWidth(col), overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</td>;
                                            }
                                            if (col.key === 'remaining_meter') {
                                                const currentRemaining = (remaining * length);
                                                inputElement = (
                                                    <input
                                                        type="number"
                                                        step="1"
                                                        value={editedRowData.remaining_meter ?? Math.round(currentRemaining).toString()}
                                                        onChange={(e) => handleEditedFieldChange('remaining_meter', e.target.value)}
                                                        style={{ width: '100%', boxSizing: 'border-box', fontSize: '11px', padding: '2px 4px', minWidth: '60px' }}
                                                    />
                                                );
                                            } else if (col.type === 'number') {
                                                const decimalFields = ['panel_thk', 'surface_front_thk', 'surface_back_thk'];
                                                const step = decimalFields.includes(col.key) ? 'any' : '1';
                                                inputElement = (
                                                    <input
                                                        type="number"
                                                        step={step}
                                                        value={editedRowData[col.key] ?? ''}
                                                        onChange={(e) => handleEditedFieldChange(col.key, e.target.value)}
                                                        style={{ width: '100%', boxSizing: 'border-box', fontSize: '11px', padding: '2px 4px', minWidth: '60px' }}
                                                    />
                                                );
                                            } else if (col.type === 'date') {
                                                inputElement = (
                                                    <input
                                                        type="date"
                                                        value={editedRowData[col.key] ?? ''}
                                                        onChange={(e) => handleEditedFieldChange(col.key, e.target.value)}
                                                        style={{ width: '100%', boxSizing: 'border-box', fontSize: '11px', padding: '2px 4px', minWidth: '60px' }}
                                                    />
                                                );
                                            } else {
                                                inputElement = (
                                                    <input
                                                        type="text"
                                                        value={editedRowData[col.key] ?? ''}
                                                        onChange={(e) => handleEditedFieldChange(col.key, e.target.value)}
                                                        style={{ width: '100%', boxSizing: 'border-box', fontSize: '11px', padding: '2px 4px', minWidth: '60px' }}
                                                    />
                                                );
                                            }
                                        }

                                        return (
                                            <td
                                                key={col.key}
                                                onClick={() => !isEditing && col.type !== 'computed' && col.key !== 'produced' && col.key !== 'prod' && handleCellClick(panel)}
                                                style={{
                                                    padding: '4px 6px',
                                                    border: '1px solid #ccc',
                                                    cursor: !isEditing && col.type !== 'computed' && col.key !== 'produced' && col.key !== 'prod' ? 'pointer' : 'default',
                                                    wordBreak: 'break-word',
                                                    fontSize: '15px',
                                                    backgroundColor: jobFilters[col.key] === panel[col.key]?.toString().trim() ? '#e3f2fd' : 'transparent',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    minWidth: getMinWidth(col),
                                                    width: getMinWidth(col),
                                                }}
                                                title={!isEditing && col.type !== 'computed' && col.key !== 'produced' && col.key !== 'prod' ? 'Click to edit' : ''}
                                            >
                                                {isEditing && col.type !== 'computed' && col.key !== 'produced' && col.key !== 'prod' ? inputElement : value}
                                            </td>
                                        );
                                    })}
                                    <td style={{
                                        padding: '4px 6px',
                                        border: '1px solid #ccc',
                                        textAlign: 'center',
                                        verticalAlign: 'middle',
                                        minWidth: '65px',
                                        width: '65px',
                                    }}>
                                        {isEditing ? (
                                            // Editing mode: Save & Cancel (still stacked)
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                                <button onClick={handleSaveEdit} style={{ fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer' }} title="Save">💾</button>
                                                <button onClick={handleCancelEdit} style={{ fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer' }} title="Cancel">❌</button>
                                            </div>
                                        ) : (
                                            // Actions: two icons in a row, third below
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 1fr',
                                                gap: '2px',
                                                justifyItems: 'center',
                                                alignItems: 'center',
                                            }}>
                                                <button
                                                    onClick={() => openDuplicateModal(panel)}
                                                    style={{ fontSize: '16px', background: 'none', border: 'none', cursor: 'pointer' }}
                                                    title="Duplicate"
                                                >
                                                    ⎘
                                                </button>
                                                <button
                                                    onClick={() => handlePrint(panel)}
                                                    style={{ fontSize: '16px', background: 'none', border: 'none', cursor: 'pointer' }}
                                                    title="Print"
                                                >
                                                    🖨️
                                                </button>
                                                <button
                                                    onClick={() => handleDeletePanel(panel.id)}
                                                    style={{
                                                        fontSize: '16px',
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        gridColumn: '1 / -1',  // spans both columns, appears on its own row
                                                        justifySelf: 'center',
                                                    }}
                                                    title="Delete"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}

                        {isAddingNew && (
                            <tr style={{ backgroundColor: '#e6f7ff' }}>
                                {visibleColumns.map(col => {
                                    if (col.type === 'computed' || col.key === 'produced' || col.key === 'prod') {
                                        return <td key={col.key} style={{ padding: '4px 6px', border: '1px solid #ccc', minWidth: getMinWidth(col), width: getMinWidth(col) }}>—</td>;
                                    }
                                    let inputElement;
                                    if (col.type === 'number') {
                                        inputElement = (
                                            <input
                                                type="number"
                                                step="any"
                                                value={newRowData[col.key] ?? ''}
                                                onChange={(e) => handleNewRowFieldChange(col.key, e.target.value)}
                                                style={{ width: '100%', boxSizing: 'border-box', fontSize: '11px', padding: '2px 4px', minWidth: '60px' }}
                                            />
                                        );
                                    } else if (col.type === 'date') {
                                        inputElement = (
                                            <input
                                                type="date"
                                                value={newRowData[col.key] ?? ''}
                                                onChange={(e) => handleNewRowFieldChange(col.key, e.target.value)}
                                                style={{ width: '100%', boxSizing: 'border-box', fontSize: '11px', padding: '2px 4px', minWidth: '60px' }}
                                            />
                                        );
                                    } else {
                                        inputElement = (
                                            <input
                                                type="text"
                                                value={newRowData[col.key] ?? ''}
                                                onChange={(e) => handleNewRowFieldChange(col.key, e.target.value)}
                                                style={{ width: '100%', boxSizing: 'border-box', fontSize: '11px', padding: '2px 4px', minWidth: '60px' }}
                                            />
                                        );
                                    }
                                    return (
                                        <td key={col.key} style={{ padding: '4px 6px', border: '1px solid #ccc', minWidth: getMinWidth(col), width: getMinWidth(col) }}>
                                            {inputElement}
                                        </td>
                                    );
                                })}
                                <td style={{ padding: '4px 6px', border: '1px solid #ccc', textAlign: 'center', minWidth: '65px', width: '65px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                        <button onClick={handleSaveNewPanel} style={{ fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer' }} title="Save">💾</button>
                                        <button onClick={onCancelNewPanel} style={{ fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer' }} title="Cancel">❌</button>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {activeFilterCol && ReactDOM.createPortal(
                <div
                    className="filter-dropdown"
                    ref={filterDropdownRef}
                    style={{
                        position: 'absolute',
                        top: filterDropdownPos.top,
                        left: filterDropdownPos.left,
                        zIndex: 2000,
                    }}
                >
                    <div className="filter-dropdown-header">
                        <span>Filter by {visibleColumns.find(c => c.key === activeFilterCol)?.label}</span>
                        <button onClick={() => setActiveFilterCol(null)}>×</button>
                    </div>
                    <div className="filter-dropdown-list">
                        <div
                            className={`filter-option ${!jobFilters[activeFilterCol] ? 'selected' : ''}`}
                            onClick={() => {
                                setJobFilters(prev => ({ ...prev, [activeFilterCol]: '' }));
                                setActiveFilterCol(null);
                            }}
                        >
                            All
                        </div>
                        {uniqueValues[activeFilterCol]?.map(val => (
                            <div
                                key={val}
                                className={`filter-option ${jobFilters[activeFilterCol] === val ? 'selected' : ''}`}
                                onClick={() => handleFilterSelect(activeFilterCol, val)}
                            >
                                {val}
                            </div>
                        ))}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
// =========================================================
// Main ViewPanelPage Component (UPDATED with Pagination & Scroll Fix)
// =========================================================
const ViewPanelPage = ({ onBack, onEditingChange, onCloseAiSidebar }) => {
    const navigate = useNavigate();
    const [panels, setPanels] = useState([]);
    const [allProductionRecords, setAllProductionRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPanel, setEditingPanel] = useState(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const [selectedPanelToDuplicate, setSelectedPanelToDuplicate] = useState(null);
    const [numberOfCopies, setNumberOfCopies] = useState(1);
    const [selectedPanelForProduction, setSelectedPanelForProduction] = useState(null);
    const [isCreateFormDuplicateModalOpen, setIsCreateFormDuplicateModalOpen] = useState(false);
    const [duplicateFormCopies, setDuplicateFormCopies] = useState(1);
    const [productionMeterDate, setProductionMeterDate] = useState('');
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [newRowData, setNewRowData] = useState(null);
    const [productionDetailModal, setProductionDetailModal] = useState(null);
    const [allProjects, setAllProjects] = useState([]);
    const [productionModalFromMeter, setProductionModalFromMeter] = useState(null);
    const [dailyProductionMeter, setDailyProductionMeter] = useState({
        totalMeter: 0,
        panelCount: 0,
        totalMeterInMeters: 0,
        estimatedTimeMinutes: 0,
        estimatedTimeHours: 0,
        estimatedTimeRemainingMinutes: 0
    });
    const [isPrintSelectionModalOpen, setIsPrintSelectionModalOpen] = useState(false);
    const [isColumnSelectionModalOpen, setIsColumnSelectionModalOpen] = useState(false);
    const [estimatedRunningSpeed, setEstimatedRunningSpeed] = useState(4.8);

    const [activeView, setActiveView] = useState('table');
    const [expandedGroups, setExpandedGroups] = useState(new Set());

    const [activeFilterColumn, setActiveFilterColumn] = useState(null);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const portalDropdownRef = useRef(null);

    const [editingRowId, setEditingRowId] = useState(null);
    const [editedRowData, setEditedRowData] = useState(null);
    const [editError, setEditError] = useState(null);
    const [editSuccess, setEditSuccess] = useState(null);
    useEffect(() => {
        onEditingChange?.(Boolean(editingRowId) || isAddingNew);
    }, [editingRowId, isAddingNew, onEditingChange]);

    const [isPrintColumnSelectionOpen, setIsPrintColumnSelectionOpen] = useState(false);
    const [selectedPrintColumns, setSelectedPrintColumns] = useState([]);

    // ============================================================
    // 🚀 PAGINATION STATE
    // ============================================================
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // ============================================================
    // 📌 Ref for the table container (for scroll preservation)
    // ============================================================
    const tableContainerRef = useRef(null);

    const defaultColumns = [
        { id: 'job_no', label: 'Job No', visible: true, order: 1 },
        { id: 'type', label: 'Type', visible: true, order: 2 },
        { id: 'panel_thk', label: 'Thk', visible: true, order: 3 },
        { id: 'joint', label: 'Joint', visible: true, order: 4 },
        { id: 'surface_front', label: 'Front', visible: true, order: 5 },
        { id: 'surface_back', label: 'Back', visible: true, order: 6 },
        { id: 'surface_front_thk', label: 'Fr Thk', visible: true, order: 7 },
        { id: 'surface_back_thk', label: 'Bk Thk', visible: true, order: 8 },
        { id: 'surface_type', label: 'Finish', visible: true, order: 9 },
        { id: 'width', label: 'Width', visible: true, order: 10 },
        { id: 'length', label: 'Length', visible: true, order: 11 },
        { id: 'salesman', label: 'Person', visible: true, order: 12 },
        { id: 'application', label: 'Applic', visible: true, order: 13 },
        { id: 'area', label: 'Area', visible: true, order: 14 },
        { id: 'qty', label: 'Qty', visible: true, order: 16 },
        { id: 'cutting', label: 'Cutting', visible: true, order: 17 },
        { id: 'brand', label: 'Brand', visible: true, order: 18 },
        { id: 'produced', label: 'Produced', visible: true, order: 19 },
        { id: 'production_meter', label: 'Meter', visible: true, order: 20 },
        { id: 'remaining', label: 'Remain', visible: true, order: 21 },
        { id: 'remaining_meter', label: 'Remain M', visible: true, order: 22 },
        { id: 'created_at', label: 'Date', visible: true, order: 23 },
        { id: 'estimated_delivery', label: 'Delivery', visible: true, order: 24 },
        { id: 'actions', label: 'Actions', visible: true, order: 25, alwaysVisible: true }
    ];

    const jobOverviewColumns = [
        { key: 'joint', label: 'Joint', type: 'text', width: '6%' },
        { key: 'type', label: 'Type', type: 'text', width: '8%' },
        { key: 'panel_thk', label: 'Thk', type: 'number', width: '6%' },
        { key: 'surface_front', label: 'Front', type: 'text', width: '8%' },
        { key: 'surface_back', label: 'Back', type: 'text', width: '8%' },
        { key: 'surface_front_thk', label: 'Fr Thk', type: 'number', width: '8%' },
        { key: 'surface_back_thk', label: 'Bk Thk', type: 'number', width: '8%' },
        { key: 'surface_type', label: 'Finish', type: 'text', width: '7%' },
        { key: 'width', label: 'Width', type: 'number', width: '5%' },
        { key: 'length', label: 'Length', type: 'number', width: '5%' },
        { key: 'salesman', label: 'Person', type: 'text', width: '6%' },
        { key: 'application', label: 'Applic', type: 'text', width: '6%' },
        { key: 'area', label: 'Area', type: 'computed', width: '5%' },
        { key: 'cutting', label: 'Cutting', type: 'text', width: '6%' },
        { key: 'brand', label: 'Brand', type: 'text', width: '6%' },
        { key: 'estimated_delivery', label: 'Delivery', type: 'date', width: '7%' },
        { key: 'prod', label: 'PROD', type: 'action', width: '4%' }
    ];

    const [columns, setColumns] = useState(() => {
        const savedColumns = localStorage.getItem('panelTableColumns');
        if (savedColumns) {
            const parsed = JSON.parse(savedColumns);
            const filtered = parsed.filter(col => col.id !== 'balance' && col.id !== 'status');
            if (filtered.length !== parsed.length) {
                localStorage.setItem('panelTableColumns', JSON.stringify(filtered));
                return filtered;
            }
            return parsed;
        }
        return defaultColumns;
    });

    const [filters, setFilters] = useState({
        reference_number: '',
        job_no: '',
        customer: '',
        type: '',
        search: '',
        panel_thk: '',
        joint: '',
        surface_front: '',
        surface_back: '',
        surface_front_thk: '',
        surface_back_thk: '',
        surface_type: '',
        width: '',
        length: '',
        qty: '',
        cutting: '',
        brand: '',
        created_at: '',
        estimated_delivery: ''
    });

    const [sortConfig, setSortConfig] = useState({
        key: 'created_at',
        direction: 'desc'
    });

    const [uniqueValues, setUniqueValues] = useState({
        jobNos: [],
        types: [],
        salesmen: [],
        panelThks: [],
        joints: [],
        surfaceFronts: [],
        surfaceBacks: [],
        surfaceFrontThks: [],
        surfaceBackThks: [],
        surfaceTypes: [],
        widths: [],
        lengths: [],
        qtys: [],
        cuttings: [],
        applications: [],
        createdDates: [],
        estimatedDeliveries: [],
        referenceNumbers: [],
        brands: []
    });

    const [productionRefs, setProductionRefs] = useState([]);
    const createModalRef = useRef(null);
    const inputRefs = useRef([]);

    const formatDateForInput = (timestamp) => {
        if (!timestamp) return '';
        if (typeof timestamp === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(timestamp)) return timestamp;
        if (typeof timestamp === 'string' && timestamp.includes('T')) return timestamp.split('T')[0];
        if (typeof timestamp === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)) {
            return timestamp.split(' ')[0];
        }
        if (timestamp instanceof Date) return timestamp.toISOString().split('T')[0];
        return timestamp || '';
    };

    const convertToISOString = (dateString) => {
        if (!dateString) return null;
        try {
            if (dateString.includes('T')) return dateString;
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return new Date(dateString + 'T00:00:00.000Z').toISOString();
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) return date.toISOString();
            return null;
        } catch { return null; }
    };

    const fetchAllProjects = async () => {
        try {
            const data = await projectsAPI.getAll();
            if (Array.isArray(data)) setAllProjects(data);
        } catch (err) {
            console.error('Failed to fetch projects:', err);
        }
    };

    const fetchAllProductionRecords = async () => {
        try {
            const data = await productionAPI.getAll();
            if (Array.isArray(data)) {
                setAllProductionRecords(data);
            }
        } catch (err) {
            console.error('Failed to fetch production records:', err);
        }
    };

    const fetchProductionReferences = async () => {
        try {
            const data = await productionAPI.getAll();
            if (Array.isArray(data)) {
                const refs = data.map(r => r.reference_number).filter(Boolean);
                setProductionRefs([...new Set(refs)].sort());
            }
        } catch (err) { console.error('Failed to fetch production references:', err); }
    };

    const fetchPanels = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await viewPanelAPI.getAll();
            if (Array.isArray(data)) {
                const records = allProductionRecords.length ? allProductionRecords : await productionAPI.getAll();
                const panelsWithProd = data.map(p => {
                    const panelRecords = records.filter(r => r.panel_id === p.id);
                    const produced = panelRecords.reduce((sum, r) => sum + (parseInt(r.number_of_panels) || 0), 0);
                    const qty = parseInt(p.qty) || 0;
                    return { ...p, produced, remaining: Math.max(0, qty - produced) };
                });
                setPanels(panelsWithProd);
            } else {
                setError('Invalid data received');
                setPanels([]);
            }
        } catch (err) {
            console.error('Failed to fetch panels:', err);
            setError('Failed to load panels.');
            setPanels([]);
        } finally {
            setIsLoading(false);
        }
    };

    // ============================================================
    // 🚀 FIXED handleToggleProduction with scroll preservation
    // ============================================================
    const handleToggleProduction = async (panel) => {
        // Save current scroll position before any state change
        const scrollTop = tableContainerRef.current?.scrollTop || 0;

        try {
            const panelId = Number(panel.id);
            if (isNaN(panelId) || panelId <= 0) {
                setError('Invalid panel ID');
                return;
            }

            const existingRecords = allProductionRecords.filter(r => r.panel_id === panelId);
            if (existingRecords.length > 0) {
                for (const rec of existingRecords) {
                    await productionAPI.delete(panelId, rec.id);
                }
                setSuccess(`Production removed for ${panel.reference_number}`);
            } else {
                const ref = generateProductionRef(allProductionRecords);
                const newRecord = {
                    panel_id: panelId,
                    number_of_panels: 1,
                    date: new Date().toISOString().split('T')[0],
                    reference_number: ref,
                    status: 'pending',
                    panel_reference: panel.reference_number,
                    job_no: panel.job_no,
                    length: parseFloat(panel.length) || 0,
                    width: parseFloat(panel.width) || 0,
                    brand: panel.brand || '',
                    estimated_delivery: panel.estimated_delivery || null,
                    notes: 'Created via toggle'
                };
                await productionAPI.create(panelId, newRecord);
                setSuccess(`Production started for ${panel.reference_number}`);
            }

            // Refresh data
            await fetchAllProductionRecords();

            // Restore scroll position after re‑render
            requestAnimationFrame(() => {
                if (tableContainerRef.current) {
                    tableContainerRef.current.scrollTop = scrollTop;
                }
            });

            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error('Failed to toggle production:', err);
            setError('Failed to toggle production: ' + err.message);
        }
    };

    const handleCellClick = (panel) => {
        if (editingRowId === panel.id) return;
        setEditingRowId(panel.id);
        setEditedRowData({
            ...panel,
            produced: panel.produced || 0,
            created_at: formatDateForInput(panel.created_at),
            estimated_delivery: formatDateForInput(panel.estimated_delivery)
        });
        setEditError(null);
        setEditSuccess(null);
    };

    const handleEditedFieldChange = (field, value) => {
        setEditedRowData(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveEdit = async () => {
        if (!editedRowData) return;
        const originalPanel = panels.find(p => p.id === editingRowId);
        if (!originalPanel) return;

        // ---- Build panelUpdates (unchanged) ----
        const panelUpdates = {};
        const fieldsToCheck = [
            'type', 'panel_thk', 'joint', 'surface_front', 'surface_back',
            'surface_front_thk', 'surface_back_thk', 'surface_type', 'width', 'length',
            'salesman', 'application', 'cutting', 'brand', 'estimated_delivery'
        ];
        let newBrand = null;
        let newEstimatedDelivery = null;

        fieldsToCheck.forEach(field => {
            let originalValue = originalPanel[field];
            let newValue = editedRowData[field];

            if (field === 'estimated_delivery') {
                originalValue = originalValue ? convertToISOString(originalValue) : null;
                newValue = newValue ? convertToISOString(newValue) : null;
                if (originalValue !== newValue) newEstimatedDelivery = newValue;
            } else if (field === 'brand') {
                originalValue = (originalValue && originalValue.trim() !== '') ? originalValue.trim() : null;
                newValue = (newValue && newValue.trim() !== '') ? newValue.trim() : null;
                if (originalValue !== newValue) newBrand = newValue;
            } else if (['panel_thk', 'surface_front_thk', 'surface_back_thk', 'width', 'length'].includes(field)) {
                originalValue = (originalValue !== undefined && originalValue !== null && originalValue !== '')
                    ? parseFloat(originalValue)
                    : null;
                newValue = (newValue !== undefined && newValue !== null && newValue !== '')
                    ? parseFloat(newValue)
                    : null;
            } else {
                originalValue = (originalValue && originalValue.trim() !== '') ? originalValue.trim() : null;
                newValue = (newValue && newValue.trim() !== '') ? newValue.trim() : null;
            }

            if (originalValue !== newValue) {
                panelUpdates[field] = newValue;
            }
        });

        // ---- No changes: clear edit mode immediately ----
        if (Object.keys(panelUpdates).length === 0 && newBrand === null && newEstimatedDelivery === null) {
            setEditError('No changes to save');
            setEditingRowId(null);
            setEditedRowData(null);
            setTimeout(() => setEditError(null), 3000);
            return;
        }

        // ---- Attempt updates ----
        let updateError = null;

        if (Object.keys(panelUpdates).length > 0) {
            try {
                await viewPanelAPI.update(editingRowId, panelUpdates);
                setPanels(prev => prev.map(p =>
                    p.id === editingRowId ? { ...p, ...panelUpdates } : p
                ));
            } catch (err) {
                updateError = 'Failed to update panel: ' + (err.message || 'Unknown error');
            }
        }

        if (!updateError && (newBrand !== null || newEstimatedDelivery !== null)) {
            try {
                const allRecords = await productionAPI.getAll();
                const panelRecords = allRecords.filter(r => r.panel_id === editingRowId);

                if (panelRecords.length === 0) {
                    updateError = 'No production records found – changes not applied.';
                } else {
                    const productionUpdates = {};
                    if (newBrand !== null) productionUpdates.brand = newBrand;
                    if (newEstimatedDelivery !== null) productionUpdates.estimated_delivery = newEstimatedDelivery;

                    for (const record of panelRecords) {
                        await productionAPI.update(editingRowId, record.id, productionUpdates);
                    }
                    await fetchAllProductionRecords();
                    setEditSuccess('Panel and production records updated successfully.');
                }
            } catch (err) {
                updateError = 'Failed to update production records: ' + (err.message || 'Unknown error');
            }
        }

        // ---- ALWAYS clear edit mode after a save attempt ----
        setEditingRowId(null);
        setEditedRowData(null);

        // Show error or success
        if (updateError) {
            setEditError(updateError);
            setTimeout(() => setEditError(null), 4000);
        } else if (!editSuccess) {
            setEditSuccess('Update successful');
            setTimeout(() => setEditSuccess(null), 3000);
        }
    };

    const handleCancelEdit = () => {
        setEditingRowId(null);
        setEditedRowData(null);
        setEditError(null);
        setEditSuccess(null);
    };

    const handleAddNewPanel = (job) => {
        const initialNewRow = {};
        jobOverviewColumns.forEach(col => {
            if (col.type !== 'computed' && col.key !== 'prod') {
                if (col.key === 'job_no') initialNewRow.job_no = job;
                else initialNewRow[col.key] = '';
            }
        });
        setNewRowData(initialNewRow);
        setIsAddingNew(true);
    };

    const handleSaveNewPanel = async () => {
        if (!newRowData) return;
        let jobNo = newRowData.job_no?.trim();
        if (!jobNo) {
            setEditError('Job No is required');
            return;
        }
        if (!newRowData.width || !newRowData.length) {
            setEditError('Width and Length are required');
            return;
        }

        try {
            setEditError(null);
            const existingRefs = panels.map(p => p.reference_number);
            const referenceNumber = generateReferenceNumber(existingRefs);

            const panelData = {
                ...newRowData,
                job_no: jobNo,
                reference_number: referenceNumber,
                width: newRowData.width ? parseFloat(newRowData.width) : 0,
                length: newRowData.length ? parseFloat(newRowData.length) : 0,
                qty: newRowData.qty ? parseInt(newRowData.qty) : null,
                estimated_delivery: newRowData.estimated_delivery ? convertToISOString(newRowData.estimated_delivery) : null,
                created_at: newRowData.created_at ? convertToISOString(newRowData.created_at) : null,
                brand: newRowData.brand || ''
            };

            Object.keys(panelData).forEach(key => {
                if (panelData[key] === '') panelData[key] = null;
            });

            const createdPanel = await viewPanelAPI.create(panelData);
            setPanels(prev => [{ ...createdPanel, produced: 0, remaining: parseInt(createdPanel.qty) || 0 }, ...prev]);
            setEditSuccess('Panel created successfully');
            setIsAddingNew(false);
            setNewRowData(null);
        } catch (err) {
            console.error('Failed to create panel:', err);
            setEditError('Failed to create panel: ' + (err.message || 'Unknown error'));
        }
    };

    const onCancelNewPanel = () => {
        setIsAddingNew(false);
        setNewRowData(null);
    };

    const handleDeleteAllByJob = async (job) => {
        const jobNo = typeof job === 'object' ? job.job : job;
        if (!jobNo) return;
        const jobPanels = panels.filter(p => p.job_no === jobNo);
        if (jobPanels.length === 0) return;
        if (!window.confirm(`Are you sure you want to delete ALL ${jobPanels.length} panels for job "${jobNo}"? This action cannot be undone.`)) {
            return;
        }
        try {
            await viewPanelAPI.deleteByJob(jobNo);
            setPanels(prev => prev.filter(p => p.job_no !== jobNo));
            await fetchAllProductionRecords();
            setSuccess(`All panels for job ${jobNo} deleted successfully.`);
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error('Failed to delete panels by job:', err);
            setError('Failed to delete panels: ' + (err.message || 'Unknown error'));
            await fetchPanels();
        }
    };

    const defaultPanelValues = {
        job_no: '',
        application: '',
        type: 'PIR',
        panel_thk: '100',
        joint: 'Clip Joint',
        surface_front: 'PPGI',
        surface_back: 'PPGI',
        surface_front_thk: '0.5',
        surface_back_thk: '0.5',
        surface_type: 'RIB',
        width: '1150',
        length: '3000',
        qty: '',
        cutting: '',
        production_meter: '',
        salesman: '',
        brand: '',
        estimated_delivery: '',
        created_at: '',
        notes: ''
    };

    const [newPanel, setNewPanel] = useState({...defaultPanelValues});

    useEffect(() => {
        localStorage.setItem('panelTableColumns', JSON.stringify(columns));
    }, [columns]);

    useEffect(() => {
        fetchPanels();
        fetchAllProductionRecords();
        fetchProductionReferences();
        fetchAllProjects();
    }, []);

    // Reset page when filters or view changes
    useEffect(() => {
        setCurrentPage(1);
    }, [filters, activeView]);

    useEffect(() => {
        if (productionMeterDate) {
            calculateDailyProductionMeter();
        } else {
            setDailyProductionMeter({
                totalMeter: 0,
                panelCount: 0,
                totalMeterInMeters: 0,
                estimatedTimeMinutes: 0,
                estimatedTimeHours: 0,
                estimatedTimeRemainingMinutes: 0
            });
        }
    }, [productionMeterDate, allProductionRecords, estimatedRunningSpeed]);

    const getCustomerByJobNo = (jobNo) => {
        if (!jobNo) return null;
        return allProjects.find(p => p.project_no === jobNo || p.job_no === jobNo || p.projectNo === jobNo) || null;
    };

    useEffect(() => {
        if (allProjects.length > 0 && panels.length > 0) {
            const customerMap = {};
            allProjects.forEach(proj => {
                const jobNo = proj.projectNo || proj.project_no || proj.job_no;
                if (jobNo) customerMap[jobNo] = proj.customer || '';
            });
            const needsUpdate = panels.some(p => p.customer === undefined);
            if (needsUpdate) {
                setPanels(prev => prev.map(p => ({
                    ...p,
                    customer: customerMap[p.job_no] || ''
                })));
            }
        }
    }, [allProjects, panels]);

    useEffect(() => {
        const getUnique = (key, isNumeric = false, isDate = false) => {
            const values = panels
                .map(panel => {
                    const value = panel[key];
                    if (value === null || value === undefined || value === '') return null;
                    if (isNumeric) {
                        const numValue = parseFloat(value);
                        return isNaN(numValue) ? null : numValue.toString();
                    }
                    if (isDate) {
                        try {
                            const date = new Date(value);
                            if (isNaN(date.getTime())) return null;
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            return `${year}-${month}-${day}`;
                        } catch { return null; }
                    }
                    return value.toString().trim();
                })
                .filter(p => p);
            const unique = [...new Set(values)];
            if (isNumeric) return unique.sort((a, b) => parseFloat(a) - parseFloat(b));
            if (isDate) return unique.sort((a, b) => new Date(b) - new Date(a));
            return unique.sort();
        };

        setUniqueValues({
            jobNos: getUnique('job_no'),
            types: getUnique('type'),
            salesmen: getUnique('salesman'),
            panelThks: getUnique('panel_thk', true),
            joints: getUnique('joint'),
            surfaceFronts: getUnique('surface_front'),
            surfaceBacks: getUnique('surface_back'),
            surfaceFrontThks: getUnique('surface_front_thk', true),
            surfaceBackThks: getUnique('surface_back_thk', true),
            surfaceTypes: getUnique('surface_type'),
            widths: getUnique('width', true),
            lengths: getUnique('length', true),
            qtys: getUnique('qty', true),
            cuttings: getUnique('cutting'),
            applications: getUnique('application'),
            createdDates: getUnique('created_at', false, true),
            estimatedDeliveries: getUnique('estimated_delivery', false, true),
            referenceNumbers: getUnique('reference_number'),
            brands: getUnique('brand')
        });
    }, [panels]);

    const handleWheel = (e) => e.target.blur();

    const calculateDailyProductionMeter = () => {
        if (!productionMeterDate) return;
        try {
            let totalMeterMM = 0;
            let panelCount = 0;
            const dateStr = productionMeterDate;

            allProductionRecords.forEach(record => {
                if (!record.created_at) return;
                const recordDate = new Date(record.created_at);
                const year = recordDate.getFullYear();
                const month = String(recordDate.getMonth() + 1).padStart(2, '0');
                const day = String(recordDate.getDate()).padStart(2, '0');
                const localDateStr = `${year}-${month}-${day}`;

                if (localDateStr === dateStr) {
                    const panelsProduced = parseInt(record.number_of_panels) || 0;
                    const length = parseFloat(record.panel?.length) ||
                                parseFloat(record.panel_length) ||
                                parseFloat(record.length) ||
                                0;
                    totalMeterMM += length * panelsProduced;
                    panelCount += panelsProduced;
                }
            });

            const totalMeterInMeters = totalMeterMM / 1000;
            const estimatedTimeMinutes = estimatedRunningSpeed > 0 ? totalMeterInMeters / estimatedRunningSpeed : 0;
            const estimatedTimeHours = Math.floor(estimatedTimeMinutes / 60);
            const estimatedTimeRemainingMinutes = Math.round(estimatedTimeMinutes % 60);

            setDailyProductionMeter({
                totalMeter: totalMeterMM,
                panelCount,
                totalMeterInMeters,
                estimatedTimeMinutes,
                estimatedTimeHours,
                estimatedTimeRemainingMinutes
            });
        } catch (err) {
            console.error('Failed to calculate daily production meter:', err);
            setDailyProductionMeter({
                totalMeter: 0,
                panelCount: 0,
                totalMeterInMeters: 0,
                estimatedTimeMinutes: 0,
                estimatedTimeHours: 0,
                estimatedTimeRemainingMinutes: 0
            });
        }
    };

    const openDuplicateModal = (panel) => { setSelectedPanelToDuplicate(panel); setNumberOfCopies(1); setIsDuplicateModalOpen(true); };
    const closeDuplicateModal = () => { setIsDuplicateModalOpen(false); setSelectedPanelToDuplicate(null); setNumberOfCopies(1); };

    const handleDuplicatePanel = async (panel, count = 1) => {
        try {
            const existingRefs = panels.map(p => p.reference_number);
            const baseDate = new Date();
            const year = baseDate.getFullYear().toString().slice(-2);
            const month = String(baseDate.getMonth() + 1).padStart(2, '0');
            const day = String(baseDate.getDate()).padStart(2, '0');
            const todayPrefix = `REF-${year}${month}${day}`;
            let maxSequence = 0;
            const todayRefs = existingRefs.filter(ref => ref && ref.startsWith(todayPrefix));
            if (todayRefs.length > 0) {
                const sequences = todayRefs.map(ref => { const match = ref.match(/\d+$/); return match ? parseInt(match[0]) : 0; });
                maxSequence = Math.max(...sequences);
            }
            const referenceNumbers = [];
            for (let i = 1; i <= count; i++) {
                const sequence = maxSequence + i;
                referenceNumbers.push(`${todayPrefix}-${String(sequence).padStart(3, '0')}`);
            }
            const newPanels = [];
            for (let i = 0; i < count; i++) {
                const originalJobNo = panel.job_no || '';
                const newJobNo = originalJobNo;
                const originalNotes = panel.notes || '';
                const newNotes = originalNotes ? `${originalNotes}\n\n---\nDuplicate of ${panel.reference_number}` : `Duplicate of ${panel.reference_number}`;
                let formattedEstimatedDelivery = null;
                if (panel.estimated_delivery) {
                    try { const date = new Date(panel.estimated_delivery); if (!isNaN(date.getTime())) { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); formattedEstimatedDelivery = `${year}-${month}-${day}`; } }
                    catch (error) { formattedEstimatedDelivery = null; }
                }
                let formattedCreatedAt = null;
                if (panel.created_at) formattedCreatedAt = formatDateForInput(panel.created_at);
                const panelData = {
                    job_no: newJobNo,
                    application: panel.application || null,
                    type: panel.type || null,
                    panel_thk: panel.panel_thk ? parseFloat(panel.panel_thk) : null,
                    joint: panel.joint || null,
                    surface_front: panel.surface_front || null,
                    surface_back: panel.surface_back || null,
                    surface_front_thk: panel.surface_front_thk ? parseFloat(panel.surface_front_thk) : null,
                    surface_back_thk: panel.surface_back_thk ? parseFloat(panel.surface_back_thk) : null,
                    surface_type: panel.surface_type || null,
                    width: panel.width ? parseFloat(panel.width) : 0,
                    length: panel.length ? parseFloat(panel.length) : 0,
                    qty: panel.qty ? parseInt(panel.qty) : null,
                    cutting: panel.cutting || null,
                    production_meter: panel.production_meter ? parseFloat(panel.production_meter) : null,
                    salesman: panel.salesman || null,
                    brand: panel.brand || '',
                    notes: newNotes,
                    reference_number: referenceNumbers[i],
                    estimated_delivery: formattedEstimatedDelivery,
                    created_at: formattedCreatedAt ? convertToISOString(formattedCreatedAt) : null
                };
                Object.keys(panelData).forEach(key => { if (panelData[key] === '' || panelData[key] === undefined) panelData[key] = null; });
                const createdPanel = await viewPanelAPI.create(panelData);
                newPanels.push({ ...createdPanel, produced: 0, remaining: parseInt(createdPanel.qty) || 0 });
            }
            setPanels(prev => [...newPanels, ...prev]);
            closeDuplicateModal();
            setError(null);
            if (count === 1) alert(`Panel duplicated successfully! New reference: ${referenceNumbers[0]}`);
            else alert(`Successfully created ${count} copies! References: ${referenceNumbers.join(', ')}`);
        } catch (err) { console.error('Failed to duplicate panel:', err); setError('Failed to duplicate panel: ' + (err.message || 'Unknown error')); }
    };

    const calculateArea = (width, length, quantity) => {
        const w = parseFloat(width) || 0;
        const l = parseFloat(length) || 0;
        const q = parseInt(quantity) || 0;
        if (w <= 0 || l <= 0) return 0;
        return (w * l * q);
    };

    const handleDuplicateFromCreateForm = async () => {
        if (!newPanel.job_no?.trim()) { setError('Job No is required'); return; }
        if (!newPanel.width || !newPanel.length) { setError('Width and Length are required'); return; }
        const count = duplicateFormCopies || 1;
        try {
            const existingRefs = panels.map(p => p.reference_number);
            const baseDate = new Date();
            const year = baseDate.getFullYear().toString().slice(-2);
            const month = String(baseDate.getMonth() + 1).padStart(2, '0');
            const day = String(baseDate.getDate()).padStart(2, '0');
            const todayPrefix = `REF-${year}${month}${day}`;
            let maxSequence = 0;
            const todayRefs = existingRefs.filter(ref => ref && ref.startsWith(todayPrefix));
            if (todayRefs.length > 0) {
                const sequences = todayRefs.map(ref => { const match = ref.match(/\d+$/); return match ? parseInt(match[0]) : 0; });
                maxSequence = Math.max(...sequences);
            }
            const referenceNumbers = [];
            for (let i = 1; i <= count; i++) {
                const sequence = maxSequence + i;
                referenceNumbers.push(`${todayPrefix}-${String(sequence).padStart(3, '0')}`);
            }
            const newPanels = [];
            for (let i = 0; i < count; i++) {
                const originalJobNo = newPanel.job_no || '';
                const newJobNo = originalJobNo;
                const originalNotes = newPanel.notes || '';
                const newNotes = originalNotes ? `${originalNotes}\n\n---\nCreated from form` : `Created from form`;
                const panelData = {
                    job_no: newJobNo,
                    application: newPanel.application || null,
                    type: newPanel.type || null,
                    panel_thk: newPanel.panel_thk ? parseFloat(newPanel.panel_thk) : null,
                    joint: newPanel.joint || null,
                    surface_front: newPanel.surface_front || null,
                    surface_back: newPanel.surface_back || null,
                    surface_front_thk: newPanel.surface_front_thk ? parseFloat(newPanel.surface_front_thk) : null,
                    surface_back_thk: newPanel.surface_back_thk ? parseFloat(newPanel.surface_back_thk) : null,
                    surface_type: newPanel.surface_type || null,
                    width: newPanel.width ? parseFloat(newPanel.width) : 0,
                    length: newPanel.length ? parseFloat(newPanel.length) : 0,
                    qty: newPanel.qty ? parseInt(newPanel.qty) : null,
                    cutting: newPanel.cutting || null,
                    production_meter: newPanel.production_meter ? parseFloat(newPanel.production_meter) : null,
                    salesman: newPanel.salesman || null,
                    brand: newPanel.brand || '',
                    notes: newNotes,
                    reference_number: referenceNumbers[i],
                    estimated_delivery: newPanel.estimated_delivery || null,
                    created_at: newPanel.created_at ? convertToISOString(newPanel.created_at) : null
                };
                Object.keys(panelData).forEach(key => { if (panelData[key] === '' || panelData[key] === undefined) panelData[key] = null; });
                const createdPanel = await viewPanelAPI.create(panelData);
                newPanels.push({ ...createdPanel, produced: 0, remaining: parseInt(createdPanel.qty) || 0 });
            }
            setPanels(prev => [...newPanels, ...prev]);
            setIsCreateFormDuplicateModalOpen(false);
            setNewPanel({...defaultPanelValues});
            setError(null);
            if (count === 1) setSuccess(`Panel duplicated successfully! New reference: ${referenceNumbers[0]}`);
            else setSuccess(`Successfully created ${count} copies! References: ${referenceNumbers.join(', ')}`);
            setTimeout(() => setSuccess(null), 5000);
        } catch (err) { console.error('Failed to duplicate from form:', err); setError('Failed to duplicate from form: ' + (err.message || 'Unknown error')); }
    };

    const handleDuplicateInCreateModal = () => { setIsCreateFormDuplicateModalOpen(true); setDuplicateFormCopies(1); setError(null); };

    const filteredPanels = useMemo(() => {
        let filtered = panels.filter(panel => {
            if (!panel || !panel.id) return false;
            if (filters.search) {
                const lower = filters.search.toLowerCase();
                const fields = [panel.reference_number, panel.job_no?.toString(), panel.type, panel.salesman, panel.joint,
                    panel.surface_front, panel.surface_back, panel.surface_type, panel.cutting, panel.application, panel.brand];
                if (!fields.some(f => f && f.toString().toLowerCase().includes(lower))) return false;
            }
            if (filters.reference_number && !panel.reference_number?.toLowerCase().includes(filters.reference_number.toLowerCase())) return false;
            if (filters.job_no && !panel.job_no?.toString().toLowerCase().includes(filters.job_no.toLowerCase())) return false;
            if (filters.customer && !panel.customer?.toLowerCase().includes(filters.customer.toLowerCase())) return false;
            if (filters.type && panel.type !== filters.type) return false;
            if (filters.panel_thk) { const pthk = parseFloat(panel.panel_thk) || 0; const fthk = parseFloat(filters.panel_thk); if (pthk !== fthk) return false; }
            if (filters.joint && panel.joint !== filters.joint) return false;
            if (filters.surface_front && panel.surface_front !== filters.surface_front) return false;
            if (filters.surface_back && panel.surface_back !== filters.surface_back) return false;
            if (filters.surface_front_thk) { const pft = parseFloat(panel.surface_front_thk) || 0; const fft = parseFloat(filters.surface_front_thk); if (pft !== fft) return false; }
            if (filters.surface_back_thk) { const pbt = parseFloat(panel.surface_back_thk) || 0; const fbt = parseFloat(filters.surface_back_thk); if (pbt !== fbt) return false; }
            if (filters.surface_type && panel.surface_type !== filters.surface_type) return false;
            if (filters.cutting && panel.cutting !== filters.cutting) return false;
            if (filters.brand && panel.brand !== filters.brand) return false;
            if (filters.width) { const pw = parseFloat(panel.width) || 0; const fw = parseFloat(filters.width); if (pw !== fw) return false; }
            if (filters.length) { const pl = parseFloat(panel.length) || 0; const fl = parseFloat(filters.length); if (pl !== fl) return false; }
            if (filters.qty) { const pq = parseInt(panel.qty) || 0; const fq = parseInt(filters.qty); if (pq !== fq) return false; }
            return true;
        });

        filtered.sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];
            if (['job_no', 'width', 'length', 'surface_front_thk', 'surface_back_thk', 'panel_thk', 'qty', 'production_meter', 'produced', 'remaining'].includes(sortConfig.key)) {
                aVal = parseFloat(aVal) || 0;
                bVal = parseFloat(bVal) || 0;
            }
            if (sortConfig.key === 'created_at' || sortConfig.key === 'estimated_delivery') {
                aVal = new Date(aVal || 0).getTime();
                bVal = new Date(bVal || 0).getTime();
            }
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return filtered;
    }, [panels, filters, sortConfig]);

    // ============================================================
    // 🚀 PAGINATION COMPUTATIONS
    // ============================================================
    const totalPages = Math.ceil(filteredPanels.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedPanels = filteredPanels.slice(startIndex, endIndex);

    const goToPage = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const groupedPanels = useMemo(() => {
        const groups = {};
        paginatedPanels.forEach(panel => {
            const job = panel.job_no || 'No Job Number';
            if (!groups[job]) groups[job] = [];
            groups[job].push(panel);
        });
        return Object.keys(groups).sort().map(job => ({
            job,
            panels: groups[job]
        }));
    }, [paginatedPanels]);

    const visibleColumns = useMemo(() => {
        return columns
            .filter(col => col.visible || col.alwaysVisible)
            .sort((a, b) => a.order - b.order);
    }, [columns]);

    const toggleColumnVisibility = (columnId) => {
        setColumns(prev => prev.map(col => col.id === columnId ? { ...col, visible: !col.visible } : col));
    };

    const moveColumn = (columnId, direction) => {
        setColumns(prev => {
            const newColumns = [...prev];
            const index = newColumns.findIndex(col => col.id === columnId);
            if (direction === 'up' && index > 0) {
                [newColumns[index], newColumns[index - 1]] = [newColumns[index - 1], newColumns[index]];
            } else if (direction === 'down' && index < newColumns.length - 1) {
                [newColumns[index], newColumns[index + 1]] = [newColumns[index + 1], newColumns[index]];
            }
            return newColumns.map((col, idx) => ({ ...col, order: idx + 1 }));
        });
    };

    const resetToDefaultColumns = () => setColumns(defaultColumns);
    const selectAllColumns = () => setColumns(prev => prev.map(col => ({ ...col, visible: true })));
    const deselectAllColumns = () => setColumns(prev => prev.map(col => ({ ...col, visible: col.alwaysVisible ? true : false })));

    const handleEditInputChange = (e) => { const { name, value } = e.target; setEditingPanel(prev => ({ ...prev, [name]: value })); };
    const handleNewPanelInputChange = (e) => { const { name, value } = e.target; setNewPanel(prev => ({ ...prev, [name]: value })); };
    const handleFilterChange = (e) => { const { name, value } = e.target; setFilters(prev => ({ ...prev, [name]: value })); };
    const handleProductionMeterDateChange = (e) => setProductionMeterDate(e.target.value);
    const handleSearchChange = (e) => setFilters(prev => ({ ...prev, search: e.target.value }));
    const handleSort = (key) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));

    const handleUpdatePanel = async (e) => {
        e.preventDefault();
        if (!editingPanel.job_no?.trim()) { setError('Job No is required'); return; }
        if (!editingPanel.width || !editingPanel.length) { setError('Width and Length are required'); return; }
        try {
            const panelToUpdate = {
                ...editingPanel,
                width: editingPanel.width ? parseFloat(editingPanel.width) : 0,
                length: editingPanel.length ? parseFloat(editingPanel.length) : 0,
                surface_front_thk: editingPanel.surface_front_thk ? parseFloat(editingPanel.surface_front_thk) : null,
                surface_back_thk: editingPanel.surface_back_thk ? parseFloat(editingPanel.surface_back_thk) : null,
                panel_thk: editingPanel.panel_thk ? parseFloat(editingPanel.panel_thk) : null,
                qty: editingPanel.qty ? parseInt(editingPanel.qty) : null,
                production_meter: editingPanel.production_meter ? parseFloat(editingPanel.production_meter) : null,
                salesman: editingPanel.salesman || null,
                brand: editingPanel.brand || null,
                notes: editingPanel.notes || null,
                application: editingPanel.application || null,
                estimated_delivery: convertToISOString(editingPanel.estimated_delivery),
                created_at: editingPanel.created_at ? convertToISOString(editingPanel.created_at) : null
            };
            Object.keys(panelToUpdate).forEach(key => { if (panelToUpdate[key] === '') panelToUpdate[key] = null; });
            const updatedPanel = await viewPanelAPI.update(editingPanel.id, panelToUpdate);
            setPanels(prev => prev.map(p => p.id === updatedPanel.id ? { ...updatedPanel, produced: p.produced || 0, remaining: Math.max(0, (parseInt(updatedPanel.qty) || 0) - (p.produced || 0)) } : p));
            setIsEditModalOpen(false); setEditingPanel(null); setError(null); setSuccess('Panel updated successfully!'); setTimeout(() => setSuccess(null), 3000);
        } catch (err) { console.error('Failed to update panel:', err); setError('Failed to update panel: ' + (err.message || 'Unknown error')); }
    };

    const handleCreatePanel = async (e) => {
        e.preventDefault();
        if (!newPanel.job_no?.trim()) { setError('Job No is required'); return; }
        if (!newPanel.width || !newPanel.length) { setError('Width and Length are required'); return; }
        try {
            const existingRefs = panels.map(p => p.reference_number);
            const referenceNumber = generateReferenceNumber(existingRefs);
            const panelData = {
                ...newPanel, reference_number: referenceNumber,
                width: newPanel.width ? parseFloat(newPanel.width) : 0,
                length: newPanel.length ? parseFloat(newPanel.length) : 0,
                surface_front_thk: newPanel.surface_front_thk ? parseFloat(newPanel.surface_front_thk) : null,
                surface_back_thk: newPanel.surface_back_thk ? parseFloat(newPanel.surface_back_thk) : null,
                panel_thk: newPanel.panel_thk ? parseFloat(newPanel.panel_thk) : null,
                qty: newPanel.qty ? parseInt(newPanel.qty) : null,
                production_meter: newPanel.production_meter ? parseFloat(newPanel.production_meter) : null,
                salesman: newPanel.salesman || null,
                brand: newPanel.brand || null,
                notes: newPanel.notes || null,
                estimated_delivery: convertToISOString(newPanel.estimated_delivery),
                created_at: newPanel.created_at ? convertToISOString(newPanel.created_at) : null,
                application: newPanel.application || null
            };
            Object.keys(panelData).forEach(key => { if (panelData[key] === '') panelData[key] = null; });
            const createdPanel = await viewPanelAPI.create(panelData);
            setPanels(prev => [{ ...createdPanel, produced: 0, remaining: parseInt(createdPanel.qty) || 0 }, ...prev]);
            setSuccess(`Panel created successfully! Reference: ${referenceNumber}`); setError(null);
            setNewPanel({...defaultPanelValues});
            setTimeout(() => { const firstInput = createModalRef.current?.querySelector('input, select, textarea'); if (firstInput) firstInput.focus(); }, 100);
        } catch (err) { console.error('Failed to create panel:', err); setError('Failed to create panel: ' + (err.message || 'Unknown error')); }
    };

    const handleResetForm = () => { setNewPanel({...defaultPanelValues}); setError(null); setSuccess('Form reset to default values.'); setTimeout(() => { const firstInput = createModalRef.current?.querySelector('input, select, textarea'); if (firstInput) firstInput.focus(); }, 100); };

    const handleDeletePanel = async (id) => {
        if (!window.confirm('Are you sure you want to delete this panel? All production records will also be deleted.')) return;
        try {
            await viewPanelAPI.delete(id);
            setPanels(prev => prev.filter(panel => panel.id !== id));
            await fetchAllProductionRecords();
            setSuccess('Panel deleted successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            console.error('Failed to delete panel:', err);
            setError('Failed to delete panel: ' + (err.message || 'Unknown error'));
        }
    };

    const openProductionModal = (panel) => setSelectedPanelForProduction(panel);
    const closeProductionModal = () => setSelectedPanelForProduction(null);
    const openEditModal = (panel) => {
        if (onCloseAiSidebar) {
            onCloseAiSidebar();
        }
         setEditingPanel({ ...panel, job_no: panel.job_no || '', application: panel.application || '', type: panel.type || '',
            panel_thk: panel.panel_thk || '', joint: panel.joint || '', surface_front: panel.surface_front || '',
            surface_back: panel.surface_back || '', surface_front_thk: panel.surface_front_thk || '',
            surface_back_thk: panel.surface_back_thk || '', surface_type: panel.surface_type || '',
            width: panel.width || '', length: panel.length || '', qty: panel.qty || '', cutting: panel.cutting || '',
            production_meter: panel.production_meter || '',
            estimated_delivery: formatDateForInput(panel.estimated_delivery) || '',
            created_at: formatDateForInput(panel.created_at) || '', salesman: panel.salesman || '',
            brand: panel.brand || '',
            notes: panel.notes || '' });
        setIsEditModalOpen(true);
        setError(null);

    };
    const openCreateModal = () => { setIsCreateModalOpen(true); setError(null); setSuccess(null); setNewPanel({...defaultPanelValues}); };
    const closeEditModal = () => { setIsEditModalOpen(false); setEditingPanel(null); setError(null); };
    const closeCreateModal = () => { setIsCreateModalOpen(false); setNewPanel({...defaultPanelValues}); setError(null); setSuccess(null); };

    const formatDate = (dateString) => {
        if (!dateString) return 'null';
        if (typeof dateString === 'string' && dateString.includes('T')) {
            return dateString.split('T')[0];
        }
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Invalid date';
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch {
            return 'Invalid date';
        }
    };

    const formatNumber = (num) => {
        if (num === null || num === undefined || num === '') return 'null';
        const number = parseFloat(num);
        if (isNaN(number)) return 'null';
        return number.toLocaleString('en-US');
    };

    const handlePrint = (specificPanel = null) => {
        try {
            const printWindow = window.open('', '_blank');
            if (!printWindow) { alert('Please allow popups to print the table'); return; }
            let panelsToPrint = specificPanel ? [specificPanel] : filteredPanels;
            const printContent = `<!DOCTYPE html><html><head><title>Panels Report - ${new Date().toLocaleDateString()}</title><style>@media print{@page{size:landscape;margin:10mm;}body{font-family:Arial,sans-serif;font-size:10pt;margin:0;padding:0;}table{width:100%;border-collapse:collapse;table-layout:auto;}th,td{border:1px solid #000;padding:4px 6px;text-align:left;font-size:9pt;vertical-align:top;word-wrap:break-word;max-width:80px;overflow-wrap:break-word;}th{background-color:#f2f2f2;font-weight:bold;}.no-print{display:none!important;}.print-header{text-align:center;margin-bottom:15px;border-bottom:2px solid #000;padding-bottom:10px;}.print-title{font-size:16pt;font-weight:bold;margin-bottom:5px;}.print-subtitle{font-size:11pt;color:#666;margin-bottom:10px;}.print-summary{margin-bottom:15px;font-size:10pt;}.total-area{font-weight:bold;margin-top:10px;border-top:1px solid #000;padding-top:5px;}.page-break{page-break-before:always;}.panel-row:nth-child(even){background-color:#f9f9f9;}}@media screen{body{font-family:Arial,sans-serif;font-size:12px;padding:20px;}.no-screen{display:none;}}</style></head><body><div class="print-header"><div class="print-title">Panel Management System - Report</div><div class="print-subtitle">Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</div><div class="print-summary">Total Panels: ${panelsToPrint.length} | Printed: ${specificPanel ? 'Single Panel' : 'Filtered List'} | Printed by: ${localStorage.getItem('username') || 'System User'}</div></div><table><thead><tr><th>Ref No</th><th>Job No</th><th>Type</th><th>Panel Thk</th><th>Joint</th><th>Front</th><th>Back</th><th>Front Thk</th><th>Back Thk</th><th>Finish</th><th>Width</th><th>Length</th><th>Person</th><th>Applic</th><th>Area</th><th>Qty</th><th>Cutting</th><th>Brand</th><th>Produced</th><th>Meter</th><th>Remain</th><th>Remain M</th><th>Date</th><th>Delivery</th></tr></thead><tbody>${panelsToPrint.map((panel, index) => { const qty = parseInt(panel.qty) || 0; const produced = panel.produced || 0; const remaining = qty - produced; const length = parseFloat(panel.length) || 0; const width = parseFloat(panel.width) || 0; const area = calculateArea(width, length, qty) / 1000000; const prodMeter = produced * length; const remainingMeter = remaining * length; return `<tr class="panel-row"><td>${panel.reference_number || 'N/A'}</td><td>${panel.job_no || 'N/A'}</td><td>${panel.type || 'N/A'}</td><td>${panel.panel_thk ? formatNumber(panel.panel_thk) : 'null'}</td><td>${panel.joint || 'null'}</td><td>${panel.surface_front || 'null'}</td><td>${panel.surface_back || 'null'}</td><td>${panel.surface_front_thk ? formatNumber(panel.surface_front_thk) : 'null'}</td><td>${panel.surface_back_thk ? formatNumber(panel.surface_back_thk) : 'null'}</td><td>${panel.surface_type || 'null'}</td><td>${panel.width ? formatNumber(panel.width) : 'null'}</td><td>${panel.length ? formatNumber(panel.length) : 'null'}</td><td>${panel.salesman || 'null'}</td><td>${panel.application || 'null'}</td><td>${area > 0 ? area.toFixed(3) : '0'}</td><td>${formatNumber(panel.qty)}</td><td>${panel.cutting || 'null'}</td><td>${panel.brand || 'null'}</td><td>${produced}</td><td>${prodMeter.toFixed(2)}</td><td>${remaining}</td><td>${remainingMeter.toFixed(2)}</td><td>${formatDate(panel.created_at)}</td><td>${formatDate(panel.estimated_delivery)}</td></tr>`; }).join('')}</tbody></table><div style="text-align:center; margin-top:20px; font-size:9pt; color:#666;" class="no-print"><p>--- End of Report ---</p></div></body></html>`;
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.onload = function() { setTimeout(() => { printWindow.focus(); printWindow.print(); }, 500); };
        } catch (error) { console.error('Error printing:', error); alert('Error generating print document. Please try again.'); }
    };

    const handlePrintWithColumns = (selectedKeys) => {
        handlePrint();
    };

    const PRINTABLE_COLUMNS = [
        { key: 'reference_number', label: 'Ref No' },
        { key: 'job_no', label: 'Job No' },
        { key: 'type', label: 'Type' },
        { key: 'panel_thk', label: 'Thk' },
        { key: 'joint', label: 'Joint' },
        { key: 'surface_front', label: 'Front' },
        { key: 'surface_back', label: 'Back' },
        { key: 'surface_front_thk', label: 'Fr Thk' },
        { key: 'surface_back_thk', label: 'Bk Thk' },
        { key: 'surface_type', label: 'Finish' },
        { key: 'width', label: 'Width' },
        { key: 'length', label: 'Length' },
        { key: 'salesman', label: 'Person' },
        { key: 'application', label: 'Applic' },
        { key: 'area', label: 'Area' },
        { key: 'qty', label: 'Qty' },
        { key: 'cutting', label: 'Cutting' },
        { key: 'brand', label: 'Brand' },
        { key: 'produced', label: 'Produced' },
        { key: 'production_meter', label: 'Meter' },
        { key: 'remaining', label: 'Remain' },
        { key: 'remaining_meter', label: 'Remain M' },
        { key: 'created_at', label: 'Date' },
        { key: 'estimated_delivery', label: 'Delivery' }
    ];

    useEffect(() => {
        setSelectedPrintColumns(PRINTABLE_COLUMNS.map(col => col.key));
    }, []);

    const toggleGroup = (job) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(job)) {
                newSet.delete(job);
            } else {
                newSet.add(job);
            }
            return newSet;
        });
    };

    const jobOverviewFilteredColumns = jobOverviewColumns;

    return (
        <div className="view-panel-container">
            <header className="page-header">
                <div className="header-left">
                    <button
                        className="back-btn"
                        onClick={() => {
                            if (onBack) {
                                onBack();
                            } else {
                                navigate(-1);
                            }
                        }}
                    >
                        ← Back
                    </button>
                    <h1 className="header-title">Panel Management System</h1>
                </div>
            </header>

            {success && <div className="alert alert-success global-success">{success}</div>}

            <div className="view-toggle-buttons" style={{ display: 'flex', justifyContent: 'center', gap: '1rem', margin: '1rem 0' }}>
                <button
                    className={`btn btn-primary ${activeView === 'table' ? 'active' : ''}`}
                    onClick={() => setActiveView('table')}
                >
                    Click Here To View All The Panel
                </button>
                <button
                    className={`btn btn-secondary ${activeView === 'productionMeter' ? 'active' : ''}`}
                    onClick={() => setActiveView('productionMeter')}
                >
                    Check Production Meter By Date
                </button>
            </div>

            {activeView === 'productionMeter' && (
                <div className="daily-production-meter-section">
                    <div className="production-meter-container">
                        <h3>Daily Production Meter</h3>
                        <div className="meter-controls">
                            <div className="form-group">
                                <label>Select Date:</label>
                                <input type="date" value={productionMeterDate} onChange={handleProductionMeterDateChange} className="form-input" />
                            </div>
                            <div className="form-group">
                                <label>Running Speed (m/min):</label>
                                <input type="number" step="0.1" value={estimatedRunningSpeed} onChange={(e) => setEstimatedRunningSpeed(parseFloat(e.target.value) || 4.8)} className="form-input" />
                            </div>
                        </div>
                        {productionMeterDate && (
                            <div className="meter-stats">
                                <div className="stat-item">
                                    <span className="stat-label">Total Production Meter:</span>
                                    <span className="stat-value">{dailyProductionMeter.totalMeterInMeters.toFixed(2)} m</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Panels Produced:</span>
                                    <span className="stat-value">{dailyProductionMeter.panelCount}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-label">Estimated Time:</span>
                                    <span className="stat-value">{dailyProductionMeter.estimatedTimeHours}h {dailyProductionMeter.estimatedTimeRemainingMinutes}m</span>
                                </div>
                            </div>
                        )}
                        {productionMeterDate && dailyProductionMeter.panelCount === 0 && (
                            <div className="empty-state"><p>No production records found for this date.</p></div>
                        )}
                    </div>
                </div>
            )}

            {activeView === 'table' && (
                <div className="table-container" ref={tableContainerRef} style={{ width: '100%', maxWidth: '100%', overflow: 'visible' }}>
                    {error && <div className="alert alert-danger">{error}</div>}

                    {isLoading ? (
                        <div className="loading-state"><div className="loading-spinner"></div><p>Loading panels...</p></div>
                    ) : filteredPanels.length === 0 && panels.length > 0 ? (
                        <div className="empty-state"><div className="empty-state-icon">🔍</div><h3>No panels match your filters</h3><p>Try adjusting your search criteria</p></div>
                    ) : filteredPanels.length === 0 && panels.length === 0 ? (
                        <div className="empty-state"><div className="empty-state-icon">📋</div><h3>No panels available</h3><p>Start by adding your first panel</p></div>
                    ) : (
                        <>
                            <div className="table-header">
                                <h3>Panels ({filteredPanels.length} of {panels.length})</h3>
                                <div className="table-header-controls">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <input
                                            type="text"
                                            placeholder="Filter by Job No"
                                            value={filters.job_no}
                                            onChange={(e) => setFilters(prev => ({ ...prev, job_no: e.target.value }))}
                                            className="form-input"
                                            style={{ width: '150px' }}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Filter by Customer"
                                            value={filters.customer}
                                            onChange={(e) => setFilters(prev => ({ ...prev, customer: e.target.value }))}
                                            className="form-input"
                                            style={{ width: '170px' }}
                                        />
                                        <button className="print-btn" onClick={() => setIsPrintColumnSelectionOpen(true)} title="Print Panels">
                                            🖨️ Print
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {groupedPanels.map(group => {
                                const isExpanded = expandedGroups.has(group.job);
                                const customer = group.panels[0]?.customer || '';
                                const hasOnHold = group.panels.some(p => p.status === 'on-hold');
                                return (
                                    <div key={group.job} className="job-overview-card" style={{ marginBottom: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                                        <div
                                            className="job-overview-header"
                                            onClick={() => toggleGroup(group.job)}
                                            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                                                    {isExpanded ? '▼' : '▶'}
                                                </span>
                                                <span style={{ fontWeight: '600', fontSize: '1.05rem', color: '#1e293b' }}>
                                                    {group.job}
                                                    {customer && (
                                                        <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#6b7280' }}>
                                                            - {customer}
                                                        </span>
                                                    )}
                                                    {hasOnHold && (
                                                        <span style={{
                                                            marginLeft: '0.5rem',
                                                            background: '#ffc107',
                                                            color: '#000',
                                                            padding: '0.1rem 0.6rem',
                                                            borderRadius: '12px',
                                                            fontSize: '0.7rem',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            On Hold
                                                        </span>
                                                    )}
                                                </span>
                                                <span style={{ fontSize: '0.85rem', color: '#6b7280', background: '#e5e7eb', padding: '0.15rem 0.6rem', borderRadius: '20px' }}>
                                                    ({group.panels.length} panel{group.panels.length !== 1 ? 's' : ''})
                                                </span>
                                            </div>
                                            <div onClick={e => e.stopPropagation()}>
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => handleDeleteAllByJob(group.job)}
                                                    title="Delete all panels in this job"
                                                    style={{ marginRight: '8px' }}
                                                >
                                                    Delete All
                                                </button>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div style={{ padding: '0.5rem 0.75rem 0.75rem 0.75rem' }}>
                                                <JobOverviewContent
                                                    job={group.job}
                                                    panels={group.panels}
                                                    editingRowId={editingRowId}
                                                    editedRowData={editedRowData}
                                                    handleCellClick={handleCellClick}
                                                    handleEditedFieldChange={handleEditedFieldChange}
                                                    handleSaveEdit={handleSaveEdit}
                                                    handleCancelEdit={handleCancelEdit}
                                                    formatDate={formatDate}
                                                    calculateArea={calculateArea}
                                                    visibleColumns={jobOverviewFilteredColumns}
                                                    openDuplicateModal={openDuplicateModal}
                                                    handlePrint={handlePrint}
                                                    handleDeletePanel={handleDeletePanel}
                                                    openProductionModal={openProductionModal}
                                                    isAddingNew={isAddingNew && newRowData?.job_no === group.job}
                                                    newRowData={newRowData}
                                                    setNewRowData={setNewRowData}
                                                    handleSaveNewPanel={handleSaveNewPanel}
                                                    onCancelNewPanel={onCancelNewPanel}
                                                    onDeleteAllByJob={handleDeleteAllByJob}
                                                    productionRecords={allProductionRecords}
                                                    stickyTop={0}
                                                    onToggleProduction={handleToggleProduction}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* 📄 Pagination Controls */}
                            {filteredPanels.length > itemsPerPage && (
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
                                        Showing {startIndex + 1}–{Math.min(endIndex, filteredPanels.length)} of {filteredPanels.length} panels
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
                </div>
            )}

            {selectedPanelForProduction && (
                <ProductionDetailsModal
                    panel={selectedPanelForProduction}
                    onClose={closeProductionModal}
                    formatNumber={formatNumber}
                    formatDate={formatDate}
                />
            )}

            {productionModalFromMeter && (
                <ProductionDetailsModal
                    panel={productionModalFromMeter}
                    onClose={() => setProductionModalFromMeter(null)}
                    formatNumber={formatNumber}
                    formatDate={formatDate}
                />
            )}

            {isCreateModalOpen && (
                <div className="modal-overlay" onClick={closeCreateModal}>
                    <div className="modal-content create-modal" onClick={e => e.stopPropagation()} ref={createModalRef}>
                        <div className="modal-header"><h2>Create New Panel</h2><button type="button" className="close-button" onClick={closeCreateModal}>×</button></div>
                        <div className="modal-body">
                            {error && <div className="alert alert-danger">{error}</div>}
                            {success && <div className="alert alert-success">{success}</div>}
                            <form onSubmit={handleCreatePanel} className="panel-form">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Job No *</label>
                                        <input type="text" name="job_no" value={newPanel.job_no} onChange={handleNewPanelInputChange} className="form-input" placeholder="Enter job number" required />
                                    </div>
                                    <div className="form-group">
                                        <label>Type</label>
                                        <input type="text" name="type" value={newPanel.type} onChange={handleNewPanelInputChange} className="form-input" placeholder="e.g. PIR" />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Panel Thk (mm)</label>
                                        <input type="number" name="panel_thk" value={newPanel.panel_thk} onChange={handleNewPanelInputChange} className="form-input" placeholder="100" />
                                    </div>
                                    <div className="form-group">
                                        <label>Joint</label>
                                        <input type="text" name="joint" value={newPanel.joint} onChange={handleNewPanelInputChange} className="form-input" placeholder="Clip Joint" />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Surface Front</label>
                                        <input type="text" name="surface_front" value={newPanel.surface_front} onChange={handleNewPanelInputChange} className="form-input" placeholder="PPGI" />
                                    </div>
                                    <div className="form-group">
                                        <label>Surface Back</label>
                                        <input type="text" name="surface_back" value={newPanel.surface_back} onChange={handleNewPanelInputChange} className="form-input" placeholder="PPGI" />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Front Thk</label>
                                        <input type="number" step="0.01" name="surface_front_thk" value={newPanel.surface_front_thk} onChange={handleNewPanelInputChange} className="form-input" placeholder="0.5" />
                                    </div>
                                    <div className="form-group">
                                        <label>Back Thk</label>
                                        <input type="number" step="0.01" name="surface_back_thk" value={newPanel.surface_back_thk} onChange={handleNewPanelInputChange} className="form-input" placeholder="0.5" />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Surface Type</label>
                                        <input type="text" name="surface_type" value={newPanel.surface_type} onChange={handleNewPanelInputChange} className="form-input" placeholder="RIB" />
                                    </div>
                                    <div className="form-group">
                                        <label>Width (mm) *</label>
                                        <input type="number" name="width" value={newPanel.width} onChange={handleNewPanelInputChange} className="form-input" placeholder="1150" required />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Length (mm) *</label>
                                        <input type="number" name="length" value={newPanel.length} onChange={handleNewPanelInputChange} className="form-input" placeholder="3000" required />
                                    </div>
                                    <div className="form-group">
                                        <label>Qty</label>
                                        <input type="number" name="qty" value={newPanel.qty} onChange={handleNewPanelInputChange} className="form-input" placeholder="1" />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Cutting</label>
                                        <input type="text" name="cutting" value={newPanel.cutting} onChange={handleNewPanelInputChange} className="form-input" placeholder="e.g. Standard" />
                                    </div>
                                    <div className="form-group">
                                        <label>Salesman</label>
                                        <input type="text" name="salesman" value={newPanel.salesman} onChange={handleNewPanelInputChange} className="form-input" placeholder="Sales person" />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Brand</label>
                                        <input type="text" name="brand" value={newPanel.brand} onChange={handleNewPanelInputChange} className="form-input" placeholder="Brand" />
                                    </div>
                                    <div className="form-group">
                                        <label>Application</label>
                                        <input type="text" name="application" value={newPanel.application} onChange={handleNewPanelInputChange} className="form-input" placeholder="Application" />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Est. Delivery</label>
                                        <input type="date" name="estimated_delivery" value={newPanel.estimated_delivery} onChange={handleNewPanelInputChange} className="form-input" />
                                    </div>
                                    <div className="form-group">
                                        <label>Notes</label>
                                        <textarea name="notes" value={newPanel.notes} onChange={handleNewPanelInputChange} className="form-input" placeholder="Notes" rows="2" />
                                    </div>
                                </div>
                                <div className="form-actions">
                                    <button type="button" className="secondary-btn" onClick={handleResetForm}>Reset</button>
                                    <button type="button" className="secondary-btn" onClick={handleDuplicateInCreateModal}>Duplicate from Form</button>
                                    <button type="submit" className="primary-btn">Create Panel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

             {isEditModalOpen && editingPanel && (
                <div className="modal-overlay" onClick={closeEditModal}>
                    <div 
                        className="modal-content wide-modal" 
                        onClick={e => e.stopPropagation()}
                        style={{
                            maxWidth: '90vw',
                            width: '90vw',
                            maxHeight: '90vh',
                            height: 'auto',
                            borderRadius: '16px',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                            border: '2px solid #6366f1',
                            background: '#ffffff',
                            overflow: 'hidden',
                        }}
                    >
                        <div className="modal-header" style={{
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            color: '#fff',
                            padding: '16px 24px',
                            borderBottom: 'none',
                            borderRadius: '16px 16px 0 0',
                        }}>
                            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>
                                ✏️ Edit Panel: {editingPanel.reference_number}
                            </h2>
                            <button 
                                type="button" 
                                className="close-button" 
                                onClick={closeEditModal}
                                style={{ color: '#fff', opacity: 0.8 }}
                            >
                                ×
                            </button>
                        </div>
                        <div className="modal-body" style={{ padding: '24px' }}>
                            <form onSubmit={handleUpdatePanel} className="panel-form horizontal-form">
                                {/* ... all form fields ... */}
                                <div className="form-actions">
                                    <button type="button" className="secondary-btn" onClick={closeEditModal}>Cancel</button>
                                    <button type="submit" className="primary-btn">Update Panel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {isDuplicateModalOpen && selectedPanelToDuplicate && (
                <div className="modal-overlay" onClick={closeDuplicateModal}>
                    <div className="modal-content small-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Duplicate Panel</h2><button type="button" className="close-button" onClick={closeDuplicateModal}>×</button></div>
                        <div className="modal-body">
                            <div className="duplicate-modal-content">
                                <p>How many copies of panel <strong>{selectedPanelToDuplicate.reference_number}</strong> would you like to create?</p>
                                <div className="form-group">
                                    <label htmlFor="copyCount">Number of copies:</label>
                                    <div className="input-with-validation">
                                        <input type="number" id="copyCount" min="1" max="100" value={numberOfCopies} onChange={(e) => { const value = e.target.value; if (value === '') setNumberOfCopies(''); else { const num = parseInt(value); if (!isNaN(num) && num >=1 && num<=100) setNumberOfCopies(num); } }} onBlur={() => { if (numberOfCopies === '' || parseInt(numberOfCopies)<1) setNumberOfCopies(1); else if (parseInt(numberOfCopies)>100) setNumberOfCopies(100); }} className="form-input" onWheel={handleWheel} placeholder="Enter number"/>
                                        <div className="input-actions"><button type="button" className="input-action-btn" onClick={() => setNumberOfCopies(Math.max(1, numberOfCopies-1))} disabled={numberOfCopies<=1}>−</button><button type="button" className="input-action-btn" onClick={() => setNumberOfCopies(Math.min(100, (numberOfCopies||0)+1))} disabled={numberOfCopies>=100}>+</button></div>
                                    </div>
                                    <div className="validation-hint"><span className={`hint-text ${(!numberOfCopies || numberOfCopies<1) ? 'error' : ''}`}>{(!numberOfCopies || numberOfCopies<1) ? 'Minimum 1 copy required' : 'Enter 1 to 100'}</span></div>
                                </div>
                            </div>
                            <div className="modal-actions" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button type="button" className="btn btn-secondary" onClick={closeDuplicateModal}>
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    disabled={!numberOfCopies || numberOfCopies < 1}
                                    onClick={() => handleDuplicatePanel(selectedPanelToDuplicate, numberOfCopies)}
                                >
                                    ✅ Duplicate {numberOfCopies || 1} Cop{(numberOfCopies || 1) === 1 ? 'y' : 'ies'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isCreateFormDuplicateModalOpen && (
                <div className="modal-overlay" onClick={() => setIsCreateFormDuplicateModalOpen(false)}>
                    <div className="modal-content duplicate-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Duplicate Panel from Form</h2><button type="button" className="close-button" onClick={() => setIsCreateFormDuplicateModalOpen(false)}>×</button></div>
                        <div className="modal-body">
                            {error && <div className="alert alert-danger">{error}</div>}
                            <div className="duplicate-form-content">
                                <div className="duplicate-info"><div className="info-icon">📋</div><div className="info-content"><h4>Create Multiple Copies</h4><p>You are about to create duplicate panels based on the current form data. Each copy will have a unique reference number.</p></div></div>
                                <div className="form-group">
                                    <label htmlFor="duplicateCopies">Number of Copies *</label>
                                    <div className="input-with-stepper">
                                        <input id="duplicateCopies" type="number" min="1" max="100" step="1" value={duplicateFormCopies} onChange={(e) => { const val = parseInt(e.target.value); if (!isNaN(val) && val>=1 && val<=100) setDuplicateFormCopies(val); }} onWheel={handleWheel} className="form-input" required/>
                                        <div className="stepper-buttons"><button type="button" className="stepper-btn minus" onClick={() => { if (duplicateFormCopies>1) setDuplicateFormCopies(prev=>prev-1); }}>−</button><button type="button" className="stepper-btn plus" onClick={() => { if (duplicateFormCopies<100) setDuplicateFormCopies(prev=>prev+1); }}>+</button></div>
                                    </div>
                                    <div className="form-hint">Maximum 100 copies. Each copy will have a unique reference number.</div>
                                </div>
                                <div className="preview-summary"><h4>Preview Summary</h4><div className="preview-details"><div className="preview-row"><span className="preview-label">Job No:</span><span className="preview-value">{newPanel.job_no || 'N/A'}</span></div><div className="preview-row"><span className="preview-label">Type:</span><span className="preview-value">{newPanel.type || 'N/A'}</span></div><div className="preview-row"><span className="preview-label">Dimensions:</span><span className="preview-value">{newPanel.width || 0}mm × {newPanel.length || 0}mm</span></div><div className="preview-row"><span className="preview-label">Quantity per copy:</span><span className="preview-value">{newPanel.qty || 1}</span></div><div className="preview-row"><span className="preview-label">Total panels to create:</span><span className="preview-value">{duplicateFormCopies} × {newPanel.qty || 1} = {duplicateFormCopies * (parseInt(newPanel.qty) || 1)}</span></div></div></div>
                                <div className="modal-footer"><div className="footer-actions"><button type="button" className="btn btn-secondary" onClick={() => setIsCreateFormDuplicateModalOpen(false)}>Cancel</button><button type="button" className="btn btn-primary" onClick={handleDuplicateFromCreateForm} disabled={!newPanel.job_no?.trim() || !newPanel.width || !newPanel.length}>Create {duplicateFormCopies} Cop{duplicateFormCopies===1 ? 'y' : 'ies'}</button></div></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isPrintSelectionModalOpen && (
                <div className="modal-overlay" onClick={() => setIsPrintSelectionModalOpen(false)}>
                    <div className="modal-content print-selection-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Print Panels</h2><button type="button" className="close-button" onClick={() => setIsPrintSelectionModalOpen(false)}>×</button></div>
                        <div className="modal-body">
                            <div className="print-options">
                                <div className="print-option" onClick={() => { handlePrint(); setIsPrintSelectionModalOpen(false); }}>
                                    <div className="print-option-content"><div className="print-option-title">Print All Visible Panels</div><div className="print-option-details">Print all {filteredPanels.length} panels currently visible in the table</div></div>
                                </div>
                                <div className="print-options-list">
                                    {filteredPanels.map(panel => (
                                        <div key={panel.id} className="print-option" onClick={() => { handlePrint(panel); setIsPrintSelectionModalOpen(false); }}>
                                            <div className="print-option-content"><div className="print-option-title">{panel.job_no || 'N/A'} - {panel.reference_number}</div><div className="print-option-details">{panel.type} | {panel.width}mm × {panel.length}mm | Qty: {panel.qty}</div></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isColumnSelectionModalOpen && (
                <div className="modal-overlay" onClick={() => setIsColumnSelectionModalOpen(false)}>
                    <div className="modal-content column-selection-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Select Columns to Display</h2><button type="button" className="close-button" onClick={() => setIsColumnSelectionModalOpen(false)}>×</button></div>
                        <div className="modal-body">
                            <div className="column-selection-content">
                                <div className="selection-header">
                                    <p>Select which columns you want to see in the table. Drag to reorder.</p>
                                    <div className="selection-actions">
                                        <button className="btn btn-sm btn-secondary" onClick={selectAllColumns}>Select All</button>
                                        <button className="btn btn-sm btn-secondary" onClick={deselectAllColumns}>Deselect All</button>
                                        <button className="btn btn-sm btn-secondary" onClick={resetToDefaultColumns}>Reset to Default</button>
                                    </div>
                                </div>
                                <div className="columns-list">
                                    {columns.filter(col => !col.alwaysVisible).sort((a, b) => a.order - b.order).map(column => (
                                        <div key={column.id} className="column-item">
                                            <div className="column-controls">
                                                <button className="move-btn" onClick={() => moveColumn(column.id, 'up')} disabled={column.order === 1} title="Move Up">↑</button>
                                                <button className="move-btn" onClick={() => moveColumn(column.id, 'down')} disabled={column.order === columns.length - 1} title="Move Down">↓</button>
                                            </div>
                                            <div className="column-checkbox">
                                                <input type="checkbox" id={`col-${column.id}`} checked={column.visible} onChange={() => toggleColumnVisibility(column.id)} />
                                                <label htmlFor={`col-${column.id}`}>{column.label}</label>
                                            </div>
                                            <div className="column-info"><span className="column-position">Position: {column.order}</span></div>
                                        </div>
                                    ))}
                                </div>
                                <div className="selection-summary">
                                    <div className="summary-item"><span className="summary-label">Total Columns:</span><span className="summary-value">{columns.length - 1}</span></div>
                                    <div className="summary-item"><span className="summary-label">Visible Columns:</span><span className="summary-value">{visibleColumns.length - 1}</span></div>
                                    <div className="summary-item"><span className="summary-label">Hidden Columns:</span><span className="summary-value">{(columns.length - 1) - (visibleColumns.length - 1)}</span></div>
                                </div>
                                <div className="modal-footer"><div className="footer-actions"><button type="button" className="btn btn-secondary" onClick={() => setIsColumnSelectionModalOpen(false)}>Close</button><button type="button" className="btn btn-primary" onClick={() => setIsColumnSelectionModalOpen(false)}>Apply Selection</button></div></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isPrintColumnSelectionOpen && (
                <div className="modal-overlay" onClick={() => setIsPrintColumnSelectionOpen(false)}>
                    <div className="modal-content print-selection-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Select Columns to Print</h2>
                            <button type="button" className="close-button" onClick={() => setIsPrintColumnSelectionOpen(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="print-column-options">
                                <div className="selection-actions" style={{ marginBottom: '1rem' }}>
                                    <button className="btn btn-sm btn-secondary" onClick={() => setSelectedPrintColumns(PRINTABLE_COLUMNS.map(col => col.key))}>
                                        Select All
                                    </button>
                                    <button className="btn btn-sm btn-secondary" onClick={() => setSelectedPrintColumns([])}>
                                        Deselect All
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', maxHeight: '400px', overflowY: 'auto', padding: '0.5rem' }}>
                                    {PRINTABLE_COLUMNS.map(col => (
                                        <div key={col.key} style={{ flex: '0 0 auto', minWidth: '150px' }}>
                                            <div className="column-checkbox">
                                                <input
                                                    type="checkbox"
                                                    id={`print-col-${col.key}`}
                                                    checked={selectedPrintColumns.includes(col.key)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedPrintColumns([...selectedPrintColumns, col.key]);
                                                        } else {
                                                            setSelectedPrintColumns(selectedPrintColumns.filter(k => k !== col.key));
                                                        }
                                                    }}
                                                />
                                                <label htmlFor={`print-col-${col.key}`}>{col.label}</label>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="modal-footer">
                                    <button className="btn btn-secondary" onClick={() => setIsPrintColumnSelectionOpen(false)}>Cancel</button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => {
                                            handlePrintWithColumns(selectedPrintColumns);
                                            setIsPrintColumnSelectionOpen(false);
                                        }}
                                        disabled={selectedPrintColumns.length === 0}
                                    >
                                        Print ({selectedPrintColumns.length} columns)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ViewPanelPage;