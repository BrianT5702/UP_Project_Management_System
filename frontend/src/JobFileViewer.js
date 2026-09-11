import React, { useState, useEffect } from 'react';
import './JobFileViewer.css'; // Assume you'll add styling for this page

// Simulated file data structure
const simulatedFiles = {
  '4715': [
    { id: 101, name: 'Logsco_Drawing_1.jpg', type: 'image/jpeg', date: '2025-11-18', url: '#' },
    { id: 102, name: 'Logsco_Install_Photo_A.jpg', type: 'image/jpeg', date: '2025-11-19', url: '#' },
    { id: 103, name: 'Logsco_PO_Scan.pdf', type: 'application/pdf', date: '2025-11-18', url: '#' },
  ],
  '17408': [
    { id: 201, name: 'Coolcare_Panel_Cut.png', type: 'image/png', date: '2025-11-19', url: '#' },
  ],
  '17412': [], // No files for this job yet
};

const JobFileViewer = ({ jobNo, customer, onBackToTracker }) => {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching files from a server/database based on jobNo
    setIsLoading(true);
    setTimeout(() => {
      const jobFiles = simulatedFiles[jobNo] || [];
      setFiles(jobFiles);
      setIsLoading(false);
    }, 500); // Simulate network delay
  }, [jobNo]);

  const handleDeleteFile = (fileId) => {
    if (window.confirm(`Are you sure you want to delete file ID ${fileId}?`)) {
      // In a real app: Send DELETE request to API here
      setFiles(prevFiles => prevFiles.filter(f => f.id !== fileId));
      alert(`File ${fileId} deleted successfully.`);
    }
  };

  if (isLoading) {
    return (
      <div className="file-viewer-container">
        <p>Loading files for Job {jobNo}...</p>
      </div>
    );
  }

  return (
    <div className="file-viewer-container">
      <header className="file-viewer-header">
        <h2>📂 Files for Job {jobNo} ({customer})</h2>
        <button onClick={onBackToTracker} className="back-btn">
          ← Back to Tracker
        </button>
      </header>
      
      <div className="file-list">
        {files.length === 0 ? (
          <p className="no-files-message">No files have been uploaded for this job yet.</p>
        ) : (
          <div className="file-grid">
            {files.map(file => (
              <div key={file.id} className="file-card">
                <div className="file-icon-wrapper">
                  {/* Simple icon based on file type */}
                  {file.type.startsWith('image/') ? (
                    <span role="img" aria-label="image" className="file-icon">📸</span>
                  ) : (
                    <span role="img" aria-label="document" className="file-icon">📄</span>
                  )}
                </div>
                <p className="file-card-name" title={file.name}>{file.name}</p>
                <p className="file-card-date">Uploaded: {file.date}</p>
                <div className="file-card-actions">
                  <a href={file.url} target="_blank" rel="noopener noreferrer" className="view-btn">View</a>
                  <button onClick={() => handleDeleteFile(file.id)} className="delete-btn">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobFileViewer;