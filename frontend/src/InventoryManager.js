// InventoryManager.js
import React, { useState, useEffect, useRef } from 'react';
import { inventoryAPI } from './apiService';
import './InventoryManager.css';

// =========================================================
// Upload Media Modal
// =========================================================
const UploadMediaModal = ({ isOpen, onClose, item, onUpload, isUploading, error }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const fileInputRef = useRef(null);

    const getCanvasCoordinates = (e) => {
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
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    };

    useEffect(() => {
        if (isOpen && item) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (item.signatureData) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
                    const x = (canvas.width - img.width * scale) / 2;
                    const y = (canvas.height - img.height * scale) / 2;
                    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                };
                img.onerror = () => {
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                };
                img.src = item.signatureData;
            } else {
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            setImagePreview(item.imageData || null);
            setImageFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [isOpen, item]);

    const startDrawing = (e) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const { x, y } = getCanvasCoordinates(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };
    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const { x, y } = getCanvasCoordinates(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };
    const stopDrawing = (e) => {
        e.preventDefault();
        setIsDrawing(false);
    };
    const clearSignature = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result);
            reader.readAsDataURL(file);
        } else {
            setImageFile(null);
            setImagePreview(item?.imageData || null);
        }
    };
    const handleSubmit = async (e) => {
        e.preventDefault();

        const canvas = canvasRef.current;
        let signatureBlob = null;

        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let hasDrawing = false;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) {
                hasDrawing = true;
                break;
            }
        }

        if (hasDrawing) {
            signatureBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        }

        if (!hasDrawing && !imageFile) {
            alert('Please draw a signature OR select an image.');
            return;
        }

        const formData = new FormData();
        if (signatureBlob) {
            formData.append('signature', signatureBlob, 'signature.png');
        }
        if (imageFile) {
            formData.append('image', imageFile);
        }

        onUpload(formData);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>📎 Upload Media for: {item?.name}</h2>
                    <button type="button" className="close-button" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    <form onSubmit={handleSubmit} className="upload-media-form">
                        <div className="form-group">
                            <label>Draw Signature</label>
                            <div className="signature-canvas-container">
                                <canvas
                                    ref={canvasRef}
                                    width={500}
                                    height={200}
                                    style={{
                                        border: '1px solid #ccc',
                                        background: '#fff',
                                        cursor: 'crosshair',
                                        width: '100%',
                                        height: 'auto',
                                        touchAction: 'none',
                                    }}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                    onTouchCancel={stopDrawing}
                                />
                            </div>
                            <button type="button" className="secondary small" onClick={clearSignature}>
                                🧹 Clear Signature
                            </button>
                        </div>
                        <div className="form-group">
                            <label>Upload Image (Photo)</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                ref={fileInputRef}
                                className="file-input"
                            />
                            {imagePreview && (
                                <div className="image-preview-container">
                                    <img src={imagePreview} alt="Preview" className="image-preview" />
                                </div>
                            )}
                            <p className="form-hint">
                                {item?.imageData ? 'Uploading a new image will replace the existing one.' : ''}
                            </p>
                        </div>
                        {error && <div className="alert alert-danger">{error}</div>}
                        <div className="modal-actions">
                            <button type="button" className="secondary" onClick={onClose} disabled={isUploading}>
                                Cancel
                            </button>
                            <button type="submit" className="primary" disabled={isUploading}>
                                {isUploading ? 'Uploading...' : 'Upload Media'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

// =========================================================
// Preview Media Modal
// =========================================================
const PreviewMediaModal = ({ isOpen, onClose, item }) => {
    if (!isOpen || !item) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>📷 Media for: {item.name}</h2>
                    <button type="button" className="close-button" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body preview-body">
                    <div className="preview-section">
                        <h4>🖼️ Image</h4>
                        {item.imageData ? (
                            <img src={item.imageData} alt={item.name} className="preview-image" />
                        ) : (
                            <p className="no-media">No image uploaded.</p>
                        )}
                    </div>
                    <div className="preview-section">
                        <h4>✍️ Signature</h4>
                        {item.signatureData ? (
                            <img src={item.signatureData} alt="Signature" className="preview-image" />
                        ) : (
                            <p className="no-media">No signature uploaded.</p>
                        )}
                    </div>
                </div>
                <div className="modal-actions">
                    <button type="button" className="secondary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

// =========================================================
// Count Prompt Modal (bulk create)
// =========================================================
const CountPromptModal = ({ isOpen, itemCount, onChangeCount, onCancel, onGenerate }) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="count-prompt-box" onClick={(e) => e.stopPropagation()}>
                <h4>How many items do you want to add?</h4>
                <div className="count-prompt-input">
                    <input
                        type="number"
                        min="1"
                        max="50"
                        value={itemCount}
                        onChange={(e) => onChangeCount(e.target.value)}
                        className="form-input"
                        autoFocus
                    />
                </div>
                <div className="count-prompt-actions">
                    <button type="button" className="secondary small" onClick={onCancel}>
                        Cancel
                    </button>
                    <button type="button" className="primary small" onClick={onGenerate}>
                        Generate Rows
                    </button>
                </div>
            </div>
        </div>
    );
};

// =========================================================
// Inventory Manager
// =========================================================

// ✅ FIX: quantity starts as empty string '' so the input field is blank,
//    letting the user type freely without fighting a pre-filled "0".
const EMPTY_FORM = { name: '', quantity: '', description: '' };

const makeEmptyRow = (id) => ({ id, name: '', quantity: '', description: '' });

const InventoryManager = ({ hideCloseButton = false, onClose }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Edit form state (single item)
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [formError, setFormError] = useState('');

    // Bulk create state
    const [showCountPrompt, setShowCountPrompt] = useState(false);
    const [itemCount, setItemCount] = useState('1');
    const [showCreateRows, setShowCreateRows] = useState(false);
    const [createRows, setCreateRows] = useState([]);
    const [createError, setCreateError] = useState('');
    const [isCreatingBulk, setIsCreatingBulk] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');

    // Upload modal state
    const [uploadingItem, setUploadingItem] = useState(null);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);

    // Preview modal state
    const [previewItem, setPreviewItem] = useState(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // Filter items by name
    const filteredItems = items.filter((item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const lowStockItems = filteredItems.filter((item) => item.quantity < 5);

    useEffect(() => {
        fetchInventory();
    }, []);

    const fetchInventory = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await inventoryAPI.getAll();
            setItems(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Fetch inventory error:', err);
            setError('Failed to load inventory: ' + err.message);
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    // ✅ FIX: parse quantity string → int only at submit time, not on every keystroke.
    const parseQuantity = (val) => {
        const parsed = parseInt(val, 10);
        // Allow 0 as a valid quantity; reject empty/NaN
        return isNaN(parsed) ? null : parsed;
    };

    // ---------- Edit (single item) ----------
    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setFormError('Name is required');
            return;
        }
        const qty = parseQuantity(formData.quantity);
        if (qty === null || qty < 0) {
            setFormError('Please enter a valid quantity (0 or more).');
            return;
        }
        try {
            const updated = await inventoryAPI.update(editingItem.id, { ...formData, quantity: qty });
            setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
            setEditingItem(null);
            setFormData(EMPTY_FORM);
            setFormError('');
        } catch (err) {
            setFormError('Update failed: ' + err.message);
        }
    };

    const startEdit = (item) => {
        setEditingItem(item);
        // ✅ FIX: when editing, show existing quantity as string so it's editable freely
        setFormData({
            name: item.name,
            quantity: String(item.quantity),
            description: item.description || '',
        });
        setFormError('');
        // close bulk-create UI if open
        setShowCreateRows(false);
        setShowCountPrompt(false);
    };

    const cancelForm = () => {
        setEditingItem(null);
        setFormData(EMPTY_FORM);
        setFormError('');
    };

    // ---------- Bulk create ----------
    const openCountPrompt = () => {
        setEditingItem(null);
        setItemCount('1');
        setShowCountPrompt(true);
    };

    const cancelCountPrompt = () => {
        setShowCountPrompt(false);
    };

    const generateCreateRows = () => {
        const parsedCount = parseInt(itemCount, 10);
        const count = Math.min(Math.max(isNaN(parsedCount) ? 1 : parsedCount, 1), 50);
        const rows = [];
        for (let i = 0; i < count; i++) {
            rows.push(makeEmptyRow(Date.now() + i));
        }
        setCreateRows(rows);
        setCreateError('');
        setShowCountPrompt(false);
        setShowCreateRows(true);
    };

    const updateCreateRow = (id, field, value) => {
        setCreateRows((prev) =>
            prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
        );
    };

    const removeCreateRow = (id) => {
        if (createRows.length <= 1) {
            setCreateError('You need at least one row.');
            return;
        }
        setCreateRows((prev) => prev.filter((row) => row.id !== id));
    };

    const cancelCreateRows = () => {
        setShowCreateRows(false);
        setCreateRows([]);
        setCreateError('');
    };

    const handleCreateAllRows = async () => {
        // Validate all rows first
        const payloads = [];
        for (const row of createRows) {
            if (!row.name.trim()) {
                setCreateError('Every row needs a name.');
                return;
            }
            const qty = parseQuantity(row.quantity === '' ? '0' : row.quantity);
            if (qty === null || qty < 0) {
                setCreateError(`Please enter a valid quantity for "${row.name}".`);
                return;
            }
            payloads.push({
                name: row.name.trim(),
                quantity: qty,
                description: row.description || '',
            });
        }

        setIsCreatingBulk(true);
        setCreateError('');
        try {
            const createdItems = [];
            // Create sequentially so a failure part-way through is easy to reason about
            for (const payload of payloads) {
                const newItem = await inventoryAPI.create(payload);
                createdItems.push(newItem);
            }
            setItems((prev) => [...prev, ...createdItems]);
            setShowCreateRows(false);
            setCreateRows([]);
        } catch (err) {
            setCreateError('Create failed: ' + err.message);
        } finally {
            setIsCreatingBulk(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this inventory item?')) return;
        try {
            await inventoryAPI.delete(id);
            setItems((prev) => prev.filter((item) => item.id !== id));
        } catch (err) {
            setError('Delete failed: ' + err.message);
        }
    };

    const handleQuantityChange = async (id, change) => {
        try {
            const updated = await inventoryAPI.patchQuantity(id, { quantityChange: change });
            setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        } catch (err) {
            setError('Stock update failed: ' + err.message);
        }
    };

    // Upload handlers
    const openUploadModal = (item) => {
        setUploadingItem(item);
        setUploadError(null);
        setIsUploadModalOpen(true);
    };

    const closeUploadModal = () => {
        setIsUploadModalOpen(false);
        setUploadingItem(null);
        setUploadError(null);
        setIsUploading(false);
    };

    const handleUploadMedia = async (formData) => {
        if (!uploadingItem) return;
        setIsUploading(true);
        setUploadError(null);
        try {
            const updated = await inventoryAPI.uploadMedia(uploadingItem.id, formData);
            setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
            closeUploadModal();
        } catch (err) {
            setUploadError('Upload failed: ' + err.message);
            setIsUploading(false);
        }
    };

    const handleDeleteImage = async (id) => {
        if (!window.confirm('Delete the image for this item?')) return;
        try {
            const updated = await inventoryAPI.deleteImage(id);
            setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        } catch (err) {
            setError('Delete image failed: ' + err.message);
        }
    };

    const handleDeleteSignature = async (id) => {
        if (!window.confirm('Delete the signature for this item?')) return;
        try {
            const updated = await inventoryAPI.deleteSignature(id);
            setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        } catch (err) {
            setError('Delete signature failed: ' + err.message);
        }
    };

    // Preview handlers
    const openPreview = (item) => {
        setPreviewItem(item);
        setIsPreviewOpen(true);
    };

    const closePreview = () => {
        setPreviewItem(null);
        setIsPreviewOpen(false);
    };

    const hasImage = (item) => item.imageData && item.imageData !== null;
    const hasSignature = (item) => item.signatureData && item.signatureData !== null;

    return (
        <div className="inventory-manager">
            <div className="inventory-header">
                <h2>📦 Door Inventory Management</h2>
                {!hideCloseButton && (
                    <button className="close-btn" onClick={onClose}>✕</button>
                )}
            </div>

            {/* Low stock alert for filtered items */}
            {lowStockItems.length > 0 && (
                <div className="low-stock-alert">
                    <h3>⚠️ Low Stock Alert</h3>
                    <ul>
                        {lowStockItems.map((item) => (
                            <li key={item.id}>
                                <strong>{item.name}</strong> – Quantity:{' '}
                                <span style={{ color: 'red' }}>{item.quantity}</span> (below 5)
                                {item.description && ` – ${item.description}`}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {error && <div className="alert alert-danger">{error}</div>}

            {/* Toolbar with search */}
            <div className="inventory-toolbar">
                <div className="toolbar-left">
                    <button className="primary" onClick={openCountPrompt}>
                        ➕ Add Item
                    </button>
                </div>
                <div className="toolbar-right">
                    <input
                        type="text"
                        placeholder="🔍 Search by name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>
            </div>

            {/* Step 1: ask how many items to add */}
            <CountPromptModal
                isOpen={showCountPrompt}
                itemCount={itemCount}
                onChangeCount={setItemCount}
                onCancel={cancelCountPrompt}
                onGenerate={generateCreateRows}
            />

            {/* Step 2: fill in that many rows, then create them all at once */}
            {showCreateRows && (
                <div className="inventory-form">
                    <h3>🆕 New Items ({createRows.length})</h3>
                    <div className="bulk-create-rows">
                        {createRows.map((row) => (
                            <div key={row.id} className="item-row" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    value={row.name}
                                    onChange={(e) => updateCreateRow(row.id, 'name', e.target.value)}
                                    placeholder="Item name"
                                    className="form-input"
                                    style={{ flex: 2 }}
                                />
                                <input
                                    type="number"
                                    min="0"
                                    value={row.quantity}
                                    onChange={(e) => updateCreateRow(row.id, 'quantity', e.target.value)}
                                    placeholder="Quantity"
                                    className="form-input"
                                    style={{ flex: 1 }}
                                />
                                <input
                                    type="text"
                                    value={row.description}
                                    onChange={(e) => updateCreateRow(row.id, 'description', e.target.value)}
                                    placeholder="Description (optional)"
                                    className="form-input"
                                    style={{ flex: 2 }}
                                />
                                <button
                                    type="button"
                                    className="delete-btn"
                                    onClick={() => removeCreateRow(row.id)}
                                    disabled={createRows.length <= 1}
                                    title="Remove this row"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>
                    {createError && <div className="alert alert-danger">{createError}</div>}
                    <div className="form-actions">
                        <button
                            type="button"
                            className="primary"
                            onClick={handleCreateAllRows}
                            disabled={isCreatingBulk}
                        >
                            {isCreatingBulk ? 'Creating...' : `✅ Create ${createRows.length} Item(s)`}
                        </button>
                        <button type="button" className="secondary" onClick={cancelCreateRows} disabled={isCreatingBulk}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Edit form (single item) */}
            {editingItem && (
                <div className="inventory-form">
                    <h3>✏️ Edit Item</h3>
                    <form onSubmit={handleUpdate}>
                        <div className="form-group">
                            <label>Name *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData({ ...formData, name: e.target.value })
                                }
                                placeholder="Enter item name"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Quantity</label>
                            {/*
                             * ✅ FIX: value is a plain string. No parseInt on change —
                             *    that was resetting the field to 0 whenever it was empty.
                             *    Parsing happens only in handleUpdate.
                             */}
                            <input
                                type="number"
                                value={formData.quantity}
                                onChange={(e) =>
                                    setFormData({ ...formData, quantity: e.target.value })
                                }
                                min="0"
                                placeholder="Enter quantity"
                            />
                        </div>
                        <div className="form-group">
                            <label>Description</label>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData({ ...formData, description: e.target.value })
                                }
                                placeholder="Optional description"
                            />
                        </div>
                        {formError && <div className="alert alert-danger">{formError}</div>}
                        <div className="form-actions">
                            <button type="submit" className="primary">
                                Update
                            </button>
                            <button type="button" className="secondary" onClick={cancelForm}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <p>Loading inventory...</p>
            ) : (
                <div className="inventory-table-wrapper">
                    <table className="inventory-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Quantity</th>
                                <th>Description</th>
                                <th>Media</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center' }}>
                                        No inventory items found.
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item) => (
                                    <tr
                                        key={item.id}
                                        className={item.quantity < 5 ? 'low-stock-row' : ''}
                                    >
                                        <td>
                                            <strong>{item.name}</strong>
                                        </td>
                                        <td>
                                            <span
                                                className={`quantity-badge ${item.quantity < 5 ? 'low' : ''}`}
                                            >
                                                {item.quantity}
                                            </span>
                                        </td>
                                        <td>{item.description || '-'}</td>
                                        <td>
                                            <div
                                                className="media-badges"
                                                style={{
                                                    display: 'flex',
                                                    gap: '0.3rem',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                {hasImage(item) && (
                                                    <span
                                                        className="media-badge"
                                                        onClick={() => openPreview(item)}
                                                        title="Click to view image"
                                                    >
                                                        🖼️
                                                    </span>
                                                )}
                                                {hasSignature(item) && (
                                                    <span
                                                        className="media-badge"
                                                        onClick={() => openPreview(item)}
                                                        title="Click to view signature"
                                                    >
                                                        ✍️
                                                    </span>
                                                )}
                                                {!hasImage(item) && !hasSignature(item) && (
                                                    <span
                                                        className="media-badge"
                                                        style={{ color: '#ccc' }}
                                                    >
                                                        —
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    className="edit-btn"
                                                    onClick={() => startEdit(item)}
                                                    title="Edit"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    className="upload-btn"
                                                    onClick={() => openUploadModal(item)}
                                                    title="Upload media"
                                                >
                                                    📤
                                                </button>
                                                <button
                                                    className="view-btn"
                                                    onClick={() => openPreview(item)}
                                                    title="View media"
                                                >
                                                    👁️
                                                </button>
                                                {hasImage(item) && (
                                                    <button
                                                        className="delete-btn"
                                                        onClick={() => handleDeleteImage(item.id)}
                                                        title="Delete image"
                                                    >
                                                        🗑️🖼️
                                                    </button>
                                                )}
                                                {hasSignature(item) && (
                                                    <button
                                                        className="delete-btn"
                                                        onClick={() => handleDeleteSignature(item.id)}
                                                        title="Delete signature"
                                                    >
                                                        🗑️✍️
                                                    </button>
                                                )}
                                                <button
                                                    className="delete-btn"
                                                    onClick={() => handleDelete(item.id)}
                                                    title="Delete item"
                                                >
                                                    🗑️
                                                </button>
                                                <button
                                                    className="stock-btn"
                                                    onClick={() => handleQuantityChange(item.id, 1)}
                                                >
                                                    ➕
                                                </button>
                                                <button
                                                    className="stock-btn"
                                                    onClick={() => handleQuantityChange(item.id, -1)}
                                                >
                                                    ➖
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <UploadMediaModal
                isOpen={isUploadModalOpen}
                onClose={closeUploadModal}
                item={uploadingItem}
                onUpload={handleUploadMedia}
                isUploading={isUploading}
                error={uploadError}
            />

            <PreviewMediaModal
                isOpen={isPreviewOpen}
                onClose={closePreview}
                item={previewItem}
            />
        </div>
    );
};

export default InventoryManager;