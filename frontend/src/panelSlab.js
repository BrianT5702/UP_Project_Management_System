import React, { useState, useEffect, useMemo, useRef } from 'react';
import { panelTasksAPI, projectsAPI, cuttingTasksAPI, transportationTasksAPI , getUserPosition } from './apiService';
import './PanelSlab.css';
import ViewPanelPage from './ViewPanelPage';
import ProductionPage from './ProductionPage';

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
    uniqueProjectNos 
}) => {
    if (!isOpen || !editingTask) return null;

    const showCutting = editingTask.status === 'cutting' ||
        (editingTask.imageUrl && editingTask.signatureUrl && editingTask.signature2Url);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
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
                                {uniqueProjectNos.map(projectNo => (
                                    <option key={projectNo} value={projectNo}>
                                        {projectNo}
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
                                    {showCutting && (
                                        <option value="cutting">✅ Completed</option>
                                    )}
                                </select>
                            </div>
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
// Create Task Modal
// =========================================================
const CreateTaskModal = ({ 
    isOpen, 
    onClose, 
    newTask, 
    onInputChange, 
    onSubmit, 
    error,
    uniqueProjectNos 
}) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>➕ Create New Task</h2>
                    <button type="button" className="close-button" onClick={onClose}>
                        &times;
                    </button>
                </div>

                <div className="modal-body">
                    <form onSubmit={onSubmit} className="task-form">
                        <div className="form-group">
                            <label htmlFor="createProjectNo">Project No *</label>
                            <select 
                                id="createProjectNo" 
                                name="project_no" 
                                value={newTask.project_no || ''} 
                                onChange={onInputChange} 
                                required 
                                className="form-select"
                            >
                                <option value="">Select a project</option>
                                {uniqueProjectNos.map(projectNo => (
                                    <option key={projectNo} value={projectNo}>
                                        {projectNo}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="createTitle">Task Title *</label>
                            <input 
                                type="text" 
                                id="createTitle" 
                                name="title" 
                                value={newTask.title} 
                                onChange={onInputChange} 
                                required 
                                autoComplete="off" 
                                className="form-input" 
                                placeholder="Enter task title"
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="createPriority">Priority</label>
                                <select 
                                    id="createPriority" 
                                    name="priority" 
                                    value={newTask.priority} 
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
                                <label htmlFor="createStatus">Status</label>
                                <select 
                                    id="createStatus" 
                                    name="status" 
                                    value={newTask.status} 
                                    onChange={onInputChange} 
                                    className="form-select"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="on-hold">On Hold</option>
                                    <option value="in-progress">In Progress</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="createDueDate">Due Date</label>
                            <input 
                                type="date" 
                                id="createDueDate" 
                                name="due_date" 
                                value={newTask.due_date || ''} 
                                onChange={onInputChange} 
                                className="form-input" 
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
// Upload Media Modal (with downstream option logic)
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

    const sig1Uploaded = !!task?.signatureUploader;      // saved signature 1 exists
    const sig2Uploaded = !!task?.signature2Uploader;    // saved signature 2 exists
    const hasExistingImage = !!task?.imageUrl;           // saved image exists

    // ★★★ CRITICAL: show downstream ONLY when signature 1 AND image are ALREADY SAVED ★★★
    const showDownstream = sig1Uploaded && hasExistingImage;

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
        // Force re‑render to update downstream visibility
        setDrawingState(prev => !prev);
    };

    const [, setDrawingState] = useState(false);

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

        // Only send new drawings if signature not already saved
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
                                        onClick={() => {
                                            clearSignature(canvasRef1);
                                            setDrawingState(prev => !prev);
                                        }}
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
                                        onClick={() => {
                                            clearSignature(canvasRef2);
                                            setDrawingState(prev => !prev);
                                        }}
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

                            {/* ★★★ Downstream option appears ONLY when signature 1 AND image are already saved ★★★ */}
                            {showDownstream && (
                                <div className="form-group" style={{ marginTop: '12px' }}>
                                    <label htmlFor="downstreamSelect">Create downstream task:</label>
                                    <select
                                        id="downstreamSelect"
                                        value={downstreamOption}
                                        onChange={(e) => setDownstreamOption(e.target.value)}
                                        className="form-select"
                                        style={{ marginTop: '4px' }}
                                    >
                                        <option value="cutting">✂️ Cutting Task (and later Transportation)</option>
                                        <option value="transportation">🚚 Transportation Task (directly)</option>
                                    </select>
                                    <p className="form-hint" style={{ marginTop: '4px', color: '#64748b', fontSize: '0.85rem' }}>
                                        This option appears after the first signature and image are saved.
                                        You can now add the second signature and choose the downstream task.
                                    </p>
                                </div>
                            )}

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
                            </div>
                        )}
                        {task.signatureUrl && (
                            <div>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>✍️ Signature 1</label>
                                <img src={task.signatureUrl} alt="Signature 1" style={{ maxWidth: '100%', maxHeight: '200px', border: '1px solid #ddd', borderRadius: '4px' }} />
                            </div>
                        )}
                        {task.signature2Url && (
                            <div>
                                <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>✍️ Signature 2</label>
                                <img src={task.signature2Url} alt="Signature 2" style={{ maxWidth: '100%', maxHeight: '200px', border: '1px solid #ddd', borderRadius: '4px' }} />
                            </div>
                        )}
                        {!task.imageUrl && !task.signatureUrl && !task.signature2Url && (
                            <p style={{ color: '#6c757d' }}>No media uploaded for this task.</p>
                        )}
                        {task.imageUploader && (
                            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '8px' }}>
                                Image uploaded by: {task.imageUploader.username}
                            </div>
                        )}
                        {task.signatureUploader && (
                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                Signature 1 by: {task.signatureUploader.username}
                            </div>
                        )}
                        {task.signature2Uploader && (
                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                Signature 2 by: {task.signature2Uploader.username}
                            </div>
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
// NEW: View Files Modal
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
// Main PanelSlab Component
// =========================================================
const PanelSlab = ({ onBackToProjects, onPanelEditLockChange }) => {
    const [showViewPanel, setShowViewPanel] = useState(false);
    const [showProductionPage, setShowProductionPage] = useState(false);
    const [tasks, setTasks] = useState([]);
    const [projects, setProjects] = useState([]);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isMediaUploadModalOpen, setIsMediaUploadModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [uploadingTask, setUploadingTask] = useState(null);
    const [viewMediaTask, setViewMediaTask] = useState(null);
    const [viewFilesTask, setViewFilesTask] = useState(null);
    const [taskFiles, setTaskFiles] = useState([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [, setIsProjectsLoading] = useState(true);
    const [isUploadingMedia, setIsUploadingMedia] = useState(false);
    const [error, setError] = useState(null);
    const [uploadMediaError, setUploadMediaError] = useState(null);
    const [cuttingError, setCuttingError] = useState(null);
    const userPosition = useMemo(() => (getUserPosition() || '').toLowerCase().trim().replace(/\s+/g, '_'), []);
    const canViewPanelPage = userPosition === 'panel_manager' || userPosition === 'admin';

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    const [filters, setFilters] = useState({
        priority: 'all',
        status: 'all',
        projectNo: 'all',
        search: ''
    });

    const [sortConfig, setSortConfig] = useState({
        key: 'createdAt',
        direction: 'desc'
    });

    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        priority: 'medium',
        status: 'pending',
        project_no: '',
        due_date: '',
    });

    useEffect(() => {
        fetchTasks();
        fetchProjects();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [filters]);

    const fetchTasks = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await panelTasksAPI.getAll();
            setTasks(data);
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
        const projectNumbers = projects.map(project => project.projectNo).filter(p => p);
        return [...new Set(projectNumbers)].sort();
    }, [projects]);

    const createCuttingTaskFromPanelTask = async (panelTask, status = 'pending') => {
        try {
            const cuttingTaskData = {
                title: panelTask.title,
                description: panelTask.description,
                priority: 'empty',
                status: status,
                project_no: panelTask.projectNo,
                approve_status: 'Approved',
                due_date: panelTask.dueDate ? panelTask.dueDate.substring(0, 10) : null,
                panel_task_id: panelTask.id
            };
            await cuttingTasksAPI.create(cuttingTaskData);
            console.log(`Cutting task created (status: ${status}) for panel task:`, panelTask.id);
        } catch (err) {
            console.error('Failed to create cutting task:', err);
            setCuttingError('Failed to create cutting task. Please check the console.');
        }
    };

    const createTransportationTaskFromPanelTask = async (panelTask) => {
        try {
            await transportationTasksAPI.createFromPanelTask(panelTask.id);
            console.log(`🚚 Transportation task created directly for panel task: ${panelTask.id}`);
        } catch (err) {
            console.error('Failed to create transportation task:', err);
            setCuttingError('Failed to create transportation task. Please check the console.');
        }
    };

    const deleteAllMedia = async (taskId) => {
        let errors = [];
        try {
            await panelTasksAPI.deleteImage(taskId);
            console.log('Image deleted for task:', taskId);
        } catch (err) {
            console.warn('Could not delete image:', err.message);
            errors.push('image');
        }

        try {
            await panelTasksAPI.deleteSignature1(taskId);
            console.log('Signature 1 deleted for task:', taskId);
        } catch (err) {
            console.warn('Could not delete signature 1:', err.message);
            errors.push('signature1');
        }

        try {
            await panelTasksAPI.deleteSignature2(taskId);
            console.log('Signature 2 deleted for task:', taskId);
        } catch (err) {
            console.warn('Could not delete signature 2:', err.message);
            errors.push('signature2');
        }

        return { success: true, errors };
    };

    const hasAllMedia = (task) => {
        return !!(task.signatureUrl && task.signature2Url && task.imageUrl);
    };

    const handleUploadMedia = async (mediaData) => {
        if (!uploadingTask) return;
        const { signature1, signature2, image, downstreamOption } = mediaData;

        setIsUploadingMedia(true);
        setUploadMediaError(null);

        const failures = [];

        try {
            console.log('🔄 Starting media uploads for task', uploadingTask.id);

            if (signature1) {
                try {
                    const formData = new FormData();
                    formData.append('signature', signature1, 'signature1.png');
                    await panelTasksAPI.uploadSignature1(uploadingTask.id, formData);
                    console.log('✅ Signature 1 uploaded');
                } catch (err) {
                    console.error('❌ Failed to upload signature 1:', err);
                    failures.push(`Signature 1: ${err.message || 'upload failed'}`);
                }
            }

            if (signature2) {
                try {
                    const formData = new FormData();
                    formData.append('signature', signature2, 'signature2.png');
                    await panelTasksAPI.uploadSignature2(uploadingTask.id, formData);
                    console.log('✅ Signature 2 uploaded');
                } catch (err) {
                    console.error('❌ Failed to upload signature 2:', err);
                    failures.push(`Signature 2: ${err.message || 'upload failed'}`);
                }
            }

            if (image) {
                try {
                    const formData = new FormData();
                    formData.append('image', image);
                    await panelTasksAPI.uploadImage(uploadingTask.id, formData);
                    console.log('✅ Image uploaded');
                } catch (err) {
                    console.error('❌ Failed to upload image:', err);
                    failures.push(`Image: ${err.message || 'upload failed'}`);
                }
            }

            if (failures.length > 0) {
                await fetchTasks();
                setUploadMediaError(
                    `Some items failed to upload — ${failures.join('; ')}. ` +
                    `Please retry just the failed item(s).`
                );
                setIsUploadingMedia(false);
                return;
            }

            const freshTasks = await panelTasksAPI.getAll();
            setTasks(freshTasks);
            const freshTask = freshTasks.find(t => t.id === uploadingTask.id);

            if (!freshTask) {
                setUploadMediaError('Task not found after upload. Please refresh.');
                setIsUploadingMedia(false);
                return;
            }

            if (hasAllMedia(freshTask)) {
                console.log('🔄 Both signatures and image are present. Marking as completed...');
                await panelTasksAPI.update(uploadingTask.id, { status: 'cutting' });
                console.log('✅ Panel task status updated to "cutting"');

                try {
                    if (downstreamOption === 'cutting') {
                        await createCuttingTaskFromPanelTask(uploadingTask, 'pending');
                        console.log('✅ Cutting task created (pending)');
                    } else if (downstreamOption === 'transportation') {
                        await createTransportationTaskFromPanelTask(uploadingTask);
                        console.log('✅ Transportation task created directly (no cutting task)');
                    }
                } catch (downstreamErr) {
                    console.warn('⚠️ Downstream task creation failed:', downstreamErr);
                    setUploadMediaError(
                        'Panel marked as completed, but downstream task creation failed. ' +
                        'Please check the console or create it manually.'
                    );
                }
            } else {
                console.log('📝 Media uploaded, but not all required media are present yet. Task remains in current status.');
            }

            await fetchTasks();
            closeUploadModal();

        } catch (err) {
            console.error('❌ Critical error in handleUploadMedia:', err);
            setUploadMediaError('Failed to complete the task: ' + (err.message || 'Please try again.'));
        } finally {
            setIsUploadingMedia(false);
        }
    };

    // NEW: open view files modal and fetch files
    const openViewFilesModal = async (task) => {
        setViewFilesTask(task);
        setIsLoadingFiles(true);
        setTaskFiles([]);
        try {
            const files = await panelTasksAPI.getFiles(task.id);
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

    // NEW: download file using existing blob endpoint
    const handleDownloadFile = async (fileId, fileName) => {
        try {
            const response = await projectsAPI.downloadFileBlob(fileId);
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

    const filteredTasks = useMemo(() => {
        let filtered = tasks.filter(task => {
            if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
            if (filters.status !== 'all' && task.status !== filters.status) return false;
            if (filters.projectNo !== 'all' && task.projectNo !== filters.projectNo) return false;
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                return (
                    (task.title?.toLowerCase().includes(searchLower)) ||
                    (task.description?.toLowerCase().includes(searchLower)) ||
                    (task.projectNo?.toLowerCase().includes(searchLower))
                );
            }
            return true;
        });

        filtered.sort((a, b) => {
            if (sortConfig.key) {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];
                if (sortConfig.key === 'priority') {
                    const priorityWeight = { high: 1, medium: 2, low: 3, empty: 4 };
                    aValue = priorityWeight[a.priority?.toLowerCase()] || 4;
                    bValue = priorityWeight[b.priority?.toLowerCase()] || 4;
                }
                if (sortConfig.key.includes('Date') || sortConfig.key === 'createdAt') {
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

    const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

    const goToPage = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    // ---- modals open/close ----
    const closeCreateModal = () => {
        setIsTaskModalOpen(false);
        setError(null);
        setNewTask({
            title: '',
            description: '',
            priority: 'medium',
            status: 'pending',
            project_no: '',
            due_date: '',
        });
    };

    const openEditModal = (task) => {
        const { id, title, description, priority, status, projectNo, imageUrl, signatureUrl, signature2Url } = task;
        setEditingTask({
            id,
            title,
            description,
            priority,
            status,
            project_no: projectNo || (uniqueProjectNos.length > 0 ? uniqueProjectNos[0] : ''),
            due_date: task.dueDate ? task.dueDate.substring(0, 10) : '',
            imageUrl: imageUrl || null,
            signatureUrl: signatureUrl || null,
            signature2Url: signature2Url || null,
        });
        setError(null);
        setIsEditModalOpen(true);
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setEditingTask(null);
        setError(null);
    };

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

    const openViewMediaModal = (task) => {
        setViewMediaTask(task);
    };

    const closeViewMediaModal = () => {
        setViewMediaTask(null);
    };

    // ---- handlers ----
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
            const createdTask = await panelTasksAPI.create(newTask);
            setTasks(prev => [createdTask, ...prev]);
            closeCreateModal();

            if (createdTask.status === 'cutting') {
                await createCuttingTaskFromPanelTask(createdTask, 'pending');
            }
        } catch (err) {
            console.error('Failed to create task:', err);
            setError('Failed to create task. Check console for details.');
        }
    };

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

        const currentTask = tasks.find(t => t.id === editingTask.id);
        if (!currentTask) return;

        const wasCutting = currentTask.status === 'cutting';
        const willBeCutting = editingTask.status === 'cutting';

        if (willBeCutting && !hasAllMedia(currentTask)) {
            setError('Cannot mark as completed: Both signatures and an image are required.');
            return;
        }

        try {
            const payload = {
                title: editingTask.title,
                description: editingTask.description,
                priority: editingTask.priority,
                status: editingTask.status,
                project_no: editingTask.project_no,
                due_date: editingTask.due_date,
            };

            const updatedTask = await panelTasksAPI.update(editingTask.id, payload);
            setTasks(prev => prev.map(task =>
                task.id === updatedTask.id ? updatedTask : task
            ));
            closeEditModal();

            if (wasCutting && !willBeCutting && currentTask.imageUrl) {
                try {
                    await deleteAllMedia(editingTask.id);
                    setTasks(prev => prev.map(task =>
                        task.id === editingTask.id
                            ? { ...task, imageUrl: null, signatureUrl: null, signature2Url: null }
                            : task
                    ));
                } catch (err) {
                    setError('Failed to delete media: ' + err.message);
                }
            }

            if (willBeCutting && !wasCutting) {
                await createCuttingTaskFromPanelTask(updatedTask, 'pending');
            }
        } catch (err) {
            console.error('Failed to update task:', err);
            setError('Failed to save changes to the task.');
        }
    };

    const handleUpdateTaskStatus = async (taskId, newStatus) => {
        const currentTask = tasks.find(t => t.id === taskId);
        if (!currentTask) return;

        const wasCutting = currentTask.status === 'cutting';
        const willBeCutting = newStatus === 'cutting';

        if (willBeCutting && !hasAllMedia(currentTask)) {
            setError('Cannot mark as completed: Both signatures and an image are required.');
            await fetchTasks();
            return;
        }

        try {
            if (wasCutting && !willBeCutting && currentTask.imageUrl) {
                await deleteAllMedia(taskId);
                setTasks(prev => prev.map(t =>
                    t.id === taskId
                        ? { ...t, imageUrl: null, signatureUrl: null, signature2Url: null }
                        : t
                ));
            }

            const updatedTask = await panelTasksAPI.update(taskId, { status: newStatus });
            setTasks(prev => prev.map(task =>
                task.id === taskId ? { ...task, ...updatedTask } : task
            ));

            if (willBeCutting && !wasCutting) {
                await createCuttingTaskFromPanelTask(updatedTask, 'pending');
            }
        } catch (err) {
            console.error('Failed to update task status:', err);
            setError('Failed to update task status: ' + (err.message || 'Unknown error'));
            await fetchTasks();
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (!window.confirm('Are you sure you want to delete this task?')) return;
        try {
            await panelTasksAPI.delete(taskId);
            setTasks(prev => prev.filter(task => task.id !== taskId));
        } catch (err) {
            console.error('Failed to delete task:', err);
            setError('Failed to delete task.');
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewTask(prev => ({ ...prev, [name]: value }));
    };

    const handleEditInputChange = (e) => {
        const { name, value } = e.target;
        setEditingTask(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSearchChange = (e) => {
        setFilters(prev => ({
            ...prev,
            search: e.target.value
        }));
    };

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

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
            case 'in-progress': return '#17a2b8';
            case 'pending': return '#ffc107';
            case 'on-hold': return '#6c757d';
            case 'cutting': return '#28a745';
            default: return '#6c757d';
        }
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return '↕️';
        return sortConfig.direction === 'asc' ? '⬆️' : '⬇️';
    };

    const goToViewPanelPage = () => {
        setShowViewPanel(true);
    };

    const goBackToPanelSlab = () => {
        setShowViewPanel(false);
    };

    const goToProductionPage = () => {
        setShowProductionPage(true);
    };

    const goBackToPanelSlabFromProduction = () => {
        setShowProductionPage(false);
    };

    if (showViewPanel) {
        return (
            <ViewPanelPage
                onBack={goBackToPanelSlab}
                onEditingChange={onPanelEditLockChange}
            />
        );
    }

    if (showProductionPage) {
        return <ProductionPage onBack={goBackToPanelSlabFromProduction} />;
    }

    return (
        <div className="panel-slab-container">
            <header className="page-header">
                <div className="header-left">
                    <h1>Panel / Slab Tasks Management</h1>
                </div>
                <div className="header-right">
                    {canViewPanelPage && (
                        <button
                            className="header-btn create-btn"
                            onClick={goToViewPanelPage}
                            title="Go to View/Create Panel page"
                        >
                            👁️ View Panel Page
                        </button>
                    )}
                    <button
                        className="header-btn production-btn"
                        onClick={goToProductionPage}
                        title="Go to Production Overview"
                    >
                        🏭 See Production Page
                    </button>
                </div>
            </header>

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
                        <p className="card-value">{tasks.filter(t => t.status === 'pending').length}</p>
                    </div>
                </div>
                <div className="dashboard-card">
                    <div className="card-icon">🔄</div>
                    <div className="card-content">
                        <h3>In Progress</h3>
                        <p className="card-value">{tasks.filter(t => t.status === 'in-progress').length}</p>
                    </div>
                </div>
                <div className="dashboard-card">
                    <div className="card-icon">⏸️</div>
                    <div className="card-content">
                        <h3>On Hold</h3>
                        <p className="card-value">{tasks.filter(t => t.status === 'on-hold').length}</p>
                    </div>
                </div>
                <div className="dashboard-card">
                    <div className="card-icon">✅</div>
                    <div className="card-content">
                        <h3>Completed</h3>
                        <p className="card-value">{tasks.filter(t => t.status === 'cutting').length}</p>
                    </div>
                </div>
            </div>

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
                        <select
                            name="priority"
                            value={filters.priority}
                            onChange={handleFilterChange}
                            className="form-select"
                        >
                            <option value="all">All Priorities</option>
                            <option value="empty">Empty</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>

                        <select
                            name="status"
                            value={filters.status}
                            onChange={handleFilterChange}
                            className="form-select"
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="on-hold">On Hold</option>
                            <option value="in-progress">In Progress</option>
                            <option value="cutting">✅ Completed</option>
                        </select>

                        <select
                            name="projectNo"
                            value={filters.projectNo}
                            onChange={handleFilterChange}
                            className="form-select"
                        >
                            <option value="all">All Projects</option>
                            {uniqueProjectNos.map(pNo => (
                                <option key={pNo} value={pNo}>{pNo}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="tasks-table-container">
                {error && <div className="alert alert-danger">{error}</div>}
                {cuttingError && <div className="alert alert-warning">{cuttingError}</div>}

                {isLoading ? (
                    <div className="loading-state">
                        <p>Loading tasks... 🔄</p>
                    </div>
                ) : filteredTasks.length === 0 && tasks.length > 0 ? (
                    <div className="empty-state">
                        <h3>No tasks match your current filters.</h3>
                        <p>Try clearing or adjusting your search/filters.</p>
                        <button className="create-first-task-btn" onClick={goToViewPanelPage}>
                            👁️ Go to View Panel Page
                        </button>
                    </div>
                ) : filteredTasks.length === 0 && tasks.length === 0 ? (
                    <div className="empty-state">
                        <h3>No tasks yet</h3>
                    </div>
                ) : (
                    <>
                        <div className="table-wrapper">
                            <table className="tasks-table">
                                <thead>
                                    <tr>
                                        <th onClick={() => handleSort('title')}>
                                            Task Title {getSortIcon('title')}
                                        </th>
                                        <th onClick={() => handleSort('projectNo')}>
                                            Project No {getSortIcon('projectNo')}
                                        </th>
                                        <th onClick={() => handleSort('priority')}>
                                            Priority {getSortIcon('priority')}
                                        </th>
                                        <th onClick={() => handleSort('status')}>
                                            Status {getSortIcon('status')}
                                        </th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedTasks.map(task => {
                                        const showCompleted = task.status === 'cutting' ||
                                            (task.imageUrl && task.signatureUrl && task.signature2Url);
                                        const sig1Uploader = task.signatureUploader?.username || 'N/A';
                                        const sig2Uploader = task.signature2Uploader?.username || 'N/A';
                                        const imageUploader = task.imageUploader?.username || 'N/A';

                                        let uploaderInfo = [];
                                        if (task.imageUrl) uploaderInfo.push(`Image by ${imageUploader}`);
                                        if (task.signatureUrl) uploaderInfo.push(`Sig1 by ${sig1Uploader}`);
                                        if (task.signature2Url) uploaderInfo.push(`Sig2 by ${sig2Uploader}`);
                                        const infoText = uploaderInfo.length > 0 ? uploaderInfo.join(' | ') : '';

                                        return (
                                            <tr key={task.id} className="task-row">
                                                <td className="task-title-cell">
                                                    <div className="task-title-main">{task.title}</div>
                                                    {infoText && (
                                                        <div className="image-indicator">
                                                            <span className="image-badge">📋</span>
                                                            <span className="uploaded-text">{infoText}</span>
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
                                                            onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)}
                                                            className="status-select"
                                                            style={{
                                                                borderColor: getStatusColor(task.status),
                                                                backgroundColor: getStatusColor(task.status) + '20'
                                                            }}
                                                        >
                                                            <option value="pending">⏳ Pending</option>
                                                            <option value="on-hold">⏸️ On Hold</option>
                                                            <option value="in-progress">🔄 In Progress</option>
                                                            {showCompleted && (
                                                                <option value="cutting">✅ Completed</option>
                                                            )}
                                                        </select>
                                                    </div>
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

                        <div className="table-footer">
                            <div className="table-summary">
                                Showing {Math.min(filteredTasks.length, itemsPerPage)} tasks per page
                            </div>
                        </div>
                    </>
                )}
            </div>

            <EditTaskModal
                isOpen={isEditModalOpen}
                onClose={closeEditModal}
                editingTask={editingTask}
                onInputChange={handleEditInputChange}
                onSubmit={handleUpdateTask}
                error={error}
                uniqueProjectNos={uniqueProjectNos}
            />

            <CreateTaskModal
                isOpen={isTaskModalOpen}
                onClose={closeCreateModal}
                newTask={newTask}
                onInputChange={handleInputChange}
                onSubmit={handleCreateTask}
                error={error}
                uniqueProjectNos={uniqueProjectNos}
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

            {/* NEW: View Files Modal */}
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

export default PanelSlab;