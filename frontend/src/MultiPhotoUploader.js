import React, { useState, useRef } from 'react';
import './MultiPhotoUploader.css'; 

const MultiPhotoUploader = ({ jobNo, onUploadSuccess }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false); // New state for drag-over visual feedback
  const fileInputRef = useRef(null);

  // --- Handlers ---

  // Handle file selection from the explicit button click
  const handleFileChange = (event) => {
    const newFiles = event.target.files;
    addFilesToSelection(newFiles);
    event.target.value = null; // Clear input to allow re-selecting same files
  };

  // 1. New: Helper function to add files to the state
  const addFilesToSelection = (files) => {
    if (files.length > 0) {
      // Filter out non-image files if needed, or let accept="image/*" handle it mostly
      const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
      setSelectedFiles(prevFiles => {
        // Optional: Prevent duplicate files by name/size if desired
        const uniqueNewFiles = imageFiles.filter(newFile => 
          !prevFiles.some(existingFile => 
            existingFile.name === newFile.name && existingFile.size === newFile.size
          )
        );
        return [...prevFiles, ...uniqueNewFiles];
      });
    }
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) {
      alert('Please select at least one photo to upload.');
      return;
    }

    setIsUploading(true);

    // --- Simulated Upload ---
    setTimeout(() => {
      console.log(`Simulated upload complete for Job ${jobNo}. Files:`, selectedFiles.map(f => f.name));
      if (onUploadSuccess) {
        onUploadSuccess(); 
      }
      setIsUploading(false);
    }, 2000); 
  };

  // --- Drag and Drop Handlers ---
  const handleDragOver = (event) => {
    event.preventDefault(); // Essential to allow drop
    setIsDragOver(true);
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    setIsDragOver(true); // Set state for visual feedback
  };

  const handleDragLeave = () => {
    setIsDragOver(false); // Reset state when drag leaves the area
  };

  const handleDrop = (event) => {
    event.preventDefault(); // Essential to prevent browser default handling (e.g., opening file)
    setIsDragOver(false); // Reset state

    const droppedFiles = event.dataTransfer.files; // Get files from the drop event
    addFilesToSelection(droppedFiles); // Add dropped files to our state
  };

  const renderPreviews = () => {
    return selectedFiles.map((file, index) => (
      <div key={index} className="preview-card">
        <img
          src={URL.createObjectURL(file)}
          alt={`Preview ${file.name}`}
          className="preview-image"
        />
        <p className="file-name">{file.name}</p>
        <button
          onClick={() => handleRemoveFile(index)}
          className="remove-button"
        >
          Remove
        </button>
      </div>
    ));
  };

  return (
    <div className="uploader-container">
      <h2>🖼️ Upload Multiple Photos</h2>
      {jobNo && <p className="upload-for-job">for Job: **{jobNo}**</p>}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        multiple 
        accept="image/*" 
        onChange={handleFileChange}
        style={{ display: 'none' }} 
        disabled={isUploading}
      />

      {/* Drag and Drop Area */}
      <div 
        className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <p>Drag & Drop your photos here, or</p>
        <button
          onClick={() => fileInputRef.current.click()} 
          className="select-button"
          disabled={isUploading}
        >
          ➕ Select Photos
        </button>
      </div>

      <hr />

      {/* Previews Area */}
      {selectedFiles.length > 0 && (
        <div className="previews-area">
          <h3>Selected Files ({selectedFiles.length})</h3>
          <div className="preview-grid">{renderPreviews()}</div>
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        className={`upload-button ${isUploading ? 'uploading' : ''}`}
        disabled={selectedFiles.length === 0 || isUploading}
      >
        {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length} Photos`}
      </button>
    </div>
  );
};

export default MultiPhotoUploader;