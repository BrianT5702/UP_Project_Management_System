import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import './ReportGenerator.css';

// Color utilities for scroll-based color picking
const colorPresets = [
  '#FF0000', '#FF4500', '#FF8C00', '#FFD700', '#FFFF00', '#ADFF2F', '#00FF00',
  '#00FA9A', '#00CED1', '#1E90FF', '#0000FF', '#8A2BE2', '#FF1493', '#FF69B4',
  '#FFC0CB', '#FFFFFF', '#F5F5F5', '#D3D3D3', '#A9A9A9', '#696969', '#000000'
];

const colorGroups = {
  reds: ['#FF0000', '#FF4500', '#FF6347', '#DC143C', '#B22222', '#8B0000'],
  greens: ['#00FF00', '#32CD32', '#00FA9A', '#00CED1', '#2E8B57', '#006400'],
  blues: ['#0000FF', '#1E90FF', '#4169E1', '#6495ED', '#4682B4', '#00008B'],
  yellows: ['#FFFF00', '#FFD700', '#FFA500', '#FF8C00', '#FF6347', '#FF4500'],
  purples: ['#8A2BE2', '#9370DB', '#9932CC', '#BA55D3', '#DA70D6', '#EE82EE'],
  grays: ['#FFFFFF', '#F5F5F5', '#D3D3D3', '#A9A9A9', '#696969', '#000000']
};

// Function to create blank grid data
const createBlankGridData = (rows = 50, cols = 26) => {
  return Array(rows).fill(null).map(() => 
    Array(cols).fill(null).map(() => ({ 
      value: '', 
      formula: '',
      type: 'text',
      style: {},
      mergeInfo: null
    }))
  );
};

// Function to create sample grid data (only for the first sheet)
const createSampleGridData = (rows = 50, cols = 26) => {
  const sampleData = createBlankGridData(rows, cols);
  
  // Add sample data starting from row 0, col 0
  sampleData[0][0] = { 
    value: 'Sales Report', 
    type: 'text', 
    formula: '', 
    style: { 
      fontWeight: 'bold', 
      fontSize: 14, 
      textAlign: 'center'
    },
    mergeInfo: null
  };
  sampleData[1][0] = { 
    value: 'Product', 
    type: 'text', 
    formula: '', 
    style: { 
      fontWeight: 'bold',
      textAlign: 'left'
    },
    mergeInfo: null
  };
  sampleData[1][1] = { 
    value: 'Quantity', 
    type: 'text', 
    formula: '', 
    style: { 
      fontWeight: 'bold',
      textAlign: 'center'
    },
    mergeInfo: null
  };
  sampleData[1][2] = { 
    value: 'Price', 
    type: 'text', 
    formula: '', 
    style: { 
      fontWeight: 'bold',
      textAlign: 'center'
    },
    mergeInfo: null
  };
  sampleData[1][3] = { 
    value: 'Total', 
    type: 'text', 
    formula: '', 
    style: { 
      fontWeight: 'bold',
      textAlign: 'right'
    },
    mergeInfo: null
  };
  
  // Product data
  const products = [
    { name: 'Product A', quantity: 40, price: 681 },
    { name: 'Product B', quantity: 69, price: 603 },
    { name: 'Product C', quantity: 26, price: 664 },
    { name: 'Product D', quantity: 37, price: 1025 }
  ];
  
  for (let i = 0; i < products.length; i++) {
    const row = i + 2;
    const product = products[i];
    const total = product.quantity * product.price;
    
    sampleData[row][0] = { 
      value: product.name, 
      type: 'text', 
      formula: '',
      style: { textAlign: 'left' },
      mergeInfo: null
    };
    sampleData[row][1] = { 
      value: product.quantity.toString(), 
      type: 'number', 
      formula: '',
      style: { textAlign: 'right' },
      mergeInfo: null
    };
    sampleData[row][2] = { 
      value: product.price.toString(), 
      type: 'number', 
      formula: '',
      style: { textAlign: 'right' },
      mergeInfo: null
    };
    sampleData[row][3] = { 
      value: total.toLocaleString(), 
      type: 'formula', 
      formula: `=B${row+1}*C${row+1}`,
      style: { 
        backgroundColor: '#f0f9ff', 
        textAlign: 'right'
      },
      mergeInfo: null
    };
  }
  
  // Summary row
  const summaryRow = products.length + 2;
  sampleData[summaryRow][2] = { 
    value: 'Total:', 
    type: 'text', 
    formula: '', 
    style: { 
      fontWeight: 'bold',
      textAlign: 'right'
    },
    mergeInfo: null
  };
  sampleData[summaryRow][3] = { 
    value: (40*681 + 69*603 + 26*664 + 37*1025).toLocaleString(), 
    type: 'formula', 
    formula: `=SUM(D3:D${summaryRow})`,
    style: { 
      fontWeight: 'bold', 
      backgroundColor: '#d1fae5',
      textAlign: 'right'
    },
    mergeInfo: null
  };
  
  return sampleData;
};

const ReportGenerator = () => {
    // Configuration
    const [config, setConfig] = useState({ 
        rows: 50, 
        cols: 26, // A-Z
        title: "Untitled Spreadsheet",
        author: "",
        lastSaved: new Date().toLocaleString()
    });
    
    // Sheet management - each sheet has its own data and history
    const [sheets, setSheets] = useState([
        { 
            id: 1, 
            name: 'Sheet1', 
            active: true,
            gridData: createSampleGridData(),
            history: [],
            historyIndex: -1,
            lastSaved: new Date().toLocaleString()
        }
    ]);
    
    const [activeSheetId, setActiveSheetId] = useState(1);
    
    // Current sheet data (derived from active sheet)
    const activeSheet = useMemo(() => 
        sheets.find(sheet => sheet.id === activeSheetId) || sheets[0]
    , [sheets, activeSheetId]);
    
    // Derived states from active sheet
    const gridData = activeSheet?.gridData || createBlankGridData();
    const history = activeSheet?.history || [];
    const historyIndex = activeSheet?.historyIndex || -1;
    
    // Cell selection and UI state
    const [selection, setSelection] = useState({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
    const [activeCell, setActiveCell] = useState({ row: 0, col: 0 });
    const [formulaBarValue, setFormulaBarValue] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isSelecting, setIsSelecting] = useState(false);
    const [cellStyle, setCellStyle] = useState({
        fontSize: 12,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'left',
        backgroundColor: '#ffffff',
        color: '#000000',
        border: '1px solid #d0d7de',
        borderTop: '1px solid #d0d7de',
        borderRight: '1px solid #d0d7de',
        borderBottom: '1px solid #d0d7de',
        borderLeft: '1px solid #d0d7de'
    });
    
    // Border style dialog state
    const [showBorderDialog, setShowBorderDialog] = useState(false);
    const [borderStyle, setBorderStyle] = useState('solid');
    const [borderWidth, setBorderWidth] = useState('1px');
    const [borderColor, setBorderColor] = useState('#000000');
    const [selectedBorders, setSelectedBorders] = useState({
        top: true,
        right: true,
        bottom: true,
        left: true
    });
    
    // Color scroll state
    const [showColorPicker, setShowColorPicker] = useState(null); // 'text' or 'fill' or null
    const [scrollColorIndex, setScrollColorIndex] = useState(0);
    const [scrollColorMode, setScrollColorMode] = useState('presets');
    
    // Reference to formula input
    const formulaInputRef = useRef(null);
    const cellEditInputRef = useRef(null);
    const tableRef = useRef(null);
    const colorPickerRef = useRef(null);
    
    // Track cursor position for editing
    const [cursorPosition, setCursorPosition] = useState(0);

    // Calculate selection stats
    const selectionStats = useMemo(() => {
        const { startRow, startCol, endRow, endCol } = selection;
        const minRow = Math.min(startRow, endRow);
        const maxRow = Math.max(startRow, endRow);
        const minCol = Math.min(startCol, endCol);
        const maxCol = Math.max(startCol, endCol);
        
        return {
            rows: maxRow - minRow + 1,
            cols: maxCol - minCol + 1,
            cellCount: (maxRow - minRow + 1) * (maxCol - minCol + 1),
            start: { row: minRow, col: minCol },
            end: { row: maxRow, col: maxCol }
        };
    }, [selection]);

    // Get current color array based on mode
    const getCurrentColorArray = useMemo(() => {
        switch(scrollColorMode) {
            case 'reds': return colorGroups.reds;
            case 'greens': return colorGroups.greens;
            case 'blues': return colorGroups.blues;
            case 'yellows': return colorGroups.yellows;
            case 'purples': return colorGroups.purples;
            case 'grays': return colorGroups.grays;
            default: return colorPresets;
        }
    }, [scrollColorMode]);

    // Update sheet data
    const updateSheetData = useCallback((sheetId, updates) => {
        setSheets(prevSheets => 
            prevSheets.map(sheet => 
                sheet.id === sheetId ? { ...sheet, ...updates } : sheet
            )
        );
    }, []);

    // Save state to history for current sheet
    const saveToHistory = useCallback((data) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(JSON.stringify(data));
        updateSheetData(activeSheetId, {
            gridData: data,
            history: newHistory,
            historyIndex: newHistory.length - 1,
            lastSaved: new Date().toLocaleString()
        });
    }, [history, historyIndex, activeSheetId, updateSheetData]);

    // Undo function for current sheet
    const handleUndo = useCallback(() => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            const previousState = JSON.parse(history[newIndex]);
            updateSheetData(activeSheetId, {
                gridData: previousState,
                historyIndex: newIndex
            });
        }
    }, [historyIndex, history, activeSheetId, updateSheetData]);

    // Redo function for current sheet
    const handleRedo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            const nextState = JSON.parse(history[newIndex]);
            updateSheetData(activeSheetId, {
                gridData: nextState,
                historyIndex: newIndex
            });
        }
    }, [historyIndex, history, activeSheetId, updateSheetData]);

    // Handle mouse down for selection
    const handleCellMouseDown = (row, col, e) => {
        e.stopPropagation();
        
        // Don't start selection if editing
        if (isEditing) {
            handleCellEditFinish(activeCell.row, activeCell.col);
            return;
        }
        
        setIsSelecting(true);
        
        // Check if this cell is part of a merged cell
        const cell = gridData[row][col];
        let targetRow = row;
        let targetCol = col;
        
        if (cell.mergeInfo && cell.mergeInfo.isMerged) {
            targetRow = cell.mergeInfo.mainCell.row;
            targetCol = cell.mergeInfo.mainCell.col;
        }
        
        setSelection({ 
            startRow: targetRow, 
            startCol: targetCol, 
            endRow: targetRow, 
            endCol: targetCol 
        });
        setActiveCell({ row: targetRow, col: targetCol });
        
        const targetCell = gridData[targetRow][targetCol];
        setFormulaBarValue(targetCell.formula || targetCell.value || '');
        
        // Update cell style state
        updateCellStyleState(targetRow, targetCol);
    };

    // Handle mouse move for selection
    const handleCellMouseMove = (row, col, e) => {
        if (!isSelecting) return;
        e.stopPropagation();
        
        // Check if this cell is part of a merged cell
        const cell = gridData[row][col];
        let targetRow = row;
        let targetCol = col;
        
        if (cell.mergeInfo && cell.mergeInfo.isMerged) {
            targetRow = cell.mergeInfo.mainCell.row;
            targetCol = cell.mergeInfo.mainCell.col;
        }
        
        setSelection(prev => ({
            ...prev,
            endRow: targetRow,
            endCol: targetCol
        }));
    };

    // Handle mouse up to end selection
    const handleMouseUp = useCallback((e) => {
        if (isSelecting) {
            setIsSelecting(false);
        }
        
        // Close color picker if clicking outside
        if (showColorPicker && colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
            setShowColorPicker(null);
        }
    }, [isSelecting, showColorPicker]);

    // Handle cell click (for single click without dragging)
    const handleCellClick = (row, col, e) => {
        e.stopPropagation();
        
        // Don't process if we were dragging
        if (isSelecting) return;
        
        // If we were editing, save the changes
        if (isEditing) {
            handleCellEditFinish(activeCell.row, activeCell.col);
        }
        
        // Check if this cell is part of a merged cell
        const cell = gridData[row][col];
        let targetRow = row;
        let targetCol = col;
        
        if (cell.mergeInfo && cell.mergeInfo.isMerged) {
            targetRow = cell.mergeInfo.mainCell.row;
            targetCol = cell.mergeInfo.mainCell.col;
        }
        
        setSelection({ 
            startRow: targetRow, 
            startCol: targetCol, 
            endRow: targetRow, 
            endCol: targetCol 
        });
        setActiveCell({ row: targetRow, col: targetCol });
        
        const targetCell = gridData[targetRow][targetCol];
        setFormulaBarValue(targetCell.formula || targetCell.value || '');
        
        // Update cell style state
        updateCellStyleState(targetRow, targetCol);
    };

    // Update cell style state from cell data
    const updateCellStyleState = useCallback((row, col) => {
        const cell = gridData[row][col];
        setCellStyle({
            fontSize: cell.style?.fontSize || 12,
            fontWeight: cell.style?.fontWeight || 'normal',
            fontStyle: cell.style?.fontStyle || 'normal',
            textAlign: cell.style?.textAlign || 'left',
            backgroundColor: cell.style?.backgroundColor || '#ffffff',
            color: cell.style?.color || '#000000',
            border: cell.style?.border || '1px solid #d0d7de',
            borderTop: cell.style?.borderTop || cell.style?.border || '1px solid #d0d7de',
            borderRight: cell.style?.borderRight || cell.style?.border || '1px solid #d0d7de',
            borderBottom: cell.style?.borderBottom || cell.style?.border || '1px solid #d0d7de',
            borderLeft: cell.style?.borderLeft || cell.style?.border || '1px solid #d0d7de'
        });
    }, [gridData]);

    // Handle cell editing via double click
    const handleCellDoubleClick = (row, col, e) => {
        // Check if this cell is part of a merged cell
        const cell = gridData[row][col];
        let targetRow = row;
        let targetCol = col;
        
        if (cell.mergeInfo && cell.mergeInfo.isMerged) {
            targetRow = cell.mergeInfo.mainCell.row;
            targetCol = cell.mergeInfo.mainCell.col;
        }
        
        setActiveCell({ row: targetRow, col: targetCol });
        const targetCell = gridData[targetRow][targetCol];
        const cellValue = targetCell.formula || targetCell.value || '';
        setFormulaBarValue(cellValue);
        setIsEditing(true);
        
        // Focus the formula input immediately
        setTimeout(() => {
            if (formulaInputRef.current) {
                formulaInputRef.current.focus();
                formulaInputRef.current.select();
            }
        }, 10);
    };

    // Handle cell editing via F2 or direct typing
    const handleCellDirectEdit = useCallback(() => {
        const { row, col } = activeCell;
        const cell = gridData[row][col];
        const cellValue = cell.formula || cell.value || '';
        setFormulaBarValue(cellValue);
        setIsEditing(true);
        
        setTimeout(() => {
            if (formulaInputRef.current) {
                formulaInputRef.current.focus();
                formulaInputRef.current.select();
            }
        }, 10);
    }, [activeCell, gridData]);

    // Handle finishing cell edit
    const handleCellEditFinish = (row, col, newValue = null) => {
        if (isEditing || newValue !== null) {
            const valueToSave = newValue !== null ? newValue : formulaBarValue.trim();
            
            const newGridData = [...gridData];
            const isFormula = valueToSave.startsWith('=');
            
            let finalValue = valueToSave;
            let calculatedValue = valueToSave;
            
            if (isFormula) {
                calculatedValue = evaluateFormula(valueToSave, row, col);
                finalValue = calculatedValue !== '#ERROR' ? calculatedValue : '';
            }
            
            newGridData[row][col] = {
                ...newGridData[row][col],
                value: finalValue,
                formula: isFormula ? valueToSave : '',
                type: isFormula ? 'formula' : (typeof finalValue === 'number' || !isNaN(finalValue)) ? 'number' : 'text'
            };
            
            // Update the sheet data
            saveToHistory(newGridData);
            setIsEditing(false);
            
            // Update formula bar
            const cell = newGridData[row][col];
            setFormulaBarValue(cell.formula || cell.value || '');
        }
    };

    // Handle cell input change (for direct typing)
    const handleCellInputChange = (e) => {
        const value = e.target.value;
        setFormulaBarValue(value);
        setCursorPosition(e.target.selectionStart);
    };

    // Handle cell input key events
    const handleCellInputKeyDown = (e, row, col) => {
        const { key, ctrlKey, metaKey } = e;
        
        // Handle cursor movement
        if (key === 'ArrowLeft') {
            const newPos = Math.max(0, cursorPosition - 1);
            setCursorPosition(newPos);
            setTimeout(() => {
                if (cellEditInputRef.current) {
                    cellEditInputRef.current.setSelectionRange(newPos, newPos);
                }
            }, 0);
        } else if (key === 'ArrowRight') {
            const newPos = Math.min(formulaBarValue.length, cursorPosition + 1);
            setCursorPosition(newPos);
            setTimeout(() => {
                if (cellEditInputRef.current) {
                    cellEditInputRef.current.setSelectionRange(newPos, newPos);
                }
            }, 0);
        } else if (key === 'Home') {
            setCursorPosition(0);
            setTimeout(() => {
                if (cellEditInputRef.current) {
                    cellEditInputRef.current.setSelectionRange(0, 0);
                }
            }, 0);
        } else if (key === 'End') {
            const endPos = formulaBarValue.length;
            setCursorPosition(endPos);
            setTimeout(() => {
                if (cellEditInputRef.current) {
                    cellEditInputRef.current.setSelectionRange(endPos, endPos);
                }
            }, 0);
        } else if (key === 'Enter') {
            e.preventDefault();
            handleCellEditFinish(row, col);
            
            // Move to next cell below
            const nextRow = Math.min(row + 1, config.rows - 1);
            setActiveCell({ row: nextRow, col });
            setSelection({ 
                startRow: nextRow, 
                startCol: col, 
                endRow: nextRow, 
                endCol: col 
            });
            setFormulaBarValue('');
        } else if (key === 'Tab') {
            e.preventDefault();
            handleCellEditFinish(row, col);
            
            // Move to next cell to the right
            const nextCol = Math.min(col + 1, config.cols - 1);
            setActiveCell({ row, col: nextCol });
            setSelection({ 
                startRow: row, 
                startCol: nextCol, 
                endRow: row, 
                endCol: nextCol 
            });
            setFormulaBarValue('');
        } else if (key === 'Escape') {
            setIsEditing(false);
            const cell = gridData[row][col];
            setFormulaBarValue(cell.formula || cell.value || '');
        } else if ((ctrlKey || metaKey) && key === 'a') {
            // Allow Ctrl+A to select all
            e.preventDefault();
            if (cellEditInputRef.current) {
                cellEditInputRef.current.select();
                setCursorPosition(0);
            }
        }
    };

    // Handle cell input mouse events for cursor positioning
    const handleCellInputMouseUp = (e) => {
        if (cellEditInputRef.current) {
            setCursorPosition(cellEditInputRef.current.selectionStart);
        }
    };

    // Handle formula bar changes - SMOOTH VERSION
    const handleFormulaBarChange = (e) => {
        const value = e.target.value;
        setFormulaBarValue(value);
    };

    // Handle formula bar submission (Enter key)
    const handleFormulaBarKeyDown = (e) => {
        const { key, ctrlKey, shiftKey ,metaKey } = e;
        
        if (key === 'Enter') {
            e.preventDefault();
            const { row, col } = activeCell;
            
            handleCellEditFinish(row, col);
            
            // Move to next cell (down for Enter, up for Shift+Enter)
            if (shiftKey) {
                // Move up
                const nextRow = Math.max(row - 1, 0);
                setActiveCell({ row: nextRow, col });
                setSelection({ 
                    startRow: nextRow, 
                    startCol: col, 
                    endRow: nextRow, 
                    endCol: col 
                });
            } else {
                // Move down (default)
                const nextRow = Math.min(row + 1, config.rows - 1);
                setActiveCell({ row: nextRow, col });
                setSelection({ 
                    startRow: nextRow, 
                    startCol: col, 
                    endRow: nextRow, 
                    endCol: col 
                });
            }
            
            // Keep the formula bar focused
            setTimeout(() => {
                if (formulaInputRef.current) {
                    formulaInputRef.current.focus();
                    // Auto-select the formula when moving to next cell
                    formulaInputRef.current.select();
                }
            }, 10);
        } else if (key === 'Tab') {
            e.preventDefault();
            const { row, col } = activeCell;
            
            handleCellEditFinish(row, col);
            
            // Move to next cell (right for Tab, left for Shift+Tab)
            if (shiftKey) {
                // Move left
                const nextCol = Math.max(col - 1, 0);
                setActiveCell({ row, col: nextCol });
                setSelection({ 
                    startRow: row, 
                    startCol: nextCol, 
                    endRow: row, 
                    endCol: nextCol 
                });
            } else {
                // Move right (default)
                const nextCol = Math.min(col + 1, config.cols - 1);
                setActiveCell({ row, col: nextCol });
                setSelection({ 
                    startRow: row, 
                    startCol: nextCol, 
                    endRow: row, 
                    endCol: nextCol 
                });
            }
            
            // Keep the formula bar focused
            setTimeout(() => {
                if (formulaInputRef.current) {
                    formulaInputRef.current.focus();
                    // Auto-select the formula when moving to next cell
                    formulaInputRef.current.select();
                }
            }, 10);
        } else if (key === 'Escape') {
            setIsEditing(false);
            const cell = gridData[activeCell.row][activeCell.col];
            setFormulaBarValue(cell.formula || cell.value || '');
        } else if (key === 'F2') {
            // F2 to edit - focus and select all
            e.preventDefault();
            if (formulaInputRef.current) {
                formulaInputRef.current.focus();
                formulaInputRef.current.select();
            }
        } else if ((ctrlKey || metaKey) && key === 'a') {
            // Allow Ctrl+A to select all
            e.preventDefault();
            if (formulaInputRef.current) {
                formulaInputRef.current.select();
            }
        } else if ((ctrlKey || metaKey) && key === 'Enter') {
            // Ctrl+Enter to apply formula without moving
            e.preventDefault();
            handleCellEditFinish(activeCell.row, activeCell.col);
            
            // Keep focus
            setTimeout(() => {
                if (formulaInputRef.current) {
                    formulaInputRef.current.focus();
                }
            }, 10);
        }
    };

    // Improved formula evaluation
    const evaluateFormula = (formula, currentRow, currentCol) => {
        try {
            // Remove leading '=' and trim
            let expression = formula.slice(1).trim();
            
            if (!expression) return '';
            
            // Replace cell references with values
            expression = expression.replace(/[A-Z]+[0-9]+/gi, (match) => {
                // Convert cell reference to row/col indices
                const colMatch = match.match(/[A-Z]+/i);
                const rowMatch = match.match(/[0-9]+/);
                
                if (!colMatch || !rowMatch) return '0';
                
                const colLetters = colMatch[0].toUpperCase();
                const rowNum = parseInt(rowMatch[0]) - 1;
                
                // Convert column letters to index
                let colNum = 0;
                for (let i = 0; i < colLetters.length; i++) {
                    colNum = colNum * 26 + (colLetters.charCodeAt(i) - 65 + 1);
                }
                colNum -= 1;
                
                if (rowNum < 0 || rowNum >= config.rows || colNum < 0 || colNum >= config.cols) {
                    return '0';
                }
                
                const cell = gridData[rowNum]?.[colNum];
                if (!cell) return '0';
                
                // Try to parse as number
                const numValue = parseFloat(cell.value);
                return !isNaN(numValue) ? numValue.toString() : '0';
            });
            
            // Handle basic functions
            // SUM function
            expression = expression.replace(/SUM\(([^)]+)\)/gi, (match, range) => {
                try {
                    // Handle ranges like A1:A10
                    if (range.includes(':')) {
                        const [startRef, endRef] = range.split(':');
                        // For now, just return placeholder
                        return '0';
                    }
                    // Handle comma-separated values
                    const values = range.split(',').map(ref => {
                        const num = parseFloat(ref.trim()) || 0;
                        return num;
                    });
                    return values.reduce((a, b) => a + b, 0).toString();
                } catch (error) {
                    console.error('SUM error:', error);
                    return '0';
                }
            });
            
            // Handle basic arithmetic
            const operators = ['+', '-', '*', '/', '^'];
            
            // Evaluate the expression
            try {
                // Use Function constructor for safer evaluation
                const result = new Function('return ' + expression)();
                
                // Handle numeric results
                if (typeof result === 'number') {
                    if (isNaN(result) || !isFinite(result)) {
                        return '#ERROR';
                    }
                    // Format numbers nicely
                    return Number.isInteger(result) ? result.toString() : parseFloat(result.toFixed(2)).toString();
                }
                
                return result.toString();
            } catch (evalError) {
                console.error('Evaluation error:', evalError);
                return '#ERROR';
            }
        } catch (error) {
            console.error('Formula error:', error);
            return '#ERROR';
        }
    };

    // Merge selected cells function
    const mergeSelectedCells = () => {
        const { start, end } = selectionStats;
        const { row: startRow, col: startCol } = start;
        const { row: endRow, col: endCol } = end;
        
        // If only one cell is selected, can't merge
        if (selectionStats.cellCount <= 1) {
            alert('Please select multiple cells to merge');
            return;
        }
        
        const newGridData = [...gridData];
        
        // Check if any cell in the range is already part of another merge
        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                if (newGridData[r][c].mergeInfo && newGridData[r][c].mergeInfo.isMerged) {
                    // Check if this cell is part of a different merge
                    const cellMerge = newGridData[r][c].mergeInfo;
                    if (cellMerge.mainCell.row !== startRow || cellMerge.mainCell.col !== startCol) {
                        alert('Cannot merge cells that are already part of a merged cell');
                        return;
                    }
                }
            }
        }
        
        // Get the value from the top-left cell
        const mainCell = newGridData[startRow][startCol];
        const mainValue = mainCell.value;
        
        // Mark all cells in the range as merged
        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                if (r === startRow && c === startCol) {
                    // This is the main cell
                    newGridData[r][c] = {
                        ...newGridData[r][c],
                        mergeInfo: {
                            isMerged: true,
                            mainCell: { row: startRow, col: startCol },
                            rowspan: endRow - startRow + 1,
                            colspan: endCol - startCol + 1
                        }
                    };
                } else {
                    // These are the merged cells - clear their content
                    newGridData[r][c] = {
                        ...newGridData[r][c],
                        value: '',
                        formula: '',
                        type: 'text',
                        style: {},
                        mergeInfo: {
                            isMerged: true,
                            mainCell: { row: startRow, col: startCol },
                            rowspan: 0,
                            colspan: 0
                        }
                    };
                }
            }
        }
        
        // Update the sheet data
        saveToHistory(newGridData);
        
        // Update selection to cover merged area
        setSelection({ 
            startRow: startRow, 
            startCol: startCol, 
            endRow: endRow, 
            endCol: endCol 
        });
        setActiveCell({ row: startRow, col: startCol });
        
        // Update formula bar with main cell value
        setFormulaBarValue(mainValue || '');
    };

    // Unmerge selected cells function
    const unmergeSelectedCells = () => {
        const { start, end } = selectionStats;
        const { row: startRow, col: startCol } = start;
        const { row: endRow, col: endCol } = end;
        
        const newGridData = [...gridData];
        let foundMergedCell = false;
        
        // Find and unmerge all merged cells in the selection
        for (let r = startRow; r <= endRow; r++) {
            for (let c = startCol; c <= endCol; c++) {
                const cell = newGridData[r][c];
                
                if (cell.mergeInfo && cell.mergeInfo.isMerged) {
                    foundMergedCell = true;
                    const { mainCell, rowspan, colspan } = cell.mergeInfo;
                    
                    // Reset all cells in the merged area
                    for (let mr = mainCell.row; mr < mainCell.row + rowspan; mr++) {
                        for (let mc = mainCell.col; mc < mainCell.col + colspan; mc++) {
                            if (mr === mainCell.row && mc === mainCell.col) {
                                // Keep the main cell's value
                                newGridData[mr][mc] = {
                                    ...newGridData[mr][mc],
                                    mergeInfo: null
                                };
                            } else {
                                // Clear merged cells
                                newGridData[mr][mc] = {
                                    value: '',
                                    formula: '',
                                    type: 'text',
                                    style: {},
                                    mergeInfo: null
                                };
                            }
                        }
                    }
                }
            }
        }
        
        if (!foundMergedCell) {
            alert('No merged cells found in the selection');
            return;
        }
        
        // Update the sheet data
        saveToHistory(newGridData);
    };

    // Apply borders to selected cells
    const applyBorders = () => {
        const { start, end } = selectionStats;
        const newGridData = [...gridData];
        
        for (let row = start.row; row <= end.row; row++) {
            for (let col = start.col; col <= end.col; col++) {
                const borderValue = `${borderWidth} ${borderStyle} ${borderColor}`;
                const newStyle = { ...newGridData[row][col].style };
                
                if (selectedBorders.top) newStyle.borderTop = borderValue;
                if (selectedBorders.right) newStyle.borderRight = borderValue;
                if (selectedBorders.bottom) newStyle.borderBottom = borderValue;
                if (selectedBorders.left) newStyle.borderLeft = borderValue;
                
                newGridData[row][col] = {
                    ...newGridData[row][col],
                    style: newStyle
                };
            }
        }
        
        // Update the sheet data
        saveToHistory(newGridData);
        setShowBorderDialog(false);
        
        // Update the active cell's style state
        updateCellStyleState(activeCell.row, activeCell.col);
    };

    // Clear borders from selected cells
    const clearBorders = () => {
        const { start, end } = selectionStats;
        const newGridData = [...gridData];
        
        for (let row = start.row; row <= end.row; row++) {
            for (let col = start.col; col <= end.col; col++) {
                const newStyle = { ...newGridData[row][col].style };
                delete newStyle.borderTop;
                delete newStyle.borderRight;
                delete newStyle.borderBottom;
                delete newStyle.borderLeft;
                
                newGridData[row][col] = {
                    ...newGridData[row][col],
                    style: newStyle
                };
            }
        }
        
        // Update the sheet data
        saveToHistory(newGridData);
    };

    // Apply text color to selected cells
    const applyTextColor = (color) => {
        const { start, end } = selectionStats;
        const newGridData = [...gridData];
        
        for (let row = start.row; row <= end.row; row++) {
            for (let col = start.col; col <= end.col; col++) {
                newGridData[row][col] = {
                    ...newGridData[row][col],
                    style: {
                        ...newGridData[row][col].style,
                        color: color
                    }
                };
            }
        }
        
        // Update the sheet data
        saveToHistory(newGridData);
        setCellStyle(prev => ({ ...prev, color: color }));
    };

    // Apply background color to selected cells
    const applyBackgroundColor = (color) => {
        const { start, end } = selectionStats;
        const newGridData = [...gridData];
        
        for (let row = start.row; row <= end.row; row++) {
            for (let col = start.col; col <= end.col; col++) {
                newGridData[row][col] = {
                    ...newGridData[row][col],
                    style: {
                        ...newGridData[row][col].style,
                        backgroundColor: color
                    }
                };
            }
        }
        
        // Update the sheet data
        saveToHistory(newGridData);
        setCellStyle(prev => ({ ...prev, backgroundColor: color }));
    };

    // Handle text alignment change
    const handleTextAlignChange = (alignment) => {
        const { row, col } = activeCell;
        const newGridData = [...gridData];
        
        newGridData[row][col] = {
            ...newGridData[row][col],
            style: {
                ...newGridData[row][col].style,
                textAlign: alignment
            }
        };
        
        // Update the sheet data
        saveToHistory(newGridData);
        setCellStyle(prev => ({ ...prev, textAlign: alignment }));
    };

    // Apply text alignment to selected cells
    const applyTextAlignToSelection = (alignment) => {
        const { start, end } = selectionStats;
        const newGridData = [...gridData];
        
        for (let row = start.row; row <= end.row; row++) {
            for (let col = start.col; col <= end.col; col++) {
                newGridData[row][col] = {
                    ...newGridData[row][col],
                    style: {
                        ...newGridData[row][col].style,
                        textAlign: alignment
                    }
                };
            }
        }
        
        // Update the sheet data
        saveToHistory(newGridData);
        setCellStyle(prev => ({ ...prev, textAlign: alignment }));
    };

    // Handle dimension changes
    const handleDimensionChange = (e) => {
        const { name, value } = e.target;
        const val = Math.max(1, Math.min(100, parseInt(value) || 1));
        const newConfig = { ...config, [name]: val };
        setConfig(newConfig);

        // Update all sheets with new dimensions
        setSheets(prevSheets => 
            prevSheets.map(sheet => {
                const currentGridData = sheet.gridData || createBlankGridData(config.rows, config.cols);
                const newGridData = Array(newConfig.rows).fill(null).map((_, r) => 
                    Array(newConfig.cols).fill(null).map((_, c) => 
                        (currentGridData[r] && currentGridData[r][c]) || { 
                            value: '', 
                            formula: '', 
                            type: 'text', 
                            style: {}, 
                            mergeInfo: null 
                        }
                    )
                );
                
                return {
                    ...sheet,
                    gridData: newGridData
                };
            })
        );
    };

    // Handle cell style changes (for font size, weight, etc.)
    const handleStyleChange = (property, value) => {
        const { row, col } = activeCell;
        const newGridData = [...gridData];
        
        newGridData[row][col] = {
            ...newGridData[row][col],
            style: {
                ...newGridData[row][col].style,
                [property]: value
            }
        };
        
        // Update the sheet data
        saveToHistory(newGridData);
        setCellStyle(prev => ({ ...prev, [property]: value }));
    };

    // Export to Excel with formatting
    const exportToExcel = () => {
        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Convert grid data to worksheet
        const wsData = gridData.map(row => 
            row.map(cell => cell.value)
        );
        
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        
        // Add some styling metadata
        ws['!cols'] = Array(config.cols).fill(null).map(() => ({ wch: 15 }));
        ws['!rows'] = Array(config.rows).fill(null).map(() => ({ hpx: 20 }));
        
        XLSX.utils.book_append_sheet(wb, ws, activeSheet.name);
        XLSX.writeFile(wb, `${config.title}.xlsx`);
    };

    // Save to database
    const saveToDatabase = async () => {
        const payload = {
            title: config.title,
            rows: config.rows,
            cols: config.cols,
            sheets: sheets,
            lastSaved: new Date().toISOString()
        };
        
        console.log("Saving to DB:", payload);
        // await fetch('/api/reports', { method: 'POST', body: JSON.stringify(payload) });
        
        setConfig(prev => ({ ...prev, lastSaved: new Date().toLocaleString() }));
        alert("Spreadsheet saved successfully!");
    };

    // Add new sheet - creates a completely blank sheet
    const addNewSheet = () => {
        const newSheetId = Math.max(...sheets.map(s => s.id)) + 1;
        const newSheetName = `Sheet${newSheetId}`;
        
        // Create a completely blank grid for the new sheet
        const blankGridData = createBlankGridData(config.rows, config.cols);
        
        setSheets(prev => [
            ...prev.map(sheet => ({ ...sheet, active: false })),
            { 
                id: newSheetId, 
                name: newSheetName, 
                active: true,
                gridData: blankGridData,
                history: [],
                historyIndex: -1,
                lastSaved: new Date().toLocaleString()
            }
        ]);
        
        setActiveSheetId(newSheetId);
        
        // Reset selection and formula bar for the new blank sheet
        setSelection({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
        setActiveCell({ row: 0, col: 0 });
        setFormulaBarValue('');
        setIsEditing(false);
        setCellStyle({
            fontSize: 12,
            fontWeight: 'normal',
            fontStyle: 'normal',
            textAlign: 'left',
            backgroundColor: '#ffffff',
            color: '#000000',
            border: '1px solid #d0d7de'
        });
    };

    // Switch between sheets
    const switchSheet = (sheetId) => {
        if (sheetId === activeSheetId) return;
        
        // If we were editing, save the changes before switching
        if (isEditing) {
            handleCellEditFinish(activeCell.row, activeCell.col);
        }
        
        setSheets(prev => 
            prev.map(sheet => ({
                ...sheet,
                active: sheet.id === sheetId
            }))
        );
        setActiveSheetId(sheetId);
        
        // Reset selection and active cell for the new sheet
        setSelection({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
        setActiveCell({ row: 0, col: 0 });
        setFormulaBarValue('');
        setIsEditing(false);
        
        // Update cell style state for the new sheet
        const targetSheet = sheets.find(sheet => sheet.id === sheetId);
        if (targetSheet) {
            // Reset to default cell style
            setCellStyle({
                fontSize: 12,
                fontWeight: 'normal',
                fontStyle: 'normal',
                textAlign: 'left',
                backgroundColor: '#ffffff',
                color: '#000000',
                border: '1px solid #d0d7de'
            });
        }
    };

    // Format cell value based on type
    const formatCellValue = (cell) => {
        if (!cell) return '';
        
        if (cell.type === 'number' || cell.type === 'formula') {
            const num = parseFloat(cell.value);
            return !isNaN(num) ? num.toLocaleString() : cell.value;
        }
        
        return cell.value;
    };

    // Get cell address (e.g., A1) - now based on actual grid position
    const getCellAddress = (row, col) => {
        const colLetters = [];
        let tempCol = col;
        
        while (tempCol >= 0) {
            colLetters.unshift(String.fromCharCode(65 + (tempCol % 26)));
            tempCol = Math.floor(tempCol / 26) - 1;
        }
        
        return colLetters.join('') + (row + 1);
    };

    // Handle scroll-based color selection
    const handleColorScroll = (e, type) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 1 : -1;
        const currentColors = getCurrentColorArray;
        let newIndex = scrollColorIndex + delta;
        
        // Wrap around
        if (newIndex < 0) newIndex = currentColors.length - 1;
        if (newIndex >= currentColors.length) newIndex = 0;
        
        setScrollColorIndex(newIndex);
        const newColor = currentColors[newIndex];
        
        // Apply color immediately based on type
        if (type === 'text') {
            applyTextColor(newColor);
        } else if (type === 'fill') {
            applyBackgroundColor(newColor);
        }
        
        // Update the current color display
        if (type === 'text') {
            setCellStyle(prev => ({ ...prev, color: newColor }));
        } else if (type === 'fill') {
            setCellStyle(prev => ({ ...prev, backgroundColor: newColor }));
        }
    };

    // Handle color mode change
    const handleColorModeChange = (mode) => {
        setScrollColorMode(mode);
        setScrollColorIndex(0);
    };
   
    // Add mouse up event listener for ending selection
    useEffect(() => {
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseUp]);

    // Auto-focus formula bar when editing starts
    useEffect(() => {
        if (isEditing && formulaInputRef.current) {
            formulaInputRef.current.focus();
        }
    }, [isEditing]);

    // Check if a cell should be displayed (not part of merged cells as a non-main cell)
    const shouldDisplayCell = (row, col) => {
        const cell = gridData[row]?.[col];
        if (!cell) return false;
        
        // If this cell is merged but not the main cell, don't display it
        if (cell.mergeInfo && cell.mergeInfo.isMerged) {
            const { mainCell } = cell.mergeInfo;
            return row === mainCell.row && col === mainCell.col;
        }
        
        return true;
    };

    // Get cell rowspan and colspan for merged cells
    const getCellSpan = (row, col) => {
        const cell = gridData[row]?.[col];
        if (!cell || !cell.mergeInfo || !cell.mergeInfo.isMerged) {
            return { rowspan: 1, colspan: 1 };
        }
        
        const { mainCell, rowspan, colspan } = cell.mergeInfo;
        if (row === mainCell.row && col === mainCell.col) {
            return { rowspan, colspan };
        }
        
        return { rowspan: 0, colspan: 0 };
    };

    // Get the address range for the selection
    const getSelectionRangeAddress = () => {
        const { start, end } = selectionStats;
        const startAddr = getCellAddress(start.row, start.col);
        const endAddr = getCellAddress(end.row, end.col);
        
        if (selectionStats.cellCount === 1) {
            return startAddr;
        }
        return `${startAddr}:${endAddr}`;
    };

    return (
        <div className="excel-container">
            {/* Excel-like Toolbar */}
            <div className="excel-toolbar">
                <div className="toolbar-section">
                    <button onClick={handleUndo} disabled={historyIndex <= 0} className="toolbar-btn">
                        ↩ Undo
                    </button>
                    <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="toolbar-btn">
                        ↪ Redo
                    </button>
                    <div className="toolbar-separator"></div>
                    
                    <select 
                        value={cellStyle.fontSize}
                        onChange={(e) => handleStyleChange('fontSize', e.target.value)}
                        className="toolbar-select"
                    >
                        {[8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24].map(size => (
                            <option key={size} value={size}>{size}px</option>
                        ))}
                    </select>
                    
                    <button 
                        onClick={() => handleStyleChange('fontWeight', cellStyle.fontWeight === 'bold' ? 'normal' : 'bold')}
                        className={`toolbar-btn ${cellStyle.fontWeight === 'bold' ? 'active' : ''}`}
                    >
                        <strong>B</strong>
                    </button>
                    
                    <button 
                        onClick={() => handleStyleChange('fontStyle', cellStyle.fontStyle === 'italic' ? 'normal' : 'italic')}
                        className={`toolbar-btn ${cellStyle.fontStyle === 'italic' ? 'active' : ''}`}
                    >
                        <em>I</em>
                    </button>
                    
                    <div className="toolbar-separator"></div>
                    
                    {/* Text Alignment Buttons */}
                    <div className="alignment-buttons">
                        <button 
                            onClick={() => applyTextAlignToSelection('left')}
                            className={`toolbar-btn ${cellStyle.textAlign === 'left' ? 'active' : ''}`}
                            title="Align Left (applies to selection)"
                        >
                            <span className="align-icon">⎡</span>
                        </button>
                        <button 
                            onClick={() => applyTextAlignToSelection('center')}
                            className={`toolbar-btn ${cellStyle.textAlign === 'center' ? 'active' : ''}`}
                            title="Align Center (applies to selection)"
                        >
                            <span className="align-icon">⎢</span>
                        </button>
                        <button 
                            onClick={() => applyTextAlignToSelection('right')}
                            className={`toolbar-btn ${cellStyle.textAlign === 'right' ? 'active' : ''}`}
                            title="Align Right (applies to selection)"
                        >
                            <span className="align-icon">⎣</span>
                        </button>
                    </div>
                    
                    <div className="toolbar-separator"></div>
                    
                    {/* Merge & Center Button (Excel-style) */}
                    <button 
                        onClick={mergeSelectedCells}
                        className="toolbar-btn merge"
                        title="Merge selected cells"
                    >
                        Merge & Center
                    </button>
                    
                    <button 
                        onClick={unmergeSelectedCells}
                        className="toolbar-btn"
                        title="Unmerge selected cells"
                    >
                        Unmerge Cells
                    </button>
                    
                    <div className="toolbar-separator"></div>
                    
                    {/* Border Button */}
                    <button 
                        onClick={() => setShowBorderDialog(true)}
                        className="toolbar-btn border"
                        title="Apply Borders"
                    >
                        Borders
                    </button>
                    
                    <button 
                        onClick={clearBorders}
                        className="toolbar-btn"
                        title="Clear Borders"
                    >
                        Clear Borders
                    </button>
                    
                    <div className="toolbar-separator"></div>
                    
                    {/* Scroll-based Color Picker - Text Color */}
                    <div className="color-picker-container">
                        <div className="color-picker-wrapper">
                            <label className="color-picker-label" title="Text Color - Scroll to change">
                                Text:
                                <div 
                                    className="color-preview"
                                    style={{ backgroundColor: cellStyle.color }}
                                    onClick={() => setShowColorPicker(showColorPicker === 'text' ? null : 'text')}
                                    onWheel={(e) => handleColorScroll(e, 'text')}
                                >
                                    <span className="color-hint">Scroll</span>
                                </div>
                            </label>
                        </div>
                    </div>
                    
                    {/* Scroll-based Color Picker - Fill Color */}
                    <div className="color-picker-container">
                        <div className="color-picker-wrapper">
                            <label className="color-picker-label" title="Fill Color - Scroll to change">
                                Fill:
                                <div 
                                    className="color-preview"
                                    style={{ backgroundColor: cellStyle.backgroundColor }}
                                    onClick={() => setShowColorPicker(showColorPicker === 'fill' ? null : 'fill')}
                                    onWheel={(e) => handleColorScroll(e, 'fill')}
                                >
                                    <span className="color-hint">Scroll</span>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>
                
                <div className="toolbar-section">
                    <input 
                        type="text" 
                        value={config.title}
                        onChange={(e) => setConfig({...config, title: e.target.value})}
                        className="title-input"
                    />
                    
                    <button onClick={saveToDatabase} className="toolbar-btn primary">
                        💾 Save
                    </button>
                    <button onClick={exportToExcel} className="toolbar-btn success">
                        📊 Export Excel
                    </button>
                </div>
            </div>

            {/* Color Picker Popup */}
            {showColorPicker && (
                <div className="color-picker-popup" ref={colorPickerRef}>
                    <div className="color-picker-header">
                        <h4>{showColorPicker === 'text' ? 'Text Color' : 'Fill Color'}</h4>
                        <button 
                            className="close-btn"
                            onClick={() => setShowColorPicker(null)}
                        >
                            ×
                        </button>
                    </div>
                    
                    <div className="color-mode-selector">
                        <button 
                            className={`color-mode-btn ${scrollColorMode === 'presets' ? 'active' : ''}`}
                            onClick={() => handleColorModeChange('presets')}
                        >
                            All Colors
                        </button>
                        <button 
                            className={`color-mode-btn ${scrollColorMode === 'reds' ? 'active' : ''}`}
                            onClick={() => handleColorModeChange('reds')}
                        >
                            Reds
                        </button>
                        <button 
                            className={`color-mode-btn ${scrollColorMode === 'greens' ? 'active' : ''}`}
                            onClick={() => handleColorModeChange('greens')}
                        >
                            Greens
                        </button>
                        <button 
                            className={`color-mode-btn ${scrollColorMode === 'blues' ? 'active' : ''}`}
                            onClick={() => handleColorModeChange('blues')}
                        >
                            Blues
                        </button>
                        <button 
                            className={`color-mode-btn ${scrollColorMode === 'yellows' ? 'active' : ''}`}
                            onClick={() => handleColorModeChange('yellows')}
                        >
                            Yellows
                        </button>
                        <button 
                            className={`color-mode-btn ${scrollColorMode === 'purples' ? 'active' : ''}`}
                            onClick={() => handleColorModeChange('purples')}
                        >
                            Purples
                        </button>
                        <button 
                            className={`color-mode-btn ${scrollColorMode === 'grays' ? 'active' : ''}`}
                            onClick={() => handleColorModeChange('grays')}
                        >
                            Grays
                        </button>
                    </div>
                    
                    <div 
                        className="color-scroll-area"
                        onWheel={(e) => handleColorScroll(e, showColorPicker)}
                    >
                        <div className="color-scroll-hint">
                            ← Scroll to change color →
                        </div>
                        <div className="color-display">
                            {getCurrentColorArray.map((color, index) => (
                                <div 
                                    key={index}
                                    className={`color-item ${index === scrollColorIndex ? 'active' : ''}`}
                                    style={{ backgroundColor: color }}
                                    onClick={() => {
                                        if (showColorPicker === 'text') {
                                            applyTextColor(color);
                                            setCellStyle(prev => ({ ...prev, color: color }));
                                        } else if (showColorPicker === 'fill') {
                                            applyBackgroundColor(color);
                                            setCellStyle(prev => ({ ...prev, backgroundColor: color }));
                                        }
                                        setScrollColorIndex(index);
                                    }}
                                    title={color}
                                >
                                    {index === scrollColorIndex && (
                                        <span className="color-selected-indicator">✓</span>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="current-color-info">
                            <div 
                                className="current-color-preview"
                                style={{ 
                                    backgroundColor: getCurrentColorArray[scrollColorIndex],
                                    borderColor: getCurrentColorArray[scrollColorIndex]
                                }}
                            />
                            <span className="current-color-value">
                                {getCurrentColorArray[scrollColorIndex]}
                            </span>
                        </div>
                    </div>
                    
                    <div className="color-picker-actions">
                        <button 
                            className="btn-primary"
                            onClick={() => {
                                if (showColorPicker === 'text') {
                                    applyTextColor(getCurrentColorArray[scrollColorIndex]);
                                } else if (showColorPicker === 'fill') {
                                    applyBackgroundColor(getCurrentColorArray[scrollColorIndex]);
                                }
                            }}
                        >
                            Apply to Selection
                        </button>
                        <button 
                            className="btn-secondary"
                            onClick={() => setShowColorPicker(null)}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Border Dialog */}
            {showBorderDialog && (
                <div className="modal-overlay">
                    <div className="modal-dialog">
                        <h3>Apply Borders</h3>
                        <p>Selected area: {getSelectionRangeAddress()} ({selectionStats.rows}×{selectionStats.cols})</p>
                        
                        <div className="form-group">
                            <label>Border Style:</label>
                            <select 
                                value={borderStyle}
                                onChange={(e) => setBorderStyle(e.target.value)}
                            >
                                <option value="solid">Solid</option>
                                <option value="dashed">Dashed</option>
                                <option value="dotted">Dotted</option>
                                <option value="double">Double</option>
                            </select>
                        </div>
                        
                        <div className="form-group">
                            <label>Border Width:</label>
                            <select 
                                value={borderWidth}
                                onChange={(e) => setBorderWidth(e.target.value)}
                            >
                                <option value="1px">Thin</option>
                                <option value="2px">Medium</option>
                                <option value="3px">Thick</option>
                            </select>
                        </div>
                        
                        <div className="form-group">
                            <label>Border Color:</label>
                            <input 
                                type="color" 
                                value={borderColor}
                                onChange={(e) => setBorderColor(e.target.value)}
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>Apply to:</label>
                            <div className="border-options">
                                <label>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedBorders.top}
                                        onChange={(e) => setSelectedBorders(prev => ({...prev, top: e.target.checked}))}
                                    />
                                    Top
                                </label>
                                <label>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedBorders.right}
                                        onChange={(e) => setSelectedBorders(prev => ({...prev, right: e.target.checked}))}
                                    />
                                    Right
                                </label>
                                <label>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedBorders.bottom}
                                        onChange={(e) => setSelectedBorders(prev => ({...prev, bottom: e.target.checked}))}
                                    />
                                    Bottom
                                </label>
                                <label>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedBorders.left}
                                        onChange={(e) => setSelectedBorders(prev => ({...prev, left: e.target.checked}))}
                                    />
                                    Left
                                </label>
                                <label>
                                    <input 
                                        type="checkbox" 
                                        checked={Object.values(selectedBorders).every(v => v)}
                                        onChange={(e) => {
                                            const allChecked = e.target.checked;
                                            setSelectedBorders({
                                                top: allChecked,
                                                right: allChecked,
                                                bottom: allChecked,
                                                left: allChecked
                                            });
                                        }}
                                    />
                                    All Borders
                                </label>
                            </div>
                        </div>
                        
                        <div className="dialog-actions">
                            <button onClick={applyBorders} className="btn-primary">
                                Apply Borders
                            </button>
                            <button onClick={() => setShowBorderDialog(false)} className="btn-secondary">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Formula Bar - SMOOTH VERSION */}
            <div className="formula-bar">
                <div className="cell-address">
                    {getSelectionRangeAddress()}
                </div>
                <div className="formula-input-container">
                    <input
                        ref={formulaInputRef}
                        type="text"
                        value={formulaBarValue}
                        onChange={handleFormulaBarChange}
                        onKeyDown={handleFormulaBarKeyDown}
                        onBlur={() => {
                            // Only save if we were editing
                            if (isEditing && formulaBarValue.trim() !== '') {
                                handleCellEditFinish(activeCell.row, activeCell.col);
                            }
                            setIsEditing(false);
                        }}
                        onClick={() => {
                            // Start editing when clicking on the formula bar
                            if (!isEditing) {
                                setIsEditing(true);
                            }
                        }}
                        placeholder={isEditing ? "Type formula (e.g., =A1+B2) or text" : "Click here or press F2 to edit"}
                        className="formula-input"
                        style={{ 
                            fontSize: '14px',
                            fontWeight: cellStyle.fontWeight,
                            fontStyle: cellStyle.fontStyle
                        }}
                    />
                    <div className="formula-hint">
                        Press Enter to apply, Tab to move right, Shift+Tab to move left. Press F2 to edit cell.
                    </div>
                </div>
            </div>

            {/* Selection Info Bar */}
            <div className="selection-info">
                <span>Selected: {selectionStats.rows} row{selectionStats.rows !== 1 ? 's' : ''}, {selectionStats.cols} column{selectionStats.cols !== 1 ? 's' : ''} ({selectionStats.cellCount} cells)</span>
                <div className="selection-hint">
                    Click and drag to select cells. Use arrow keys to navigate. Type directly to edit.
                </div>
            </div>

            {/* Sheet Tabs */}
            <div className="sheet-tabs">
                {sheets.map(sheet => (
                    <div 
                        key={sheet.id}
                        className={`sheet-tab ${sheet.active ? 'active' : ''}`}
                        onClick={() => switchSheet(sheet.id)}
                    >
                        {sheet.name}
                    </div>
                ))}
                <button onClick={addNewSheet} className="add-sheet-btn">
                    +
                </button>
            </div>

            {/* Spreadsheet Grid */}
            <div className="spreadsheet-container">
                <div className="spreadsheet-wrapper" ref={tableRef}>
                    <table className="excel-table">
                        <thead>
                            <tr>
                                <th className="corner-cell"></th>
                                {Array.from({ length: config.cols }).map((_, colIndex) => (
                                    <th key={colIndex} className="column-header">
                                        {String.fromCharCode(65 + colIndex)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {gridData.slice(0, config.rows).map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                    <td className="row-header">{rowIndex + 1}</td>
                                    {row.slice(0, config.cols).map((cell, colIndex) => {
                                        // Skip rendering if this cell is merged and not the main cell
                                        if (!shouldDisplayCell(rowIndex, colIndex)) {
                                            return null;
                                        }
                                        
                                        const { startRow, startCol, endRow, endCol } = selection;
                                        const minRow = Math.min(startRow, endRow);
                                        const maxRow = Math.max(startRow, endRow);
                                        const minCol = Math.min(startCol, endCol);
                                        const maxCol = Math.max(startCol, endCol);
                                        
                                        const isActive = activeCell.row === rowIndex && activeCell.col === colIndex;
                                        const isSelected = rowIndex >= minRow && rowIndex <= maxRow &&
                                                          colIndex >= minCol && colIndex <= maxCol;
                                        
                                        const { rowspan, colspan } = getCellSpan(rowIndex, colIndex);
                                        
                                        return (
                                            <td 
                                                key={`${rowIndex}-${colIndex}`}
                                                className={`cell ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
                                                onMouseDown={(e) => handleCellMouseDown(rowIndex, colIndex, e)}
                                                onMouseMove={(e) => handleCellMouseMove(rowIndex, colIndex, e)}
                                                onClick={(e) => handleCellClick(rowIndex, colIndex, e)}
                                                onDoubleClick={(e) => handleCellDoubleClick(rowIndex, colIndex, e)}
                                                style={{
                                                    ...cell.style,
                                                    borderTop: cell.style?.borderTop || cell.style?.border || '1px solid #d0d7de',
                                                    borderRight: cell.style?.borderRight || cell.style?.border || '1px solid #d0d7de',
                                                    borderBottom: cell.style?.borderBottom || cell.style?.border || '1px solid #d0d7de',
                                                    borderLeft: cell.style?.borderLeft || cell.style?.border || '1px solid #d0d7de',
                                                    fontSize: cell.style?.fontSize || '12px',
                                                    fontWeight: cell.style?.fontWeight || 'normal',
                                                    fontStyle: cell.style?.fontStyle || 'normal',
                                                    textAlign: cell.style?.textAlign || 'left',
                                                    color: cell.style?.color || '#000000',
                                                    backgroundColor: cell.style?.backgroundColor || '#ffffff'
                                                }}
                                                rowSpan={rowspan}
                                                colSpan={colspan}
                                            >
                                                {isActive && isEditing ? (
                                                    <input
                                                        ref={cellEditInputRef}
                                                        type="text"
                                                        value={formulaBarValue}
                                                        onChange={handleCellInputChange}
                                                        onKeyDown={(e) => handleCellInputKeyDown(e, rowIndex, colIndex)}
                                                        onMouseUp={handleCellInputMouseUp}
                                                        onBlur={() => {
                                                            if (formulaBarValue.trim() !== '') {
                                                                handleCellEditFinish(rowIndex, colIndex);
                                                            }
                                                        }}
                                                        className="cell-edit-input"
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            border: 'none',
                                                            outline: 'none',
                                                            background: 'transparent',
                                                            fontSize: cell.style?.fontSize || '12px',
                                                            fontWeight: cell.style?.fontWeight || 'normal',
                                                            fontStyle: cell.style?.fontStyle || 'normal',
                                                            textAlign: cell.style?.textAlign || 'left',
                                                            color: cell.style?.color || '#000000',
                                                            backgroundColor: cell.style?.backgroundColor || '#ffffff'
                                                        }}
                                                    />
                                                ) : (
                                                    <div 
                                                        className="cell-content"
                                                        style={{
                                                            textAlign: cell.style?.textAlign || 'left',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            height: '100%',
                                                            width: '100%',
                                                            padding: '2px 4px',
                                                            boxSizing: 'border-box',
                                                            color: cell.style?.color || '#000000',
                                                            backgroundColor: cell.style?.backgroundColor || '#ffffff',
                                                            fontSize: cell.style?.fontSize || '12px',
                                                            fontWeight: cell.style?.fontWeight || 'normal',
                                                            fontStyle: cell.style?.fontStyle || 'normal'
                                                        }}
                                                    >
                                                        {formatCellValue(cell)}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Status Bar */}
            <div className="status-bar">
                <div className="status-info">
                    <span>Ready</span>
                    <span className="status-separator">|</span>
                    <span>Active Sheet: {activeSheet?.name || 'Sheet1'}</span>
                    <span className="status-separator">|</span>
                    <span>Press F2 to edit, Arrow keys to navigate</span>
                    <span className="status-separator">|</span>
                    <span>Scroll on color buttons to change instantly</span>
                    <span className="status-separator">|</span>
                    <span>Last saved: {config.lastSaved}</span>
                </div>
                <div className="dimension-controls">
                    <label>
                        Rows: 
                        <input 
                            type="number" 
                            name="rows" 
                            value={config.rows} 
                            onChange={handleDimensionChange}
                            min="1"
                            max="1000"
                        />
                    </label>
                    <label>
                        Columns: 
                        <input 
                            type="number" 
                            name="cols" 
                            value={config.cols} 
                            onChange={handleDimensionChange}
                            min="1"
                            max="52"
                        />
                    </label>
                </div>
            </div>
        </div>
    );
};

export default ReportGenerator;