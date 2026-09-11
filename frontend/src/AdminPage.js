import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './AdminPage.css';
import { getAllAdminJobs, createAdminJob, updateAdminJob, deleteAdminJob } from './apiService';
import { FileView } from './FileComponents';
import AIChatWindow from './AIChatWindow';

const tableColumns = [
    'DATE', 'JOB NO.', 'CUSTOMER', 'SELL', 'COST', 'MARGIN', 'SIGNATURE', 'REMARKS'
];

// =========================================================
// Utility Functions for Date Formatting
// =========================================================
const formatDateToYYYYMMDD = (dateString) => {
    if (!dateString) return '';
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateString;
    }
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error('Error formatting date:', error);
        return '';
    }
};

const getCurrentDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getInitialValue = (col) => {
    if (col === 'DATE') return getCurrentDate();
    return '';
};

// =========================================================
// SignatureCanvas Component
// =========================================================
const SignatureCanvas = ({ signatureData, onSaveSignature, onClearSignature }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [ctx, setCtx] = useState(null);
    
    useEffect(() => {
        if (canvasRef.current) {
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            context.fillStyle = 'white';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.lineWidth = 2;
            context.lineCap = 'round';
            context.lineJoin = 'round';
            context.strokeStyle = '#000000';
            setCtx(context);
            if (signatureData) {
                const img = new Image();
                img.onload = () => context.drawImage(img, 0, 0, canvas.width, canvas.height);
                img.src = signatureData;
            }
        }
    }, [signatureData]);

    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        let clientX, clientY;
        if (e.touches && e.touches.length === 1) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;
        return { x, y };
    };

    const startDrawing = (e) => {
        if (!ctx) return;
        const { x, y } = getCoordinates(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };
    
    const draw = (e) => {
        if (!isDrawing || !ctx) return;
        const { x, y } = getCoordinates(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };
    
    const stopDrawing = () => setIsDrawing(false);
    
    const handleSave = () => {
        if (canvasRef.current) {
            const originalCanvas = canvasRef.current;
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCanvas.width = 400;
            tempCanvas.height = 150;
            tempCtx.drawImage(originalCanvas, 0, 0, originalCanvas.width, originalCanvas.height, 0, 0, tempCanvas.width, tempCanvas.height);
            const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.8);
            onSaveSignature(dataUrl);
        }
    };
    
    const handleClear = () => {
        if (canvasRef.current && ctx) {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            onClearSignature();
        }
    };
    
    return (
        <div className="signature-container">
            <div className="signature-header">
                <h4>Draw Signature</h4>
                <div className="signature-instructions">Draw your signature in the box below</div>
            </div>
            <div className="signature-canvas-wrapper">
                <canvas
                    ref={canvasRef}
                    width={400}
                    height={150}
                    className="signature-canvas"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={(e) => { e.preventDefault(); if (e.touches.length === 1) startDrawing(e); }}
                    onTouchMove={(e) => { e.preventDefault(); if (e.touches.length === 1) draw(e); }}
                    onTouchEnd={stopDrawing}
                />
            </div>
            <div className="signature-controls">
                <button type="button" onClick={handleClear} className="signature-btn clear-btn">Clear</button>
                <button type="button" onClick={handleSave} className="signature-btn save-btn">Save Signature</button>
            </div>
            {signatureData && (
                <div className="signature-preview">
                    <h5>Current Signature:</h5>
                    <img src={signatureData} alt="Signature Preview" className="signature-image-preview" />
                </div>
            )}
        </div>
    );
};

// =========================================================
// ProjectModal Component (SALES removed)
// =========================================================
const ProjectModal = ({ isOpen, onClose, columns, onSave, jobToEdit }) => {
    const initialFormState = useMemo(() => columns.reduce((acc, col) => ({ ...acc, [col]: col === 'SIGNATURE' ? null : getInitialValue(col) }), {}), [columns]);
    const [formData, setFormData] = useState(initialFormState);
    const [error, setError] = useState(null);
    const [showSignaturePad, setShowSignaturePad] = useState(false);
    const [tempSignature, setTempSignature] = useState(null);

    const sellValue = formData['SELL'];
    const costValue = formData['COST'];
    const marginValue = formData['MARGIN'];

    useEffect(() => {
        if (jobToEdit) {
            const mappedData = {
                'DATE': formatDateToYYYYMMDD(jobToEdit.dateEntry) || getInitialValue('DATE'),
                'JOB NO.': jobToEdit.jobNo || getInitialValue('JOB NO.'),
                'CUSTOMER': jobToEdit.customerName || getInitialValue('CUSTOMER'),
                'SELL': jobToEdit.sellPrice === null || jobToEdit.sellPrice === 0 ? '' : Number(jobToEdit.sellPrice),
                'COST': jobToEdit.cost === null || jobToEdit.cost === 0 ? '' : Number(jobToEdit.cost),
                'MARGIN': jobToEdit.margin === null || jobToEdit.margin === 0 ? '' : Number(jobToEdit.margin),
                'SIGNATURE': jobToEdit.signatureData,
                'REMARKS': jobToEdit.remarks || getInitialValue('REMARKS'),
            };
            setFormData(mappedData);
            setTempSignature(jobToEdit.signatureData);
        } else {
            setFormData(initialFormState);
            setTempSignature(null);
        }
    }, [jobToEdit, isOpen, initialFormState]);

    useEffect(() => {
        const sellNum = Number(sellValue);
        const costNum = Number(costValue);
        const currentMargin = marginValue;
        if (!isNaN(sellNum) && !isNaN(costNum) && sellValue !== '' && costValue !== '') {
            const calculatedMargin = parseFloat((sellNum - costNum).toFixed(2));
            if (calculatedMargin !== currentMargin) {
                setFormData(prev => ({ ...prev, 'MARGIN': calculatedMargin }));
            }
        } else if (currentMargin !== '') {
            setFormData(prev => ({ ...prev, 'MARGIN': '' }));
        }
    }, [sellValue, costValue, marginValue]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setError(null);
        let finalValue = value;
        if (type === 'number') finalValue = value === '' ? '' : parseFloat(value);
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleSignatureSave = (signatureData) => {
        setTempSignature(signatureData);
        setShowSignaturePad(false);
    };

    const handleClearSignature = () => setTempSignature(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData['JOB NO.'] || String(formData['JOB NO.']).trim() === '') {
            setError('Job No. is required.');
            return;
        }
        if (formData['SELL'] === '' || formData['COST'] === '') {
            setError('Please ensure SELL and COST amounts are entered.');
            return;
        }
        const selectedProjectNumber = String(formData['JOB NO.']);
        const customerName = formData['CUSTOMER'] || `Customer for ${selectedProjectNumber}`;
        const payload = {
            Job_No: selectedProjectNumber,
            Date_Entry: formData['DATE'],
            Customer_Name: customerName,
            Sell_Price: formData['SELL'] === '' ? null : formData['SELL'],
            Cost: formData['COST'] === '' ? null : formData['COST'],
            Margin: formData['MARGIN'] === '' ? null : formData['MARGIN'],
            Remarks: formData['REMARKS'] || null,
            Signature_Data: tempSignature,
        };
        const oldJobNo = jobToEdit ? jobToEdit.jobNo : null;
        onSave(payload, jobToEdit ? 'UPDATE' : 'CREATE', oldJobNo);
    };

    const getInputType = (col) => {
        if (['SELL', 'COST', 'MARGIN'].includes(col)) return 'number';
        if (col === 'DATE') return 'date';
        if (col === 'REMARKS') return 'textarea';
        return 'text';
    };

    const isRequired = (col) => ['DATE', 'JOB NO.', 'SELL', 'COST'].includes(col);

    const renderField = (col) => {
        const type = getInputType(col);
        const isReadOnly = col === 'MARGIN';
        if (col === 'SIGNATURE') {
            return (
                <div className="signature-field">
                    <div className="signature-display">
                        {tempSignature ? (
                            <img src={tempSignature} alt="Signature" className="signature-thumbnail" />
                        ) : (
                            <span className="no-signature">No signature</span>
                        )}
                    </div>
                    {!tempSignature && (
                        <button
                            type="button"
                            onClick={() => setShowSignaturePad(true)}
                            className="action-btn signature-btn"
                        >
                            Add Signature
                        </button>
                    )}
                </div>
            );
        }
        const inputProps = {
            id: col,
            name: col,
            value: formData[col] === null || formData[col] === '' ? '' : formData[col],
            onChange: isReadOnly ? undefined : handleChange,
            required: isRequired(col),
            readOnly: isReadOnly,
            className: isReadOnly ? 'readonly-field' : '',
            placeholder: col === 'JOB NO.' ? 'Enter Job/Project Number' : ''
        };
        if (col === 'JOB NO.') return <input {...inputProps} type="text" />;
        if (type === 'textarea') return <textarea {...inputProps} rows="3"></textarea>;
        if (type === 'number') return <input {...inputProps} type="number" step="0.01" onWheel={(e) => e.target.blur()} />;
        return <input {...inputProps} type={type} />;
    };

    return (
        <>
            <div className="modal-backdrop" onClick={onClose}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <button className="modal-close-icon" onClick={onClose}>&times;</button>
                    
                    {error && <div className="error-message">⚠️ {error}</div>}
                    <form onSubmit={handleSubmit}>
                        {columns.map(col => (
                            <div key={col} className="form-group">
                                <label htmlFor={col}>{col}{isRequired(col) && <span className="required-star">*</span>}</label>
                                {renderField(col)}
                            </div>
                        ))}
                        <div className="modal-actions">
                            <button type="submit" className="action-btn primary">{jobToEdit ? 'Update' : 'Save Entry'}</button>
                            <button type="button" onClick={onClose} className="action-btn secondary">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>

            {showSignaturePad && (
                <div className="modal-backdrop" onClick={() => setShowSignaturePad(false)}>
                    <div className="modal-content signature-modal" onClick={e => e.stopPropagation()}>
                        <button className="modal-close-icon" onClick={() => setShowSignaturePad(false)}>&times;</button>
                        <h3>Draw Signature</h3>
                        <SignatureCanvas signatureData={tempSignature} onSaveSignature={handleSignatureSave} onClearSignature={handleClearSignature} />
                        <div className="modal-actions">
                            <button type="button" onClick={() => setShowSignaturePad(false)} className="action-btn secondary">Close Without Saving</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// =========================================================
// AdminPage Component with AI Chat Window & Pagination
// =========================================================
const AdminPage = ({ navigate }) => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [jobToEdit, setJobToEdit] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    // ---- Pagination state ----
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    // ---- AI Chat state ----
    const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(() => {
        const saved = localStorage.getItem('adminAiSidebarOpen');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [aiSidebarWidth, setAiSidebarWidth] = useState(() => {
        const saved = localStorage.getItem('adminAiSidebarWidth');
        return saved ? parseInt(saved, 10) : 420;
    });
    const [isResizing, setIsResizing] = useState(false);
    const startResizeX = useRef(0);
    const startWidth = useRef(0);
    
    // Persist AI sidebar state
    useEffect(() => {
        localStorage.setItem('adminAiSidebarOpen', JSON.stringify(isAiSidebarOpen));
    }, [isAiSidebarOpen]);
    useEffect(() => {
        localStorage.setItem('adminAiSidebarWidth', aiSidebarWidth);
    }, [aiSidebarWidth]);

    // Resize handlers
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

    const toggleAiSidebar = () => setIsAiSidebarOpen(prev => !prev);
    
    // Simple notification helper
    const addNotification = (message) => {
        console.log('[AI]', message);
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.backgroundColor = '#333';
        toast.style.color = '#fff';
        toast.style.padding = '8px 16px';
        toast.style.borderRadius = '8px';
        toast.style.zIndex = '10000';
        toast.style.fontSize = '14px';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    };

    const fetchProjects = async () => []; // Dummy

    // =========================================================
    // SORTING LOGIC: unsign first, then by date desc
    // =========================================================
    const sortJobs = (jobsArray) => {
        return [...jobsArray].sort((a, b) => {
            const aHasSig = a.signatureData && a.signatureData.trim() !== '';
            const bHasSig = b.signatureData && b.signatureData.trim() !== '';
            if (aHasSig === bHasSig) {
                // both have or both don't – sort by date desc
                return new Date(b.dateEntry) - new Date(a.dateEntry);
            }
            // put those without signature first
            return aHasSig ? 1 : -1;
        });
    };

    // ---- Filter jobs by search term ----
    const filteredJobs = useMemo(() => {
        if (!searchTerm.trim()) return jobs;
        const lower = searchTerm.toLowerCase().trim();
        return jobs.filter(job =>
            job.customerName?.toLowerCase().includes(lower) ||
            job.jobNo?.toLowerCase().includes(lower)
        );
    }, [jobs, searchTerm]);

    // Reset to page 1 whenever the job list changes
    useEffect(() => {
        setCurrentPage(1);
    }, [jobs.length]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filteredJobs.length]);

    // ---- File view logic (fixed regex to allow slashes) ----
    const getProjectNoFromHash = () => {
        const hash = window.location.hash;
        const match = hash.match(/^#\/files\/(.+)$/);
        return match ? match[1] : null;
    };
    
    const [viewingProjectNo, setViewingProjectNo] = useState(getProjectNoFromHash());
    
    useEffect(() => {
        const handleHashChange = () => {
            const newProjectNo = getProjectNoFromHash();
            if (newProjectNo !== viewingProjectNo) setViewingProjectNo(newProjectNo);
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [viewingProjectNo]);
    
    useEffect(() => {
        if (viewingProjectNo) {
            window.location.hash = `/files/${viewingProjectNo}`;
        } else {
            if (getProjectNoFromHash()) window.location.hash = '/';
        }
    }, [viewingProjectNo]);

    // ---- Fetch jobs ----
    const fetchJobs = async () => {
        setLoading(true);
        try {
            const data = await getAllAdminJobs();
            const sorted = sortJobs(data);
            setJobs(sorted);
            setError(null);
        } catch (err) {
            setError(`Failed to load job data: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!viewingProjectNo) fetchJobs();
    }, [viewingProjectNo]);

    // ---- Format helpers ----
    const formatCurrency = (value) => {
        if (value === null || value === undefined || value === '') return 'N/A';
        const numValue = Number(value);
        if (isNaN(numValue)) return 'N/A';
        return `RM${numValue.toFixed(2)}`;
    };

    const formatDateForDisplay = (dateString) => formatDateToYYYYMMDD(dateString) || 'N/A';

    const formatJobData = (job) => ({
        DATE: formatDateForDisplay(job.dateEntry),
        'JOB NO.': job.jobNo || 'N/A',
        CUSTOMER: job.customerName || 'N/A',
        SELL: formatCurrency(job.sellPrice),
        COST: formatCurrency(job.cost),
        MARGIN: formatCurrency(job.margin),
        SIGNATURE: job.signatureData,
        REMARKS: job.remarks || '-',
        signatureData: job.signatureData,
    });

    // ---- CRUD handlers with re-sorting ----
    const handleSaveJob = async (payload, mode, oldJobNo = null) => {
        try {
            const processedPayload = { ...payload, Date_Entry: formatDateToYYYYMMDD(payload.Date_Entry) };
            let responseJob;
            if (mode === 'CREATE') {
                const response = await createAdminJob(processedPayload);
                responseJob = response.job || response;
                setJobs(prev => sortJobs([responseJob, ...prev]));
                alert(`✅ Created job ${responseJob.jobNo}`);
            } else if (mode === 'UPDATE') {
                try {
                    const response = await updateAdminJob(oldJobNo || processedPayload.Job_No, processedPayload);
                    responseJob = response.job || response;
                    setJobs(prev => {
                        const filtered = oldJobNo && oldJobNo !== responseJob.jobNo
                            ? prev.filter(job => job.jobNo !== oldJobNo)
                            : prev;
                        const exists = filtered.findIndex(job => job.jobNo === responseJob.jobNo) >= 0;
                        const updated = exists
                            ? filtered.map(job => job.jobNo === responseJob.jobNo ? responseJob : job)
                            : [responseJob, ...filtered];
                        return sortJobs(updated);
                    });
                    alert(`✅ Updated job ${responseJob.jobNo}`);
                } catch (updateErr) {
                    if (updateErr.message.includes('404') || (updateErr.response && updateErr.response.status === 404)) {
                        const createResponse = await createAdminJob(processedPayload);
                        responseJob = createResponse.job || createResponse;
                        setJobs(prev => {
                            const filtered = prev.filter(job => job.jobNo !== oldJobNo);
                            return sortJobs([responseJob, ...filtered]);
                        });
                        alert(`✅ Job number changed to ${responseJob.jobNo}`);
                    } else throw updateErr;
                }
            }
            setError(null);
            closeModal();
        } catch (err) {
            let msg = err.message.includes('409') ? `Job No. ${payload.Job_No} already exists.` : err.message;
            alert(`❌ ${mode} failed: ${msg}`);
        }
    };

    const handleDeleteJob = async (jobNo) => {
        if (!window.confirm(`Delete job ${jobNo}?`)) return;
        try {
            await deleteAdminJob(jobNo);
            setJobs(prev => sortJobs(prev.filter(job => job.jobNo !== jobNo)));
            alert(`Job ${jobNo} deleted.`);
        } catch (err) {
            alert(`Deletion failed: ${err.message}`);
        }
    };

    const openEditModal = (job) => { setJobToEdit(job); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setJobToEdit(null); };
    const handleViewFiles = (jobNo) => setViewingProjectNo(jobNo);
    const handleBackFromFiles = () => setViewingProjectNo(null);

    // ---- Signature cell render ----
    const renderSignatureCell = (signatureData) => {
        if (!signatureData) return <span className="no-signature-text">No signature</span>;
        const imgSrc = signatureData.startsWith('data:image/') ? signatureData : `data:image/png;base64,${signatureData}`;
        return (
            <div className="signature-cell-tooltip" onClick={() => {
                const win = window.open('', '_blank');
                if (win) {
                    win.document.write(`
                        <html><head><title>Signature</title>
                        <style>body{display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f5f5f5;}
                        img{max-width:90vw;max-height:90vh;border:1px solid #ddd;box-shadow:0 4px 8px rgba(0,0,0,0.1);background:white;}</style>
                        </head><body><img src="${imgSrc}" alt="Signature"/></body></html>
                    `);
                    win.document.close();
                }
            }}>
                <img src={imgSrc} alt="Signature" className="signature-table-image" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<span class="no-signature-text">Error</span>'; }} />
                <span className="tooltip-text">Click to view full size</span>
            </div>
        );
    };

    // ---- Pagination calculations ----
    const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

    const goToPage = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    // Render page numbers with ellipsis
    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5; // show 5 page numbers at most
        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (currentPage <= 3) {
                for (let i = 1; i <= 4; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
            } else {
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            }
        }
        return pages;
    };

    // ---- Main render ----
    if (viewingProjectNo) {
        return <FileView projectNo={viewingProjectNo} navigateHome={handleBackFromFiles} />;
    }

    return (
        <div className="admin-page" style={{ position: 'relative' }}>
            <header className="page-header">
                <h1>⚙️ Projects Administration</h1>
                <div className="project-stats">
                    <span className="stat-item">📊 Total Entries: <strong>{jobs.length}</strong></span>
                    <span className="stat-item">📄 Page {currentPage} of {totalPages || 1}</span>
                </div>
            </header>
            <main className="admin-content">
                <div className="admin-section project-table-section">
                    <div className="table-header-row">
                        <h2>Projects Ledger</h2>
                    </div>
                    <div className="search-container">
                        <input
                            type="text"
                            placeholder="🔍 Search by Customer or Job No..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                        {searchTerm && (
                            <button
                                className="clear-search"
                                onClick={() => setSearchTerm('')}
                                title="Clear search"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    <div className="project-table-container">
                        {loading && <div className="loading-message">Loading...</div>}
                        {error && <div className="error-message">Error: {error}</div>}
                        {!loading && !error && (
                            <>
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            {tableColumns.map(col => <th key={col}>{col}</th>)}
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedJobs.length > 0 ? paginatedJobs.map(job => {
                                            const data = formatJobData(job);
                                            return (
                                                <tr key={job.jobNo}>
                                                    {tableColumns.map(col => (
                                                        col === 'SIGNATURE' ? 
                                                            <td key={`${job.jobNo}-${col}`} className="signature-cell">{renderSignatureCell(data.signatureData)}</td> :
                                                            <td key={`${job.jobNo}-${col}`}>{data[col]}</td>
                                                    ))}
                                                    <td className="action-cell">
                                                        <button onClick={() => handleViewFiles(job.jobNo)} className="action-btn view-btn" title="View Files">📁 View Files</button>
                                                        <button onClick={() => openEditModal(job)} className="action-btn edit-btn" title="Edit Job">✏️ Edit</button>
                                                        <button onClick={() => handleDeleteJob(job.jobNo)} className="action-btn delete-btn" title="Delete Job">🗑️ Delete</button>
                                                    </td>
                                                </tr>
                                            );
                                        }) : (
                                            <tr><td colSpan={tableColumns.length + 1} className="no-data">No jobs found. Create one using the modal.</td></tr>
                                        )}
                                    </tbody>
                                </table>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="pagination-bar">
                                        <button
                                            className="pagination-btn"
                                            onClick={() => goToPage(currentPage - 1)}
                                            disabled={currentPage === 1}
                                        >
                                            ◀ Prev
                                        </button>
                                        <div className="pagination-pages">
                                            {getPageNumbers().map((page, idx) => (
                                                typeof page === 'number' ? (
                                                    <button
                                                        key={idx}
                                                        className={`pagination-page ${page === currentPage ? 'active' : ''}`}
                                                        onClick={() => goToPage(page)}
                                                    >
                                                        {page}
                                                    </button>
                                                ) : (
                                                    <span key={idx} className="pagination-ellipsis">…</span>
                                                )
                                            ))}
                                        </div>
                                        <button
                                            className="pagination-btn"
                                            onClick={() => goToPage(currentPage + 1)}
                                            disabled={currentPage === totalPages}
                                        >
                                            Next ▶
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </main>
            <ProjectModal isOpen={isModalOpen} onClose={closeModal} columns={tableColumns} onSave={handleSaveJob} jobToEdit={jobToEdit} />

            {/* AI Chat Sidebar */}
            {isAiSidebarOpen && (
                <aside className="ai-sidebar" style={{ width: aiSidebarWidth, position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 1000, background: '#fff', boxShadow: '-2px 0 12px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
                    <div className="ai-sidebar-resize-handle" onMouseDown={startResize} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '5px', cursor: 'ew-resize', background: 'transparent', zIndex: 10 }} />
                    <AIChatWindow
                        embedded={true}
                        onClose={toggleAiSidebar}
                        addNotification={addNotification}
                        fetchProjects={fetchProjects}
                        activeTab="approved"
                        createProject={async () => { addNotification('Project creation not available in Admin view'); }}
                        uploadProjectFiles={async () => { addNotification('File upload not available in Admin view'); }}
                    />
                </aside>
            )}

            {/* AI Chat Toggle Button */}
            <button className="ai-chat-fab" onClick={toggleAiSidebar} style={{
                position: 'fixed',
                bottom: '24px',
                right: isAiSidebarOpen ? `${aiSidebarWidth + 20}px` : '24px',
                width: '56px',
                height: '56px',
                borderRadius: '28px',
                background: '#6366f1',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 1001,
                transition: 'right 0.2s ease'
            }}>
                <span>{isAiSidebarOpen ? '✕' : '💬'}</span>
            </button>
        </div>
    );
};

export default AdminPage;