import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import imageCompression from 'browser-image-compression';
import './FileView.css';

const API_BASE = '/api';

// =========================================================
// CONFIGURATION
// =========================================================
const MAX_UPLOAD_SIZE_BYTES = 300 * 1024 * 1024; // 300 MB
const INDIVIDUAL_FILE_LIMIT = 50 * 1024 * 1024; // 50 MB per file

// =========================================================
// Thumbnail Helpers
// =========================================================
const createFallbackThumbnail = (mimeType, fileName) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 200;
  canvas.height = 120;

  let bgColor, icon, typeLabel;
  const ext = fileName.toLowerCase().split('.').pop();

  if (ext === 'pdf' || mimeType === 'application/pdf') {
    bgColor = '#e74c3c';
    icon = '📕';
    typeLabel = 'PDF';
  } else if (['doc', 'docx'].includes(ext)) {
    bgColor = '#2c3e50';
    icon = '📝';
    typeLabel = 'DOC';
  } else if (['xls', 'xlsx'].includes(ext)) {
    bgColor = '#27ae60';
    icon = '📊';
    typeLabel = 'XLS';
  } else if (['zip', 'rar', '7z'].includes(ext)) {
    bgColor = '#f39c12';
    icon = '🗜️';
    typeLabel = 'ZIP';
  } else if (ext === 'txt' || mimeType?.includes('text')) {
    bgColor = '#3498db';
    icon = '📄';
    typeLabel = 'TXT';
  } else {
    bgColor = '#95a5a6';
    icon = '📁';
    typeLabel = 'FILE';
  }

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 40px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(icon, canvas.width / 2, 50);
  ctx.font = 'bold 12px Arial';
  ctx.fillText(typeLabel, canvas.width / 2, 80);
  const shortName = fileName.length > 20 ? fileName.substring(0, 17) + '...' : fileName;
  ctx.font = '10px Arial';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillText(shortName, canvas.width / 2, 100);

  return canvas.toDataURL();
};

// =========================================================
// Compression Utilities
// =========================================================
const compressImageFile = async (file, options = {}) => {
  const {
    maxSizeMB = 5,
    maxWidthOrHeight = 1920,
    quality = 0.8,
    useWebWorker = true
  } = options;

  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return file;
  }

  try {
    const compressionOptions = {
      maxSizeMB,
      maxWidthOrHeight,
      useWebWorker,
      initialQuality: quality,
      maxIteration: 10,
      exifOrientation: 1,
      fileType: file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png',
    };
    const compressedFile = await imageCompression(file, compressionOptions);
    return new File([compressedFile], file.name, {
      type: compressedFile.type,
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn('Compression failed, using original file:', error);
    return file;
  }
};

const needsAggressiveCompression = (file) => {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return false;
  return file.size > 10 * 1024 * 1024;
};

// =========================================================
// API Functions
// =========================================================
const apiCall = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    if (response.status === 204) return null;
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

export const real_getProjectFilesByCategory = async (projectNo, category) => {
  return await apiCall(`/projects/files/${projectNo}?category=${category}`);
};

export const real_downloadFile = async (fileId) => {
  const response = await fetch(`${API_BASE}/projects/file/blob/${fileId}`);
  if (!response.ok) throw new Error('Download failed');
  return response.blob();
};

export const real_deleteProjectFile = async (fileId) => {
  return await apiCall(`/projects/file/${fileId}`, { method: 'DELETE' });
};

export const real_uploadProjectFiles = async (formData) => {
  const response = await fetch(`${API_BASE}/projects/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
  return await response.json();
};

export const real_replaceFile = async (fileId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE}/projects/file/${fileId}/replace`, {
    method: 'PUT',
    body: formData,
  });
  if (!response.ok) throw new Error(`Replace failed: ${response.status}`);
  return await response.json();
};

export const real_toggleCategoryHold = async (projectNo, category, status) => {
  return await apiCall(
    `/projects/tasks/category/${category}/status?projectNo=${encodeURIComponent(projectNo)}&status=${status}`,
    { method: 'PATCH' }
  );
};

// ✅ Per‑file task status update (uses 'on-hold' and 'pending')
export const real_updateTaskStatus = async (taskId, category, status) => {
  return await apiCall(
    `/projects/tasks/${taskId}/status?category=${category}`,
    { method: 'PATCH', body: JSON.stringify({ status }) }
  );
};

// =========================================================
// Category Cards Component
// =========================================================
const CategoryCards = ({ projectNo, onCategorySelect }) => {
  const categories = [
    { key: 'panel', label: 'Panel / Slab', icon: '🖼️', description: 'Panel and slab related files' },
    // { key: 'cutting', label: 'Cutting', icon: '✂️', description: 'Cutting plans and documents' }, // Commented out
    { key: 'door', label: 'Door', icon: '🚪', description: 'Door specifications and drawings' },
    { key: 'accessories', label: 'Accessories', icon: '🔧', description: 'Accessories and fittings' },
    { key: 'system', label: 'System', icon: '⚙️', description: 'System integration files' },
    // { key: 'transportation', label: 'Transportation', icon: '🚚', description: 'Transportation logs and documents' }, // Commented out
    { key: 'quotation', label: 'Quotation', icon: '📄', description: 'Quotation documents and pricing details' },
  ];

  return (
    <div className="category-cards-container">
      <header className="page-header">
        <h1>Files for Job: <strong>{projectNo}</strong></h1>
        <p className="page-subtitle">Select a category to view files</p>
      </header>
      <div className="category-cards-grid">
        {categories.map(category => (
          <div 
            key={category.key}
            className="category-card"
            onClick={() => onCategorySelect(category.key, category.label)}
          >
            <div className="category-icon">{category.icon}</div>
            <h3 className="category-title">{category.label}</h3>
            <p className="category-description">{category.description}</p>
            <div className="category-arrow">→</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// =========================================================
// Main FileView Component
// =========================================================
export const FileView = ({ projectNo, navigateHome }) => {
  const [currentView, setCurrentView] = useState('categories');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState('');
  
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedFile, setSelectedFile] = useState(null); 
  const [previewUrl, setPreviewUrl] = useState('');
  const [isFetchingBlob, setIsFetchingBlob] = useState(false);
  
  const [thumbnails, setThumbnails] = useState({});
  const [loadingThumbnails, setLoadingThumbnails] = useState({});
  
  // Upload states
  const [filesToUpload, setFilesToUpload] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [compressionReport, setCompressionReport] = useState(null); 
  const [uploadProgress, setUploadProgress] = useState(0);

  // States for Hold & Replace
  const [, setIsTogglingHold] = useState(false);
  const [isReplacing, setIsReplacing] = useState({});
  const [isTogglingFileHold, setIsTogglingFileHold] = useState({});
  const [holdModalState, setHoldModalState] = useState({ isOpen: false, type: null, file: null });
  const fileInputReplaceRef = useRef(null);

  const fileInputRef = useRef(null);
  const blobUrlRefs = useRef(new Set());

  const revokeAllBlobUrls = useCallback(() => {
    blobUrlRefs.current.forEach(url => URL.revokeObjectURL(url));
    blobUrlRefs.current.clear();
  }, []);

  useEffect(() => {
    return () => revokeAllBlobUrls();
  }, [revokeAllBlobUrls]);

  // ========== Category & File Fetching ==========
  const handleCategorySelect = async (category, label) => {
    setSelectedCategory(category);
    setSelectedCategoryLabel(label);
    setCurrentView('files');
    revokeAllBlobUrls();
    setThumbnails({});
    setLoadingThumbnails({});
    await fetchFilesByCategory(category);
  };

  const handleBackToCategories = () => {
    setCurrentView('categories');
    setSelectedCategory('');
    setSelectedCategoryLabel('');
    setFiles([]);
    setSelectedFile(null);
    revokeAllBlobUrls();
    setThumbnails({});
    setLoadingThumbnails({});
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
  };

  const fetchFilesByCategory = useCallback(async (category) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await real_getProjectFilesByCategory(projectNo, category);
      const filesArray = Array.isArray(data) ? data : [];
      setFiles(filesArray);
      await loadThumbnails(filesArray);
    } catch (err) {
      console.error("Failed to fetch files:", err);
      setError(`Failed to load ${category} files for project ${projectNo}.`);
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectNo]);

  const loadThumbnails = async (filesArray) => {
    const batchSize = 3;
    for (let i = 0; i < filesArray.length; i += batchSize) {
      const batch = filesArray.slice(i, i + batchSize);
      await Promise.all(batch.map(async (file) => {
        try {
          setLoadingThumbnails(prev => ({ ...prev, [file.id]: true }));
          const blob = await real_downloadFile(file.id);
          if (file.mime_type && file.mime_type.startsWith('image/')) {
            const blobUrl = URL.createObjectURL(blob);
            blobUrlRefs.current.add(blobUrl);
            setThumbnails(prev => ({ ...prev, [file.id]: blobUrl }));
          } else {
            const fallback = createFallbackThumbnail(file.mime_type, file.file_name);
            setThumbnails(prev => ({ ...prev, [file.id]: fallback }));
          }
        } catch (err) {
          console.warn(`Thumbnail failed for ${file.file_name}:`, err);
          const fallback = createFallbackThumbnail(file.mime_type, file.file_name);
          setThumbnails(prev => ({ ...prev, [file.id]: fallback }));
        } finally {
          setLoadingThumbnails(prev => ({ ...prev, [file.id]: false }));
        }
      }));
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  // ========== Preview & Delete ==========
  const isPreviewable = (mimeType) => mimeType && (mimeType.startsWith('image/') || mimeType === 'application/pdf');

  const handleFileSelectForPreview = async (file) => {
    if (selectedFile?.id === file.id && previewUrl) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl('');
    setError(null);
    if (!isPreviewable(file.mime_type)) return;
    setIsFetchingBlob(true);
    try {
      const blob = await real_downloadFile(file.id);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err) {
      console.error("Failed to fetch file blob:", err);
      setError(`Failed to open ${file.file_name}: ${err.message}`);
      setSelectedFile(null);
    } finally {
      setIsFetchingBlob(false);
    }
  };

  const handleDeleteFile = async (file, e) => {
    if (e) e.stopPropagation(); 
    if (!window.confirm(`Are you sure you want to permanently delete: ${file.file_name}?`)) return;
    try {
      await real_deleteProjectFile(file.id);
      const thumb = thumbnails[file.id];
      if (thumb && typeof thumb === 'string' && thumb.startsWith('blob:')) {
        URL.revokeObjectURL(thumb);
        blobUrlRefs.current.delete(thumb);
      }
      setFiles(prev => prev.filter(f => f.id !== file.id));
      setThumbnails(prev => {
        const newThumb = { ...prev };
        delete newThumb[file.id];
        return newThumb;
      });
      setLoadingThumbnails(prev => {
        const newLoading = { ...prev };
        delete newLoading[file.id];
        return newLoading;
      });
      if (selectedFile?.id === file.id) {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setSelectedFile(null);
        setPreviewUrl('');
      }
    } catch (err) {
      console.error("Failed to delete file:", err);
      setError(`Failed to delete ${file.file_name}.`);
    }
  };

  const openFileHoldModal = (file) => {
    if (!file.taskNo) {
      alert('This file does not have an associated task.');
      return;
    }
    setHoldModalState({ isOpen: true, type: 'file', file });
  };

  const closeHoldModal = () => setHoldModalState({ isOpen: false, type: null, file: null });

  const handleHoldStatusChoice = async (status) => {
    const { type, file } = holdModalState;
    closeHoldModal();

    if (type === 'category') {
      setIsTogglingHold(true);
      try {
        await real_toggleCategoryHold(projectNo, selectedCategory, status);
        setError(null);
        alert(`All ${selectedCategoryLabel} tasks set to ${status}.`);
      } catch (err) {
        console.error('Failed to toggle hold:', err);
        setError(`Failed to update tasks status: ${err.message}`);
      } finally {
        setIsTogglingHold(false);
      }
    } else if (type === 'file' && file) {
      setIsTogglingFileHold(prev => ({ ...prev, [file.id]: true }));
      try {
        await real_updateTaskStatus(file.taskNo, file.category, status);
        setError(null);
        alert(`Task for "${file.file_name}" set to ${status}.`);
      } catch (err) {
        console.error('Failed to toggle file hold:', err);
        setError(`Failed to update task status: ${err.message}`);
      } finally {
        setIsTogglingFileHold(prev => ({ ...prev, [file.id]: false }));
      }
    }
  };

  // ========== REPLACE FILE ==========
  const handleReplaceClick = (fileId) => {
    if (fileInputReplaceRef.current) {
      fileInputReplaceRef.current.dataset.targetFileId = fileId;
      fileInputReplaceRef.current.click();
    }
  };

  const handleReplaceFileChange = async (e) => {
    const input = e.target;
    const fileId = input.dataset.targetFileId;
    if (!fileId) return;
    const file = input.files[0];
    if (!file) return;

    if (file.size > INDIVIDUAL_FILE_LIMIT) {
      setError(`File exceeds 50MB limit: ${file.name}`);
      input.value = '';
      return;
    }

    if (!window.confirm(`Replace this file with "${file.name}"?`)) {
      input.value = '';
      return;
    }

    setIsReplacing(prev => ({ ...prev, [fileId]: true }));
    setError(null);
    try {
      let finalFile = file;
      if (file.type.startsWith('image/') && file.type !== 'image/gif') {
        finalFile = await compressImageFile(file, { maxSizeMB: 5, maxWidthOrHeight: 1920, quality: 0.8 });
      }
      const updatedFile = await real_replaceFile(fileId, finalFile);
      setFiles(prev => prev.map(f => String(f.id) === String(fileId) ? { ...f, ...updatedFile } : f));
      if (updatedFile.mime_type && updatedFile.mime_type.startsWith('image/')) {
        const blob = await real_downloadFile(updatedFile.id);
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRefs.current.add(blobUrl);
        setThumbnails(prev => ({ ...prev, [fileId]: blobUrl }));
      } else {
        const fallback = createFallbackThumbnail(updatedFile.mime_type, updatedFile.file_name);
        setThumbnails(prev => ({ ...prev, [fileId]: fallback }));
      }
      if (String(selectedFile?.id) === String(fileId)) {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl('');
        if (isPreviewable(updatedFile.mime_type)) {
          const blob = await real_downloadFile(updatedFile.id);
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
        }
        setSelectedFile(updatedFile);
      }
      alert('File replaced successfully!');
    } catch (err) {
      console.error('Replace failed:', err);
      setError(`Failed to replace file: ${err.message}`);
    } finally {
      setIsReplacing(prev => ({ ...prev, [fileId]: false }));
      input.value = '';
    }
  };

  // ========== Upload Modal Logic ==========
  const handleOpenModal = () => {
    setIsModalOpen(true);
    setFilesToUpload([]);
    setCompressionReport(null);
    setError(null);
    setUploadProgress(0);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFilesToUpload([]);
    setCompressionReport(null);
    setIsUploading(false);
    setUploadProgress(0);
  };
  
  const handleFilesChange = (e) => {
    const selected = e.target.files;
    if (selected) {
      const newFiles = Array.from(selected);
      const oversizedFiles = newFiles.filter(file => file.size > INDIVIDUAL_FILE_LIMIT);
      if (oversizedFiles.length > 0) {
        setError(`Some files exceed 50MB limit: ${oversizedFiles.map(f => f.name).join(', ')}`);
      }
      const validFiles = newFiles.filter(file => file.size <= INDIVIDUAL_FILE_LIMIT);
      setFilesToUpload(prev => [...prev, ...validFiles]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    const oversizedFiles = droppedFiles.filter(file => file.size > INDIVIDUAL_FILE_LIMIT);
    if (oversizedFiles.length > 0) {
      setError(`Some files exceed 50MB limit: ${oversizedFiles.map(f => f.name).join(', ')}`);
    }
    const validFiles = droppedFiles.filter(file => file.size <= INDIVIDUAL_FILE_LIMIT);
    setFilesToUpload(prev => [...prev, ...validFiles]);
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragActive(true); };
  const handleDragLeave = () => setIsDragActive(false);

  const handleUpload = async () => {
    if (filesToUpload.length === 0) return;
    setIsUploading(true);
    setError(null);
    setCompressionReport(null);
    setUploadProgress(0);

    let totalOriginalSize = 0;
    let totalCompressedSize = 0;
    let compressedCount = 0;
    let skippedCount = 0;
    const filesToActuallyUpload = [];
    const compressionResults = [];

    try {
      const formData = new FormData();
      formData.append('projectNo', projectNo);
      formData.append('category', selectedCategory);
      
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        setUploadProgress(Math.round(((i + 1) / filesToUpload.length) * 50));
        totalOriginalSize += file.size;
        let finalFile = file;
        let compressionApplied = false;
        let compressionDetails = {
          name: file.name,
          originalSize: file.size,
          compressedSize: file.size,
          ratio: 1,
          skipped: false,
          reason: '',
          compressionLevel: 'none'
        };

        if (file.type.startsWith('image/') && file.type !== 'image/gif') {
          try {
            let compressionOptions = {
              maxSizeMB: 5,
              maxWidthOrHeight: 1920,
              quality: 0.8,
              useWebWorker: true
            };
            if (needsAggressiveCompression(file)) {
              compressionOptions = {
                maxSizeMB: 2,
                maxWidthOrHeight: 1024,
                quality: 0.6,
                useWebWorker: true
              };
              compressionDetails.compressionLevel = 'aggressive';
            } else {
              compressionDetails.compressionLevel = 'standard';
            }
            finalFile = await compressImageFile(file, compressionOptions);
            if (finalFile.size < file.size) {
              compressionApplied = true;
              compressionDetails.compressedSize = finalFile.size;
              compressionDetails.ratio = (finalFile.size / file.size).toFixed(2);
            }
          } catch (compressionError) {
            console.warn(`Compression failed for ${file.name}:`, compressionError);
            compressionDetails.reason = 'Compression failed';
          }
        } else {
          compressionDetails.reason = 'Not an image or GIF file';
        }

        if (totalCompressedSize + finalFile.size > MAX_UPLOAD_SIZE_BYTES) {
          compressionDetails.skipped = true;
          compressionDetails.reason = `Size limit exceeded`;
          skippedCount++;
          compressionResults.push(compressionDetails);
          setError(`Upload limit exceeded! Skipping remaining files.`);
          break;
        }

        filesToActuallyUpload.push(finalFile);
        totalCompressedSize += finalFile.size;
        if (compressionApplied) compressedCount++;
        compressionResults.push(compressionDetails);
        setUploadProgress(Math.round(((i + 1) / filesToUpload.length) * 100));
      }

      if (filesToActuallyUpload.length === 0) {
        setError('No files to upload after processing.');
        setIsUploading(false);
        return;
      }

      filesToActuallyUpload.forEach(file => {
        formData.append('files', file);
      });

      const report = {
        totalFiles: filesToUpload.length,
        uploadedFiles: filesToActuallyUpload.length,
        compressedCount,
        skippedCount,
        originalSize: totalOriginalSize,
        compressedSize: totalCompressedSize,
        results: compressionResults,
        sizeReduction: totalOriginalSize - totalCompressedSize,
        isCompressed: compressedCount > 0,
        uploadStarted: false
      };
      setCompressionReport(report);
      setUploadProgress(100);
      await real_uploadProjectFiles(formData);
      await fetchFilesByCategory(selectedCategory);

      // ✅ notify + auto-close
      alert(
        `✅ Upload complete! ${filesToActuallyUpload.length} file${filesToActuallyUpload.length !== 1 ? 's' : ''} uploaded` +
        (compressedCount > 0 ? `, ${compressedCount} compressed` : '') +
        (skippedCount > 0 ? `, ${skippedCount} skipped` : '') + '.'
      );
      handleCloseModal();
    } catch (err) {
      console.error("Upload failed:", err);
      setError(`Upload failed: ${err.message || 'Server error'}`);
      setCompressionReport(prev => prev ? { ...prev, uploadStarted: true, uploadSuccessful: false, uploadError: err.message } : null);
    } finally {
      setIsUploading(false);
    }
  };

  const removeFileFromStaging = (index) => setFilesToUpload(prev => prev.filter((_, i) => i !== index));

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const getFileIcon = (mimeType) => {
    if (!mimeType) return '📄';
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📕';
    if (mimeType.includes('word')) return '📝';
    if (mimeType.includes('excel')) return '📊';
    if (mimeType.includes('zip')) return '🗜️';
    return '📄';
  };

  // ========== Upload Modal Component ==========
  const UploadModal = () => {
    const modalBodyRef = useRef(null);
    const savedScrollTop = useRef(0);

    useLayoutEffect(() => {
      if (modalBodyRef.current) {
        savedScrollTop.current = modalBodyRef.current.scrollTop;
      }
    });

    useEffect(() => {
      if (modalBodyRef.current && savedScrollTop.current > 0) {
        const rafId = requestAnimationFrame(() => {
          if (modalBodyRef.current) {
            modalBodyRef.current.scrollTop = savedScrollTop.current;
          }
        });
        return () => cancelAnimationFrame(rafId);
      }
    });

    if (!isModalOpen) return null;

    const uploadSuccessful = compressionReport?.uploadStarted && compressionReport?.uploadSuccessful;

    return (
      <div className="modal-overlay" onClick={handleCloseModal}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>📁 Upload Files to {selectedCategoryLabel}</h2>
            <button className="close-button" onClick={handleCloseModal}>&times;</button>
          </div>
          <div className="modal-body" ref={modalBodyRef}>
            {isUploading && (
              <div className="upload-progress">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                </div>
                <div className="progress-text">
                  {uploadProgress < 100 ? 'Processing files...' : 'Uploading...'}
                  <span>{uploadProgress}%</span>
                </div>
              </div>
            )}

            {compressionReport && compressionReport.uploadStarted && (
              <div className={`alert ${compressionReport.uploadSuccessful ? 'alert-success' : 'alert-danger'} upload-result-alert`}>
                <h4>{compressionReport.uploadSuccessful ? '✅ Upload Complete!' : '❌ Upload Failed'}</h4>
                <p>
                  Processed <strong>{compressionReport.totalFiles}</strong> file(s).
                  {compressionReport.compressedCount > 0 && <> <strong>{compressionReport.compressedCount}</strong> image(s) compressed.</>}
                  {compressionReport.skippedCount > 0 && <> <strong>{compressionReport.skippedCount}</strong> file(s) skipped.</>}
                </p>
              </div>
            )}

            <div className="upload-info">
              <p><strong>Uploading to:</strong> {selectedCategoryLabel}</p>
              <p><strong>Total limit:</strong> 300 MB (images auto-compressed)</p>
              <p><strong>Individual limit:</strong> 50 MB per file</p>
              <p className="upload-tip"><em>⚠️ Images are automatically compressed to save space.</em></p>
            </div>

            <input type="file" multiple ref={fileInputRef} onChange={handleFilesChange} style={{ display: 'none' }} />
            <div
              className={`drag-drop-area ${isDragActive ? 'drag-active' : ''}`}
              onClick={() => !uploadSuccessful && fileInputRef.current && fileInputRef.current.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={uploadSuccessful ? undefined : handleDrop}
              style={{ cursor: uploadSuccessful ? 'default' : 'pointer', opacity: uploadSuccessful ? 0.6 : 1 }}
            >
              <div className="drag-drop-icon">📁</div>
              <p className="drag-drop-text">
                {uploadSuccessful ? 'Upload complete – you can now close the modal' : (isDragActive ? 'Release files here!' : 'Click to Select or Drag & Drop Files')}
              </p>
              <small className="drag-drop-hint">Supports images, PDFs, documents (max 50MB each)</small>
            </div>

            {filesToUpload.length > 0 && (
              <div className="file-list-preview">
                <div className="staged-files-header">
                  <h4>Files to Upload ({filesToUpload.length})</h4>
                  <button className="clear-all-btn" onClick={() => setFilesToUpload([])} disabled={isUploading || uploadSuccessful}>Clear All</button>
                </div>
                <div className="staged-file-list-container">
                  <ul className="staged-file-list">
                    {filesToUpload.map((file, index) => (
                      <li key={index} className="staged-file-item">
                        <div className="file-info">
                          <span className="file-icon">{getFileIcon(file.type)}</span>
                          <div className="file-details">
                            <span className="file-name">{file.name}</span>
                            <span className="file-size">{formatSize(file.size)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => !uploadSuccessful && removeFileFromStaging(index)}
                          className="remove-file-btn"
                          disabled={isUploading || uploadSuccessful}
                        >&times;</button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="upload-actions">
                  <button
                    className={`upload-btn primary ${isUploading ? 'uploading' : ''}`}
                    onClick={handleUpload}
                    disabled={isUploading || filesToUpload.length === 0 || uploadSuccessful}
                  >
                    {isUploading ? (
                      <><span className="spinner"></span> Processing & Uploading...</>
                    ) : (
                      `Upload ${filesToUpload.length} File${filesToUpload.length !== 1 ? 's' : ''}`
                    )}
                  </button>
                  <button className="cancel-btn secondary" onClick={handleCloseModal} disabled={isUploading}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {uploadSuccessful && (
              <div className="upload-complete-actions" style={{ marginTop: '1rem' }}>
                <button className="close-modal-btn primary" onClick={handleCloseModal}>Close</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ========== Hold Choice Modal Component ==========
  const HoldChoiceModal = () => {
    if (!holdModalState.isOpen) return null;
    const targetLabel = holdModalState.type === 'category'
      ? `all tasks in "${selectedCategoryLabel}"`
      : `the task for "${holdModalState.file?.file_name}"`;

    return (
      <div className="modal-overlay" onClick={closeHoldModal}>
        <div className="modal-content hold-choice-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>⏸️ Update Task Status</h2>
            <button className="close-button" onClick={closeHoldModal}>&times;</button>
          </div>
          <div className="modal-body">
            <p>Set {targetLabel} to:</p>
            <div className="hold-choice-actions" style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button className="upload-btn primary" style={{ flex: 1 }} onClick={() => handleHoldStatusChoice('on-hold')}>
                ⏸️ On Hold
              </button>
              <button className="upload-btn primary" style={{ flex: 1 }} onClick={() => handleHoldStatusChoice('pending')}>
                ▶️ Pending
              </button>
            </div>
            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button className="cancel-btn secondary" onClick={closeHoldModal}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================
  // RENDER
  // =========================================================
  if (currentView === 'categories') {
    return <div className="file-view-container"><CategoryCards projectNo={projectNo} onCategorySelect={handleCategorySelect} /></div>;
  }

  if (isLoading) {
    return (
      <div className="file-view-container">
        <header className="page-header">
          <div className="header-controls">
            <div className="header-left">
              <button onClick={handleBackToCategories} className="secondary back-button">← Back to Categories</button>
              <h1>{selectedCategoryLabel} Files</h1>
            </div>
          </div>
        </header>
        <div className="loading-container"><div className="spinner-large"></div><h2>Loading {selectedCategoryLabel} Files...</h2></div>
      </div>
    );
  }

  return (
    <div className="file-view-container">
      <header className="page-header">
        <div className="header-controls">
          <div className="header-left">
            <button onClick={handleBackToCategories} className="secondary back-button">← Back to Categories</button>
            <h1>{selectedCategoryLabel} Files</h1>
          </div>
          <div className="header-right">
            <button className="primary add-files-btn" onClick={handleOpenModal} title="Add new files">
              + Add Files
            </button>
          </div>
        </div>
      </header>
      
      {error && !selectedFile && <div className="alert alert-danger">{error}</div>}
      
      <div className="files-grid-container">
        <div className="files-grid-header">
          <h2>All Files in {selectedCategoryLabel}</h2>
          <div className="files-count">{files.length} files</div>
        </div>
        
        {!Array.isArray(files) ? (
          <div className="no-files-message">
            <div className="no-files-icon">❌</div>
            <h3>Failed to load files</h3>
            <p>There was an error loading the files. Please try again.</p>
            <button className="secondary" onClick={() => fetchFilesByCategory(selectedCategory)}>↻ Retry</button>
          </div>
        ) : files.length === 0 ? (
          <div className="no-files-message">
            <div className="no-files-icon">📁</div>
            <h3>No files yet</h3>
            <p>Upload your first file to get started with {selectedCategoryLabel}.</p>
            <button className="primary" onClick={handleOpenModal}>+ Upload First File</button>
          </div>
        ) : (
          <div className="files-grid">
            {files.map(file => (
              <div 
                key={file.id} 
                className={`file-grid-card ${selectedFile?.id === file.id ? 'selected' : ''}`}
                onClick={() => handleFileSelectForPreview(file)}
              >
                <div className="file-grid-thumbnail">
                  {loadingThumbnails[file.id] ? (
                    <div className="thumbnail-loading"><div className="thumbnail-spinner"></div></div>
                  ) : thumbnails[file.id] ? (
                    file.mime_type?.startsWith('image/') ? (
                      <img src={thumbnails[file.id]} alt={file.file_name} className="thumbnail-image" />
                    ) : (
                      <div className="thumbnail-fallback">
                        <span className="file-type-icon">{getFileIcon(file.mime_type)}</span>
                      </div>
                    )
                  ) : (
                    <div className="thumbnail-fallback">
                      <span className="file-type-icon">{getFileIcon(file.mime_type)}</span>
                    </div>
                  )}
                </div>
                <div className="file-grid-info">
                  <h4 className="file-grid-name" title={file.file_name}>{file.file_name}</h4>
                  <div className="file-grid-actions">
                    <span className="file-grid-size">{formatSize(file.file_size || 0)}</span>
                    <button
                      className="file-grid-hold-btn"
                      onClick={(e) => { e.stopPropagation(); openFileHoldModal(file); }}
                      title={file.taskNo ? "Toggle this file's task On Hold/Pending" : "No task associated"}
                      disabled={isTogglingFileHold[file.id] || !file.taskNo}
                    >
                      {isTogglingFileHold[file.id] ? '⏳' : '⏸️'}
                    </button>
                    <button
                      className="file-grid-replace-btn"
                      onClick={(e) => { e.stopPropagation(); handleReplaceClick(file.id); }}
                      title={`Replace ${file.file_name}`}
                      disabled={isReplacing[file.id]}
                    >
                      {isReplacing[file.id] ? '⏳' : '🔄'}
                    </button>
                    <button className="file-grid-delete-btn" onClick={(e) => handleDeleteFile(file, e)} title={`Delete ${file.file_name}`}>🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <input
        type="file"
        ref={fileInputReplaceRef}
        style={{ display: 'none' }}
        onChange={handleReplaceFileChange}
        accept="*/*"
      />

      {selectedFile && (
        <div className="preview-modal-overlay" onClick={() => setSelectedFile(null)}>
          <div className="preview-modal-content" onClick={e => e.stopPropagation()}>
            <div className="preview-modal-header">
              <h3><span className="file-type-icon">{getFileIcon(selectedFile.mime_type)}</span>{selectedFile.file_name}</h3>
              <div className="preview-modal-actions">
                <a className="modal-download-btn" href={`${API_BASE}/projects/file/blob/${selectedFile.id}`} download={selectedFile.file_name} target="_blank" rel="noopener noreferrer">📥 View</a>
                <button
                  className="modal-hold-btn"
                  onClick={(e) => { e.stopPropagation(); openFileHoldModal(selectedFile); }}
                  disabled={isTogglingFileHold[selectedFile.id] || !selectedFile.taskNo}
                >
                  {isTogglingFileHold[selectedFile.id] ? '⏳' : '⏸️ Hold'}
                </button>
                <button
                  className="modal-replace-btn"
                  onClick={(e) => { e.stopPropagation(); handleReplaceClick(selectedFile.id); }}
                  disabled={isReplacing[selectedFile.id]}
                >
                  {isReplacing[selectedFile.id] ? '⏳ Replacing...' : '🔄 Replace'}
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteFile(selectedFile); }} className="modal-delete-btn">🗑️ Delete</button>
                <button className="modal-close-btn" onClick={() => setSelectedFile(null)}>✕</button>
              </div>
            </div>
            <div className="preview-modal-body">
              {isFetchingBlob ? (
                <div className="preview-loading"><div className="spinner-large"></div><h3>Loading {selectedFile.file_name}...</h3></div>
              ) : previewUrl ? (
                selectedFile.mime_type?.startsWith('image/') ? (
                  <img src={previewUrl} alt={selectedFile.file_name} className="preview-full-content preview-full-image" />
                ) : selectedFile.mime_type === 'application/pdf' ? (
                  <iframe src={previewUrl} title={selectedFile.file_name} className="preview-full-content preview-full-iframe" />
                ) : (
                  <div className="preview-full-placeholder">
                    <h4>Cannot Display Preview</h4>
                    <p>The file <strong>{selectedFile.file_name}</strong> cannot be previewed directly.</p>
                    <a className="modal-download-btn" href={`${API_BASE}/projects/file/blob/${selectedFile.id}`} download={selectedFile.file_name} target="_blank" rel="noopener noreferrer">📥 Download File</a>
                  </div>
                )
              ) : (
                <div className="preview-full-placeholder">
                  <h4>Preview Unavailable</h4>
                  <p>Unable to load preview for <strong>{selectedFile.file_name}</strong>.</p>
                  <a className="modal-download-btn" href={`${API_BASE}/projects/file/blob/${selectedFile.id}`} download={selectedFile.file_name} target="_blank" rel="noopener noreferrer">📥 Download File</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <UploadModal />
      <HoldChoiceModal />
    </div>
  );
};

export default FileView;