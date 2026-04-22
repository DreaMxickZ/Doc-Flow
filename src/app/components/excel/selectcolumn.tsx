"use client";
import React, { useState, useCallback } from 'react';
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, Plus, X, Edit3 } from 'lucide-react';
import * as XLSX from 'xlsx';

type CustomColumnType = 'text' | 'signature' | 'note' | 'checkbox' | 'date' | 'number';
type CustomColumn = { name: string; type: CustomColumnType; id: number };
type SortDirection = 'asc' | 'desc' | '';
type SortConfig = { column: string; direction: SortDirection };

const ExcelColumnSelector = () => {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [originalData, setOriginalData] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: '', direction: '' });
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [newColumnName, setNewColumnName] = useState<string>('');
  const [newColumnType, setNewColumnType] = useState<CustomColumnType>('text');
  const [showAddColumn, setShowAddColumn] = useState<boolean>(false);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    // Check if file is Excel format
    const fileExtension = uploadedFile.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !['xlsx', 'xls'].includes(fileExtension)) {
      setError('กรุณาเลือกไฟล์ Excel (.xlsx หรือ .xls)');
      return;
    }

    setIsLoading(true);
    setError('');
    
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const result = e.target?.result as string;
        const workbook = XLSX.read(result, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length === 0) {
          setError('ไฟล์ Excel ว่างเปล่า');
          setIsLoading(false);
          return;
        }

        // Extract headers (first row)
        const headersRow = (jsonData[0] || []) as any[];
        const headers = headersRow.map((h, idx) => String(h ?? `คอลัมน์ ${idx + 1}`));
        const dataRows = jsonData.slice(1);

        // Convert back to object format for easier handling
        const processedData: Record<string, any>[] = (dataRows as any[]).map((row: any[]) => {
          const obj: Record<string, any> = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          return obj;
        });

        setFile(uploadedFile);
        setData(processedData);
        setOriginalData(processedData);
        setColumns(headers);
        setSelectedColumns([]);
        setCustomColumns([]);
        setIsLoading(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError('เกิดข้อผิดพลาดในการอ่านไฟล์: ' + message);
        setIsLoading(false);
      }
    };
    
    reader.readAsBinaryString(uploadedFile);
  }, []);

  const handleColumnToggle = (column: string) => {
    setSelectedColumns(prev => 
      prev.includes(column) 
        ? prev.filter(col => col !== column)
        : [...prev, column]
    );
  };

  const handleSort = (column: string) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.column === column && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    
    setSortConfig({ column, direction });
    
    const sortedData = [...data].sort((a, b) => {
      const aVal = String(a[column] || '');
      const bVal = String(b[column] || '');
      
      // Try to parse as numbers first
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return direction === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      // Sort as strings
      if (direction === 'asc') {
        return aVal.localeCompare(bVal, 'th');
      } else {
        return bVal.localeCompare(aVal, 'th');
      }
    });
    
    setData(sortedData);
  };

  const clearSort = () => {
    setSortConfig({ column: '', direction: '' });
    setData(originalData);
  };

  const addCustomColumn = () => {
    if (!newColumnName.trim()) {
      setError('กรุณากรอกชื่อคอลัมน์');
      return;
    }

    const allColumns = [...columns, ...customColumns.map((col: CustomColumn) => col.name)];
    if (allColumns.includes(newColumnName)) {
      setError('ชื่อคอลัมน์นี้มีอยู่แล้ว');
      return;
    }

    const newCustomColumn = {
      name: newColumnName,
      type: newColumnType,
      id: Date.now()
    };

    setCustomColumns(prev => [...prev, newCustomColumn]);
    
    // Add empty values for this column to all existing data rows
    setData(prevData => prevData.map((row: Record<string, any>) => ({
      ...row,
      [newColumnName]: getDefaultValue(newColumnType)
    })));
    setOriginalData(prevData => prevData.map(row => ({
      ...row,
      [newColumnName]: getDefaultValue(newColumnType)
    })));

    // Auto-select the new column
    setSelectedColumns(prev => [...prev, newColumnName]);

    // Reset form
    setNewColumnName('');
    setNewColumnType('text');
    setShowAddColumn(false);
    setError('');
  };

  const getDefaultValue = (type: CustomColumnType): string => {
    switch (type) {
      case 'signature': return '_______________';
      case 'note': return '';
      case 'checkbox': return '☐';
      case 'date': return '__/__/____';
      case 'number': return '0';
      default: return '';
    }
  };

  const removeCustomColumn = (columnId: number) => {
    const columnToRemove = customColumns.find(col => col.id === columnId);
    if (!columnToRemove) return;

    // Remove from custom columns
    setCustomColumns(prev => prev.filter(col => col.id !== columnId));
    
    // Remove from selected columns
    setSelectedColumns(prev => prev.filter(col => col !== columnToRemove.name));
    
    // Remove from data
    setData(prevData => prevData.map((row: Record<string, any>) => {
      const { [columnToRemove.name]: removed, ...rest } = row;
      return rest;
    }));
    setOriginalData(prevData => prevData.map((row: Record<string, any>) => {
      const { [columnToRemove.name]: removed, ...rest } = row;
      return rest;
    }));
  };

  const getAllColumns = () => {
    return [...columns, ...customColumns.map(col => col.name)];
  };

  const selectAllColumns = () => {
    setSelectedColumns(getAllColumns());
  };

  const clearSelection = () => {
    setSelectedColumns([]);
  };

  const downloadSelectedColumns = () => {
    if (selectedColumns.length === 0) {
      setError('กรุณาเลือกคอลัมน์อย่างน้อย 1 คอลัมน์');
      return;
    }
    if (!file) {
      setError('ยังไม่ได้เลือกไฟล์');
      return;
    }

    try {
      // Filter data to include only selected columns
      const filteredData = data.map(row => {
        const filteredRow: Record<string, any> = {};
        selectedColumns.forEach(col => {
          filteredRow[col] = row[col];
        });
        return filteredRow;
      });

      // Create new workbook with filtered data
      const worksheet = XLSX.utils.json_to_sheet(filteredData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'FilteredData');

      // Generate filename
      const originalName = file.name.split('.')[0];
      const fileName = `${originalName}_selected_columns.xlsx`;

      // Download file
      XLSX.writeFile(workbook, fileName);
      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError('เกิดข้อผิดพลาดในการดาวน์โหลด: ' + message);
    }
  };

  const resetAll = () => {
    setFile(null);
    setData([]);
    setOriginalData([]);
    setColumns([]);
    setSelectedColumns([]);
    setCustomColumns([]);
    setSortConfig({ column: '', direction: '' });
    setError('');
    setShowAddColumn(false);
    setNewColumnName('');
    setNewColumnType('text');
    // Reset file input
    const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
    if (fileInput) fileInput.value = '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <FileSpreadsheet className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Excel Column Selector
            </h1>
            <p className="text-gray-600">
              อัพโหลดไฟล์ Excel เลือกคอลัมน์ที่ต้องการ และดาวน์โหลดเฉพาะข้อมูลที่เลือก
            </p>
          </div>

          {/* File Upload Section */}
          {!file && (
            <div className="border-2 border-dashed border-blue-300 rounded-xl p-8 text-center mb-8">
              <Upload className="w-12 h-12 text-blue-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                อัพโหลดไฟล์ Excel
              </h3>
              <p className="text-gray-500 mb-4">
                รองรับไฟล์ .xlsx และ .xls
              </p>
              <input
                id="file-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label
                htmlFor="file-input"
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
              >
                <Upload className="w-5 h-5 mr-2" />
                เลือกไฟล์
              </label>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">กำลังประมวลผลไฟล์...</p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* File Info & Column Selection */}
          {file && columns.length > 0 && (
            <div className="space-y-6">
              {/* File Info */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mr-2" />
                  <div>
                    <p className="text-green-700 font-medium">
                      ไฟล์: {file.name}
                    </p>
                    <p className="text-green-600 text-sm">
                      จำนวนคอลัมน์: {getAllColumns().length} ({columns.length} เดิม + {customColumns.length} ที่เพิ่ม) | จำนวนแถว: {data.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Column Selection Controls */}
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-800">
                  เลือกคอลัมน์ ({selectedColumns.length}/{getAllColumns().length})
                </h3>
                <div className="space-x-2">
                  <button
                    onClick={() => setShowAddColumn(!showAddColumn)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    เพิ่มคอลัมน์
                  </button>
                  <button
                    onClick={selectAllColumns}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    เลือกทั้งหมด
                  </button>
                  <button
                    onClick={clearSelection}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                  >
                    ยกเลิกการเลือก
                  </button>
                  <button
                    onClick={resetAll}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                  >
                    รีเซ็ต
                  </button>
                </div>
              </div>

              {/* Add Custom Column Form */}
              {showAddColumn && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-800 mb-3 flex items-center">
                    <Plus className="w-5 h-5 mr-2" />
                    เพิ่มคอลัมน์ใหม่
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ชื่อคอลัมน์
                      </label>
                      <input
                        type="text"
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        placeholder="เช่น ลายเซ็น, หมายเหตุ"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ประเภทคอลัมน์
                      </label>
                      <select
                        value={newColumnType}
                        onChange={(e) => setNewColumnType(e.target.value as CustomColumnType)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        <option value="text">ข้อความ</option>
                        <option value="signature">ลายเซ็น</option>
                        <option value="note">หมายเหตุ</option>
                        <option value="checkbox">Checkbox</option>
                        <option value="date">วันที่</option>
                        <option value="number">ตัวเลข</option>
                      </select>
                    </div>
                    
                    <div className="flex items-end space-x-2">
                      <button
                        onClick={addCustomColumn}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        เพิ่ม
                      </button>
                      <button
                        onClick={() => {
                          setShowAddColumn(false);
                          setNewColumnName('');
                          setNewColumnType('text');
                          setError('');
                        }}
                        className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Column Grid */}
              <div>
                {/* Original Columns */}
                {columns.length > 0 && (
                  <div className="mb-4">
                    <h5 className="text-lg font-medium text-gray-700 mb-3 flex items-center">
                      <FileSpreadsheet className="w-5 h-5 mr-2" />
                      คอลัมน์เดิมจากไฟล์
                    </h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {columns.map((column, index) => (
                        <div key={`original-${index}`} className="relative">
                          <label className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={selectedColumns.includes(column)}
                              onChange={() => handleColumnToggle(column)}
                              className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-gray-700 text-sm font-medium truncate" title={column}>
                              {column || `คอลัมน์ ${index + 1}`}
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Columns */}
                {customColumns.length > 0 && (
                  <div>
                    <h5 className="text-lg font-medium text-purple-700 mb-3 flex items-center">
                      <Edit3 className="w-5 h-5 mr-2" />
                      คอลัมน์ที่เพิ่มเติม
                    </h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {customColumns.map((column) => (
                        <div key={`custom-${column.id}`} className="relative">
                          <label className="flex items-center p-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={selectedColumns.includes(column.name)}
                              onChange={() => handleColumnToggle(column.name)}
                              className="mr-3 w-4 h-4 text-purple-600 bg-purple-100 border-purple-300 rounded focus:ring-purple-500"
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-purple-700 text-sm font-medium truncate block" title={column.name}>
                                {column.name}
                              </span>
                              <span className="text-purple-500 text-xs">
                                {column.type === 'signature' && '✍️ ลายเซ็น'}
                                {column.type === 'note' && '📝 หมายเหตุ'}
                                {column.type === 'checkbox' && '☑️ Checkbox'}
                                {column.type === 'date' && '📅 วันที่'}
                                {column.type === 'number' && '🔢 ตัวเลข'}
                                {column.type === 'text' && '📄 ข้อความ'}
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                removeCustomColumn(column.id);
                              }}
                              className="ml-2 p-1 text-red-500 hover:bg-red-100 rounded"
                              title="ลบคอลัมน์"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Preview Selected Data */}
              {selectedColumns.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-800">
                      ตัวอย่างข้อมูลที่เลือก (10 แถวแรก)
                    </h4>
                    {sortConfig.column && (
                      <button
                        onClick={clearSort}
                        className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors"
                      >
                        ยกเลิกการเรียงลำดับ
                      </button>
                    )}
                  </div>
                  
                  {sortConfig.column && (
                    <div className="mb-3 text-sm text-blue-600">
                      <span>เรียงลำดับตาม: {sortConfig.column} ({sortConfig.direction === 'asc' ? 'น้อยไปมาก' : 'มากไปน้อย'})</span>
                    </div>
                  )}
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-200">
                          {selectedColumns.map((col, index) => (
                            <th 
                              key={index} 
                              className="px-3 py-2 text-left font-medium text-gray-700 border-r border-gray-300 last:border-r-0 relative"
                            >
                              <div className="flex items-center justify-between group">
                                <span className="truncate mr-2" title={col}>{col}</span>
                                <button
                                  onClick={() => handleSort(col)}
                                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-300 rounded transition-all"
                                  title="เรียงลำดับ"
                                >
                                  {sortConfig.column === col ? (
                                    sortConfig.direction === 'asc' ? (
                                      <ArrowUp className="w-3 h-3 text-blue-600" />
                                    ) : (
                                      <ArrowDown className="w-3 h-3 text-blue-600" />
                                    )
                                  ) : (
                                    <ArrowUpDown className="w-3 h-3 text-gray-500" />
                                  )}
                                </button>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.slice(0, 10).map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-b border-gray-200 hover:bg-gray-100">
                            {selectedColumns.map((col, colIndex) => (
                              <td key={colIndex} className="px-3 py-2 border-r border-gray-200 last:border-r-0">
                                {String(row[col] || '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {data.length > 10 && (
                    <p className="text-gray-600 text-sm mt-2">
                      ... และอีก {data.length - 10} แถว
                    </p>
                  )}
                </div>
              )}

              {/* Download Button */}
              <div className="text-center pt-4">
                <button
                  onClick={downloadSelectedColumns}
                  disabled={selectedColumns.length === 0}
                  className="inline-flex items-center px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  <Download className="w-5 h-5 mr-2" />
                  ดาวน์โหลดคอลัมน์ที่เลือก
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExcelColumnSelector;