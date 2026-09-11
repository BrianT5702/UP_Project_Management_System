// import React, { useState, useCallback, useMemo, useEffect } from 'react';
// import * as XLSX from 'xlsx';
// import { useDropzone } from 'react-dropzone';
// import './ExcelExtractor.css';
// import {
//   Upload, FileSpreadsheet, Table, Download, 
//   Filter, Search, Edit, Trash2, Save, 
//   X, Check, Eye, EyeOff, BarChart3,
//   ChevronDown, ChevronRight, Maximize2, Minimize2,
//   Database
// } from 'lucide-react';
// import { excelDataAPI } from './apiService';

// const ExcelExtractor = () => {
//   const [excelData, setExcelData] = useState(null);
//   const [workbook, setWorkbook] = useState(null);
//   const [selectedSheet, setSelectedSheet] = useState('');
//   const [tableData, setTableData] = useState([]);
//   const [columns, setColumns] = useState([]);
//   const [searchTerm, setSearchTerm] = useState('');
//   const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
//   const [visibleColumns, setVisibleColumns] = useState([]);
//   const [editingCell, setEditingCell] = useState(null);
//   const [editValue, setEditValue] = useState('');
//   const [filters, setFilters] = useState({});
//   const [isFullscreen, setIsFullscreen] = useState(false);
//   const [viewMode, setViewMode] = useState('table'); // 'table' or 'chart'
//   const [tableName, setTableName] = useState('');
//   const [storedTables, setStoredTables] = useState([]);
//   const [isSaving, setIsSaving] = useState(false);

//   // Process uploaded Excel file
//   const onDrop = useCallback((acceptedFiles) => {
//     const file = acceptedFiles[0];
//     if (!file) return;

//     const reader = new FileReader();
//     reader.onload = (e) => {
//       const data = new Uint8Array(e.target.result);
//       const workbook = XLSX.read(data, { type: 'array' });
      
//       setWorkbook(workbook);
      
//       // Get first sheet by default
//       const firstSheetName = workbook.SheetNames[0];
//       const worksheet = workbook.Sheets[firstSheetName];
//       const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
//       processExcelData(jsonData);
//       setSelectedSheet(firstSheetName);
      
//       // Set all columns as visible initially
//       if (jsonData.length > 0) {
//         const headers = jsonData[0];
//         setVisibleColumns(headers);
//       }
//     };
    
//     reader.readAsArrayBuffer(file);
//   }, []);

//   const { getRootProps, getInputProps, isDragActive } = useDropzone({
//     onDrop,
//     accept: {
//       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
//       'application/vnd.ms-excel': ['.xls'],
//       'text/csv': ['.csv']
//     },
//     multiple: false
//   });

//   const processExcelData = (data) => {
//     if (data.length === 0) {
//       setExcelData([]);
//       setTableData([]);
//       setColumns([]);
//       return;
//     }

//     // Clean column names for database compatibility
//     const headers = data[0].map((header, index) => {
//       if (!header || header.toString().trim() === '') {
//         return `column_${index + 1}`;
//       }
//       // Clean the header for SQL compatibility
//       return header.toString()
//         .trim()
//         .replace(/[^\w\s]/gi, '_')
//         .replace(/\s+/g, '_')
//         .replace(/__+/g, '_')
//         .replace(/^_+|_+$/g, '');
//     });

//     const rows = data.slice(1).map((row, index) => {
//       const rowData = {};
//       headers.forEach((header, colIndex) => {
//         rowData[header] = row[colIndex] || '';
//         rowData.id = `${index}-${Date.now()}`;
//       });
//       return rowData;
//     });

//     setExcelData(data);
//     setColumns(headers);
//     setTableData(rows);
//   };

//   // Handle sheet selection
//   const handleSheetChange = (sheetName) => {
//     setSelectedSheet(sheetName);
//     const worksheet = workbook.Sheets[sheetName];
//     const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
//     processExcelData(jsonData);
//   };

//   // Sort table
//   const requestSort = (key) => {
//     let direction = 'asc';
//     if (sortConfig.key === key && sortConfig.direction === 'asc') {
//       direction = 'desc';
//     }
//     setSortConfig({ key, direction });
//   };

//   // Filter and sort data
//   const processedData = useMemo(() => {
//     let filteredData = [...tableData];
    
//     // Apply search
//     if (searchTerm) {
//       filteredData = filteredData.filter(row =>
//         Object.values(row).some(value =>
//           String(value).toLowerCase().includes(searchTerm.toLowerCase())
//         )
//       );
//     }
    
//     // Apply column filters
//     Object.entries(filters).forEach(([column, filterValue]) => {
//       if (filterValue) {
//         filteredData = filteredData.filter(row =>
//           String(row[column]).toLowerCase().includes(filterValue.toLowerCase())
//         );
//       }
//     });
    
//     // Apply sorting
//     if (sortConfig.key) {
//       filteredData.sort((a, b) => {
//         if (a[sortConfig.key] < b[sortConfig.key]) {
//           return sortConfig.direction === 'asc' ? -1 : 1;
//         }
//         if (a[sortConfig.key] > b[sortConfig.key]) {
//           return sortConfig.direction === 'asc' ? 1 : -1;
//         }
//         return 0;
//       });
//     }
    
//     return filteredData;
//   }, [tableData, searchTerm, filters, sortConfig]);

//   // Export data
//   const exportToExcel = () => {
//     if (!tableData.length) return;
    
//     const ws = XLSX.utils.json_to_sheet(processedData);
//     const wb = XLSX.utils.book_new();
//     XLSX.utils.book_append_sheet(wb, ws, 'Extracted Data');
//     XLSX.writeFile(wb, 'extracted_table.xlsx');
//   };

//   const exportToCSV = () => {
//     if (!tableData.length) return;
    
//     const csv = XLSX.utils.sheet_to_csv(
//       XLSX.utils.json_to_sheet(processedData)
//     );
//     const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
//     const link = document.createElement('a');
//     link.href = URL.createObjectURL(blob);
//     link.download = 'extracted_table.csv';
//     link.click();
//   };

//   // Cell editing
//   const startEditing = (rowIndex, column, value) => {
//     setEditingCell({ rowIndex, column });
//     setEditValue(value);
//   };

//   const saveEdit = () => {
//     if (!editingCell) return;
    
//     const newData = [...tableData];
//     newData[editingCell.rowIndex][editingCell.column] = editValue;
    
//     setTableData(newData);
//     setEditingCell(null);
//     setEditValue('');
//   };

//   const cancelEdit = () => {
//     setEditingCell(null);
//     setEditValue('');
//   };

//   // Column visibility
//   const toggleColumnVisibility = (column) => {
//     setVisibleColumns(prev =>
//       prev.includes(column)
//         ? prev.filter(col => col !== column)
//         : [...prev, column]
//     );
//   };

//   // Add filter
//   const addFilter = (column, value) => {
//     setFilters(prev => ({ ...prev, [column]: value }));
//   };

//   const removeFilter = (column) => {
//     const newFilters = { ...filters };
//     delete newFilters[column];
//     setFilters(newFilters);
//   };

//   // Clear all data
//   const clearData = () => {
//     setExcelData(null);
//     setWorkbook(null);
//     setTableData([]);
//     setColumns([]);
//     setSelectedSheet('');
//     setSearchTerm('');
//     setFilters({});
//     setTableName('');
//   };

//   // Calculate statistics
//   const calculateStats = useMemo(() => {
//     if (!tableData.length || !columns.length) return null;
    
//     const stats = {};
//     columns.forEach(col => {
//       const values = tableData.map(row => row[col]).filter(val => val !== '');
//       const numericValues = values.filter(val => !isNaN(parseFloat(val)));
      
//       if (numericValues.length > 0) {
//         stats[col] = {
//           min: Math.min(...numericValues),
//           max: Math.max(...numericValues),
//           avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
//           count: numericValues.length
//         };
//       }
//     });
    
//     return stats;
//   }, [tableData, columns]);

//   // Database functions
//   const handleSaveToDatabase = async () => {
//     if (!tableData.length) {
//       alert('No data to save');
//       return;
//     }

//     if (!tableName.trim()) {
//       alert('Please enter a table name');
//       return;
//     }

//     setIsSaving(true);
//     try {
//       const saveData = {
//         tableName: `excel_table_${tableName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
//         data: processedData,
//         columns: visibleColumns
//       };

//       const response = await excelDataAPI.storeExcelData(saveData);
//       alert(`Data saved successfully!\nTable: ${saveData.tableName}\nRows: ${response.rowCount}`);
      
//       // Refresh stored tables list
//       await fetchStoredTables();
//       setTableName(''); // Clear the input after saving
//     } catch (error) {
//       console.error('Error saving data:', error);
//       alert('Failed to save data to database');
//     } finally {
//       setIsSaving(false);
//     }
//   };

//   // Function to fetch stored tables
//   const fetchStoredTables = async () => {
//     try {
//       const tables = await excelDataAPI.getExcelTables();
//       setStoredTables(tables);
//     } catch (error) {
//       console.error('Error fetching stored tables:', error);
//     }
//   };

//   // Call fetchStoredTables on component mount
//   useEffect(() => {
//     fetchStoredTables();
//   }, []);

//   return (
//     <div className={`excel-extractor ${isFullscreen ? 'fullscreen' : ''}`}>
//       {/* Header */}
//       <header className="app-header">
//         <div className="header-left">
//           <FileSpreadsheet className="header-icon" />
//           <h1>Excel Table Extractor</h1>
//           <span className="file-info">
//             {workbook && `${workbook.SheetNames.length} sheet(s) loaded`}
//           </span>
//         </div>
        
//         <div className="header-actions">
//           {tableData.length > 0 && (
//             <>
//               <button 
//                 onClick={exportToExcel}
//                 className="btn btn-primary"
//               >
//                 <Download size={16} />
//                 Export Excel
//               </button>
//               <button 
//                 onClick={exportToCSV}
//                 className="btn btn-secondary"
//               >
//                 <Download size={16} />
//                 Export CSV
//               </button>
//               <button
//                 onClick={() => setIsFullscreen(!isFullscreen)}
//                 className="btn btn-icon"
//                 title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
//               >
//                 {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
//               </button>
//             </>
//           )}
//         </div>
//       </header>

//       <div className="content-container">
//         {/* Left Panel - Upload & Controls */}
//         <div className="left-panel">
//           {/* Upload Zone */}
//           {!excelData && (
//             <div className="upload-section">
//               <div
//                 {...getRootProps()}
//                 className={`dropzone ${isDragActive ? 'active' : ''}`}
//               >
//                 <input {...getInputProps()} />
//                 <Upload className="upload-icon" size={48} />
//                 <h3>Drop Excel file here</h3>
//                 <p>or click to browse</p>
//                 <span className="supported-formats">
//                   Supports .xlsx, .xls, .csv
//                 </span>
//               </div>
//             </div>
//           )}

//           {/* Sheet Selection */}
//           {workbook && workbook.SheetNames.length > 0 && (
//             <div className="sheet-selector">
//               <h3>
//                 <Table size={18} />
//                 Select Worksheet
//               </h3>
//               <div className="sheet-list">
//                 {workbook.SheetNames.map((sheet) => (
//                   <button
//                     key={sheet}
//                     className={`sheet-btn ${selectedSheet === sheet ? 'active' : ''}`}
//                     onClick={() => handleSheetChange(sheet)}
//                   >
//                     {sheet}
//                     {selectedSheet === sheet && <Check size={16} />}
//                   </button>
//                 ))}
//               </div>
//             </div>
//           )}

//           {/* Column Visibility */}
//           {columns.length > 0 && (
//             <div className="column-controls">
//               <h3>
//                 <Eye size={18} />
//                 Column Visibility
//               </h3>
//               <div className="column-list">
//                 {columns.map((column) => (
//                   <label key={column} className="column-checkbox">
//                     <input
//                       type="checkbox"
//                       checked={visibleColumns.includes(column)}
//                       onChange={() => toggleColumnVisibility(column)}
//                     />
//                     <span className="checkbox-custom"></span>
//                     {column}
//                   </label>
//                 ))}
//               </div>
//             </div>
//           )}

//           {/* Database Save Section */}
//           {columns.length > 0 && (
//             <div className="database-actions">
//               <h3>
//                 <Save size={18} />
//                 Save to Database
//               </h3>
              
//               <div className="save-form">
//                 <div className="form-group">
//                   <label>Table Name:</label>
//                   <input
//                     type="text"
//                     value={tableName}
//                     onChange={(e) => setTableName(e.target.value)}
//                     placeholder="Enter table name"
//                     className="table-name-input"
//                   />
//                 </div>
                
//                 <div className="stats-preview">
//                   <div className="stat-item">
//                     <span className="stat-label">Rows:</span>
//                     <span className="stat-value">{processedData.length}</span>
//                   </div>
//                   <div className="stat-item">
//                     <span className="stat-label">Columns:</span>
//                     <span className="stat-value">{visibleColumns.length}</span>
//                   </div>
//                   <div className="stat-item">
//                     <span className="stat-label">Total Cells:</span>
//                     <span className="stat-value">{processedData.length * visibleColumns.length}</span>
//                   </div>
//                 </div>
                
//                 <button
//                   onClick={handleSaveToDatabase}
//                   disabled={isSaving || !tableData.length}
//                   className={`btn btn-save ${isSaving ? 'saving' : ''}`}
//                 >
//                   {isSaving ? (
//                     <>
//                       <div className="spinner"></div>
//                       Saving...
//                     </>
//                   ) : (
//                     <>
//                       <Save size={16} />
//                       Save to Database
//                     </>
//                   )}
//                 </button>
//               </div>

//               {/* Stored Tables List */}
//               {storedTables.length > 0 && (
//                 <div className="stored-tables">
//                   <h4>
//                     <Database size={16} />
//                     Stored Tables
//                   </h4>
//                   <div className="tables-list">
//                     {storedTables.map((table, index) => (
//                       <div key={index} className="table-item">
//                         <FileSpreadsheet size={14} />
//                         <span className="table-name">{table.table_name}</span>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               )}
//             </div>
//           )}
//         </div>

//         {/* Main Content - Table */}
//         <div className="main-content">
//           {/* Toolbar */}
//           {tableData.length > 0 && (
//             <div className="table-toolbar">
//               <div className="toolbar-left">
//                 <div className="search-box">
//                   <Search size={18} />
//                   <input
//                     type="text"
//                     placeholder="Search across all columns..."
//                     value={searchTerm}
//                     onChange={(e) => setSearchTerm(e.target.value)}
//                   />
//                 </div>
//               </div>
//               <div className="toolbar-right">
//                 <div className="record-count">
//                   Showing {processedData.length} of {tableData.length} records
//                 </div>
//                 <button
//                   onClick={clearData}
//                   className="btn btn-danger"
//                 >
//                   <Trash2 size={16} />
//                   Clear All
//                 </button>
//               </div>
//             </div>
//           )}

//           {/* Active Filters */}
//           {Object.keys(filters).length > 0 && (
//             <div className="active-filters">
//               <h4>Active Filters:</h4>
//               {Object.entries(filters).map(([column, value]) => (
//                 <div key={column} className="filter-tag">
//                   {column}: {value}
//                   <button onClick={() => removeFilter(column)}>
//                     <X size={12} />
//                   </button>
//                 </div>
//               ))}
//             </div>
//           )}

//           {/* Table Display */}
//           {tableData.length > 0 && viewMode === 'table' && (
//             <div className="table-container">
//               <table className="data-table">
//                 <thead>
//                   <tr>
//                     {columns
//                       .filter(col => visibleColumns.includes(col))
//                       .map((column) => (
//                         <th key={column}>
//                           <div className="th-content">
//                             <span>{column}</span>
//                             <div className="th-actions">
//                               <button
//                                 onClick={() => requestSort(column)}
//                                 className={`sort-btn ${sortConfig.key === column ? 'active' : ''}`}
//                               >
//                                 {sortConfig.key === column && sortConfig.direction === 'asc' 
//                                   ? <ChevronDown size={14} />
//                                   : <ChevronRight size={14} />
//                                 }
//                               </button>
//                               <div className="filter-input">
//                                 <input
//                                   type="text"
//                                   placeholder="Filter..."
//                                   value={filters[column] || ''}
//                                   onChange={(e) => addFilter(column, e.target.value)}
//                                 />
//                               </div>
//                             </div>
//                           </div>
//                         </th>
//                       ))}
//                     <th className="actions-header">Actions</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {processedData.map((row, rowIndex) => (
//                     <tr key={row.id || rowIndex}>
//                       {columns
//                         .filter(col => visibleColumns.includes(col))
//                         .map((column) => (
//                           <td key={column} className="data-cell">
//                             {editingCell?.rowIndex === rowIndex && 
//                              editingCell?.column === column ? (
//                               <div className="edit-cell">
//                                 <input
//                                   type="text"
//                                   value={editValue}
//                                   onChange={(e) => setEditValue(e.target.value)}
//                                   autoFocus
//                                 />
//                                 <button onClick={saveEdit} className="btn-save">
//                                   <Check size={14} />
//                                 </button>
//                                 <button onClick={cancelEdit} className="btn-cancel">
//                                   <X size={14} />
//                                 </button>
//                               </div>
//                             ) : (
//                               <div 
//                                 className="cell-content"
//                                 onClick={() => startEditing(rowIndex, column, row[column])}
//                               >
//                                 {row[column] || <span className="empty-cell">-</span>}
//                               </div>
//                             )}
//                           </td>
//                         ))}
//                       <td className="actions-cell">
//                         <button
//                           onClick={() => {
//                             const newData = tableData.filter((_, i) => i !== rowIndex);
//                             setTableData(newData);
//                           }}
//                           className="btn-icon delete-btn"
//                           title="Delete row"
//                         >
//                           <Trash2 size={14} />
//                         </button>
//                         <button
//                           onClick={() => startEditing(rowIndex, columns[0], row[columns[0]])}
//                           className="btn-icon edit-btn"
//                           title="Edit row"
//                         >
//                           <Edit size={14} />
//                         </button>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           )}

//           {/* Empty State */}
//           {!tableData.length && excelData && (
//             <div className="empty-state">
//               <Table size={64} />
//               <h3>No data found in selected sheet</h3>
//               <p>The selected worksheet appears to be empty</p>
//             </div>
//           )}

//           {/* Instructions */}
//           {!excelData && (
//             <div className="instructions">
//               <div className="instruction-card">
//                 <h3>How to use:</h3>
//                 <ol>
//                   <li>Upload an Excel file (.xlsx, .xls) or CSV</li>
//                   <li>Select the worksheet you want to extract</li>
//                   <li>View and interact with the table data</li>
//                   <li>Filter, sort, and edit as needed</li>
//                   <li>Export the processed data</li>
//                   <li>Save to database for later use</li>
//                 </ol>
//               </div>
              
//               <div className="feature-grid">
//                 <div className="feature">
//                   <Filter size={24} />
//                   <h4>Smart Filtering</h4>
//                   <p>Filter data by any column</p>
//                 </div>
//                 <div className="feature">
//                   <Edit size={24} />
//                   <h4>Inline Editing</h4>
//                   <p>Edit cells directly in the table</p>
//                 </div>
//                 <div className="feature">
//                   <Download size={24} />
//                   <h4>Export Options</h4>
//                   <p>Export to Excel or CSV</p>
//                 </div>
//                 <div className="feature">
//                   <Eye size={24} />
//                   <h4>Column Control</h4>
//                   <p>Show/hide columns as needed</p>
//                 </div>
//                 <div className="feature">
//                   <Database size={24} />
//                   <h4>Database Storage</h4>
//                   <p>Save data to PostgreSQL</p>
//                 </div>
//                 <div className="feature">
//                   <BarChart3 size={24} />
//                   <h4>Data Statistics</h4>
//                   <p>View min, max, and average values</p>
//                 </div>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default ExcelExtractor;