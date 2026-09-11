import React, { useState, useEffect, useMemo, useRef } from 'react';
import { doorTasksAPI, projectsAPI, inventoryAPI } from './apiService';
import InventoryManager from './InventoryManager';
import './PanelSlab.css';

// =========================================================
// Shared: Inventory Item Editor inside modals (unchanged)
// =========================================================
const InventorySection = ({
    inventoryList,
    taskItems,
    selectedInventoryId,
    itemQuantity,
    onAddItem,
    onRemoveItem,
    onSelectInventory,
    onQuantityChange,
    onUpdateItem,
}) => {
    const [editingItemId, setEditingItemId] = useState(null);
    const [editQuantity, setEditQuantity] = useState('');

    useEffect(() => {
        if (!taskItems.find((i) => i.inventory_id === editingItemId)) {
            setEditingItemId(null);
            setEditQuantity('');
        }
    }, [taskItems, editingItemId]);

    const handleEditClick = (item) => {
        setEditingItemId(item.inventory_id);
        setEditQuantity(String(item.quantity));
    };

    const handleSaveEdit = (inventoryId) => {
        const parsed = parseInt(editQuantity, 10);
        if (!editQuantity || isNaN(parsed) || parsed < 1) {
            alert('Quantity must be a whole number of at least 1.');
            return;
        }
        const inventoryItem = inventoryList.find((i) => i.id === inventoryId);
        if (inventoryItem && parsed > inventoryItem.quantity) {
            alert(`Not enough stock. Available: ${inventoryItem.quantity}`);
            return;
        }
        onUpdateItem(inventoryId, parsed);
        setEditingItemId(null);
        setEditQuantity('');
    };

    const handleCancelEdit = () => {
        setEditingItemId(null);
        setEditQuantity('');
    };

    return (
        <div className="task-items-section">
            <div className="item-row">
                <select
                    value={selectedInventoryId}
                    onChange={(e) => onSelectInventory(e.target.value)}
                    className="form-select"
                    style={{ flex: 1 }}
                >
                    <option value="">Select item</option>
                    {inventoryList.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.name} (Stock: {item.quantity})
                        </option>
                    ))}
                </select>
                <input
                    type="number"
                    min="1"
                    value={itemQuantity}
                    onChange={(e) => onQuantityChange(e.target.value)}
                    className="form-input"
                    style={{ width: '80px' }}
                    placeholder="Qty"
                />
                <button type="button" className="primary" onClick={onAddItem}>
                    Add
                </button>
            </div>

            {taskItems.length > 0 && (
                <ul className="task-items-list">
                    {taskItems.map((item) => {
                        const isEditing = editingItemId === item.inventory_id;
                        return (
                            <li key={item.inventory_id}>
                                {isEditing ? (
                                    <>
                                        <span>{item.inventory_name}&nbsp;</span>
                                        <input
                                            type="number"
                                            min="1"
                                            value={editQuantity}
                                            onChange={(e) => setEditQuantity(e.target.value)}
                                            className="form-input"
                                            style={{ width: '80px', margin: '0 8px' }}
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleSaveEdit(item.inventory_id);
                                                }
                                                if (e.key === 'Escape') handleCancelEdit();
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="primary small"
                                            onClick={() => handleSaveEdit(item.inventory_id)}
                                        >
                                            Save
                                        </button>
                                        <button
                                            type="button"
                                            className="secondary small"
                                            onClick={handleCancelEdit}
                                        >
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        {item.inventory_name} x{item.quantity}
                                        <button
                                            type="button"
                                            className="edit-btn small"
                                            onClick={() => handleEditClick(item)}
                                            title="Edit quantity"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            type="button"
                                            className="delete-btn"
                                            onClick={() => onRemoveItem(item.inventory_id)}
                                        >
                                            ✕
                                        </button>
                                    </>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

// =========================================================
// Create Task Modal
// =========================================================
const CreateTaskModal = ({
    isOpen,
    onClose,
    newTask,
    onInputChange,
    onSubmit,
    error,
    uniqueProjectNos,
    inventoryList,
    taskItems,
    selectedInventoryId,
    itemQuantity,
    onAddItem,
    onRemoveItem,
    onSelectInventory,
    onQuantityChange,
    onUpdateItem,
}) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>➕ Create New Door Task</h2>
                    <button type="button" className="close-button" onClick={onClose}>
                        &times;
                    </button>
                </div>
                <div className="modal-body">
                    <form onSubmit={onSubmit} className="task-form">
                        <div className="form-group">
                            <label htmlFor="project_no">Project No *</label>
                            <select
                                id="project_no"
                                name="project_no"
                                value={newTask.project_no}
                                onChange={onInputChange}
                                required
                                className="form-select"
                            >
                                <option value="">Select a project</option>
                                {uniqueProjectNos.map((p) => (
                                    <option key={p} value={p}>
                                        {p}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="title">Task Title *</label>
                            <input
                                type="text"
                                id="title"
                                name="title"
                                value={newTask.title}
                                onChange={onInputChange}
                                placeholder="Enter door task title"
                                required
                                autoComplete="off"
                                className="form-input"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="description">Description</label>
                            <textarea
                                id="description"
                                name="description"
                                value={newTask.description}
                                onChange={onInputChange}
                                className="form-input"
                                rows="2"
                                placeholder="Task description (optional)"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="remark">Remark</label>
                            <textarea
                                id="remark"
                                name="remark"
                                value={newTask.remark}
                                onChange={onInputChange}
                                className="form-input"
                                rows="2"
                                placeholder="Any remarks..."
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="priority">Priority</label>
                                <select
                                    id="priority"
                                    name="priority"
                                    value={newTask.priority}
                                    onChange={onInputChange}
                                    className="form-select"
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="due_date">Due Date</label>
                                <input
                                    type="date"
                                    id="due_date"
                                    name="due_date"
                                    value={newTask.due_date}
                                    onChange={onInputChange}
                                    className="form-input"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Inventory Requirements</label>
                            <InventorySection
                                inventoryList={inventoryList}
                                taskItems={taskItems}
                                selectedInventoryId={selectedInventoryId}
                                itemQuantity={itemQuantity}
                                onAddItem={onAddItem}
                                onRemoveItem={onRemoveItem}
                                onSelectInventory={onSelectInventory}
                                onQuantityChange={onQuantityChange}
                                onUpdateItem={onUpdateItem}
                            />
                        </div>

                        {error && <div className="alert alert-danger">{error}</div>}
                        <div className="modal-actions">
                            <button type="button" className="secondary" onClick={onClose}>
                                Cancel
                            </button>
                            <button type="submit" className="primary">
                                Create Task
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

// =========================================================
// Edit Task Modal
// =========================================================
const EditTaskModal = ({
    isOpen,
    onClose,
    editingTask,
    onInputChange,
    onSubmit,
    error,
    uniqueProjectNos,
    inventoryList,
    taskItems,
    selectedInventoryId,
    itemQuantity,
    onAddItem,
    onRemoveItem,
    onSelectInventory,
    onQuantityChange,
    onUpdateItem,
}) => {
    if (!isOpen || !editingTask) return null;

    const showCompleted = editingTask.status === 'completed' ||
        (editingTask.imageUrl && editingTask.signatureUrl && editingTask.signature2Url);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 style={{ color: 'white' }}>✏️ Edit Task: {editingTask.title}</h2>
                    <button type="button" className="close-button" onClick={onClose}>
                        &times;
                    </button>
                </div>
                <div className="modal-body">
                    <form onSubmit={onSubmit} className="task-form">
                        <div className="form-group">
                            <label htmlFor="editProjectNo">Project No *</label>
                            <select
                                id="editProjectNo"
                                name="project_no"
                                value={editingTask.project_no || ''}
                                onChange={onInputChange}
                                required
                                className="form-select"
                            >
                                <option value="">Select a project</option>
                                {uniqueProjectNos.map((p) => (
                                    <option key={p} value={p}>
                                        {p}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="editTitle">Task Title *</label>
                            <input
                                type="text"
                                id="editTitle"
                                name="title"
                                value={editingTask.title}
                                onChange={onInputChange}
                                required
                                autoComplete="off"
                                className="form-input"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="editRemark">Remark</label>
                            <textarea
                                id="editRemark"
                                name="remark"
                                value={editingTask.remark}
                                onChange={onInputChange}
                                className="form-input"
                                rows="2"
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="editPriority">Priority</label>
                                <select
                                    id="editPriority"
                                    name="priority"
                                    value={editingTask.priority}
                                    onChange={onInputChange}
                                    className="form-select"
                                >
                                    <option value="empty">Empty</option>
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="editStatus">Status</label>
                                <select
                                    id="editStatus"
                                    name="status"
                                    value={editingTask.status}
                                    onChange={onInputChange}
                                    className="form-select"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="on-hold">On Hold</option>
                                    <option value="in-progress">In Progress</option>
                                    {showCompleted && (
                                        <option value="completed">✅ Completed</option>
                                    )}
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Inventory Requirements</label>
                            <InventorySection
                                inventoryList={inventoryList}
                                taskItems={taskItems}
                                selectedInventoryId={selectedInventoryId}
                                itemQuantity={itemQuantity}
                                onAddItem={onAddItem}
                                onRemoveItem={onRemoveItem}
                                onSelectInventory={onSelectInventory}
                                onQuantityChange={onQuantityChange}
                                onUpdateItem={onUpdateItem}
                            />
                        </div>

                        {error && <div className="alert alert-danger">{error}</div>}
                        <div className="modal-actions">
                            <button type="button" className="secondary" onClick={onClose}>
                                Cancel
                            </button>
                            <button type="submit" className="primary">
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

// =========================================================
// Full‑screen Image Viewer
// =========================================================
const FullscreenImageModal = ({ isOpen, onClose, imageUrl, onReplaceImage, isUploading }) => {
    if (!isOpen) return null;

    return (
        <div className="fullscreen-overlay" onClick={onClose}>
            <div className="fullscreen-content" onClick={e => e.stopPropagation()}>
                <button className="fullscreen-close" onClick={onClose}>&times;</button>
                <div className="fullscreen-image-container">
                    {imageUrl ? (
                        <img src={imageUrl} alt="Full view" className="fullscreen-image" />
                    ) : (
                        <p>No image available</p>
                    )}
                </div>
                <div className="fullscreen-actions">
                    <button 
                        className="primary" 
                        onClick={onReplaceImage}
                        disabled={isUploading}
                    >
                        {isUploading ? 'Uploading...' : '🔄 Replace Image'}
                    </button>
                    <button className="secondary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

// =========================================================
// Upload Media Modal
// =========================================================
const UploadMediaModal = ({ 
    isOpen, 
    onClose, 
    task, 
    onUpload, 
    isUploading, 
    error 
}) => {
    const canvasRef1 = useRef(null);
    const canvasRef2 = useRef(null);
    const [isDrawing1, setIsDrawing1] = useState(false);
    const [isDrawing2, setIsDrawing2] = useState(false);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const fileInputRef = useRef(null);
    const [showFullscreen, setShowFullscreen] = useState(false);
    const [downstreamOption, setDownstreamOption] = useState('cutting');

    const sig1Uploaded = !!task?.signatureUploader;
    const sig2Uploaded = !!task?.signature2Uploader;
    const hasExistingImage = !!task?.imageUrl;

    useEffect(() => {
        if (isOpen && task) {
            const loadSignature = (canvasRef, signatureUrl) => {
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                if (signatureUrl) {
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
                    img.src = signatureUrl;
                } else {
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
            };

            loadSignature(canvasRef1, task.signatureUrl);
            loadSignature(canvasRef2, task.signature2Url);

            if (task.imageUrl) {
                setImagePreview(task.imageUrl);
            } else {
                setImagePreview(null);
            }
            setImageFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            setDownstreamOption('cutting');
        }
    }, [isOpen, task]);

    const getCanvasCoordinates = (e, canvas) => {
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

    const startDrawing = (ref, setDrawing) => (e) => {
        e.preventDefault();
        const canvas = ref.current;
        const ctx = canvas.getContext('2d');
        const { x, y } = getCanvasCoordinates(e, canvas);
        ctx.beginPath();
        ctx.moveTo(x, y);
        setDrawing(true);
    };

    const draw = (ref, isDrawing) => (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const canvas = ref.current;
        const ctx = canvas.getContext('2d');
        const { x, y } = getCanvasCoordinates(e, canvas);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = (setDrawing) => (e) => {
        e.preventDefault();
        setDrawing(false);
    };

    const clearSignature = (ref) => {
        const canvas = ref.current;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        } else {
            setImageFile(null);
            setImagePreview(task?.imageUrl || null);
        }
    };

    const getSignatureBlob = (ref) => {
        return new Promise((resolve) => {
            const canvas = ref.current;
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            let hasDrawing = false;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] < 250 || data[i+1] < 250 || data[i+2] < 250) {
                    hasDrawing = true;
                    break;
                }
            }
            if (hasDrawing) {
                canvas.toBlob(resolve, 'image/png');
            } else {
                resolve(null);
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const sig1Blob = await getSignatureBlob(canvasRef1);
        const sig2Blob = await getSignatureBlob(canvasRef2);

        const finalSig1 = sig1Uploaded ? null : sig1Blob;
        const finalSig2 = sig2Uploaded ? null : sig2Blob;

        const hasSig1 = !!(sig1Blob || sig1Uploaded);
        const hasSig2 = !!(sig2Blob || sig2Uploaded);
        const hasImage = !!(imageFile || hasExistingImage);

        if (!hasSig1 && !hasSig2) {
            alert('At least one signature must be present (existing or newly drawn).');
            return;
        }
        if (!hasImage) {
            alert('An image is required (existing or newly selected).');
            return;
        }

        onUpload({
            signature1: finalSig1,
            signature2: finalSig2,
            image: imageFile,
            downstreamOption: downstreamOption
        });
    };

    const handleImagePreviewClick = () => {
        if (imagePreview) {
            setShowFullscreen(true);
        }
    };

    const handleReplaceImage = () => {
        fileInputRef.current?.click();
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h2>📎 Upload Media for Task: {task?.title}</h2>
                        <button type="button" className="close-button" onClick={onClose}>
                            &times;
                        </button>
                    </div>

                    <div className="modal-body">
                        <form onSubmit={handleSubmit} className="upload-media-form">
                            <div className="signatures-row">
                                <div className="form-group signature-group">
                                    <label>
                                        ✍️ Signature 1
                                        {sig1Uploaded && (
                                            <span style={{ marginLeft: '8px', fontSize: '0.85rem', color: '#28a745' }}>
                                                ✅ Signed by {task.signatureUploader.username}
                                            </span>
                                        )}
                                    </label>
                                    <div 
                                        className="signature-canvas-container"
                                        style={{ opacity: sig1Uploaded ? 0.6 : 1 }}
                                    >
                                        <canvas
                                            ref={canvasRef1}
                                            width={500}
                                            height={200}
                                            style={{
                                                border: '1px solid #ccc',
                                                background: '#fff',
                                                cursor: sig1Uploaded ? 'default' : 'crosshair',
                                                width: '100%',
                                                height: 'auto',
                                                touchAction: 'none',
                                                pointerEvents: sig1Uploaded ? 'none' : 'auto'
                                            }}
                                            onMouseDown={startDrawing(canvasRef1, setIsDrawing1)}
                                            onMouseMove={draw(canvasRef1, isDrawing1)}
                                            onMouseUp={stopDrawing(setIsDrawing1)}
                                            onMouseLeave={stopDrawing(setIsDrawing1)}
                                            onTouchStart={startDrawing(canvasRef1, setIsDrawing1)}
                                            onTouchMove={draw(canvasRef1, isDrawing1)}
                                            onTouchEnd={stopDrawing(setIsDrawing1)}
                                            onTouchCancel={stopDrawing(setIsDrawing1)}
                                        />
                                    </div>
                                    <button 
                                        type="button" 
                                        className="secondary small" 
                                        onClick={() => clearSignature(canvasRef1)}
                                        disabled={sig1Uploaded}
                                        style={{ opacity: sig1Uploaded ? 0.5 : 1 }}
                                    >
                                        🧹 Clear Signature 1
                                    </button>
                                    {sig1Uploaded && (
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                                            Uploaded by: {task.signatureUploader.username}
                                        </div>
                                    )}
                                </div>

                                <div className="form-group signature-group">
                                    <label>
                                        ✍️ Signature 2
                                        {sig2Uploaded && (
                                            <span style={{ marginLeft: '8px', fontSize: '0.85rem', color: '#28a745' }}>
                                                ✅ Signed by {task.signature2Uploader.username}
                                            </span>
                                        )}
                                    </label>
                                    <div 
                                        className="signature-canvas-container"
                                        style={{ opacity: sig2Uploaded ? 0.6 : 1 }}
                                    >
                                        <canvas
                                            ref={canvasRef2}
                                            width={500}
                                            height={200}
                                            style={{
                                                border: '1px solid #ccc',
                                                background: '#fff',
                                                cursor: sig2Uploaded ? 'default' : 'crosshair',
                                                width: '100%',
                                                height: 'auto',
                                                touchAction: 'none',
                                                pointerEvents: sig2Uploaded ? 'none' : 'auto'
                                            }}
                                            onMouseDown={startDrawing(canvasRef2, setIsDrawing2)}
                                            onMouseMove={draw(canvasRef2, isDrawing2)}
                                            onMouseUp={stopDrawing(setIsDrawing2)}
                                            onMouseLeave={stopDrawing(setIsDrawing2)}
                                            onTouchStart={startDrawing(canvasRef2, setIsDrawing2)}
                                            onTouchMove={draw(canvasRef2, isDrawing2)}
                                            onTouchEnd={stopDrawing(setIsDrawing2)}
                                            onTouchCancel={stopDrawing(setIsDrawing2)}
                                        />
                                    </div>
                                    <button 
                                        type="button" 
                                        className="secondary small" 
                                        onClick={() => clearSignature(canvasRef2)}
                                        disabled={sig2Uploaded}
                                        style={{ opacity: sig2Uploaded ? 0.5 : 1 }}
                                    >
                                        🧹 Clear Signature 2
                                    </button>
                                    {sig2Uploaded && (
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                                            Uploaded by: {task.signature2Uploader.username}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>📷 Upload Image (Photo)</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    ref={fileInputRef}
                                    className="file-input"
                                />
                                {imagePreview && (
                                    <div className="image-preview-container" onClick={handleImagePreviewClick} style={{ cursor: 'pointer' }}>
                                        <img src={imagePreview} alt="Preview" className="image-preview" />
                                        <div className="image-preview-overlay">🔍 Click to view full screen</div>
                                    </div>
                                )}
                                <p className="form-hint">
                                    {task?.imageUrl 
                                        ? "Upload a new image to replace the existing one, or leave empty to keep current image." 
                                        : "Please select an image."}
                                </p>
                            </div>

                            {error && <div className="alert alert-danger">{error}</div>}

                            <div className="modal-actions">
                                <button type="button" className="secondary" onClick={onClose} disabled={isUploading}>
                                    Cancel
                                </button>
                                <button type="submit" className="primary" disabled={isUploading}>
                                    {isUploading ? 'Uploading...' : 'Upload & Complete Task'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <FullscreenImageModal
                isOpen={showFullscreen}
                onClose={() => setShowFullscreen(false)}
                imageUrl={imagePreview}
                onReplaceImage={handleReplaceImage}
                isUploading={isUploading}
            />
        </>
    );
};

// =========================================================
// View Media Modal (read-only)
// =========================================================
const ViewMediaModal = ({ isOpen, onClose, task }) => {
    if (!isOpen || !task) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>📂 Media for: {task.title}</h2>
                    <button type="button" className="close-button" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {task.imageUrl && (
                            <div>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>📷 Image</label>
                                <img src={task.imageUrl} alt="Task" style={{ maxWidth: '100%', maxHeight: '400px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                {task.imageUploader && (
                                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '8px' }}>
                                        Uploaded by: {task.imageUploader.username}
                                    </div>
                                )}
                            </div>
                        )}
                        {task.signatureUrl && (
                            <div>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>✍️ Signature 1</label>
                                <img src={task.signatureUrl} alt="Signature 1" style={{ maxWidth: '100%', maxHeight: '200px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                {task.signatureUploader && (
                                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '8px' }}>
                                        Uploaded by: {task.signatureUploader.username}
                                    </div>
                                )}
                            </div>
                        )}
                        {task.signature2Url && (
                            <div>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>✍️ Signature 2</label>
                                <img src={task.signature2Url} alt="Signature 2" style={{ maxWidth: '100%', maxHeight: '200px', border: '1px solid #ddd', borderRadius: '4px' }} />
                                {task.signature2Uploader && (
                                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '8px' }}>
                                        Uploaded by: {task.signature2Uploader.username}
                                    </div>
                                )}
                            </div>
                        )}
                        {!task.imageUrl && !task.signatureUrl && !task.signature2Url && (
                            <p style={{ color: '#6c757d' }}>No media uploaded for this task.</p>
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
// View Files Modal
// =========================================================
const ViewFilesModal = ({ isOpen, onClose, task, files, isLoading, onDownload }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>📁 Files for: {task?.title}</h2>
                    <button type="button" className="close-button" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    {isLoading ? (
                        <p>Loading files...</p>
                    ) : files.length === 0 ? (
                        <p style={{ color: '#6c757d' }}>No files attached to this task.</p>
                    ) : (
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {files.map(file => (
                                <li key={file.id} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '8px 12px',
                                    borderBottom: '1px solid #e2e8f0'
                                }}>
                                    <span>
                                        📄 {file.fileName}
                                        <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '8px' }}>
                                            ({(file.fileSize / 1024).toFixed(1)} KB)
                                        </span>
                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '8px' }}>
                                            uploaded {new Date(file.uploadedAt).toLocaleDateString()}
                                        </span>
                                    </span>
                                    <button
                                        onClick={() => onDownload(file.id, file.fileName)}
                                        className="secondary small"
                                        style={{ padding: '4px 12px' }}
                                    >
                                        ⬇️ Download
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="modal-actions">
                    <button type="button" className="secondary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

// =========================================================
// Main Door Component
// =========================================================
const Door = ({ navigate }) => {
    const [tasks, setTasks] = useState([]);
    const [projects, setProjects] = useState([]);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isMediaUploadModalOpen, setIsMediaUploadModalOpen] = useState(false);
    const [uploadingTask, setUploadingTask] = useState(null);
    const [isUploadingMedia, setIsUploadingMedia] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [viewMediaTask, setViewMediaTask] = useState(null);
    const [viewFilesTask, setViewFilesTask] = useState(null);
    const [taskFiles, setTaskFiles] = useState([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isProjectsLoading, setIsProjectsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [uploadMediaError, setUploadMediaError] = useState(null);
    const [activeTab, setActiveTab] = useState('tasks');

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    const [inventoryList, setInventoryList] = useState([]);
    const [taskItems, setTaskItems] = useState([]);
    const [selectedInventoryId, setSelectedInventoryId] = useState('');
    const [itemQuantity, setItemQuantity] = useState('1');

    const [filters, setFilters] = useState({
        priority: 'all',
        status: 'all',
        projectNo: 'all',
        search: '',
    });

    const [sortConfig, setSortConfig] = useState({
        key: 'createdAt',
        direction: 'desc',
    });

    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        remark: '',
        priority: 'medium',
        status: 'pending',
        project_no: '',
        due_date: '',
    });

    // ---------- Helpers ----------
    const areAllItemsChecked = (task) => {
        if (!task.inventoryItems || task.inventoryItems.length === 0) return true;
        return task.inventoryItems.every(item => item.is_checked === true);
    };

    const hasAllMedia = (task) => {
        return !!(task.imageUrl && task.signatureUrl && task.signature2Url);
    };

    // ---------- Auto‑complete (FIXED – accepts taskId, fetches fresh data) ----------
    const autoCompleteTask = async (taskId) => {
        // Fetch the freshest task from the API
        try {
            const freshTasks = await doorTasksAPI.getAll();
            const freshTask = freshTasks.find(t => t.id === taskId);
            if (!freshTask) return;

            if (freshTask.status === 'completed') return;
            if (areAllItemsChecked(freshTask) && hasAllMedia(freshTask)) {
                console.log(`✅ Auto‑completing task ${freshTask.id}: ${freshTask.title}`);
                await doorTasksAPI.update(freshTask.id, { status: 'completed' });

                // Update local state
                const items = await doorTasksAPI.getItems(freshTask.id);
                const taskWithItems = { ...freshTask, inventoryItems: items, status: 'completed' };
                setTasks(prev =>
                    prev.map(t =>
                        t.id === freshTask.id ? taskWithItems : t
                    )
                );
            }
        } catch (err) {
            console.error('Auto‑complete failed:', err);
        }
    };

    // ---------- Data fetching ----------
    const fetchInventoryList = async () => {
        try {
            const data = await inventoryAPI.getAll();
            setInventoryList(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch inventory:', err);
        }
    };

    useEffect(() => {
        fetchTasks();
        fetchProjects();
        fetchInventoryList();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [filters]);

    const fetchTasks = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await doorTasksAPI.getAll();
            const tasksWithItems = await Promise.all(
                data.map(async (task) => {
                    try {
                        const items = await doorTasksAPI.getItems(task.id);
                        return { ...task, inventoryItems: items };
                    } catch (err) {
                        console.error(`Failed to fetch items for task ${task.id}:`, err);
                        return { ...task, inventoryItems: [] };
                    }
                })
            );
            setTasks(tasksWithItems);
        } catch (err) {
            console.error('Failed to fetch tasks:', err);
            setError('Failed to load tasks. Please ensure the backend is running.');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchProjects = async () => {
        setIsProjectsLoading(true);
        try {
            const data = await projectsAPI.getAll();
            setProjects(data);
        } catch (err) {
            console.error('Failed to fetch projects:', err);
            setError('Failed to load projects list.');
        } finally {
            setIsProjectsLoading(false);
        }
    };

    const uniqueProjectNos = useMemo(() => {
        const projectNumbers = projects
            .map((project) => project.projectNo)
            .filter((p) => p);
        return [...new Set(projectNumbers)].sort();
    }, [projects]);

    // ---------- Filtering & sorting ----------
    const filteredTasks = useMemo(() => {
        let filtered = tasks.filter((task) => {
            if (filters.priority !== 'all' && task.priority !== filters.priority)
                return false;
            if (filters.status !== 'all' && task.status !== filters.status)
                return false;
            if (filters.projectNo !== 'all' && task.projectNo !== filters.projectNo)
                return false;
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                return (
                    task.title?.toLowerCase().includes(searchLower) ||
                    task.description?.toLowerCase().includes(searchLower) ||
                    task.projectNo?.toLowerCase().includes(searchLower) ||
                    task.remark?.toLowerCase().includes(searchLower)
                );
            }
            return true;
        });

        filtered.sort((a, b) => {
            const isACompleted = a.status?.toLowerCase() === 'completed';
            const isBCompleted = b.status?.toLowerCase() === 'completed';
            if (isACompleted !== isBCompleted) return isACompleted ? 1 : -1;
            if (sortConfig.key) {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];
                if (sortConfig.key === 'priority') {
                    const priorityWeight = { high: 1, medium: 2, low: 3 };
                    aValue = priorityWeight[a.priority?.toLowerCase()] || 4;
                    bValue = priorityWeight[b.priority?.toLowerCase()] || 4;
                }
                if (
                    sortConfig.key.includes('Date') ||
                    sortConfig.key === 'createdAt'
                ) {
                    aValue = new Date(aValue || 0).getTime();
                    bValue = new Date(bValue || 0).getTime();
                }
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
        return filtered;
    }, [tasks, filters, sortConfig]);

    // ---------- Pagination ----------
    const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedTasks = filteredTasks.slice(startIndex, endIndex);
    const goToPage = (page) => {
        if (page >= 1 && page <= totalPages) setCurrentPage(page);
    };

    // ---------- Task CRUD ----------
    const openCreateModal = () => {
        setNewTask({
            title: '',
            description: '',
            remark: '',
            priority: 'medium',
            status: 'pending',
            project_no: uniqueProjectNos.length > 0 ? uniqueProjectNos[0] : '',
            due_date: '',
        });
        setTaskItems([]);
        setSelectedInventoryId('');
        setItemQuantity('1');
        setError(null);
        setIsTaskModalOpen(true);
        fetchInventoryList();
    };

    const closeCreateModal = () => {
        setIsTaskModalOpen(false);
        setError(null);
        setTaskItems([]);
    };

    const openEditModal = async (task) => {
        const { id, title, description, remark, priority, status, projectNo } = task;
        setEditingTask({
            id,
            title,
            description,
            remark: remark || '',
            priority,
            status,
            project_no: projectNo || (uniqueProjectNos.length > 0 ? uniqueProjectNos[0] : ''),
            due_date: task.dueDate ? task.dueDate.substring(0, 10) : '',
        });
        try {
            const items = await doorTasksAPI.getItems(id);
            setTaskItems(items);
        } catch (err) {
            console.error('Failed to fetch task items:', err);
            setTaskItems([]);
        }
        setSelectedInventoryId('');
        setItemQuantity('1');
        setError(null);
        setIsEditModalOpen(true);
        fetchInventoryList();
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setEditingTask(null);
        setError(null);
        setTaskItems([]);
    };

    const handleAddItem = () => {
        if (!selectedInventoryId) {
            alert('Please select an item.');
            return;
        }
        const parsedQty = parseInt(itemQuantity, 10);
        if (!itemQuantity || isNaN(parsedQty) || parsedQty < 1) {
            alert('Quantity must be a whole number of at least 1.');
            return;
        }
        if (taskItems.some((item) => item.inventory_id === parseInt(selectedInventoryId))) {
            alert('Item already added. Please remove it first to change quantity.');
            return;
        }
        const inventoryItem = inventoryList.find((i) => i.id === parseInt(selectedInventoryId));
        if (!inventoryItem) return;
        if (inventoryItem.quantity < parsedQty) {
            alert(`Not enough stock. Available: ${inventoryItem.quantity}`);
            return;
        }
        const newItem = {
            inventory_id: parseInt(selectedInventoryId),
            inventory_name: inventoryItem.name,
            quantity: parsedQty,
        };
        setTaskItems([...taskItems, newItem]);
        setSelectedInventoryId('');
        setItemQuantity('1');
    };

    const handleRemoveItem = (inventoryId) => {
        setTaskItems(taskItems.filter((item) => item.inventory_id !== inventoryId));
    };

    const handleUpdateItem = (inventoryId, newQuantity) => {
        setTaskItems((prevItems) =>
            prevItems.map((item) =>
                item.inventory_id === inventoryId ? { ...item, quantity: newQuantity } : item
            )
        );
    };

    // ----- Media deletion helper -----
    const deleteAllMedia = async (taskId) => {
        let errors = [];
        try {
            await doorTasksAPI.deleteImage(taskId);
        } catch { errors.push('image'); }
        try {
            await doorTasksAPI.deleteSignature1(taskId);
        } catch { errors.push('sig1'); }
        try {
            await doorTasksAPI.deleteSignature2(taskId);
        } catch { errors.push('sig2'); }
        if (errors.length === 3) {
            throw new Error('Failed to delete any media for task ' + taskId);
        }
    };

    // ----- Toggle item check status -----
    const handleToggleItemCheck = async (taskId, inventoryId, currentChecked) => {
        const newChecked = !currentChecked;
        let updatedTask = null;

        setTasks(prev =>
            prev.map(task => {
                if (task.id !== taskId) return task;
                const updatedItems = task.inventoryItems.map(item =>
                    item.inventory_id === inventoryId ? { ...item, is_checked: newChecked } : item
                );
                updatedTask = { ...task, inventoryItems: updatedItems };
                return updatedTask;
            })
        );

        try {
            await doorTasksAPI.toggleItemCheck(taskId, inventoryId, newChecked);
            if (updatedTask) await autoCompleteTask(taskId);
        } catch (err) {
            console.error('Failed to toggle item check:', err);
            setTasks(prev =>
                prev.map(task => {
                    if (task.id !== taskId) return task;
                    const revertedItems = task.inventoryItems.map(item =>
                        item.inventory_id === inventoryId ? { ...item, is_checked: currentChecked } : item
                    );
                    return { ...task, inventoryItems: revertedItems };
                })
            );
            alert('Failed to update item check status.');
        }
    };

    // ----- Create task -----
    const handleCreateTask = async (e) => {
        e.preventDefault();
        if (!newTask.title.trim()) {
            setError('Task title is required');
            return;
        }
        if (!newTask.project_no.trim()) {
            setError('Project No is required');
            return;
        }
        try {
            const payload = {
                ...newTask,
                items: taskItems.map((item) => ({
                    inventory_id: item.inventory_id,
                    quantity: item.quantity,
                })),
            };
            const createdTask = await doorTasksAPI.create(payload);
            const items = await doorTasksAPI.getItems(createdTask.id);
            const taskWithItems = { ...createdTask, inventoryItems: items };
            setTasks((prev) => [taskWithItems, ...prev]);
            closeCreateModal();
        } catch (err) {
            console.error('Failed to create task:', err);
            setError('Failed to create task. ' + err.message);
        }
    };

    // ----- Update task (edit modal) -----
    const handleUpdateTask = async (e) => {
        e.preventDefault();
        if (!editingTask.title.trim()) {
            setError('Task title is required');
            return;
        }
        if (!editingTask.project_no.trim()) {
            setError('Project No is required');
            return;
        }

        if (editingTask.status === 'completed') {
            const currentTask = tasks.find(t => t.id === editingTask.id);
            if (currentTask && !areAllItemsChecked(currentTask)) {
                setError('Cannot mark as completed: all inventory items must be checked.');
                return;
            }
        }

        const currentTask = tasks.find(t => t.id === editingTask.id);
        if (!currentTask) return;

        const wasCompleted = currentTask.status === 'completed';
        const willBeCompleted = editingTask.status === 'completed';
        let mediaDeleted = false;

        try {
            if (wasCompleted && !willBeCompleted && currentTask.imageUrl) {
                await deleteAllMedia(editingTask.id);
                mediaDeleted = true;
                setTasks(prev =>
                    prev.map(t =>
                        t.id === editingTask.id ? { ...t, imageUrl: null, signatureUrl: null, signature2Url: null } : t
                    )
                );
            }

            const payload = {
                title: editingTask.title,
                description: editingTask.description,
                remark: editingTask.remark,
                priority: editingTask.priority,
                status: editingTask.status,
                project_no: editingTask.project_no,
                due_date: editingTask.due_date,
                items: taskItems.map((item) => ({
                    inventory_id: item.inventory_id,
                    quantity: item.quantity,
                })),
            };

            if (mediaDeleted) {
                payload.clearImage = true;
                payload.clearSignature1 = true;
                payload.clearSignature2 = true;
            }

            const updatedTask = await doorTasksAPI.update(editingTask.id, payload);
            if (mediaDeleted) {
                updatedTask.imageUrl = null;
                updatedTask.signatureUrl = null;
                updatedTask.signature2Url = null;
            }
            const items = await doorTasksAPI.getItems(updatedTask.id);
            const taskWithItems = { ...updatedTask, inventoryItems: items };
            setTasks(prev =>
                prev.map(task => (task.id === taskWithItems.id ? taskWithItems : task))
            );
            closeEditModal();
        } catch (err) {
            console.error('Failed to update task:', err);
            setError('Failed to save changes: ' + err.message);
        }
    };

    // ----- Update task status (dropdown) -----
    const handleUpdateTaskStatus = async (taskId, newStatus) => {
        const currentTask = tasks.find(t => t.id === taskId);
        if (!currentTask) return;

        if (newStatus === 'completed' && !areAllItemsChecked(currentTask)) {
            alert('Cannot mark as completed: all inventory items must be checked.');
            return;
        }

        const wasCompleted = currentTask.status === 'completed';
        const willBeCompleted = newStatus === 'completed';
        let mediaDeleted = false;

        try {
            if (wasCompleted && !willBeCompleted && currentTask.imageUrl) {
                await deleteAllMedia(taskId);
                mediaDeleted = true;
                setTasks(prev =>
                    prev.map(t =>
                        t.id === taskId ? { ...t, imageUrl: null, signatureUrl: null, signature2Url: null } : t
                    )
                );
            }

            const payload = { status: newStatus };
            if (mediaDeleted) {
                payload.clearImage = true;
                payload.clearSignature1 = true;
                payload.clearSignature2 = true;
            }

            const updatedTask = await doorTasksAPI.update(taskId, payload);
            if (mediaDeleted) {
                updatedTask.imageUrl = null;
                updatedTask.signatureUrl = null;
                updatedTask.signature2Url = null;
            }

            setTasks(prev =>
                prev.map(task => {
                    if (task.id !== taskId) return task;
                    return {
                        ...task,
                        ...updatedTask,
                        inventoryItems: task.inventoryItems || [],
                    };
                })
            );
        } catch (err) {
            console.error('Failed to update task status:', err);
            setError('Failed to update task status.');
        }
    };

    // ----- Delete task -----
    const handleDeleteTask = async (taskId) => {
        if (!window.confirm('Are you sure you want to delete this task?')) return;
        try {
            await doorTasksAPI.delete(taskId);
            setTasks(prev => prev.filter(task => task.id !== taskId));
        } catch (err) {
            console.error('Failed to delete task:', err);
            setError('Failed to delete task.');
        }
    };

    // ----- Upload media (FIXED – uses autoCompleteTask correctly) -----
    const openUploadModal = (task) => {
        setUploadingTask(task);
        setUploadMediaError(null);
        setIsMediaUploadModalOpen(true);
    };

    const closeUploadModal = () => {
        setIsMediaUploadModalOpen(false);
        setUploadingTask(null);
        setUploadMediaError(null);
    };

    const handleUploadMedia = async (mediaData) => {
        if (!uploadingTask) return;
        const { signature1, signature2, image } = mediaData;

        setIsUploadingMedia(true);
        setUploadMediaError(null);

        try {
            if (signature1) {
                const formData = new FormData();
                formData.append('signature', signature1, 'signature1.png');
                await doorTasksAPI.uploadSignature1(uploadingTask.id, formData);
            }
            if (signature2) {
                const formData = new FormData();
                formData.append('signature', signature2, 'signature2.png');
                await doorTasksAPI.uploadSignature2(uploadingTask.id, formData);
            }
            if (image) {
                const formData = new FormData();
                formData.append('image', image);
                await doorTasksAPI.uploadImage(uploadingTask.id, formData);
            }

            // Refresh the list in the background
            await fetchTasks();

            // Call auto-complete with the task ID (it will fetch fresh data)
            await autoCompleteTask(uploadingTask.id);

            closeUploadModal();
        } catch (err) {
            console.error('Failed to upload media:', err);
            setUploadMediaError('Failed to upload: ' + (err.message || 'Please try again.'));
        } finally {
            setIsUploadingMedia(false);
        }
    };

    // ----- Delete media (all) -----
    const handleDeleteMedia = async (taskId) => {
        if (!window.confirm('Delete all uploaded media (image and signatures) for this task?')) return;
        try {
            await deleteAllMedia(taskId);
            await fetchTasks();
        } catch (err) {
            console.error('Failed to delete media:', err);
            setError('Failed to delete media. Please try again.');
        }
    };

    // ----- View Media Modal -----
    const openViewMediaModal = (task) => {
        setViewMediaTask(task);
    };

    const closeViewMediaModal = () => {
        setViewMediaTask(null);
    };

    // ----- View Files Modal -----
    const openViewFilesModal = async (task) => {
        setViewFilesTask(task);
        setIsLoadingFiles(true);
        setTaskFiles([]);
        try {
            const files = await doorTasksAPI.getFiles(task.id);
            setTaskFiles(files);
        } catch (err) {
            console.error('Failed to fetch task files:', err);
            alert('Could not load files. Please try again.');
        } finally {
            setIsLoadingFiles(false);
        }
    };

    const closeViewFilesModal = () => {
        setViewFilesTask(null);
        setTaskFiles([]);
    };

    const handleDownloadFile = async (fileId, fileName) => {
        try {
            const response = await doorTasksAPI.downloadFileBlob(fileId);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download failed:', err);
            alert('Failed to download file. Please try again.');
        }
    };

    // ---------- Input change handlers ----------
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewTask((prev) => ({ ...prev, [name]: value }));
    };

    const handleEditInputChange = (e) => {
        const { name, value } = e.target;
        setEditingTask((prev) => ({ ...prev, [name]: value }));
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const handleSearchChange = (e) => {
        setFilters((prev) => ({ ...prev, search: e.target.value }));
    };

    const handleSort = (key) => {
        setSortConfig((prev) => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    // ---------- UI helpers ----------
    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'high': return '#dc3545';
            case 'medium': return '#ffc107';
            case 'low': return '#28a745';
            default: return '#6c757d';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return '#28a745';
            case 'in-progress': return '#17a2b8';
            case 'pending': return '#ffc107';
            default: return '#6c757d';
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Not set';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return '↕️';
        return sortConfig.direction === 'asc' ? '⬆️' : '⬇️';
    };

    // ---------- Render ----------
    return (
        <div className="panel-slab-container">
            <header className="page-header">
                <div className="header-left">
                    <button className="back-btn" onClick={() => navigate('/')}>
                        ← Back to Projects
                    </button>
                    <h1>🚪 Door Tasks Management</h1>
                </div>
            </header>

            <div className="tab-bar">
                <button
                    className={`tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tasks')}
                >
                    📋 Tasks
                </button>
                <button
                    className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
                    onClick={() => setActiveTab('inventory')}
                >
                    📦 Inventory
                </button>
            </div>

            {activeTab === 'tasks' && (
                <>
                    {/* Dashboard cards */}
                    <div className="dashboard-cards">
                        <div className="dashboard-card">
                            <div className="card-icon">📋</div>
                            <div className="card-content">
                                <h3>Total Tasks</h3>
                                <p className="card-value">{tasks.length}</p>
                            </div>
                        </div>
                        <div className="dashboard-card">
                            <div className="card-icon">⏳</div>
                            <div className="card-content">
                                <h3>Pending</h3>
                                <p className="card-value">
                                    {tasks.filter((t) => t.status === 'pending').length}
                                </p>
                            </div>
                        </div>
                        <div className="dashboard-card">
                            <div className="card-icon">🔄</div>
                            <div className="card-content">
                                <h3>In Progress</h3>
                                <p className="card-value">
                                    {tasks.filter((t) => t.status === 'in-progress').length}
                                </p>
                            </div>
                        </div>
                        <div className="dashboard-card">
                            <div className="card-icon">✅</div>
                            <div className="card-content">
                                <h3>Completed</h3>
                                <p className="card-value">
                                    {tasks.filter((t) => t.status === 'completed').length}
                                </p>
                            </div>
                        </div>
                        <div className="dashboard-card">
                            <div className="card-icon">⏸️</div>
                            <div className="card-content">
                                <h3>On Hold</h3>
                                <p className="card-value">
                                    {tasks.filter((t) => t.status === 'on-hold').length}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="filters-section">
                        <div className="filter-row">
                            <div className="search-box">
                                <input
                                    type="text"
                                    placeholder="🔍 Search tasks..."
                                    value={filters.search}
                                    onChange={handleSearchChange}
                                    className="search-input"
                                />
                            </div>
                            <div className="filter-group">
                                <select name="priority" value={filters.priority} onChange={handleFilterChange} className="form-select">
                                    <option value="all">All Priorities</option>
                                    <option value="empty">Empty</option>
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                                <select name="status" value={filters.status} onChange={handleFilterChange} className="form-select">
                                    <option value="all">All Statuses</option>
                                    <option value="pending">Pending</option>
                                    <option value="on-hold">On Hold</option>
                                    <option value="in-progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                </select>
                                <select name="projectNo" value={filters.projectNo} onChange={handleFilterChange} className="form-select">
                                    <option value="all">All Projects</option>
                                    {uniqueProjectNos.map((pNo) => (
                                        <option key={pNo} value={pNo}>{pNo}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Tasks table */}
                    <div className="tasks-table-container">
                        {error && <div className="alert alert-danger">{error}</div>}
                        {isLoading ? (
                            <div className="loading-state"><p>Loading tasks... 🔄</p></div>
                        ) : filteredTasks.length === 0 && tasks.length > 0 ? (
                            <div className="empty-state">
                                <h3>No tasks match your current filters.</h3>
                                <p>Try clearing or adjusting your search/filters.</p>
                            </div>
                        ) : filteredTasks.length === 0 && tasks.length === 0 ? (
                            <div className="empty-state"><h3>No tasks yet</h3></div>
                        ) : (
                            <>
                                <div className="table-wrapper">
                                    <table className="tasks-table">
                                        <thead>
                                            <tr>
                                                <th className="door-title-col" onClick={() => handleSort('title')}>
                                                    Task Title {getSortIcon('title')}
                                                </th>
                                                <th className="door-project-col" onClick={() => handleSort('projectNo')}>
                                                    Project No {getSortIcon('projectNo')}
                                                </th>
                                                <th className="door-priority-col" onClick={() => handleSort('priority')}>
                                                    Priority {getSortIcon('priority')}
                                                </th>
                                                <th className="door-status-col" onClick={() => handleSort('status')}>
                                                    Status {getSortIcon('status')}
                                                </th>
                                                <th className="door-inventory-col">Inventory Used</th>
                                                <th className="door-actions-col">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedTasks.map((task) => {
                                                const showCompleted = task.status === 'completed' ||
                                                    (task.imageUrl && task.signatureUrl && task.signature2Url);
                                                const sig1Uploader = task.signatureUploader?.username || 'N/A';
                                                const sig2Uploader = task.signature2Uploader?.username || 'N/A';
                                                const imageUploader = task.imageUploader?.username || 'N/A';

                                                let uploaderParts = [];
                                                if (task.imageUrl) uploaderParts.push(`Image by ${imageUploader}`);
                                                if (task.signatureUrl) uploaderParts.push(`✍️ Sig1 by ${sig1Uploader}`);
                                                if (task.signature2Url) uploaderParts.push(`✍️ Sig2 by ${sig2Uploader}`);
                                                const uploaderInfo = uploaderParts.join(' | ');

                                                return (
                                                    <tr key={task.id} className="task-row">
                                                        <td className="door-title-cell">
                                                            <div className="task-title-main">{task.title}</div>
                                                            {task.remark && (
                                                                <div className="door-remark">
                                                                    💬 {task.remark}
                                                                </div>
                                                            )}
                                                            {uploaderInfo && (
                                                                <div className="image-indicator">
                                                                    <span className="image-badge">📋</span>
                                                                    <span className="uploaded-text">{uploaderInfo}</span>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <span className="project-no-badge">
                                                                {task.projectNo || 'N/A'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <span
                                                                className="priority-badge"
                                                                style={{ backgroundColor: getPriorityColor(task.priority) }}
                                                            >
                                                                {task.priority}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div className="status-cell">
                                                                <select
                                                                    value={task.status}
                                                                    onChange={(e) =>
                                                                        handleUpdateTaskStatus(task.id, e.target.value)
                                                                    }
                                                                    className="status-select"
                                                                    style={{
                                                                        borderColor: getStatusColor(task.status),
                                                                        backgroundColor: getStatusColor(task.status) + '20',
                                                                    }}
                                                                >
                                                                    <option value="pending">⏳ Pending</option>
                                                                    <option value="on-hold">⏸️ On Hold</option>
                                                                    <option value="in-progress">🔄 In Progress</option>
                                                                    {showCompleted && (
                                                                        <option value="completed">✅ Completed</option>
                                                                    )}
                                                                </select>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {task.inventoryItems && task.inventoryItems.length > 0 ? (
                                                                <div className="inventory-items-list">
                                                                    {task.inventoryItems.map((item, idx) => (
                                                                        <span
                                                                            key={item.inventory_id || idx}
                                                                            className="inventory-item-wrapper"
                                                                        >
                                                                            <button
                                                                                className={`item-check-btn ${item.is_checked ? 'checked' : ''}`}
                                                                                onClick={() =>
                                                                                    handleToggleItemCheck(
                                                                                        task.id,
                                                                                        item.inventory_id,
                                                                                        item.is_checked
                                                                                    )
                                                                                }
                                                                                title={item.is_checked ? 'Uncheck this item' : 'Check this item'}
                                                                                style={{
                                                                                    background: 'none',
                                                                                    border: 'none',
                                                                                    fontSize: '1rem',
                                                                                    cursor: 'pointer',
                                                                                    padding: '0 2px',
                                                                                    transition: 'transform 0.1s',
                                                                                    color: item.is_checked ? '#28a745' : '#6c757d',
                                                                                }}
                                                                            >
                                                                                {item.is_checked ? '✅' : '⬜'}
                                                                            </button>
                                                                            <span className="inventory-item-badge">
                                                                                {item.inventory_name} ({item.quantity})
                                                                            </span>
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="no-inventory">—</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <div className="action-btns">
                                                                <button
                                                                    onClick={() => openViewMediaModal(task)}
                                                                    className="action-btn view-btn"
                                                                    title="View media"
                                                                >
                                                                    👁️
                                                                </button>
                                                                <button
                                                                    onClick={() => openViewFilesModal(task)}
                                                                    className="action-btn files-btn"
                                                                    title="View attached files"
                                                                >
                                                                    📁
                                                                </button>
                                                                <button
                                                                    onClick={() => openEditModal(task)}
                                                                    className="action-btn edit-btn"
                                                                    title="Edit task"
                                                                >
                                                                    ✏️
                                                                </button>
                                                                <button
                                                                    onClick={() => openUploadModal(task)}
                                                                    className="action-btn upload-btn"
                                                                    title={task.imageUrl ? "Replace/update media" : "Upload media"}
                                                                >
                                                                    {task.imageUrl ? '✅' : '📤'}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteTask(task.id)}
                                                                    className="action-btn delete-task-btn"
                                                                    title="Delete task permanently"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {filteredTasks.length > itemsPerPage && (
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
                                            Showing {startIndex + 1}–{Math.min(endIndex, filteredTasks.length)} of {filteredTasks.length} tasks
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
                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
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
                                <div className="table-footer">
                                    <div className="table-summary">
                                        Showing {Math.min(filteredTasks.length, itemsPerPage)} tasks per page
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'inventory' && <InventoryManager hideCloseButton={true} />}

            {/* Modals */}
            <CreateTaskModal
                isOpen={isTaskModalOpen}
                onClose={closeCreateModal}
                newTask={newTask}
                onInputChange={handleInputChange}
                onSubmit={handleCreateTask}
                error={error}
                uniqueProjectNos={uniqueProjectNos}
                inventoryList={inventoryList}
                taskItems={taskItems}
                selectedInventoryId={selectedInventoryId}
                itemQuantity={itemQuantity}
                onAddItem={handleAddItem}
                onRemoveItem={handleRemoveItem}
                onSelectInventory={setSelectedInventoryId}
                onQuantityChange={setItemQuantity}
                onUpdateItem={handleUpdateItem}
            />
            <EditTaskModal
                isOpen={isEditModalOpen}
                onClose={closeEditModal}
                editingTask={editingTask}
                onInputChange={handleEditInputChange}
                onSubmit={handleUpdateTask}
                error={error}
                uniqueProjectNos={uniqueProjectNos}
                inventoryList={inventoryList}
                taskItems={taskItems}
                selectedInventoryId={selectedInventoryId}
                itemQuantity={itemQuantity}
                onAddItem={handleAddItem}
                onRemoveItem={handleRemoveItem}
                onSelectInventory={setSelectedInventoryId}
                onQuantityChange={setItemQuantity}
                onUpdateItem={handleUpdateItem}
            />
            <UploadMediaModal
                isOpen={isMediaUploadModalOpen}
                onClose={closeUploadModal}
                task={uploadingTask}
                onUpload={handleUploadMedia}
                isUploading={isUploadingMedia}
                error={uploadMediaError}
            />
            <ViewMediaModal
                isOpen={!!viewMediaTask}
                onClose={closeViewMediaModal}
                task={viewMediaTask}
            />
            <ViewFilesModal
                isOpen={!!viewFilesTask}
                onClose={closeViewFilesModal}
                task={viewFilesTask}
                files={taskFiles}
                isLoading={isLoadingFiles}
                onDownload={handleDownloadFile}
            />
        </div>
    );
};

export default Door;