import React, { useState, useEffect, useCallback, useRef } from 'react';
import PanelSlab from './panelSlab';
import Cutting from './Cutting';
import Door from './Door';
import Accessories from './Accessories';
import System from './System';
import { FileView, real_uploadProjectFiles } from './FileComponents';
import AdminPage from './AdminPage';
import './App.css';
import Transportation from './Transportation';
import NotificationPage from './Notification';
import ExcelExtractor from './ExcelExtractor';
import ReportGenerator from './ReportGenerator';
import AIChatWindow from './AIChatWindow';
import StockPage from './StockPage';
import SuperadminDashboard from './SuperadminDashboard';
import { viewPanelAPI, getUserPosition } from '../src/apiService';
import { getStoredTheme, applyTheme, toggleThemeValue } from './theme';

const API_BASE = '/api';

const apiCall = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!response.ok) throw new Error(`API error: ${response.status} ${response.statusText}`);
    if (response.status === 204) return null;
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

const ROLE_ACCESS = {
  superadmin: ['Superadmin', 'JobList', 'AdminPage', 'PanelSlab', 'Cutting', 'Door', 'Accessories', 'System', 'Transportation', 'StockPage', 'FileView'],
  admin: ['JobList', 'AdminPage', 'PanelSlab', 'Cutting', 'Door', 'Accessories', 'System', 'Transportation', 'StockPage', 'FileView'],
  panel: ['PanelSlab', 'StockPage'],
  panel_manager: ['PanelSlab', 'StockPage'],
  cutting: ['Cutting'],
  cut: ['Cutting'],
  door: ['Door'],
  accessories: ['Accessories'],
  system: ['System'],
  transportation: ['Transportation'],
  sale: ['JobList', 'FileView'],
};

const normalizePosition = (pos) =>
  (pos || '').toLowerCase().trim().replace(/[\s-]+/g, '_');

const getAllowedRoutes = (position) => {
  const normalized = normalizePosition(position);
  if (normalized === 'super_admin') return ROLE_ACCESS.superadmin;
  return ROLE_ACCESS[normalized] || [];
};

const real_getProjectsByStatus = async (status) => await apiCall(`/projects/status/${status}`);
const real_createProject = async (newProject) => await apiCall('/projects', { method: 'POST', body: JSON.stringify(newProject) });
const real_deleteProject = async (id) => await apiCall(`/projects/${id}`, { method: 'DELETE' });
const real_updateProject = async (id, updatedData) => await apiCall(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(updatedData) });
const real_updateProjectStatus = async (id, status) => await apiCall(`/projects/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });

const real_getProjectFiles = async (projectNo) => {
  try {
    const result = await apiCall(`/projects/files/${projectNo}`);
    const grouped = {};
    if (Array.isArray(result)) {
      result.forEach(file => {
        const cat = file.category || 'uncategorized';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({ id: file.id, name: file.file_name });
      });
    }
    return grouped;
  } catch {
    return {};
  }
};


const real_getJobByJobNo = async (jobNo) => await apiCall(`/admin/jobs/${jobNo}`);

const real_deleteProjectFile = async (fileId) =>
  apiCall(`/projects/file/${fileId}`, { method: 'DELETE' });

const generatePanelReference = (existingRefs = []) => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const prefix = `REF-${year}${month}${day}`;
  const todayRefs = existingRefs.filter(ref => ref && ref.startsWith(prefix));
  let seq = 1;
  if (todayRefs.length > 0) {
    const nums = todayRefs.map(ref => {
      const match = ref.match(/\d+$/);
      return match ? parseInt(match[0]) : 0;
    });
    seq = Math.max(...nums) + 1;
  }
  return `${prefix}-${String(seq).padStart(3, '0')}`;
};

const EMPTY_PROJECT = {
  drawingDate: '',
  projectNo: '',
  customer: '',
  poPayment: '',
  requestedDelivery: '',
  remarks: '',
  sales: '',
  sell: '',
  cost: '',
  margin: '',
  salesman: '',
  projectName: '',
  salesDetail: ''
};

const useSimpleRouter = () => {
  const [path, setPath] = useState(window.location.hash.slice(1) || '/');
  const handleHashChange = useCallback(() => setPath(window.location.hash.slice(1) || '/'), []);
  useEffect(() => {
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [handleHashChange]);
  const navigate = useCallback((newPath) => { window.location.hash = newPath; }, []);

  const matchFiles = path.match(/^\/files\/(.+)$/);
  let currentRoute = 'JobList';
  let params = {};
  if (matchFiles) { currentRoute = 'FileView'; params = { projectNo: matchFiles[1] }; }
  else if (path === '/panels') currentRoute = 'PanelSlab';
  else if (path === '/cutting') currentRoute = 'Cutting';
  else if (path === '/doors') currentRoute = 'Door';
  else if (path === '/accessories') currentRoute = 'Accessories';
  else if (path === '/strip-curtain') currentRoute = 'StripCurtain';
  else if (path === '/transportation') currentRoute = 'Transportation';
  else if (path === '/system') currentRoute = 'System';
  else if (path === '/notifications') currentRoute = 'NotificationPage';
  else if (path === '/admin') currentRoute = 'AdminPage';
  else if (path === '/superadmin') currentRoute = 'Superadmin';
  else if (path === '/excel-extractor') currentRoute = 'ExcelExtractor';
  else if (path === '/report-generator') currentRoute = 'ReportGenerator';
  else if (path === '/stock') currentRoute = 'StockPage';

  return { navigate, currentRoute, params };
};

const formatDateForDisplay = (dateString) => {
  if (!dateString) return '—';
  try { return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return dateString; }
};

const StatusTabs = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'approved', label: 'Approved', icon: '🎯' },
    { id: 'done', label: 'Completed', icon: '✅' },
  ];
  return (
    <div className="status-tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`status-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="tab-icon">{tab.icon}</span>
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

const StatusUpdateModal = ({ isOpen, onClose, project, onUpdateStatus }) => {
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const statusOptions = [
    { value: 'done', label: 'Completed', icon: '✅', color: '#10b981' },
    { value: 'approved', label: 'Approved', icon: '🎯', color: '#6366f1' }
  ];

  if (!isOpen || !project) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStatus) return;
    setIsSubmitting(true);
    try {
      await onUpdateStatus(project.id, selectedStatus);
      onClose();
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content status-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-inner">
            <div className="modal-icon">⚡</div>
            <div>
              <h3>Update Project Status</h3>
              <p className="modal-subtitle">Choose a new status for this project</p>
            </div>
          </div>
          <button className="close-modal" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="project-info-card">
            <div className="project-info-avatar">{project.customer?.charAt(0)}</div>
            <div>
              <h4>{project.customer}</h4>
              <span className="project-no-pill">#{project.projectNo}</span>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <label className="form-label">Select Status</label>
            <div className="status-options">
              {statusOptions.map(option => (
                <div
                  key={option.value}
                  className={`status-option ${selectedStatus === option.value ? 'selected' : ''}`}
                  onClick={() => setSelectedStatus(option.value)}
                  style={{ '--accent': option.color }}
                >
                  <span className="status-option-icon">{option.icon}</span>
                  <span className="status-option-label">{option.label}</span>
                  {selectedStatus === option.value && <span className="status-check">✓</span>}
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
              <button type="submit" className="btn-primary" disabled={!selectedStatus || isSubmitting}>
                {isSubmitting ? <span className="btn-loading">Updating…</span> : 'Update Status'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const DatePicker = ({ value, onChange, name, label, required = false, disabled = false, minDate = null, maxDate = null }) => (
  <div className="form-group">
    <label htmlFor={name}>{label}</label>
    <input type="date" id={name} name={name} value={value} onChange={onChange} required={required} disabled={disabled} min={minDate} max={maxDate} className="styled-input" />
  </div>
);

const PaymentStatusDropdown = ({ value, onChange, name, required = false, disabled = false }) => {
  const options = [
    { value: '', label: 'Select Payment Status', disabled: true },
    { value: 'Deposit', label: '💰 Deposit' },
    { value: 'Full Payment', label: '💳 Full Payment' },
    { value: 'Progress Claim', label: '📋 Progress Claim' },
    { value: 'Retention', label: '📊 Retention' },
    { value: 'Done', label: '✅ Done' }
  ];
  const colors = { Done: '#10b981', 'Full Payment': '#3b82f6', Deposit: '#f59e0b', 'Progress Claim': '#8b5cf6', Retention: '#ef4444' };
  const color = colors[value] || '#94a3b8';
  return (
    <div className="form-group">
      <label>PO / Payment Status</label>
      <div className="select-wrap" style={{ '--sel-color': color }}>
        <select name={name} value={value} onChange={onChange} required={required} disabled={disabled} className="styled-select">
          {options.map((o, i) => <option key={i} value={o.value} disabled={o.disabled}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
};

const SearchBar = ({ searchTerm, onSearchChange, searchType, onSearchTypeChange, onClearSearch, totalProjects, filteredCount }) => (
  <div className="search-container">
    <div className="search-inner">
      <div className="search-input-wrap">
        <span className="search-icon-inline">🔍</span>
        <input
          type="text"
          placeholder="Search projects by name, customer, or job number…"
          value={searchTerm}
          onChange={onSearchChange}
          className="search-input"
        />
        {searchTerm && <button onClick={onClearSearch} className="clear-search-btn">✕</button>}
      </div>
      <select value={searchType} onChange={onSearchTypeChange} className="search-type-select">
        <option value="all">All Fields</option>
        <option value="projectNo">Job No.</option>
        <option value="customer">Customer</option>
        <option value="projectName">Project Name</option>
      </select>
    </div>
    <div className="search-meta">
      <span className="search-count">{filteredCount} of {totalProjects} projects</span>
      {searchTerm && <span className="search-active-badge">Filtering: "{searchTerm}"</span>}
    </div>
  </div>
);

const EnhancedCategorySelection = ({
  selectedCategories,
  onCategoryChange,
  categoryFiles,
  onCategoryFileUpload,
  onRemoveCategoryFile,
  onClearCategoryFiles,
  existingFiles = {},
  onDeleteExistingFile = null,
  projectNo = null,
  uid = '',
  excludedCategories = [],
}) => {
  const categories = [
    { id: 'panel', label: 'Panel / Slab', icon: '🖼️', color: '#3b82f6' },
    { id: 'door', label: 'Door', icon: '🚪', color: '#10b981' },
    { id: 'accessories', label: 'Accessories', icon: '🔧', color: '#8b5cf6' },
    { id: 'system', label: 'Refrigeration System', icon: '⚙️', color: '#06b6d4' },
    { id: 'quotation', label: 'Quotation', icon: '📋', color: '#ec4899' }
  ];

  const [dragActiveCategory, setDragActiveCategory] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({});
  const [isUploadingPerCategory, setIsUploadingPerCategory] = useState({});

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType) => {
    if (!fileType) return '📎';
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('dwg') || fileType.includes('dxf')) return '📐';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('excel') || fileType.includes('sheet')) return '📊';
    if (fileType.includes('zip') || fileType.includes('rar')) return '📦';
    return '📎';
  };

  const getFileIconByName = (name = '') => {
    const ext = name.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return '🖼️';
    if (ext === 'pdf') return '📄';
    if (['dwg', 'dxf'].includes(ext)) return '📐';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
    if (['zip', 'rar', '7z'].includes(ext)) return '📦';
    return '📎';
  };

  const handleCategoryToggle = (categoryId) => {
    const newCategories = selectedCategories.includes(categoryId)
      ? selectedCategories.filter(id => id !== categoryId)
      : [...selectedCategories, categoryId];
    onCategoryChange(newCategories);
  };

  const handleFileUpload = async (categoryId, event) => {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      setIsUploadingPerCategory(prev => ({ ...prev, [categoryId]: true }));
      files.forEach(file => {
        const interval = setInterval(() => {
          setUploadProgress(prev => {
            const current = prev[`${categoryId}-${file.name}`] || 0;
            if (current < 90) return { ...prev, [`${categoryId}-${file.name}`]: current + 10 };
            clearInterval(interval);
            return prev;
          });
        }, 200);
        setTimeout(() => {
          setUploadProgress(prev => ({ ...prev, [`${categoryId}-${file.name}`]: 100 }));
        }, 2000);
      });
      onCategoryFileUpload(categoryId, files);
      setTimeout(() => {
        setIsUploadingPerCategory(prev => ({ ...prev, [categoryId]: false }));
        setUploadProgress(prev => {
          const newP = { ...prev };
          Object.keys(newP).filter(k => k.startsWith(`${categoryId}-`)).forEach(k => delete newP[k]);
          return newP;
        });
      }, 2500);
    }
  };

  const handleDrop = (categoryId, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveCategory(null);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFileUpload(categoryId, { target: { files } });
  };

  const triggerFileInput = (categoryId) => {
    const inputId = `file-input-${uid ? `${uid}-` : ''}${categoryId}`;
    document.getElementById(inputId)?.click();
  };

  return (
    <div className="category-selection">
      <div className="section-label">
        <span className="section-label-icon">📂</span>
        <div>
          <h3>Job Categories</h3>
          <p>Select applicable categories and optionally upload files</p>
        </div>
      </div>
      <div className="category-grid">
        {categories.map((category) => {
          const isSelected = selectedCategories.includes(category.id);
          const files = categoryFiles[category.id] || [];
          const serverFiles = existingFiles[category.id] || [];
          const isDraggingOver = dragActiveCategory === category.id;
          const isUploading = isUploadingPerCategory[category.id] || false;
          const inputId = `file-input-${uid ? `${uid}-` : ''}${category.id}`;

          return (
            <div key={category.id} className={`category-item ${isSelected ? 'selected' : ''}`} style={{ '--cat-color': category.color }}>
              <div className="category-main" onClick={() => handleCategoryToggle(category.id)}>
                <div className="category-icon-wrap" style={{ background: `${category.color}18`, color: category.color }}>
                  {category.icon}
                </div>
                <span className="category-label">{category.label}</span>
                {!isSelected && serverFiles.length > 0 && (
                  <span style={{
                    marginLeft: 'auto', marginRight: '8px',
                    background: `${category.color}18`, color: category.color,
                    border: `1px solid ${category.color}40`,
                    borderRadius: '99px', padding: '1px 8px', fontSize: '0.72rem', fontWeight: 600,
                  }}>
                    {serverFiles.length} file{serverFiles.length !== 1 ? 's' : ''}
                  </span>
                )}
                <div className={`cat-checkbox ${isSelected ? 'checked' : ''}`}>
                  {isSelected && <span>✓</span>}
                </div>
              </div>

              {isSelected && (
                <div className="category-file-upload">
                  {serverFiles.length > 0 && (
                    <div className="files-list" style={{ marginBottom: '10px' }}>
                      <div className="files-list-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '6px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.78rem', color: '#475569' }}>
                          <span>🗂️</span>Existing File({serverFiles.length})
                        </span>
                      </div>
                      {serverFiles.map((fileObj, idx) => {
                        const filename = fileObj.name;
                        const fileId = fileObj.id;
                        const downloadUrl = `${API_BASE}/projects/file/blob/${fileId}`;
                        return (
                          <div key={idx} className="file-row" style={{ background: 'var(--surface-2, #f8fafc)', borderRadius: '6px', marginBottom: '4px' }}>
                            <span className="file-row-icon">{getFileIconByName(filename)}</span>
                            <span className="file-row-name" title={filename} style={{ flex: 1 }}>{filename}</span>
                            <a
                              href={downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="download-file-btn"
                              title="Download file"
                              style={{ marginRight: '6px', textDecoration: 'none', color: '#3b82f6', cursor: 'pointer' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              📥
                            </a>
                            {onDeleteExistingFile && (
                              <button
                                type="button"
                                className="remove-file-btn"
                                title="Delete from server"
                                onClick={(e) => { e.stopPropagation(); onDeleteExistingFile(category.id, fileId, filename); }}
                                style={{ color: '#ef4444' }}
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div
                    className={`dropzone ${isDraggingOver ? 'drag-active' : ''} ${isUploading ? 'uploading' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDragActiveCategory(category.id); }}
                    onDragLeave={() => setDragActiveCategory(null)}
                    onDrop={(e) => handleDrop(category.id, e)}
                    onClick={() => !isUploading && triggerFileInput(category.id)}
                  >
                    <input
                      type="file"
                      multiple
                      id={inputId}
                      style={{ display: 'none' }}
                      onChange={(e) => handleFileUpload(category.id, e)}
                      accept="image/*,application/pdf,.dwg,.dxf,.doc,.docx,.xls,.xlsx,.zip,.rar"
                      disabled={isUploading}
                    />
                    <div className="dropzone-icon">
                      {isUploading ? '⏳' : isDraggingOver ? '⬇️' : '📁'}
                    </div>
                    <div className="dropzone-text">
                      {isUploading ? 'Uploading…' : isDraggingOver ? 'Drop to upload' : 'Click or drag to add more files'}
                    </div>
                    <div className="dropzone-hint">Images, PDFs, CAD, Documents</div>
                  </div>

                  {files.length > 0 && (
                    <div className="files-list" style={{ marginTop: '8px' }}>
                      <div className="files-list-header">
                        <span style={{ fontWeight: 600, fontSize: '0.78rem', color: '#475569' }}>
                          ➕ New files to upload ({files.length}) · {formatFileSize(files.reduce((a, f) => a + (f.size || 0), 0))}
                        </span>
                        <button type="button" className="clear-btn" onClick={(e) => { e.stopPropagation(); onClearCategoryFiles(category.id); }}>Clear all</button>
                      </div>
                      {files.map((file, index) => {
                        const progress = uploadProgress[`${category.id}-${file.name}`] || 0;
                        return (
                          <div key={index} className="file-row">
                            <span className="file-row-icon">{getFileIcon(file.type)}</span>
                            <span className="file-row-name" title={file.name}>{file.name}</span>
                            <span className="file-row-size">{file.size ? formatFileSize(file.size) : ''}</span>
                            {progress > 0 && progress < 100
                              ? <div className="mini-progress"><div className="mini-bar" style={{ width: `${progress}%` }} /></div>
                              : <button type="button" className="remove-file-btn" onClick={(e) => { e.stopPropagation(); onRemoveCategoryFile(category.id, index); }}>✕</button>
                            }
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BulkProjectCreator = ({ onSubmit, onCancel, getTodayDate, EMPTY_PROJECT }) => {
  const [projectCount, setProjectCount] = useState(1);
  const [step, setStep] = useState('askCount');
  const [projects, setProjects] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });

  const [showPanelCountPrompt, setShowPanelCountPrompt] = useState(false);
  const [tempPanelCount, setTempPanelCount] = useState(1);
  const [panelCountPromptIndex, setPanelCountPromptIndex] = useState(null);
  const [showPanelTableModal, setShowPanelTableModal] = useState(false);
  const [panelTableProjectIndex, setPanelTableProjectIndex] = useState(null);

  const handleCountSubmit = (e) => {
    e.preventDefault();
    const count = parseInt(projectCount, 10);
    if (count > 0 && count <= 20) {
      setProjects(Array(count).fill().map(() => ({
        ...EMPTY_PROJECT,
        drawingDate: '',
        requestedDelivery: '',
        selectedCategories: [],
        categoryFiles: {},
        sales: '',
        sell: '',
        cost: '',
        margin: '',
        poPayment: '',
        panelRows: [],
        panelSectionExpanded: true,
      })));
      setStep('fillForms');
    } else {
      alert('Please enter a number between 1 and 20.');
    }
  };

  const updateProject = (index, field, value) => {
    const updated = [...projects];
    updated[index][field] = value;
    if (field === 'sell' || field === 'cost') {
      const sell = parseFloat(updated[index].sell) || 0;
      const cost = parseFloat(updated[index].cost) || 0;
      updated[index].margin = (sell - cost).toFixed(2);
    }
    setProjects(updated);
  };

  const updateCategories = (index, categories) => {
    const updated = [...projects];
    updated[index].selectedCategories = categories;
    setProjects(updated);
  };

  const updateCategoryFiles = (index, categoryId, files) => {
    const updated = [...projects];
    if (!updated[index].categoryFiles) updated[index].categoryFiles = {};
    updated[index].categoryFiles[categoryId] = files;
    setProjects(updated);
  };

  const openPanelCountPrompt = (index) => {
    setPanelCountPromptIndex(index);
    setTempPanelCount(1);
    setShowPanelCountPrompt(true);
  };

  const closePanelCountPrompt = () => {
    setShowPanelCountPrompt(false);
    setPanelCountPromptIndex(null);
  };

  const confirmPanelCount = () => {
    const count = parseInt(tempPanelCount) || 1;
    if (count < 1) {
      alert('Please enter at least 1 panel.');
      return;
    }
    if (count > 100) {
      alert('Maximum 100 panels per batch.');
      return;
    }
    setShowPanelCountPrompt(false);
    setPanelTableProjectIndex(panelCountPromptIndex);
    setShowPanelTableModal(true);
  };

  const closePanelTableModal = () => {
    setShowPanelTableModal(false);
    setPanelTableProjectIndex(null);
  };

  const confirmPanelTable = (rows) => {
    const updated = [...projects];
    const projectIndex = panelTableProjectIndex;
    const existingRows = updated[projectIndex]?.panelRows || [];
    updated[projectIndex].panelRows = [...existingRows, ...rows];
    setProjects(updated);
    closePanelTableModal();
  };

  const togglePanelSection = (projectIndex) => {
    const updated = [...projects];
    updated[projectIndex].panelSectionExpanded = !updated[projectIndex].panelSectionExpanded;
    setProjects(updated);
  };

  const generatePanelRef = (existingRefs = []) => {
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const prefix = `REF-${y}${m}${d}`;
    const todayRefs = existingRefs.filter(r => r && r.startsWith(prefix));
    let seq = 1;
    if (todayRefs.length > 0) {
      const nums = todayRefs.map(r => { const x = r.match(/\d+$/); return x ? parseInt(x[0]) : 0; });
      seq = Math.max(...nums) + 1;
    }
    return `${prefix}-${String(seq).padStart(3, '0')}`;
  };

  const handleSubmitAll = async () => {
    for (let i = 0; i < projects.length; i++) {
      const proj = projects[i];
      if (!proj.projectNo || !proj.customer) {
        alert(`Project ${i + 1} is missing Job No. or Customer.`);
        return;
      }
      for (let r = 0; r < proj.panelRows.length; r++) {
        const row = proj.panelRows[r];
        const qty = parseInt(row.qty) || 0;
        if (qty > 0 && (!row.width || !row.length)) {
          alert(`Project ${i + 1}, Row ${r + 1}: Width and Length are required when quantity > 0.`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    setProgress({ current: 0, total: projects.length, status: 'Creating projects...' });

    let allPanelRefs = [];
    try {
      const allData = await viewPanelAPI.getAll();
      allPanelRefs = Array.isArray(allData) ? allData.map(p => p.reference_number).filter(Boolean) : [];
    } catch (e) {
      console.warn('Could not fetch existing panel refs, proceeding anyway.');
    }
    const usedRefs = [...allPanelRefs];

    for (let idx = 0; idx < projects.length; idx++) {
      const proj = projects[idx];
      setProgress({ current: idx, total: projects.length, status: `Creating project ${idx + 1}...` });

      try {
        const result = await onSubmit(proj);
        const createdProject = result || proj;

        const catFiles = proj.categoryFiles || {};
        for (const catId of Object.keys(catFiles)) {
          const files = catFiles[catId];
          if (files && files.length) {
            const fd = new FormData();
            fd.append('projectNo', createdProject.projectNo);
            fd.append('category', catId);
            files.forEach(f => fd.append('files', f));
            await real_uploadProjectFiles(fd);
          }
        }

        for (const row of proj.panelRows) {
          const qty = parseInt(row.qty) || 0;
          if (qty <= 0) continue;

          const ref = generatePanelRef(usedRefs);
          usedRefs.push(ref);

          const panelData = {
            project_id: createdProject.id,
            job_no: createdProject.projectNo,
            reference_number: ref,
            type: row.type || null,
            panel_thk: parseFloat(row.thk) || null,
            joint: row.joint || null,
            surface_front: row.front || null,
            surface_back: row.back || null,
            surface_front_thk: parseFloat(row.frontThk) || null,
            surface_back_thk: parseFloat(row.backThk) || null,
            surface_type: row.surface || null,
            width: parseFloat(row.width) || 0,
            length: parseFloat(row.length) || 0,
            qty: qty,
            balance: qty,
            cutting: row.cutting || null,
            salesman: row.salesman || null,
            application: row.application || null,
            estimated_delivery: row.delivery || null,
            notes: row.notes || null,
            status: 'pending',
          };

          Object.keys(panelData).forEach(k => {
            if (panelData[k] === '' || panelData[k] === null || panelData[k] === undefined) {
              delete panelData[k];
            }
          });

          await viewPanelAPI.create(panelData);
        }

        setProgress(p => ({ ...p, current: p.current + 1 }));
      } catch (err) {
        console.error(`Project ${idx + 1} failed:`, err);
      }
    }

    setIsSubmitting(false);
    setProgress({ current: projects.length, total: projects.length, status: 'Done!' });
    alert(`✅ All projects and panels have been created.`);
    onCancel();
  };

  if (step === 'askCount') {
    return (
      <div className="modal-overlay" onClick={onCancel}>
        <div className="modal-content single-scroll" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
          <div style={{ padding: '24px' }}>
            <h3>📦 Project Creation</h3>
            <form onSubmit={handleCountSubmit}>
              <div className="form-group">
                <label>How many projects do you want to create? (Max 20)</label>
                <input type="number" min="1" max="20" value={projectCount} onChange={e => setProjectCount(e.target.value)} className="styled-input" required autoFocus />
              </div>
              <div className="modal-actions" style={{ marginTop: '24px' }}>
                <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-primary">Continue →</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="modal-overlay" onClick={onCancel}>
        <div className="modal-content single-scroll" onClick={e => e.stopPropagation()} style={{ maxWidth: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', padding: 0, borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <h3>Create {projects.length} Projects</h3>
            <p style={{ color: '#64748b', marginTop: '4px' }}>
              Fill in details for each project. Click <strong>"Add Panels"</strong> to create panels for a project.
            </p>
          </div>

          <div style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>
            {projects.map((proj, idx) => {
              const panelRows = proj.panelRows || [];
              const totalPanels = panelRows.reduce((sum, row) => sum + (parseInt(row.qty) || 0), 0);

              return (
                <div key={idx} className="bulk-project-card" style={{ marginBottom: '32px', borderBottom: '2px solid #e2e8f0', paddingBottom: '24px' }}>
                  <h4 style={{ marginTop: 0, marginBottom: '16px', color: '#1e293b' }}>
                    📋 Project #{idx + 1}
                    <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#94a3b8', marginLeft: '12px' }}>
                      {proj.projectNo ? `#${proj.projectNo}` : 'New Project'}
                    </span>
                  </h4>

                  <div className="form-row-2">
                    <div className="form-group"><label>Job No. *</label><input value={proj.projectNo || ''} onChange={e => updateProject(idx, 'projectNo', e.target.value)} className="styled-input" placeholder="e.g. UPS_001_002" /></div>
                    <div className="form-group"><label>Customer *</label><input value={proj.customer || ''} onChange={e => updateProject(idx, 'customer', e.target.value)} className="styled-input" placeholder="Customer name" /></div>
                  </div>
                  <div className="form-row-2">
                    <div className="form-group"><label>Project Name</label><input value={proj.projectName || ''} onChange={e => updateProject(idx, 'projectName', e.target.value)} className="styled-input" placeholder="Optional" /></div>
                    <div className="form-group"><label>Salesman</label><input value={proj.salesman || ''} onChange={e => updateProject(idx, 'salesman', e.target.value)} className="styled-input" placeholder="Salesperson" /></div>
                  </div>
                  <div className="form-row-2">
                    <DatePicker value={proj.drawingDate} onChange={e => updateProject(idx, 'drawingDate', e.target.value)} name={`drawingDate-${idx}`} label="Drawing Date" />
                    <DatePicker value={proj.requestedDelivery} onChange={e => updateProject(idx, 'requestedDelivery', e.target.value)} name={`delivery-${idx}`} label="Requested Delivery" />
                  </div>
                  <div className="form-row-2">
                    <PaymentStatusDropdown value={proj.poPayment || ''} onChange={e => updateProject(idx, 'poPayment', e.target.value)} name="poPayment" />
                    <div className="form-group"><label>Remarks</label><input value={proj.remarks || ''} onChange={e => updateProject(idx, 'remarks', e.target.value)} className="styled-input" placeholder="Notes..." /></div>
                  </div>

                  <div className="form-section" style={{ marginTop: '16px' }}>
                    <div className="form-section-title">💹 Financial Details <span className="optional-tag">optional</span></div>
                    <div className="form-row-4">
                      <div className="form-group"><label>Sell Price (RM)</label><input type="number" step="0.01" value={proj.sell || ''} onChange={e => updateProject(idx, 'sell', e.target.value)} className="styled-input" placeholder="0.00" /></div>
                      <div className="form-group"><label>Cost (RM)</label><input type="number" step="0.01" value={proj.cost || ''} onChange={e => updateProject(idx, 'cost', e.target.value)} className="styled-input" placeholder="0.00" /></div>
                      <div className="form-group"><label>Margin (RM)</label><input type="number" step="0.01" value={proj.margin || '0.00'} readOnly className="styled-input readonly" /></div>
                    </div>
                    <p className="field-hint">💡 Margin is auto-calculated as Sell − Cost</p>
                  </div>

                  <div className="panel-section" style={{ marginTop: '20px', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <div
                      className="panel-section-header"
                      onClick={() => togglePanelSection(idx)}
                      style={{
                        padding: '12px 16px',
                        background: '#f8fafc',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: proj.panelSectionExpanded ? '1px solid #e2e8f0' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.1rem' }}>🖼️</span>
                        <span style={{ fontWeight: 600 }}>Panel Creation</span>
                        <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '8px' }}>
                          ({totalPanels} panel{totalPanels !== 1 ? 's' : ''} added)
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
                          {proj.panelSectionExpanded ? '▲' : '▼'}
                        </span>
                      </div>
                    </div>

                    {proj.panelSectionExpanded && (
                      <div style={{ padding: '16px' }}>
                        {panelRows.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                            <p>No panels added yet.</p>
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => openPanelCountPrompt(idx)}
                              style={{ marginTop: '8px' }}
                            >
                              + Add Panels
                            </button>
                          </div>
                        ) : (
                          <>
                           {panelRows.length > 0 && (
                            <div style={{ marginBottom: '12px' }}>
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                                gap: '12px',
                              }}>
                                {panelRows.map((row, rIdx) => (
                                  <div key={rIdx} style={{
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    padding: '12px 14px',
                                    background: '#fafbfc',
                                    position: 'relative',
                                  }}>
                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      marginBottom: '8px',
                                    }}>
                                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                        Panel #{rIdx + 1}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = [...projects];
                                          updated[idx].panelRows.splice(rIdx, 1);
                                          setProjects(updated);
                                        }}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          cursor: 'pointer',
                                          color: '#ef4444',
                                          fontSize: '1rem',
                                          padding: '0 4px',
                                        }}
                                        title="Remove panel"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                    <div style={{
                                      display: 'grid',
                                      gridTemplateColumns: '1fr 1fr',
                                      gap: '4px 12px',
                                      fontSize: '0.82rem',
                                    }}>
                                      <div><span style={{ color: '#64748b' }}>Type</span> {row.type || 'PIR'}</div>
                                      <div><span style={{ color: '#64748b' }}>Thk</span> {row.thk || '100'}</div>
                                      <div><span style={{ color: '#64748b' }}>Joint</span> {row.joint || 'Clip Joint'}</div>
                                      <div><span style={{ color: '#64748b' }}>Front</span> {row.front || 'PPGI'}</div>
                                      <div><span style={{ color: '#64748b' }}>Back</span> {row.back || 'PPGI'}</div>
                                      <div><span style={{ color: '#64748b' }}>Ft Thk</span> {row.frontThk || '0.5'}</div>
                                      <div><span style={{ color: '#64748b' }}>Bk Thk</span> {row.backThk || '0.5'}</div>
                                      <div><span style={{ color: '#64748b' }}>Surface</span> {row.surface || 'RIB'}</div>
                                      <div><span style={{ color: '#64748b' }}>Width</span> {row.width || '1150'}</div>
                                      <div><span style={{ color: '#64748b' }}>Length</span> {row.length || '3000'}</div>
                                      <div><span style={{ color: '#64748b' }}>Qty</span> {row.qty || '1'}</div>
                                      <div><span style={{ color: '#64748b' }}>Cutting</span> {row.cutting || '—'}</div>
                                      <div><span style={{ color: '#64748b' }}>Salesman</span> {row.salesman || '—'}</div>
                                      <div><span style={{ color: '#64748b' }}>Application</span> {row.application || '—'}</div>
                                      <div><span style={{ color: '#64748b' }}>Delivery</span> {row.delivery || '—'}</div>
                                      <div><span style={{ color: '#64748b' }}>Notes</span> {row.notes || '—'}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <button
                              type="button"
                              className="btn-ghost btn-sm"
                              onClick={() => openPanelCountPrompt(idx)}
                              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              <span style={{ fontSize: '18px' }}>➕</span> Add More Panels
                            </button>
                          </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <EnhancedCategorySelection
                    key={`cat-${idx}`}
                    uid={`bulk-${idx}`}
                    selectedCategories={proj.selectedCategories || []}
                    onCategoryChange={cats => updateCategories(idx, cats)}
                    categoryFiles={proj.categoryFiles || {}}
                    onCategoryFileUpload={(catId, files) => updateCategoryFiles(idx, catId, files)}
                    onRemoveCategoryFile={(catId, fileIndex) => {
                      const updatedFiles = [...(proj.categoryFiles?.[catId] || [])];
                      updatedFiles.splice(fileIndex, 1);
                      updateCategoryFiles(idx, catId, updatedFiles);
                    }}
                    onClearCategoryFiles={(catId) => updateCategoryFiles(idx, catId, [])}
                  />
                </div>
              );
            })}
          </div>

          {isSubmitting && (
            <div style={{ padding: '12px 24px', background: '#f1f5f9', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span>{progress.status}</span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${(progress.current / progress.total) * 100}%`, height: '100%', background: '#6366f1', transition: 'width 0.2s' }} />
              </div>
            </div>
          )}

          <div className="modal-actions" style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{projects.length} project{projects.length !== 1 ? 's' : ''} to create</div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={onCancel} className="btn-ghost" disabled={isSubmitting}>Cancel</button>
              <button onClick={handleSubmitAll} className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : `Create All Projects`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showPanelCountPrompt && (
        <div 
          className="modal-overlay" 
          onClick={closePanelCountPrompt}
          style={{ zIndex: 9999 }}
        >
          <div 
            className="modal-content" 
            onClick={e => e.stopPropagation()} 
            style={{ maxWidth: '700px', zIndex: 10000 }}
          >
            <h3>🖼️ Add Panels</h3>
            <p style={{ color: '#64748b', marginBottom: '16px' }}>
              How many panels do you want to create for this project?
            </p>
            <div className="form-group">
              <label>Number of Panels</label>
              <input
                type="number"
                min="1"
                max="100"
                value={tempPanelCount}
                onChange={e => setTempPanelCount(e.target.value)}
                className="styled-input"
                autoFocus
                onFocus={e => e.target.select()}
              />
              <small style={{ color: '#94a3b8', display: 'block', marginTop: '4px' }}>Enter a number between 1 and 100</small>
            </div>
            <div className="modal-actions" style={{ marginTop: '16px' }}>
              <button onClick={closePanelCountPrompt} className="btn-ghost">Cancel</button>
              <button onClick={confirmPanelCount} className="btn-primary">Continue →</button>
            </div>
          </div>
        </div>
      )}

      {showPanelTableModal && (
        <BulkPanelTableModal
          projectNo={projects[panelTableProjectIndex]?.projectNo || 'Project'}
          panelCount={parseInt(tempPanelCount) || 1}
          onClose={closePanelTableModal}
          onConfirm={confirmPanelTable}
        />
      )}
    </>
  );
};

const BulkPanelTableModal = ({ projectNo, panelCount, onClose, onConfirm }) => {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const defaultRow = {
      type: 'PIR',
      thk: '100',
      joint: 'Clip Joint',
      front: 'PPGI',
      back: 'PPGI',
      frontThk: '0.5',
      backThk: '0.5',
      surface: 'RIB',
      width: '1150',
      length: '3000',
      cutting: '',
      salesman: '',
      application: '',
      delivery: '',
      notes: '',
    };
    setRows(Array(panelCount).fill().map(() => ({ ...defaultRow })));
  }, [panelCount]);

  const updateRow = (index, field, value) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    setRows(newRows);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-content-CreatePanel"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100vw',              
          maxWidth: '100vw', 
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          zIndex: 10000,
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>🖼️ Create {panelCount} Panels for {projectNo}</h3>
            <p style={{ color: '#64748b', marginTop: '4px' }}>
              Each row represents one panel. Fill in the details below.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}
          >
            ✕
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '16px 24px', flex: 1 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left', minWidth: '30px' }}>#</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left', minWidth: '70px' }}>Type</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left', minWidth: '60px' }}>Thk (mm)</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left', minWidth: '80px' }}>Joint</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left', minWidth: '70px' }}>Front</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left', minWidth: '70px' }}>Back</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left', minWidth: '60px' }}>Ft Thk</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left', minWidth: '60px' }}>Bk Thk</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left', minWidth: '70px' }}>Finish</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left', minWidth: '70px', background: '#fffbeb' }}>Width*</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left', minWidth: '70px', background: '#fffbeb' }}>Length*</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left', minWidth: '70px' }}>Cutting</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left', minWidth: '70px' }}>Salesman</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left', minWidth: '70px' }}>Application</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left', minWidth: '100px' }}>Delivery</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left', minWidth: '80px' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}>
                      <input
                        type="text"
                        value={row.type || ''}
                        onChange={e => updateRow(idx, 'type', e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent' }}
                        placeholder="PIR"
                      />
                    </td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}>
                      <input
                        type="number"
                        value={row.thk || ''}
                        onChange={e => updateRow(idx, 'thk', e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent' }}
                        placeholder="100"
                      />
                    </td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}>
                      <input
                        type="text"
                        value={row.joint || ''}
                        onChange={e => updateRow(idx, 'joint', e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent' }}
                        placeholder="Clip Joint"
                      />
                    </td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}>
                      <input
                        type="text"
                        value={row.front || ''}
                        onChange={e => updateRow(idx, 'front', e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent' }}
                        placeholder="PPGI"
                      />
                    </td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}>
                      <input
                        type="text"
                        value={row.back || ''}
                        onChange={e => updateRow(idx, 'back', e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent' }}
                        placeholder="PPGI"
                      />
                    </td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}>
                      <input
                        type="number"
                        step="0.01"
                        value={row.frontThk || ''}
                        onChange={e => updateRow(idx, 'frontThk', e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent' }}
                        placeholder="0.5"
                      />
                    </td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}>
                      <input
                        type="number"
                        step="0.01"
                        value={row.backThk || ''}
                        onChange={e => updateRow(idx, 'backThk', e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent' }}
                        placeholder="0.5"
                      />
                    </td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}>
                      <input
                        type="text"
                        value={row.surface || ''}
                        onChange={e => updateRow(idx, 'surface', e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent' }}
                        placeholder="RIB"
                      />
                    </td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0', background: '#fffbeb' }}>
                      <input
                        type="number"
                        value={row.width || ''}
                        onChange={e => updateRow(idx, 'width', e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent' }}
                        placeholder="1150"
                        required
                      />
                    </td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0', background: '#fffbeb' }}>
                      <input
                        type="number"
                        value={row.length || ''}
                        onChange={e => updateRow(idx, 'length', e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent' }}
                        placeholder="3000"
                        required
                      />
                    </td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}>
                      <input
                        type="text"
                        value={row.cutting || ''}
                        onChange={e => updateRow(idx, 'cutting', e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent' }}
                      />
                    </td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}>
                      <input
                        type="text"
                        value={row.salesman || ''}
                        onChange={e => updateRow(idx, 'salesman', e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent' }}
                      />
                    </td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}>
                      <input
                        type="text"
                        value={row.application || ''}
                        onChange={e => updateRow(idx, 'application', e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent' }}
                      />
                    </td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}>
                      <input
                        type="date"
                        value={row.delivery || ''}
                        onChange={e => updateRow(idx, 'delivery', e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent' }}
                      />
                    </td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}>
                      <input
                        type="text"
                        value={row.notes || ''}
                        onChange={e => updateRow(idx, 'notes', e.target.value)}
                        style={{ width: '100%', border: 'none', background: 'transparent' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div
          className="modal-actions"
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
            {rows.length} panel{rows.length !== 1 ? 's' : ''} to create
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={onClose} className="btn-ghost">Cancel</button>
            <button
              onClick={() => {
                const rowsWithQty = rows.map(row => ({ ...row, qty: 1 }));
                onConfirm(rowsWithQty);
              }}
              className="btn-primary"
            >
              ✅ Confirm Panels
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const EditProjectModal = ({ 
  project, 
  onClose, 
  onSave, 
  addNotification, 
  allPanelRefs, 
  setAllPanelRefs 
}) => {
  const [formData, setFormData] = useState({ ...project });
  const [editCategories, setEditCategories] = useState(
    Array.isArray(project.selectedCategories)
      ? project.selectedCategories
      : project.selectedCategories
        ? String(project.selectedCategories).split(',').map(s => s.trim()).filter(Boolean)
        : []
  );
  const [editCategoryFiles, setEditCategoryFiles] = useState({});
  const [existingFiles, setExistingFiles] = useState({});
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Panel management state
  const [panels, setPanels] = useState([]);
  const [loadingPanels, setLoadingPanels] = useState(false);
  const [showPanelEditor, setShowPanelEditor] = useState(false);

  // 👇 NEW: Fetch ledger data to pre-fill sell/cost/margin
  useEffect(() => {
    const fetchLedgerData = async () => {
      if (!project.projectNo) return;
      try {
        const jobData = await real_getJobByJobNo(project.projectNo);
        if (jobData) {
          setFormData(prev => ({
            ...prev,
            sell: jobData.sellPrice !== null && jobData.sellPrice !== 0 ? jobData.sellPrice : '',
            cost: jobData.cost !== null && jobData.cost !== 0 ? jobData.cost : '',
            margin: jobData.margin !== null && jobData.margin !== 0 ? jobData.margin : '',
          }));
        }
      } catch (err) {
        console.warn('Could not fetch ledger data for edit modal:', err);
      }
    };
    fetchLedgerData();
  }, [project.projectNo]);

  // Fetch panels when modal opens
  useEffect(() => {
    const fetchPanels = async () => {
      setLoadingPanels(true);
      try {
        const allPanels = await viewPanelAPI.getAll();
        const projectPanels = allPanels.filter(p => p.job_no === project.projectNo);
        setPanels(projectPanels);
      } catch (err) {
        addNotification(`❌ Failed to load panels: ${err.message}`);
      } finally {
        setLoadingPanels(false);
      }
    };
    if (project.projectNo) {
      fetchPanels();
    }
  }, [project.projectNo, addNotification]);

  // Auto-calculate margin
  useEffect(() => {
    const margin = (parseFloat(formData.sell) || 0) - (parseFloat(formData.cost) || 0);
    if (!isNaN(margin)) setFormData(p => ({ ...p, margin: margin.toFixed(2) }));
  }, [formData.sell, formData.cost]);

  // Fetch existing files
  useEffect(() => {
    const fetchFiles = async () => {
      setLoadingFiles(true);
      try {
        const filesFromApi = await real_getProjectFiles(project.projectNo);
        setExistingFiles(filesFromApi);
        const fileCats = Object.keys(filesFromApi).filter(cat => (filesFromApi[cat] || []).length > 0);
        setEditCategories(prev => Array.from(new Set([...prev, ...fileCats])));
      } catch {
        setExistingFiles({});
      } finally {
        setLoadingFiles(false);
      }
    };
    fetchFiles();
  }, [project.projectNo]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(p => ({ ...p, [name]: value }));
  };

  const handleCategoryChange = (categories) => {
    setEditCategories(categories);
  };

  const handleCategoryFileUpload = (categoryId, files) => {
    setEditCategoryFiles(p => ({ ...p, [categoryId]: [...(p[categoryId] || []), ...files] }));
  };

  const removeCategoryFile = (categoryId, fileIndex) => {
    setEditCategoryFiles(p => {
      const arr = [...(p[categoryId] || [])];
      arr.splice(fileIndex, 1);
      return { ...p, [categoryId]: arr };
    });
  };

  const clearCategoryFiles = (categoryId) => {
    setEditCategoryFiles(p => ({ ...p, [categoryId]: [] }));
  };

  const handleDeleteExistingFile = async (categoryId, fileId, filename) => {
    const confirmed = window.confirm(`Delete "${filename}"? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await real_deleteProjectFile(fileId);
      setExistingFiles(prev => ({
        ...prev,
        [categoryId]: (prev[categoryId] || []).filter(f => f.id !== fileId),
      }));
      addNotification(`🗑️ Deleted ${filename}`);
    } catch (err) {
      addNotification(`❌ Could not delete: ${err.message}`);
    }
  };

  // Panel edit handler
  const handlePanelEditConfirm = async (editedPanels) => {
    const originalPanels = panels;
    try {
      const originalIds = new Set(originalPanels.map(p => p.id).filter(Boolean));
      const editedIds = new Set(editedPanels.map(p => p.id).filter(Boolean));
      const idsToDelete = [...originalIds].filter(id => !editedIds.has(id));

      for (const id of idsToDelete) {
        await viewPanelAPI.delete(id);
      }

      const usedRefs = [...allPanelRefs];
      for (const row of editedPanels) {
        const payload = {
          project_id: formData.id,
          job_no: formData.projectNo,
          type: row.type || null,
          panel_thk: parseFloat(row.thk) || null,
          joint: row.joint || null,
          surface_front: row.front || null,
          surface_back: row.back || null,
          surface_front_thk: parseFloat(row.frontThk) || null,
          surface_back_thk: parseFloat(row.backThk) || null,
          surface_type: row.surface || null,
          width: parseFloat(row.width) || 0,
          length: parseFloat(row.length) || 0,
          qty: 1,
          balance: 1,
          cutting: row.cutting || null,
          salesman: row.salesman || null,
          application: row.application || null,
          estimated_delivery: row.delivery || null,
          notes: row.notes || null,
          status: row.status || 'pending',
        };
        Object.keys(payload).forEach(k => {
          if (payload[k] === '' || payload[k] === null || payload[k] === undefined) {
            delete payload[k];
          }
        });

        if (row.id) {
          await viewPanelAPI.update(row.id, payload);
        } else {
          const ref = generatePanelReference(usedRefs);
          usedRefs.push(ref);
          payload.reference_number = ref;
          await viewPanelAPI.create(payload);
          setAllPanelRefs(prev => [...prev, ref]);
        }
      }

      const allPanels = await viewPanelAPI.getAll();
      const projectPanels = allPanels.filter(p => p.job_no === formData.projectNo);
      setPanels(projectPanels);
      addNotification(`✅ Panels updated for ${formData.projectNo}`);
      setShowPanelEditor(false);
    } catch (err) {
      addNotification(`❌ Failed to update panels: ${err.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = { ...formData, selectedCategories: editCategories };
      await onSave(payload);

      for (const catId of Object.keys(editCategoryFiles)) {
        const files = editCategoryFiles[catId] || [];
        if (files.length) {
          const fd = new FormData();
          fd.append('projectNo', formData.projectNo);
          fd.append('category', catId);
          files.forEach(f => fd.append('files', f));
          try {
            await real_uploadProjectFiles(fd);
          } catch (err) {
            addNotification(`⚠️ Some files for ${catId} failed to upload.`);
          }
        }
      }

      addNotification(`✏️ Job #${formData.projectNo} updated.`);
      onClose();
    } catch (err) {
      addNotification(`❌ Could not update job: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '860px',
          width: '95vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--surface, #fff)',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>✏️ Edit Project</h3>
            <p style={{ margin: '3px 0 0', color: '#64748b', fontSize: '0.85rem' }}>
              #{formData.projectNo} — {formData.customer}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
            {/* Basic Information */}
            <div className="form-section">
              <div className="form-section-title">Basic Information</div>
              <div className="form-row-2">
                <DatePicker value={formData.drawingDate || ''} onChange={handleChange} name="drawingDate" label="Drawing Date" />
                <div className="form-group">
                  <label>Job No.</label>
                  <input name="projectNo" value={formData.projectNo || ''} onChange={handleChange} className="styled-input" />
                </div>
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Customer Name *</label>
                  <input name="customer" value={formData.customer || ''} onChange={handleChange} required className="styled-input" />
                </div>
                <div className="form-group">
                  <label>Project Name</label>
                  <input name="projectName" value={formData.projectName || ''} onChange={handleChange} className="styled-input" />
                </div>
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Salesman Name</label>
                  <input name="salesman" value={formData.salesman || ''} onChange={handleChange} className="styled-input" />
                </div>
                <PaymentStatusDropdown value={formData.poPayment || ''} onChange={handleChange} name="poPayment" />
              </div>
              <DatePicker value={formData.requestedDelivery || ''} onChange={handleChange} name="requestedDelivery" label="Requested Delivery" />
            </div>

            {/* FINANCIAL DETAILS */}
            <div className="form-section">
              <div className="form-section-title">💹 Financial Details <span className="optional-tag">optional</span></div>
              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                flexWrap: 'nowrap',
                alignItems: 'flex-start'
              }}>
                {['sell', 'cost'].map((field) => {
                  const labels = {
                    sell: 'Sell Price (RM)',
                    cost: 'Cost (RM)'
                  };
                  return (
                    <div className="form-group" key={field} style={{ flex: 1, minWidth: 0 }}>
                      <label>{labels[field]}</label>
                      <input
                        name={field}
                        type="number"
                        step="0.01"
                        value={formData[field] || ''}
                        onChange={handleChange}
                        className="styled-input"
                        placeholder="0.00"
                        onWheel={e => e.target.blur()}
                      />
                    </div>
                  );
                })}
                <div className="form-group" style={{ flex: 1, minWidth: 0 }}>
                  <label>Margin (RM)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.margin || '0.00'}
                    readOnly
                    className="styled-input readonly"
                  />
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div className="form-section">
              <div className="form-group">
                <label>Remarks</label>
                <textarea name="remarks" value={formData.remarks || ''} onChange={handleChange} rows="3" className="styled-textarea" placeholder="Additional notes…" />
              </div>
            </div>

            {/* Panel Management */}
            <div className="form-section" style={{ borderTop: '2px solid #e2e8f0', paddingTop: '16px', marginTop: '16px' }}>
              <div className="form-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🖼️ Panels</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#64748b' }}>
                  {loadingPanels ? 'Loading…' : `${panels.length} panel${panels.length !== 1 ? 's' : ''}`}
                </span>
              </div>
              <div style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setShowPanelEditor(true)}
                  disabled={loadingPanels}
                  style={{ width: '100%', padding: '8px' }}
                >
                  {panels.length === 0 ? '➕ Add Panels' : '✏️ Manage Panels'}
                </button>
              </div>
            </div>

            {/* Categories & Files */}
            {loadingFiles ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px 0', color: '#64748b' }}>
                <div className="loading-spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
                Loading existing files…
              </div>
            ) : (
              <EnhancedCategorySelection
                uid="edit-modal"
                selectedCategories={editCategories}
                onCategoryChange={handleCategoryChange}
                categoryFiles={editCategoryFiles}
                onCategoryFileUpload={handleCategoryFileUpload}
                onRemoveCategoryFile={removeCategoryFile}
                onClearCategoryFiles={clearCategoryFiles}
                existingFiles={existingFiles}
                onDeleteExistingFile={handleDeleteExistingFile}
                projectNo={formData.projectNo}
              />
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            background: 'var(--surface, #fff)',
          }}>
            <button type="button" onClick={onClose} className="btn-ghost" disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {showPanelEditor && (
        <PanelEditModal
          projectNo={formData.projectNo}
          panels={panels}
          onClose={() => setShowPanelEditor(false)}
          onConfirm={handlePanelEditConfirm}
        />
      )}
    </div>
  );
};

// ==================== NEW COMPONENT: AddPanelsModal ====================
const AddPanelsModal = ({ projectNo, onClose, onConfirm }) => {
  const [count, setCount] = useState(1);
  const [step, setStep] = useState('count');
  const [rows, setRows] = useState([]);

  const handleCountSubmit = () => {
    const num = parseInt(count, 10);
    if (num < 1 || num > 100) {
      alert('Please enter a number between 1 and 100.');
      return;
    }
    const defaultRow = {
      type: 'PIR',
      thk: '100',
      joint: 'Clip Joint',
      front: 'PPGI',
      back: 'PPGI',
      frontThk: '0.5',
      backThk: '0.5',
      surface: 'RIB',
      width: '1150',
      length: '3000',
      cutting: '',
      salesman: '',
      application: '',
      delivery: '',
      notes: '',
    };
    setRows(Array(num).fill().map(() => ({ ...defaultRow })));
    setStep('table');
  };

  const updateRow = (index, field, value) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    setRows(newRows);
  };

  const handleConfirm = () => {
    const rowsWithQty = rows.map(row => ({ ...row, qty: 1 }));
    onConfirm(rowsWithQty);
  };

  if (step === 'count') {
    return (
      <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10001 }}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
          <h3>➕ Add Panels to {projectNo}</h3>
          <p style={{ color: '#64748b', marginBottom: '16px' }}>How many panels do you want to add?</p>
          <div className="form-group">
            <label>Number of Panels</label>
            <input
              type="number"
              min="1"
              max="100"
              value={count}
              onChange={e => setCount(e.target.value)}
              className="styled-input"
              autoFocus
            />
          </div>
          <div className="modal-actions">
            <button onClick={onClose} className="btn-ghost">Cancel</button>
            <button onClick={handleCountSubmit} className="btn-primary">Continue →</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10001 }}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}
      >
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>New Panels for {projectNo}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '16px 24px', flex: 1 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left' }}>#</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left' }}>Type</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left' }}>Thk (mm)</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left' }}>Joint</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left' }}>Front</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left' }}>Back</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left' }}>Front Thk</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left' }}>Back Thk</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left' }}>Finish</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left', background: '#fffbeb' }}>Width*</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left', background: '#fffbeb' }}>Length*</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left' }}>Cutting</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left' }}>Salesman</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left' }}>Application</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left' }}>Delivery</th>
                  <th style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'left' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}><input type="text" value={row.type || ''} onChange={e => updateRow(idx, 'type', e.target.value)} style={{ width: '100%', border: 'none' }} placeholder="PIR" /></td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}><input type="number" value={row.thk || ''} onChange={e => updateRow(idx, 'thk', e.target.value)} style={{ width: '100%', border: 'none' }} placeholder="100" /></td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}><input type="text" value={row.joint || ''} onChange={e => updateRow(idx, 'joint', e.target.value)} style={{ width: '100%', border: 'none' }} placeholder="Clip Joint" /></td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}><input type="text" value={row.front || ''} onChange={e => updateRow(idx, 'front', e.target.value)} style={{ width: '100%', border: 'none' }} placeholder="PPGI" /></td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}><input type="text" value={row.back || ''} onChange={e => updateRow(idx, 'back', e.target.value)} style={{ width: '100%', border: 'none' }} placeholder="PPGI" /></td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}><input type="number" step="0.01" value={row.frontThk || ''} onChange={e => updateRow(idx, 'frontThk', e.target.value)} style={{ width: '100%', border: 'none' }} placeholder="0.5" /></td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}><input type="number" step="0.01" value={row.backThk || ''} onChange={e => updateRow(idx, 'backThk', e.target.value)} style={{ width: '100%', border: 'none' }} placeholder="0.5" /></td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}><input type="text" value={row.surface || ''} onChange={e => updateRow(idx, 'surface', e.target.value)} style={{ width: '100%', border: 'none' }} placeholder="RIB" /></td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0', background: '#fffbeb' }}><input type="number" value={row.width || ''} onChange={e => updateRow(idx, 'width', e.target.value)} style={{ width: '100%', border: 'none' }} placeholder="1150" required /></td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0', background: '#fffbeb' }}><input type="number" value={row.length || ''} onChange={e => updateRow(idx, 'length', e.target.value)} style={{ width: '100%', border: 'none' }} placeholder="3000" required /></td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}><input type="text" value={row.cutting || ''} onChange={e => updateRow(idx, 'cutting', e.target.value)} style={{ width: '100%', border: 'none' }} /></td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}><input type="text" value={row.salesman || ''} onChange={e => updateRow(idx, 'salesman', e.target.value)} style={{ width: '100%', border: 'none' }} /></td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}><input type="text" value={row.application || ''} onChange={e => updateRow(idx, 'application', e.target.value)} style={{ width: '100%', border: 'none' }} /></td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}><input type="date" value={row.delivery || ''} onChange={e => updateRow(idx, 'delivery', e.target.value)} style={{ width: '100%', border: 'none' }} /></td>
                    <td style={{ padding: '4px 8px', border: '1px solid #e2e8f0' }}><input type="text" value={row.notes || ''} onChange={e => updateRow(idx, 'notes', e.target.value)} style={{ width: '100%', border: 'none' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-actions" style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={handleConfirm} className="btn-primary">✅ Add Panels</button>
        </div>
      </div>
    </div>
  );
};

// ==================== MODIFIED PanelEditModal ====================
const PanelEditModal = ({ projectNo, panels, onClose, onConfirm }) => {
  const [rows, setRows] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    const initialRows = panels.map(p => ({
      id: p.id,
      type: p.type || '',
      thk: p.panel_thk || '',
      joint: p.joint || '',
      front: p.surface_front || '',
      back: p.surface_back || '',
      frontThk: p.surface_front_thk || '',
      backThk: p.surface_back_thk || '',
      surface: p.surface_type || '',
      width: p.width || '',
      length: p.length || '',
      cutting: p.cutting || '',
      salesman: p.salesman || '',
      application: p.application || '',
      delivery: p.estimated_delivery || '',
      notes: p.notes || '',
      status: p.status || 'pending',
    }));
    setRows(initialRows);
  }, [panels]);

  const updateRow = (index, field, value) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    setRows(newRows);
  };

  const deleteRow = (index) => {
    if (!window.confirm('Delete this panel permanently?')) return;
    const newRows = [...rows];
    newRows.splice(index, 1);
    setRows(newRows);
  };

  const handleAddPanels = (newRows) => {
    setRows(prev => [...prev, ...newRows]);
    setShowAddModal(false);
  };

  return (
    <div 
      className="panel-edit-overlay" 
      onClick={onClose} 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div 
        className="panel-edit-modal" 
        onClick={e => e.stopPropagation()} 
        style={{
          width: '95vw',
          maxWidth: '95vw',
          height: '90vh',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          margin: 0,
          borderRadius: '12px',
          background: '#fff',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ 
          padding: '12px 20px', 
          borderBottom: '1px solid #e2e8f0', 
          flexShrink: 0, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          background: '#fff' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>🖼️ Edit Panels – {projectNo}</h3>
              <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                {rows.length} panel{rows.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button 
              onClick={() => setShowAddModal(true)} 
              className="btn-ghost" 
              style={{ padding: '4px 12px', fontSize: '0.85rem', borderColor: '#6366f1', color: '#6366f1' }}
            >
              ➕ Add Panels
            </button>
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '1.8rem', 
              cursor: 'pointer', 
              color: '#94a3b8',
              padding: '0 8px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '8px 12px', flex: 1, background: '#fafbfc' }}>
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ 
              width: '100%', 
              tableLayout: 'fixed', 
              borderCollapse: 'collapse', 
              fontSize: '10px',
              border: '1px solid #e2e8f0',
            }}>
              <colgroup>
                <col style={{ width: '3%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '4.5%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '4%' }} />
                <col style={{ width: '4%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '4%' }} />
              </colgroup>
              <thead>
                <tr style={{ background: '#1e293b', color: '#fff' }}>
                  <th style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 600, border: '1px solid #334155',background: '#fffbeb', whiteSpace: 'nowrap', fontSize: '10px' }}>#</th>
                  <th style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 600, border: '1px solid #334155',background: '#fffbeb', whiteSpace: 'nowrap', fontSize: '10px' }}>Type</th>
                  <th style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 600, border: '1px solid #334155', background: '#fffbeb',whiteSpace: 'nowrap', fontSize: '10px' }}>Thk</th>
                  <th style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 600, border: '1px solid #334155',background: '#fffbeb', whiteSpace: 'nowrap', fontSize: '10px' }}>Joint</th>
                  <th style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 600, border: '1px solid #334155',background: '#fffbeb', whiteSpace: 'nowrap', fontSize: '10px' }}>Front</th>
                  <th style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 600, border: '1px solid #334155', background: '#fffbeb',whiteSpace: 'nowrap', fontSize: '10px' }}>Back</th>
                  <th style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 600, border: '1px solid #334155', background: '#fffbeb',whiteSpace: 'nowrap', fontSize: '10px' }}>Ft Thk</th>
                  <th style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 600, border: '1px solid #334155', background: '#fffbeb',whiteSpace: 'nowrap', fontSize: '10px' }}>Bk Thk</th>
                  <th style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 600, border: '1px solid #334155', background: '#fffbeb',whiteSpace: 'nowrap', fontSize: '10px' }}>Finish</th>
                  <th style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 600, border: '1px solid #334155', background: '#fffbeb', color: '#1e293b', whiteSpace: 'nowrap', fontSize: '10px' }}>Width*</th>
                  <th style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 600, border: '1px solid #334155', background: '#fffbeb', color: '#1e293b', whiteSpace: 'nowrap', fontSize: '10px' }}>Length*</th>
                  <th style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 600, border: '1px solid #334155', background: '#fffbeb',whiteSpace: 'nowrap', fontSize: '10px' }}>Cutting</th>
                  <th style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 600, border: '1px solid #334155', background: '#fffbeb',whiteSpace: 'nowrap', fontSize: '10px' }}>Salesman</th>
                  <th style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 600, border: '1px solid #334155', background: '#fffbeb',whiteSpace: 'nowrap', fontSize: '10px' }}>Application</th>
                  <th style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 600, border: '1px solid #334155', background: '#fffbeb',whiteSpace: 'nowrap', fontSize: '10px' }}>Delivery</th>
                  <th style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 600, border: '1px solid #334155', background: '#fffbeb',whiteSpace: 'nowrap', fontSize: '10px' }}>Notes</th>
                  <th style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 600, border: '1px solid #334155', background: '#fffbeb',whiteSpace: 'nowrap', fontSize: '10px' }}>Status</th>
                  <th style={{ padding: '5px 3px', textAlign: 'center', fontWeight: 600, border: '1px solid #334155', background: '#fffbeb',whiteSpace: 'nowrap', fontSize: '10px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id || idx} style={{ background: row.id ? '#f8fafc' : '#fef9e7' }}>
                    <td style={{ padding: '3px 2px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      {idx + 1}
                      {row.id && <span style={{ fontSize: '0.55rem', color: '#10b981', display: 'block' }}>✓</span>}
                    </td>
                    <td style={{ padding: '2px 2px', border: '1px solid #e2e8f0' }}>
                      <input type="text" value={row.type || ''} onChange={e => updateRow(idx, 'type', e.target.value)} style={{ width: '100%', fontSize: '19px', border: 'none', background: 'transparent', padding: '2px 2px' }} placeholder="PIR" />
                    </td>
                    <td style={{ padding: '2px 2px', border: '1px solid #e2e8f0' }}>
                      <input type="number" value={row.thk || ''} onChange={e => updateRow(idx, 'thk', e.target.value)} style={{ width: '100%', fontSize: '19px', border: 'none', background: 'transparent', padding: '2px 2px' }} placeholder="100" />
                    </td>
                    <td style={{ padding: '2px 2px', border: '1px solid #e2e8f0' }}>
                      <input type="text" value={row.joint || ''} onChange={e => updateRow(idx, 'joint', e.target.value)} style={{ width: '100%', fontSize: '19px', border: 'none', background: 'transparent', padding: '2px 2px' }} placeholder="Clip Joint" />
                    </td>
                    <td style={{ padding: '2px 2px', border: '1px solid #e2e8f0' }}>
                      <input type="text" value={row.front || ''} onChange={e => updateRow(idx, 'front', e.target.value)} style={{ width: '100%', fontSize: '19px', border: 'none', background: 'transparent', padding: '2px 2px' }} placeholder="PPGI" />
                    </td>
                    <td style={{ padding: '2px 2px', border: '1px solid #e2e8f0' }}>
                      <input type="text" value={row.back || ''} onChange={e => updateRow(idx, 'back', e.target.value)} style={{ width: '100%', fontSize: '19px', border: 'none', background: 'transparent', padding: '2px 2px' }} placeholder="PPGI" />
                    </td>
                    <td style={{ padding: '2px 2px', border: '1px solid #e2e8f0' }}>
                      <input type="number" step="0.01" value={row.frontThk || ''} onChange={e => updateRow(idx, 'frontThk', e.target.value)} style={{ width: '100%', fontSize: '19px', border: 'none', background: 'transparent', padding: '2px 2px' }} placeholder="0.5" />
                    </td>
                    <td style={{ padding: '2px 2px', border: '1px solid #e2e8f0' }}>
                      <input type="number" step="0.01" value={row.backThk || ''} onChange={e => updateRow(idx, 'backThk', e.target.value)} style={{ width: '100%', fontSize: '19px', border: 'none', background: 'transparent', padding: '2px 2px' }} placeholder="0.5" />
                    </td>
                    <td style={{ padding: '2px 2px', border: '1px solid #e2e8f0' }}>
                      <input type="text" value={row.surface || ''} onChange={e => updateRow(idx, 'surface', e.target.value)} style={{ width: '100%', fontSize: '19px', border: 'none', background: 'transparent', padding: '2px 2px' }} placeholder="RIB" />
                    </td>
                    <td style={{ padding: '2px 2px', border: '1px solid #e2e8f0' }}>
                      <input type="number" value={row.width || ''} onChange={e => updateRow(idx, 'width', e.target.value)} style={{ width: '100%', fontSize: '19px', border: 'none', background: 'transparent', padding: '2px 2px' }} placeholder="1150" required />
                    </td>
                    <td style={{ padding: '2px 2px', border: '1px solid #e2e8f0' }}>
                      <input type="number" value={row.length || ''} onChange={e => updateRow(idx, 'length', e.target.value)} style={{ width: '100%', fontSize: '19px', border: 'none', background: 'transparent', padding: '2px 2px' }} placeholder="3000" required />
                    </td>
                    <td style={{ padding: '2px 2px', border: '1px solid #e2e8f0' }}>
                      <input type="text" value={row.cutting || ''} onChange={e => updateRow(idx, 'cutting', e.target.value)} style={{ width: '100%', fontSize: '19px', border: 'none', background: 'transparent', padding: '2px 2px' }} />
                    </td>
                    <td style={{ padding: '2px 2px', border: '1px solid #e2e8f0' }}>
                      <input type="text" value={row.salesman || ''} onChange={e => updateRow(idx, 'salesman', e.target.value)} style={{ width: '100%', fontSize: '15px', border: 'none', background: 'transparent', padding: '2px 2px' }} />
                    </td>
                    <td style={{ padding: '2px 2px', border: '1px solid #e2e8f0' }}>
                      <input type="text" value={row.application || ''} onChange={e => updateRow(idx, 'application', e.target.value)} style={{ width: '100%', fontSize: '19px', border: 'none', background: 'transparent', padding: '2px 2px' }} />
                    </td>
                    <td style={{ padding: '2px 2px', border: '1px solid #e2e8f0' }}>
                      <input type="date" value={row.delivery || ''} onChange={e => updateRow(idx, 'delivery', e.target.value)} style={{ width: '100%', fontSize: '15px', border: 'none', background: 'transparent', padding: '2px 2px' }} />
                    </td>
                    <td style={{ padding: '2px 2px', border: '1px solid #e2e8f0' }}>
                      <input type="text" value={row.notes || ''} onChange={e => updateRow(idx, 'notes', e.target.value)} style={{ width: '100%', fontSize: '19px', border: 'none', background: 'transparent', padding: '2px 2px' }} />
                    </td>
                    <td style={{ padding: '2px 2px', border: '1px solid #e2e8f0' }}>
                      <select value={row.status || 'pending'} onChange={e => updateRow(idx, 'status', e.target.value)} style={{ width: '100%', fontSize: '15px', border: 'none', background: 'transparent', padding: '2px 2px' }}>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </td>
                    <td style={{ padding: '2px 2px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => deleteRow(idx)}
                        disabled={rows.length <= 1}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: rows.length <= 1 ? 'not-allowed' : 'pointer',
                          color: rows.length <= 1 ? '#cbd5e1' : '#ef4444',
                          fontSize: '16px',
                          padding: '0 4px',
                          opacity: rows.length <= 1 ? 0.5 : 1,
                        }}
                        title={rows.length <= 1 ? 'Cannot delete the last panel' : 'Delete panel'}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ 
          padding: '12px 20px', 
          borderTop: '1px solid #e2e8f0', 
          flexShrink: 0, 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '10px', 
          background: '#fff' 
        }}>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>Cancel</button>
          <button
            onClick={() => {
              if (rows.length === 0 && panels.length > 0) {
                alert('Cannot delete all panels. At least one panel must remain.');
                return;
              }
              onConfirm(rows);
            }}
            className="btn-primary"
            style={{ padding: '6px 18px', fontSize: '0.85rem' }}
          >
            ✅ Confirm Changes
          </button>
        </div>
      </div>

      {showAddModal && (
        <AddPanelsModal
          projectNo={projectNo}
          onClose={() => setShowAddModal(false)}
          onConfirm={handleAddPanels}
        />
      )}
    </div>
  );
};

// ==================== MODIFIED BulkUpdateModal ====================
const BulkUpdateModal = ({ isOpen, onClose, projects, onUpdate, addNotification, fetchProjects, activeTab, allPanelRefs, setAllPanelRefs }) => {
  const [selectedIds, setSelectedIds] = useState([]);
  const [editedData, setEditedData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingPanels, setLoadingPanels] = useState({});
  const [editPanelsProjectId, setEditPanelsProjectId] = useState(null);
  const [expandedProjects, setExpandedProjects] = useState(new Set());

  useEffect(() => {
    if (!isOpen) {
      setSelectedIds([]);
      setEditedData({});
      setIsSubmitting(false);
      setSearchTerm('');
      setLoadingPanels({});
      setEditPanelsProjectId(null);
      setExpandedProjects(new Set());
    }
  }, [isOpen]);

  const filteredProjects = projects.filter(p => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      (p.projectNo && p.projectNo.toLowerCase().includes(term)) ||
      (p.customer && p.customer.toLowerCase().includes(term))
    );
  });

  const buildEditSnapshot = (project, existingFilesMap = {}) => {
    let cats = [];
    if (Array.isArray(project.selectedCategories)) {
      cats = project.selectedCategories;
    } else if (typeof project.selectedCategories === 'string' && project.selectedCategories) {
      cats = project.selectedCategories.split(',').map(s => s.trim()).filter(Boolean);
    }
    const fileCats = Object.keys(existingFilesMap).filter(cat => (existingFilesMap[cat] || []).length > 0);
    const mergedCats = Array.from(new Set([...cats, ...fileCats]));
    return {
      id: project.id,
      projectNo: project.projectNo || '',
      customer: project.customer || '',
      projectName: project.projectName || '',
      salesman: project.salesman || '',
      drawingDate: project.drawingDate || '',
      requestedDelivery: project.requestedDelivery || '',
      poPayment: project.poPayment || '',
      remarks: project.remarks || '',
      selectedCategories: mergedCats,
      categoryFiles: {},
      existingFiles: existingFilesMap,
      loadingFiles: false,
      panels: [],
      panelCount: 0,
    };
  };

  const fetchPanelsForProject = async (projectId, projectNo) => {
    setLoadingPanels(prev => ({ ...prev, [projectId]: true }));
    try {
      const allPanels = await viewPanelAPI.getAll();
      const panels = allPanels.filter(p => p.job_no === projectNo);
      setEditedData(prev => ({
        ...prev,
        [projectId]: {
          ...prev[projectId],
          panels: panels.map(p => ({
            id: p.id,
            type: p.type || '',
            thk: p.panel_thk || '',
            joint: p.joint || '',
            front: p.surface_front || '',
            back: p.surface_back || '',
            frontThk: p.surface_front_thk || '',
            backThk: p.surface_back_thk || '',
            surface: p.surface_type || '',
            width: p.width || '',
            length: p.length || '',
            cutting: p.cutting || '',
            salesman: p.salesman || '',
            application: p.application || '',
            delivery: p.estimated_delivery || '',
            notes: p.notes || '',
            status: p.status || 'pending',
          })),
          panelCount: panels.length,
        }
      }));
    } catch (err) {
      addNotification(`❌ Failed to load panels for ${projectNo}: ${err.message}`);
    } finally {
      setLoadingPanels(prev => ({ ...prev, [projectId]: false }));
    }
  };

  const selectProject = async (project) => {
    setEditedData(d => ({ ...d, [project.id]: { ...buildEditSnapshot(project, {}), loadingFiles: true } }));
    try {
      const filesFromApi = await real_getProjectFiles(project.projectNo);
      const snapshot = buildEditSnapshot(project, filesFromApi);
      setEditedData(d => ({ ...d, [project.id]: { ...snapshot, loadingFiles: false } }));
      await fetchPanelsForProject(project.id, project.projectNo);
    } catch {
      setEditedData(d => ({ ...d, [project.id]: { ...buildEditSnapshot(project, {}), loadingFiles: false } }));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        setEditedData(d => { const n = { ...d }; delete n[id]; return n; });
        return prev.filter(i => i !== id);
      } else {
        const project = projects.find(p => p.id === id);
        if (project) selectProject(project);
        return [...prev, id];
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProjects.length) {
      setSelectedIds([]);
      setEditedData({});
    } else {
      filteredProjects.forEach(p => {
        if (!editedData[p.id]) selectProject(p);
      });
      setSelectedIds(filteredProjects.map(p => p.id));
    }
  };

  const toggleProjectExpand = (projectId) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const updateField = (id, field, value) => {
    setEditedData(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const updateCategoryList = (id, categories) => {
    setEditedData(prev => ({ ...prev, [id]: { ...prev[id], selectedCategories: categories } }));
  };

  const handleCategoryFileUpload = (id, categoryId, newFiles) => {
    if (!newFiles.length) return;
    setEditedData(prev => ({
      ...prev,
      [id]: { ...prev[id], categoryFiles: { ...prev[id].categoryFiles, [categoryId]: [...(prev[id].categoryFiles?.[categoryId] || []), ...newFiles] } }
    }));
  };

  const removeNewFile = (id, categoryId, fileIndex) => {
    setEditedData(prev => {
      const files = [...(prev[id].categoryFiles?.[categoryId] || [])];
      files.splice(fileIndex, 1);
      return { ...prev, [id]: { ...prev[id], categoryFiles: { ...prev[id].categoryFiles, [categoryId]: files } } };
    });
  };

  const clearNewFiles = (id, categoryId) => {
    setEditedData(prev => ({ ...prev, [id]: { ...prev[id], categoryFiles: { ...prev[id].categoryFiles, [categoryId]: [] } } }));
  };

  const handleDeleteExistingFile = async (id, categoryId, fileId, filename) => {
    const confirmed = window.confirm(`Delete "${filename}" from the server? This cannot be undone.`);
    if (!confirmed) return;
    try {
      await real_deleteProjectFile(fileId);
      setEditedData(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          existingFiles: {
            ...prev[id].existingFiles,
            [categoryId]: (prev[id].existingFiles[categoryId] || []).filter(f => f.id !== fileId),
          }
        }
      }));
      addNotification(`🗑️ Deleted ${filename} from ${categoryId}`);
    } catch (err) {
      addNotification(`❌ Could not delete ${filename}: ${err.message}`);
    }
  };

  const openPanelEditor = (projectId) => {
    setEditPanelsProjectId(projectId);
  };

  const closePanelEditor = () => {
    setEditPanelsProjectId(null);
  };

  const confirmPanelEdit = async (editedPanels) => {
    const projectId = editPanelsProjectId;
    const projectData = editedData[projectId];
    if (!projectData) return;

    const originalPanels = projectData.panels || [];

    try {
      const originalIds = new Set(originalPanels.map(p => p.id).filter(Boolean));
      const editedIds = new Set(editedPanels.map(p => p.id).filter(Boolean));
      const idsToDelete = [...originalIds].filter(id => !editedIds.has(id));

      for (const id of idsToDelete) {
        await viewPanelAPI.delete(id);
      }

      const usedRefs = [...allPanelRefs];
      for (const row of editedPanels) {
        const payload = {
          project_id: editPanelsProjectId,
          job_no: projectData.projectNo,
          type: row.type || null,
          panel_thk: parseFloat(row.thk) || null,
          joint: row.joint || null,
          surface_front: row.front || null,
          surface_back: row.back || null,
          surface_front_thk: parseFloat(row.frontThk) || null,
          surface_back_thk: parseFloat(row.backThk) || null,
          surface_type: row.surface || null,
          width: parseFloat(row.width) || 0,
          length: parseFloat(row.length) || 0,
          qty: 1,
          balance: 1,
          cutting: row.cutting || null,
          salesman: row.salesman || null,
          application: row.application || null,
          estimated_delivery: row.delivery || null,
          notes: row.notes || null,
          status: row.status || 'pending',
        };
        Object.keys(payload).forEach(k => {
          if (payload[k] === '' || payload[k] === null || payload[k] === undefined) {
            delete payload[k];
          }
        });

        if (row.id) {
          await viewPanelAPI.update(row.id, payload);
        } else {
          const ref = generatePanelReference(usedRefs);
          usedRefs.push(ref);
          payload.reference_number = ref;
          await viewPanelAPI.create(payload);
          setAllPanelRefs(prev => [...prev, ref]);
        }
      }

      addNotification(`✅ Panels updated for ${projectData.projectNo}`);
      await fetchPanelsForProject(projectId, projectData.projectNo);
      closePanelEditor();
    } catch (err) {
      addNotification(`❌ Failed to update panels: ${err.message}`);
    }
  };

  const handleSubmitAll = async () => {
    if (selectedIds.length === 0) { addNotification('No projects selected.'); return; }
    setIsSubmitting(true);
    let successCount = 0, failCount = 0;
    for (const id of selectedIds) {
      const snap = editedData[id];
      if (!snap) continue;
      const { categoryFiles: newFilesMap, existingFiles, loadingFiles, selectedCategories, panels, panelCount, ...rest } = snap;
      const payload = { ...rest, selectedCategories };
      delete payload.panelRows;
      try {
        await onUpdate(id, payload);
        for (const catId of Object.keys(newFilesMap)) {
          const filesToUpload = newFilesMap[catId] || [];
          if (filesToUpload.length) {
            const fd = new FormData();
            fd.append('projectNo', snap.projectNo);
            fd.append('category', catId);
            filesToUpload.forEach(f => fd.append('files', f));
            await real_uploadProjectFiles(fd);
          }
        }
        successCount++;
        addNotification(`✅ Updated ${snap.projectNo}`);
      } catch (err) {
        failCount++;
        addNotification(`❌ Failed ${snap.projectNo}: ${err.message}`);
      }
    }
    await fetchProjects(activeTab);
    addNotification(`Bulk update done: ${successCount} updated${failCount ? `, ${failCount} failed` : ''}.`);
    setIsSubmitting(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" style={{
          maxWidth: '98vw', width: '98vw',
          maxHeight: '95vh', height: '95vh',
          display: 'flex', flexDirection: 'column',
          padding: 0, margin: 0, borderRadius: '12px',
          background: '#fff', overflow: 'hidden',
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10000,
        }} onClick={e => e.stopPropagation()}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.4rem' }}>✏️ Bulk Update Projects</h3>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '1rem' }}>Select projects, edit fields, and manage panels via the "Edit Panels" button.</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '2rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
          </div>

          <div style={{ padding: '12px 24px', borderBottom: '1px solid #e2e8f0', flexShrink: 0, background: '#fafbfc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>🔍</span>
              <input
                type="text"
                placeholder="Search by Job No. or Customer..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ flex: 1, padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '1rem', outline: 'none' }}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1.2rem' }}>✕</button>
              )}
            </div>
          </div>

          <div style={{ overflowY: 'auto', padding: '16px 24px', flex: 1, background: '#fafbfc' }}>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px 16px', borderRadius: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '1rem' }}>
                <input type="checkbox" checked={selectedIds.length === filteredProjects.length && filteredProjects.length > 0} onChange={toggleSelectAll} />
                Select all ({filteredProjects.length})
              </label>
              <span style={{ color: '#64748b', fontSize: '0.95rem' }}>{selectedIds.length} selected</span>
            </div>

            {filteredProjects.map(proj => {
              const isSelected = selectedIds.includes(proj.id);
              const data = editedData[proj.id];
              const panelCount = data?.panelCount || 0;
              const loading = loadingPanels[proj.id] || false;
              const isExpanded = expandedProjects.has(proj.id);

              return (
                <div key={proj.id} className="bulk-project-card" style={{
                  marginBottom: '20px',
                  border: `2px solid ${isSelected ? '#6366f1' : '#e2e8f0'}`,
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: isSelected ? '#f8fafc' : '#fff',
                  transition: 'border-color 0.15s, background 0.15s'
                }}>
                  <div
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: isSelected ? '#f1f5f9' : '#fafbfc',
                      borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                    }}
                    onClick={() => toggleProjectExpand(proj.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelect(proj.id);
                        }}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{proj.projectNo}</span>
                      {proj.customer && <span style={{ color: '#475569' }}>— {proj.customer}</span>}
                      {proj.projectName && <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>({proj.projectName})</span>}
                      <span style={{ fontSize: '0.75rem', color: '#64748b', background: '#e2e8f0', padding: '2px 10px', borderRadius: '12px' }}>
                        {panelCount} panels
                      </span>
                    </div>
                    <span style={{ fontSize: '1.2rem', color: '#94a3b8' }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>

                  {isExpanded && isSelected && data && (
                    data.loadingFiles ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                        <div className="loading-spinner" style={{ width: '24px', height: '24px', borderWidth: '3px', margin: '0 auto' }} />
                        Loading project data…
                      </div>
                    ) : (
                      <div style={{ padding: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div className="form-group"><label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Job No.</label><input value={data.projectNo} onChange={e => updateField(proj.id, 'projectNo', e.target.value)} className="styled-input" /></div>
                          <div className="form-group"><label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Customer</label><input value={data.customer} onChange={e => updateField(proj.id, 'customer', e.target.value)} className="styled-input" /></div>
                          <div className="form-group"><label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Project Name</label><input value={data.projectName} onChange={e => updateField(proj.id, 'projectName', e.target.value)} className="styled-input" /></div>
                          <div className="form-group"><label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Salesman</label><input value={data.salesman} onChange={e => updateField(proj.id, 'salesman', e.target.value)} className="styled-input" /></div>
                          <DatePicker value={data.drawingDate} onChange={e => updateField(proj.id, 'drawingDate', e.target.value)} name={`drawingDate-${proj.id}`} label="Drawing Date" />
                          <DatePicker value={data.requestedDelivery} onChange={e => updateField(proj.id, 'requestedDelivery', e.target.value)} name={`delivery-${proj.id}`} label="Requested Delivery" />
                          <PaymentStatusDropdown value={data.poPayment} onChange={e => updateField(proj.id, 'poPayment', e.target.value)} name={`poPayment-${proj.id}`} />
                          <div className="form-group"><label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Remarks</label><input value={data.remarks} onChange={e => updateField(proj.id, 'remarks', e.target.value)} className="styled-input" placeholder="Notes…" /></div>
                        </div>

                        <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '16px', textAlign: 'center' }}>
                          <div style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '8px' }}>
                            🖼️ Panels: {panelCount}
                          </div>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => openPanelEditor(proj.id)}
                            disabled={loading || panelCount === 0}
                            style={{ margin: '0 auto' }}
                          >
                            ✏️ Edit Panels
                          </button>
                          {panelCount === 0 && !loading && (
                            <div style={{ marginTop: '8px', color: '#94a3b8', fontSize: '0.85rem' }}>
                              No panels found for this project.
                            </div>
                          )}
                        </div>

                        <EnhancedCategorySelection
                          uid={`bulk-update-${proj.id}`}
                          selectedCategories={data.selectedCategories}
                          onCategoryChange={cats => updateCategoryList(proj.id, cats)}
                          categoryFiles={data.categoryFiles}
                          onCategoryFileUpload={(catId, files) => handleCategoryFileUpload(proj.id, catId, files)}
                          onRemoveCategoryFile={(catId, fileIndex) => removeNewFile(proj.id, catId, fileIndex)}
                          onClearCategoryFiles={(catId) => clearNewFiles(proj.id, catId)}
                          existingFiles={data.existingFiles}
                          onDeleteExistingFile={(catId, fileId, filename) => handleDeleteExistingFile(proj.id, catId, fileId, filename)}
                          projectNo={data.projectNo}
                        />
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
            <div style={{ color: '#94a3b8', fontSize: '1rem' }}>
              {selectedIds.length} project{selectedIds.length !== 1 ? 's' : ''} selected
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={onClose} className="btn-ghost" disabled={isSubmitting}>Cancel</button>
              <button onClick={handleSubmitAll} className="btn-primary" disabled={isSubmitting || selectedIds.length === 0}>
                {isSubmitting ? 'Updating…' : `Update Selected (${selectedIds.length})`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {editPanelsProjectId && (
        <PanelEditModal
          projectNo={editedData[editPanelsProjectId]?.projectNo || 'Project'}
          panels={editedData[editPanelsProjectId]?.panels || []}
          onClose={closePanelEditor}
          onConfirm={confirmPanelEdit}
        />
      )}
    </>
  );
};

const getPaymentStyle = (payment) => {
  const styles = {
    Done: { bg: '#10b981', text: '#ffffff' },
    'Full Payment': { bg: '#3b82f6', text: '#ffffff' },
    Deposit: { bg: '#f59e0b', text: '#1e293b' },
    'Progress Claim': { bg: '#8b5cf6', text: '#ffffff' },
    Retention: { bg: '#ef4444', text: '#ffffff' },
  };
  return styles[payment] || { bg: '#94a3b8', text: '#ffffff' };
};

// ==================== App ====================
function App({ onLogout }) {
  const { navigate, currentRoute, params } = useSimpleRouter();
  const [userPosition, setUserPosition] = useState(() => getUserPosition());
  const allowedRoutes = getAllowedRoutes(userPosition);
  const isSuperadmin = normalizePosition(userPosition) === 'superadmin' || normalizePosition(userPosition) === 'super_admin';
  const isAdmin = normalizePosition(userPosition) === 'admin' || isSuperadmin;
  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const [projects, setProjects] = useState([]);
  const [editingProject, setEditingProject] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [theme, setTheme] = useState(getStoredTheme);
  const [isPanelEditLocked, setIsPanelEditLocked] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [activeTab, setActiveTab] = useState('approved');
  const [statusUpdateModal, setStatusUpdateModal] = useState({ isOpen: false, project: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setUserPosition(getUserPosition());
  }, []);

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);

  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(() => {
    if (normalizePosition(getUserPosition()) === 'superadmin') return false;
    const saved = localStorage.getItem('aiSidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [aiSidebarWidth, setAiSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('aiSidebarWidth');
    return saved ? parseInt(saved, 10) : 420;
  });
  const [isResizing, setIsResizing] = useState(false);
  const startResizeX = useRef(0);
  const startWidth = useRef(0);

  const [isBatchPanelModalOpen, setIsBatchPanelModalOpen] = useState(false);
  const [batchPanelProject, setBatchPanelProject] = useState(null);
  const [, setBatchPanelStep] = useState('count');
  const [batchPanelCount, setBatchPanelCount] = useState(1);
  const [, setBatchPanelRows] = useState([]);
  const [batchPanelFormData, setBatchPanelFormData] = useState({});
  const [allPanelRefs, setAllPanelRefs] = useState([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Reset page when search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, searchType, projects]);

  useEffect(() => {
      setIsSidebarOpen(!isPanelEditLocked);
  }, [isPanelEditLocked]);

  // Compute paginated data
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const paginatedProjects = filteredProjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Ensure current page is valid when filteredProjects changes
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const fetchAllPanelRefs = useCallback(async () => {
    try {
      const data = await viewPanelAPI.getAll();
      if (Array.isArray(data)) {
        const refs = data.map(p => p.reference_number).filter(Boolean);
        setAllPanelRefs(refs);
      }
    } catch (err) {
      console.error('Failed to fetch panel refs:', err);
    }
  }, []);

  const closeBatchPanelModal = () => {
    setIsBatchPanelModalOpen(false);
    setBatchPanelProject(null);
    setBatchPanelCount(1);
    setBatchPanelStep('count');
    setBatchPanelRows([]);
    setBatchPanelFormData({});
  };

  const handleBatchPanelSingleSubmit = async () => {
    const qty = parseInt(batchPanelCount) || 1;
    if (qty < 1) {
      addNotification('Quantity must be at least 1.');
      return;
    }

    const row = {
      job_no: batchPanelFormData.job_no || batchPanelProject?.projectNo || '',
      type: batchPanelFormData.type || 'PIR',
      panel_thk: batchPanelFormData.panel_thk || '100',
      joint: batchPanelFormData.joint || 'Clip Joint',
      surface_front: batchPanelFormData.surface_front || 'PPGI',
      surface_back: batchPanelFormData.surface_back || 'PPGI',
      surface_front_thk: batchPanelFormData.surface_front_thk || '0.5',
      surface_back_thk: batchPanelFormData.surface_back_thk || '0.5',
      surface_type: batchPanelFormData.surface_type || 'RIB',
      width: batchPanelFormData.width || '1150',
      length: batchPanelFormData.length || '3000',
      qty: qty,
      cutting: batchPanelFormData.cutting || '',
      salesman: batchPanelFormData.salesman || '',
      application: batchPanelFormData.application || '',
      estimated_delivery: batchPanelFormData.estimated_delivery || '',
      notes: batchPanelFormData.notes || '',
    };

    try {
      await fetchAllPanelRefs();
      const existingRefs = [...allPanelRefs];
      const ref = generatePanelReference(existingRefs);
      existingRefs.push(ref);

      const panelData = {
        project_id: batchPanelProject.id,
        job_no: row.job_no,
        reference_number: ref,
        width: parseFloat(row.width) || 0,
        length: parseFloat(row.length) || 0,
        qty: qty,
        balance: qty,
        panel_thk: row.panel_thk ? parseFloat(row.panel_thk) : null,
        surface_front_thk: row.surface_front_thk ? parseFloat(row.surface_front_thk) : null,
        surface_back_thk: row.surface_back_thk ? parseFloat(row.surface_back_thk) : null,
        type: row.type || null,
        joint: row.joint || null,
        surface_front: row.surface_front || null,
        surface_back: row.surface_back || null,
        surface_type: row.surface_type || null,
        cutting: row.cutting || null,
        salesman: row.salesman || null,
        application: row.application || null,
        estimated_delivery: row.estimated_delivery || null,
        notes: row.notes || null,
        status: 'pending',
      };
      Object.keys(panelData).forEach(key => {
        if (panelData[key] === '') panelData[key] = null;
      });

      await viewPanelAPI.create(panelData);
      addNotification(`✅ Created 1 panel (${ref}) with quantity ${qty}`);
      closeBatchPanelModal();
      await fetchAllPanelRefs();
    } catch (err) {
      console.error('Single panel creation failed:', err);
      addNotification(`❌ Failed to create panel: ${err.message}`);
    }
  };

  useEffect(() => {
    localStorage.setItem('aiSidebarOpen', JSON.stringify(isAiSidebarOpen));
  }, [isAiSidebarOpen]);
  useEffect(() => {
    localStorage.setItem('aiSidebarWidth', aiSidebarWidth);
  }, [aiSidebarWidth]);

  const startResize = (e) => {
    e.preventDefault();
    setIsResizing(true);
    startResizeX.current = e.clientX;
    startWidth.current = aiSidebarWidth;
    document.body.style.userSelect = 'none';
  };

  const onResize = useCallback((e) => {
    if (!isResizing) return;
    const delta = startResizeX.current - e.clientX;
    let newWidth = startWidth.current + delta;
    newWidth = Math.min(Math.max(newWidth, 280), 700);
    setAiSidebarWidth(newWidth);
  }, [isResizing]);

  const stopResize = useCallback(() => {
    setIsResizing(false);
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', onResize);
      window.addEventListener('mouseup', stopResize);
      return () => {
        window.removeEventListener('mousemove', onResize);
        window.removeEventListener('mouseup', stopResize);
      };
    }
  }, [isResizing, onResize, stopResize]);

  useEffect(() => {
    if (!searchTerm.trim()) { setFilteredProjects(projects); return; }
    const term = searchTerm.toLowerCase().trim();
    setFilteredProjects(projects.filter(p => {
      if (searchType === 'all') return ['projectNo', 'customer', 'projectName', 'salesman', 'remarks', 'salesDetail'].some(k => p[k]?.toLowerCase().includes(term));
      return p[searchType]?.toLowerCase().includes(term);
    }));
  }, [projects, searchTerm, searchType]);

  const fetchProjects = useCallback(async (status = 'approved') => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await real_getProjectsByStatus(status);
      const enriched = data.map(project => ({
        ...project,
        salesDetail: project.salesDetail || '',
        selectedCategories: Array.isArray(project.selectedCategories)
          ? project.selectedCategories
          : project.selectedCategories
            ? String(project.selectedCategories).split(',').map(s => s.trim()).filter(Boolean)
            : [],
        completion: {
          panelSlab: { completed: project.completed_panel || 0, total: project.total_panel || 0 },
          cutting: { completed: project.completed_cutting || 0, total: project.total_cutting || 0 },
          door: { completed: project.completed_door || 0, total: project.total_door || 0 },
          accessories: { completed: project.completed_accessories || 0, total: project.total_accessories || 0 },
          system: { completed: project.completed_system || 0, total: project.total_system || 0 },
        }
      }));
      setProjects(enriched);
      setFilteredProjects(enriched);
    } catch (err) {
      setError(`Failed to load projects: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentRoute === 'JobList' || currentRoute === 'AdminPage') fetchProjects(activeTab);
  }, [fetchProjects, currentRoute, activeTab]);

  useEffect(() => {
    fetchAllPanelRefs();
  }, [fetchAllPanelRefs]);

  const addNotification = (message) => {
    const id = Date.now();
    setNotifications(p => [{ id, message }, ...p]);
    setTimeout(() => setNotifications(p => p.filter(n => n.id !== id)), 5000);
  };

  const handleStatusTabChange = (tab) => { setActiveTab(tab); fetchProjects(tab); };

  const handleUpdateProjectStatus = async (projectId, status) => {
    try {
      await real_updateProjectStatus(projectId, status);
      setProjects(p => p.map(pr => pr.id === projectId ? { ...pr, status } : pr));
      addNotification(`✅ Project status updated to ${status}`);
      fetchProjects(activeTab);
    } catch (error) {
      addNotification(`❌ Failed to update: ${error.message}`);
      throw error;
    }
  };

  const handleSaveEditedProject = async (updatedPayload) => {
    const updated = await real_updateProject(updatedPayload.id, updatedPayload);
    setProjects(p => p.map(pr => pr.id === updated.id ? { ...updated, completion: pr.completion } : pr));
    fetchProjects(activeTab);
  };

  const handleBulkProjectSubmit = async (proj) => {
    try {
      const added = await real_createProject({
        ...proj,
        selectedCategories: proj.selectedCategories || [],
        status: 'active'
      });
      const catFiles = proj.categoryFiles || {};
      const uploadPromises = Object.keys(catFiles).map(async (catId) => {
        const files = catFiles[catId];
        if (files && files.length) {
          const fd = new FormData();
          fd.append('projectNo', added.projectNo);
          fd.append('category', catId);
          files.forEach(f => fd.append('files', f));
          await real_uploadProjectFiles(fd);
        }
      });
      await Promise.all(uploadPromises);
      addNotification(`✅ Project ${added.projectNo} created`);
      return { success: true };
    } catch (err) {
      addNotification(`❌ Failed to create project: ${err.message}`);
      throw err;
    }
  };

  const startDeleteConfirmation = (id, projectNo) => setConfirmDeleteId({ id, projectNo });
  const confirmDeleteProject = async () => {
    if (!confirmDeleteId) return;
    const { id, projectNo } = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await real_deleteProject(id);
      setProjects(p => p.filter(pr => pr.id !== id));
      addNotification(`🗑️ Job #${projectNo} deleted.`);
    } catch (err) {
      addNotification(`❌ Could not delete job.`);
    }
  };

  const toggleAiSidebar = () => setIsAiSidebarOpen(prev => !prev);
  const openBulkCreateModal = () => setShowBulkModal(true);
  const openBulkUpdateModal = () => setShowBulkUpdateModal(true);

  const navItems = [
    { path: '/superadmin', label: 'Superadmin', icon: '🛡️', route: 'Superadmin' },
    { path: '/', label: 'Project List', icon: '🏠', route: 'JobList' },
    { path: '/admin', label: 'Administration Projects', icon: '👨‍💼', route: 'AdminPage' },
    { path: '/panels', label: 'Panel / Slab', icon: '🖼️', route: 'PanelSlab' },
    { path: '/cutting', label: 'Cutting', icon: '📐', route: 'Cutting' },
    { path: '/doors', label: 'Door', icon: '🚪', route: 'Door' },
    { path: '/accessories', label: 'Accessories', icon: '🔧', route: 'Accessories' },
    { path: '/system', label: 'Refrigeration', icon: '⚙️', route: 'System' },
    { path: '/transportation', label: 'Transportation/QC', icon: '🚚', route: 'Transportation' },
    { path: '/stock', label: 'PanelStock', icon: '📦', route: 'StockPage' },
  ];

  const visibleNavItems = navItems.filter(item => allowedRoutes.includes(item.route));

  useEffect(() => {
    if (!userPosition) return;
    if (!allowedRoutes.includes(currentRoute)) {
      const fallback = visibleNavItems[0];
      if (fallback) navigate(fallback.path);
    }
  }, [currentRoute, userPosition])

  if (isLoading && (currentRoute === 'JobList' || currentRoute === 'AdminPage')) {
    return (
      <div className="App sidebar-layout">
        <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
          <div className="sidebar-header">
            {isSidebarOpen && (
              <div className="sidebar-brand">
                <div className="brand-text">
                  <span className="brand-name">UnitedPanel</span>
                  <span className="brand-sub">Project Manager</span>
                </div>
              </div>
            )}
          </div>
          <nav className="sidebar-nav">
            {visibleNavItems.map(item => (
              <a key={item.path} href={`#${item.path}`} className={`nav-item ${currentRoute === item.route ? 'active' : ''}`}>
                <span className="nav-icon">{item.icon}</span>
                {isSidebarOpen && <span className="nav-label">{item.label}</span>}
              </a>
            ))}
          </nav>
        </aside>
        <main className={`content-area ${isSidebarOpen ? 'shrunk' : 'expanded'}`}>
          <div className="loading-screen">
            <div className="loading-spinner" />
            <p>Loading projects…</p>
          </div>
        </main>
      </div>
    );
  }

  const renderProjectRow = (project) => {
    const completion = project.completion || {};
    const truncatedRemarks = project.remarks && project.remarks.length > 60 ? project.remarks.substring(0, 60) + '…' : project.remarks || '—';
    const categoryKeys = [
      { key: 'panelSlab', label: 'Panel' },
      { key: 'cutting', label: 'Cut' },
      { key: 'door', label: 'Door' },
      { key: 'accessories', label: 'Acc' },
      { key: 'system', label: 'Sys' }
    ];
    return (
      <tr key={project.id} className="project-table-row" onClick={() => navigate(`/files/${project.projectNo}`)}>
        <td className="mono strong">#{project.projectNo}</td>
        <td className="customer-cell"><strong>{project.customer}</strong></td>
        <td className="project-name-cell">{project.projectName || '—'}</td>
        <td className="salesman-cell">{project.salesman || '-'}</td>
        <td className="date-cell">{formatDateForDisplay(project.drawingDate)}</td>
        <td className="date-cell">{formatDateForDisplay(project.requestedDelivery)}</td>
        <td className="payment-cell">
          {project.poPayment ? (
            (() => {
              const style = getPaymentStyle(project.poPayment);
              return (
                <span
                  className="payment-pill"
                  style={{
                    background: style.bg,
                    color: style.text,
                    borderRadius: '20px',
                    fontWeight: 600,
                    display: 'inline-block',
                    border: 'none',
                  }}
                >
                  {project.poPayment}
                </span>
              );
            })()
          ) : (
            <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>Not set</span>
          )}
        </td>
        <td className="progress-cell-vertical">
          <div className="progress-vertical-list">
            {categoryKeys.map(({ key, label }) => {
              const comp = completion[key] || { completed: 0, total: 0 };
              const cls = comp.total === 0 ? 'none' : comp.completed === comp.total ? 'done' : 'wip';
              return (
                <div key={key} className="progress-vertical-item">
                  <span className="progress-vertical-label">{label}</span>
                  <span className={`progress-vertical-value ${cls}`}>{comp.completed}/{comp.total}</span>
                </div>
              );
            })}
          </div>
        </td>
        <td className="remarks-cell" title={project.remarks || ''}>{truncatedRemarks}</td>
        <td className="sa-col-actions" onClick={e => e.stopPropagation()}>
          {isAdmin ? (
            <div className="row-actions">
              <button
                onClick={() => setStatusUpdateModal({ isOpen: true, project })}
                className="btn-status btn-sm"
              >
                Status
              </button>
              <button
                onClick={() => startDeleteConfirmation(project.id, project.projectNo)}
                className="btn-danger btn-sm"
              >
                Delete
              </button>
            </div>
          ) : (
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>View only</span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="App sidebar-layout">
      <aside className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          {isSidebarOpen && (
            <div className="sidebar-brand">
              <div className="brand-text">
                <span className="brand-name">UnitedPanel</span>
                <span className="brand-sub">Project Manager</span>
              </div>
            </div>
          )}
          <button
              className="sidebar-toggle"
              onClick={() => { if (!isPanelEditLocked) setIsSidebarOpen(!isSidebarOpen); }}
          >
              {isSidebarOpen ? '◀' : '▶'}
          </button>
        </div>
        <nav className="sidebar-nav">
          {visibleNavItems.map(item => (
            <a key={item.path}
                href={`#${item.path}`}
                className={`nav-item ${currentRoute === item.route ? 'active' : ''} ${isPanelEditLocked ? 'disabled' : ''}`}
                onClick={(e) => {
                    if (isPanelEditLocked) { e.preventDefault(); return; }
                    navigate(item.path);
                }}
                title={!isSidebarOpen ? item.label : (isPanelEditLocked ? 'Finish editing the panel first' : undefined)}
            >
                <span className="nav-icon">{item.icon}</span>
                {isSidebarOpen && <span className="nav-label">{item.label}</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button
            className="nav-item theme-toggle"
            onClick={() => setTheme((current) => applyTheme(toggleThemeValue(current)))}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            <span className="nav-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
            {isSidebarOpen && <span className="nav-label">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>}
          </button>
          <button className="nav-item logout-btn" onClick={() => onLogout && onLogout()} title={!isSidebarOpen ? 'Log Out' : undefined}>
            <span className="nav-icon">🚪</span>
            {isSidebarOpen && <span className="nav-label">Log Out</span>}
          </button>
        </div>
      </aside>

      <main className={`content-area ${isSidebarOpen ? 'shrunk' : 'expanded'} ${isAiSidebarOpen ? 'ai-open' : ''}`} style={isAiSidebarOpen ? { marginRight: aiSidebarWidth } : {}}>
        <div className="toast-container">
          {notifications.map(n => (
            <div key={n.id} className="toast"><span>{n.message}</span><button onClick={() => setNotifications(p => p.filter(x => x.id !== n.id))}>✕</button></div>
          ))}
        </div>

        {currentRoute === 'JobList' && (
          <>
            <div className="page-header">
              <div className="page-header-left">
                <h1 className="page-title">Project Tracker</h1>
                <p className="page-subtitle">Manage and monitor all active projects</p>
              </div>
            </div>
            <StatusTabs activeTab={activeTab} onTabChange={handleStatusTabChange} />
            {error && <div className="error-banner">⚠️ {error}</div>}
            <SearchBar searchTerm={searchTerm} onSearchChange={e => setSearchTerm(e.target.value)} searchType={searchType} onSearchTypeChange={e => setSearchType(e.target.value)} onClearSearch={() => { setSearchTerm(''); setSearchType('all'); }} totalProjects={projects.length} filteredCount={filteredProjects.length} />
            <div className="list-header"><h3>{activeTab === 'done' ? 'Completed' : 'Approved'} Projects <span className="list-count">{filteredProjects.length}</span></h3></div>
            {filteredProjects.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">{searchTerm ? '🔍' : '📋'}</div>
                <h4>{searchTerm ? 'No results found' : 'No projects yet'}</h4>
                <p>{searchTerm ? `No projects match "${searchTerm}"` : 'Create your first project to get started.'}</p>
                {searchTerm && <button onClick={() => { setSearchTerm(''); setSearchType('all'); }} className="btn-ghost" style={{ marginTop: '1rem' }}>Clear Search</button>}
              </div>
            ) : (
              <>
                <div className="project-table-wrap">
                  <table className="project-table">
                    <thead>
                      <tr>
                        <th>Job No.</th><th>Customer</th><th>Project Name</th><th>Salesman</th>
                        <th>Drawing Date</th><th>Delivery</th><th>Payment</th><th>Progress</th>
                        <th>Remarks</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>{paginatedProjects.map(renderProjectRow)}</tbody>
                  </table>
                </div>

                {/* Pagination controls */}
                {filteredProjects.length > 0 && (
                  <div className="pagination-bar">
                    <button
                      className="pagination-btn"
                      disabled={currentPage === 1}
                      onClick={() => goToPage(currentPage - 1)}
                    >
                      ◀ Previous
                    </button>
                    <span className="pagination-info">
                      Page {currentPage} of {totalPages}
                    </span>
                    <div className="pagination-pages">
                      {[...Array(totalPages).keys()].map((_, idx) => {
                        const page = idx + 1;
                        if (
                          page === 1 ||
                          page === totalPages ||
                          Math.abs(page - currentPage) <= 1
                        ) {
                          return (
                            <button
                              key={page}
                              className={`pagination-page ${page === currentPage ? 'active' : ''}`}
                              onClick={() => goToPage(page)}
                            >
                              {page}
                            </button>
                          );
                        } else if (
                          (page === 2 && currentPage > 3) ||
                          (page === totalPages - 1 && currentPage < totalPages - 2)
                        ) {
                          return <span key={page} className="pagination-ellipsis">…</span>;
                        }
                        return null;
                      })}
                    </div>
                    <button
                      className="pagination-btn"
                      disabled={currentPage === totalPages}
                      onClick={() => goToPage(currentPage + 1)}
                    >
                      Next ▶
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {currentRoute === 'FileView' && params.projectNo && <FileView projectNo={params.projectNo} navigateHome={() => navigate('/')} />}
        {currentRoute === 'PanelSlab' && <PanelSlab navigate={navigate} onPanelEditLockChange={setIsPanelEditLocked} />}
        {currentRoute === 'Cutting' && <Cutting navigate={navigate} />}
        {currentRoute === 'Door' && <Door navigate={navigate} />}
        {currentRoute === 'Accessories' && <Accessories navigate={navigate} />}
        {currentRoute === 'System' && <System navigate={navigate} />}
        {currentRoute === 'Transportation' && <Transportation navigate={navigate} />}
        {currentRoute === 'ReportGenerator' && <ReportGenerator />}
        {currentRoute === 'ExcelExtractor' && <ExcelExtractor />}
        {currentRoute === 'NotificationPage' && <NotificationPage notifications={notifications} removeNotification={id => setNotifications(p => p.filter(n => n.id !== id))} clearAllNotifications={() => setNotifications([])} showActivityLogs={false} />}
        {currentRoute === 'AdminPage' && <AdminPage projects={projects} navigate={navigate} />}
        {currentRoute === 'Superadmin' && <SuperadminDashboard />}
        {currentRoute === 'StockPage' && <StockPage />}
      </main>

      {/* AI Sidebar – only for admin */}
      {isAdmin && !isSuperadmin && isAiSidebarOpen && (
        <aside className="ai-sidebar" style={{ width: aiSidebarWidth, position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 1000, background: '#fff', boxShadow: '-2px 0 12px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
          <div className="ai-sidebar-resize-handle" onMouseDown={startResize} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '5px', cursor: 'ew-resize', background: 'transparent', zIndex: 10 }} />
          <AIChatWindow
            embedded={true}
            onClose={toggleAiSidebar}
            addNotification={addNotification}
            fetchProjects={fetchProjects}
            activeTab={activeTab}
            createProject={real_createProject}
            uploadProjectFiles={real_uploadProjectFiles}
            onBulkCreateClick={openBulkCreateModal}
            onBulkUpdateClick={openBulkUpdateModal}
          />
        </aside>
      )}

      {/* AI FAB – only for admin */}
      {isAdmin && !isSuperadmin && !isAiSidebarOpen && (
        <button
          className="ai-chat-fab"
          onClick={() => setIsAiSidebarOpen(true)}
          style={{ position: 'fixed', bottom: '24px', right: '24px', width: '56px', height: '56px', borderRadius: '28px', background: '#6366f1', color: 'white', border: 'none', cursor: 'pointer', fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 1001 }}
        >
          💬
        </button>
      )}

      <StatusUpdateModal isOpen={statusUpdateModal.isOpen} onClose={() => setStatusUpdateModal({ isOpen: false, project: null })} project={statusUpdateModal.project} onUpdateStatus={handleUpdateProjectStatus} />

      {editingProject && (
        <EditProjectModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSave={handleSaveEditedProject}
          addNotification={addNotification}
          allPanelRefs={allPanelRefs}
          setAllPanelRefs={setAllPanelRefs}
        />
      )}

      {confirmDeleteId && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="modal-content confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon">🗑️</div>
            <h3>Delete Project?</h3>
            <p>This will permanently delete job <strong>#{confirmDeleteId.projectNo}</strong>. This action cannot be undone.</p>
            <div className="confirm-actions">
              <button onClick={() => setConfirmDeleteId(null)} className="btn-ghost">Cancel</button>
              <button onClick={confirmDeleteProject} className="btn-danger">Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {showBulkModal && (
        <BulkProjectCreator
          onSubmit={handleBulkProjectSubmit}
          onCancel={() => setShowBulkModal(false)}
          getTodayDate={getTodayDate}
          EMPTY_PROJECT={EMPTY_PROJECT}
        />
      )}

      {showBulkUpdateModal && (
        <BulkUpdateModal
          isOpen={showBulkUpdateModal}
          onClose={() => setShowBulkUpdateModal(false)}
          projects={projects}
          onUpdate={real_updateProject}
          addNotification={addNotification}
          fetchProjects={fetchProjects}
          activeTab={activeTab}
          allPanelRefs={allPanelRefs}
          setAllPanelRefs={setAllPanelRefs}
        />
      )}

      {isBatchPanelModalOpen && batchPanelProject && (
        <div className="panel-modal-overlay" onClick={closeBatchPanelModal}>
          <div className="panel-modal-box" onClick={e => e.stopPropagation()}>
            <div className="panel-modal-header">
              <h2>Create Panel for {batchPanelProject.projectNo}</h2>
              <button className="panel-modal-close-btn" onClick={closeBatchPanelModal} title="Close">×</button>
            </div>

            <div className="panel-modal-body">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleBatchPanelSingleSubmit();
                }}
                className="panel-modal-count-form"
              >
                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="batchPanelCount">Total quantity for this panel:</label>
                  <input
                    type="number"
                    id="batchPanelCount"
                    min="1"
                    max="9999"
                    value={batchPanelCount}
                    onChange={e => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v) && v >= 1) setBatchPanelCount(v);
                    }}
                    className="panel-modal-count-input"
                    autoFocus
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                  <button type="button" className="panel-btn panel-btn-ghost" onClick={closeBatchPanelModal}>Cancel</button>
                  <button type="submit" className="panel-btn panel-btn-primary">Create Panel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;