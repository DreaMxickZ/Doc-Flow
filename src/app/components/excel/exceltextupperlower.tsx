import React, { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, Type, Download, Sheet, Eye, EyeOff } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ExcelData {
  [key: string]: any;
}

interface ColumnTransform {
  column: string;
  transform: 'lowercase' | 'uppercase' | 'none';
}

interface SheetData {
  name: string;
  data: ExcelData[];
  columns: string[];
  selected: boolean;
}

interface SheetPreview {
  [sheetName: string]: boolean;
}

const ExcelTextTransformer = () => {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [transforms, setTransforms] = useState<ColumnTransform[]>([]);
  const [transformedSheets, setTransformedSheets] = useState<SheetData[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [allColumns, setAllColumns] = useState<string[]>([]);
  const [sheetPreviews, setSheetPreviews] = useState<SheetPreview>({});

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        const sheetsData: SheetData[] = [];
        const columnsSet = new Set<string>();
        
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length > 0) {
            const headers = jsonData[0] as string[];
            const rows = jsonData.slice(1).map((row: any) => {
              const rowObj: ExcelData = {};
              headers.forEach((header, index) => {
                rowObj[header] = row[index] || '';
              });
              return rowObj;
            });
            
            headers.forEach(header => columnsSet.add(header));
            
            sheetsData.push({
              name: sheetName,
              data: rows,
              columns: headers,
              selected: false
            });
          }
        });
        
        setSheets(sheetsData);
        setAllColumns(Array.from(columnsSet));
        setSelectedColumns([]);
        setTransforms([]);
        setTransformedSheets([]);
        setSheetPreviews({});
      } catch (error) {
        console.error('Error reading Excel file:', error);
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  const handleSheetSelection = (sheetName: string) => {
    setSheets(prev => 
      prev.map(sheet => 
        sheet.name === sheetName 
          ? { ...sheet, selected: !sheet.selected }
          : sheet
      )
    );
  };

  const handleSelectAllSheets = () => {
    const allSelected = sheets.every(sheet => sheet.selected);
    setSheets(prev => 
      prev.map(sheet => ({ ...sheet, selected: !allSelected }))
    );
  };

  const handleColumnSelection = (column: string) => {
    setSelectedColumns(prev => {
      const newSelected = prev.includes(column) 
        ? prev.filter(c => c !== column)
        : [...prev, column];
      
      // Update transforms based on selected columns
      setTransforms(currentTransforms => {
        const newTransforms = [...currentTransforms];
        if (newSelected.includes(column) && !currentTransforms.find(t => t.column === column)) {
          newTransforms.push({ column, transform: 'none' });
        } else if (!newSelected.includes(column)) {
          return newTransforms.filter(t => t.column !== column);
        }
        return newTransforms;
      });
      
      return newSelected;
    });
  };

  const handleTransformChange = (column: string, transform: 'lowercase' | 'uppercase' | 'none') => {
    setTransforms(prev => 
      prev.map(t => t.column === column ? { ...t, transform } : t)
    );
  };

  const toggleSheetPreview = (sheetName: string) => {
    setSheetPreviews(prev => ({
      ...prev,
      [sheetName]: !prev[sheetName]
    }));
  };

  const getSelectedSheets = () => {
    return sheets.filter(sheet => sheet.selected);
  };

  const getCommonColumns = () => {
    const selectedSheets = getSelectedSheets();
    if (selectedSheets.length === 0) return [];
    if (selectedSheets.length === 1) return selectedSheets[0].columns;
    
    // Find common columns across selected sheets
    const firstSheetColumns = new Set(selectedSheets[0].columns);
    return selectedSheets.slice(1).reduce((common, sheet) => {
      return common.filter(col => sheet.columns.includes(col));
    }, Array.from(firstSheetColumns));
  };

  const applyTransforms = () => {
    const selectedSheets = getSelectedSheets();
    if (selectedSheets.length === 0 || transforms.length === 0) return;

    const transformed = selectedSheets.map(sheet => {
      const transformedData = sheet.data.map(row => {
        const newRow = { ...row };
        
        transforms.forEach(({ column, transform }) => {
          if (newRow[column] !== undefined && typeof newRow[column] === 'string') {
            switch (transform) {
              case 'lowercase':
                newRow[column] = newRow[column].toLowerCase();
                break;
              case 'uppercase':
                newRow[column] = newRow[column].toUpperCase();
                break;
              case 'none':
              default:
                // No transformation
                break;
            }
          }
        });
        
        return newRow;
      });

      return {
        ...sheet,
        data: transformedData
      };
    });

    setTransformedSheets(transformed);
  };

  const downloadTransformed = () => {
    if (transformedSheets.length === 0) return;

    const workbook = XLSX.utils.book_new();
    
    transformedSheets.forEach(sheet => {
      const worksheet = XLSX.utils.json_to_sheet(sheet.data);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
    });
    
    const originalName = fileName.replace(/\.[^/.]+$/, '');
    XLSX.writeFile(workbook, `${originalName}_transformed.xlsx`);
  };

  const selectedSheets = getSelectedSheets();
  const commonColumns = getCommonColumns();
  const availableColumns = selectedSheets.length > 1 ? commonColumns : (selectedSheets.length === 1 ? selectedSheets[0].columns : []);

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
          <FileSpreadsheet className="w-8 h-8 text-green-600" />
          Excel Multi-Sheet Text Transformer
        </h1>
        <p className="text-gray-600">อัพโหลดไฟล์ Excel เลือก Sheet และ Column แล้วแปลงตัวอักษรได้</p>
      </div>

      {/* File Upload */}
      <div className="mb-6">
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="w-8 h-8 mb-2 text-gray-500" />
            <p className="mb-2 text-sm text-gray-500">
              <span className="font-semibold">คลิกเพื่ออัพโหลด</span> หรือ ลากไฟล์มาวาง
            </p>
            <p className="text-xs text-gray-500">Excel files (.xlsx, .xls)</p>
          </div>
          <input 
            type="file" 
            className="hidden" 
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
          />
        </label>
        {fileName && (
          <p className="mt-2 text-sm text-green-600">ไฟล์: {fileName}</p>
        )}
      </div>

      {/* Sheet Selection */}
      {sheets.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Sheet className="w-5 h-5" />
              เลือก Sheets ({sheets.filter(s => s.selected).length}/{sheets.length}):
            </h3>
            <button
              onClick={handleSelectAllSheets}
              className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
            >
              {sheets.every(sheet => sheet.selected) ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
            </button>
          </div>
          
          <div className="space-y-3">
            {sheets.map(sheet => (
              <div key={sheet.name} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sheet.selected}
                      onChange={() => handleSheetSelection(sheet.name)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <span className="font-medium">{sheet.name}</span>
                      <span className="ml-2 text-sm text-gray-500">
                        ({sheet.data.length} แถว, {sheet.columns.length} columns)
                      </span>
                    </div>
                  </label>
                  
                  <button
                    onClick={() => toggleSheetPreview(sheet.name)}
                    className="flex items-center gap-1 text-sm px-2 py-1 text-gray-600 hover:bg-gray-100 rounded"
                  >
                    {sheetPreviews[sheet.name] ? (
                      <>
                        <EyeOff className="w-4 h-4" />
                        ซ่อน
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" />
                        แสดง
                      </>
                    )}
                  </button>
                </div>
                
                <div className="text-xs text-gray-600 mb-2">
                  Columns: {sheet.columns.join(', ')}
                </div>
                
                {/* Sheet Preview */}
                {sheetPreviews[sheet.name] && sheet.data.length > 0 && (
                  <div className="mt-3 overflow-x-auto border rounded">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {sheet.columns.map(column => (
                            <th key={column} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sheet.data.slice(0, 3).map((row, index) => (
                          <tr key={index}>
                            {sheet.columns.map(column => (
                              <td key={column} className="px-3 py-2 text-xs text-gray-900 max-w-24 truncate">
                                {String(row[column] || '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Column Selection */}
      {selectedSheets.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">
            เลือก Columns ที่ต้องการแปลง:
            {selectedSheets.length > 1 && (
              <span className="text-sm font-normal text-blue-600 ml-2">
                (แสดงเฉพาะ columns ที่มีในทุก sheet ที่เลือก)
              </span>
            )}
          </h3>
          
          {availableColumns.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>ไม่มี columns ที่เหมือนกันในทุก sheet ที่เลือก</p>
              <p className="text-sm">ลองเลือก sheet ที่มี columns คล้ายกัน</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {availableColumns.map(column => (
                <label key={column} className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(column)}
                    onChange={() => handleColumnSelection(column)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm truncate" title={column}>{column}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Transform Options */}
      {transforms.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Type className="w-5 h-5" />
            ตั้งค่าการแปลงตัวอักษร:
          </h3>
          <div className="space-y-3">
            {transforms.map(({ column, transform }) => (
              <div key={column} className="flex items-center space-x-4 p-3 border rounded-lg">
                <div className="font-medium min-w-32 truncate" title={column}>
                  {column}
                </div>
                <div className="flex space-x-2">
                  <label className="flex items-center space-x-1">
                    <input
                      type="radio"
                      name={`transform-${column}`}
                      value="none"
                      checked={transform === 'none'}
                      onChange={() => handleTransformChange(column, 'none')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm">ไม่แปลง</span>
                  </label>
                  <label className="flex items-center space-x-1">
                    <input
                      type="radio"
                      name={`transform-${column}`}
                      value="lowercase"
                      checked={transform === 'lowercase'}
                      onChange={() => handleTransformChange(column, 'lowercase')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm">ตัวเล็ก (abc)</span>
                  </label>
                  <label className="flex items-center space-x-1">
                    <input
                      type="radio"
                      name={`transform-${column}`}
                      value="uppercase"
                      checked={transform === 'uppercase'}
                      onChange={() => handleTransformChange(column, 'uppercase')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm">ตัวใหญ่ (ABC)</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
          
          <button
            onClick={applyTransforms}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            แปลงข้อมูล
          </button>
        </div>
      )}

      {/* Transformed Data Preview */}
      {transformedSheets.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">ข้อมูลที่แปลงแล้ว:</h3>
            <button
              onClick={downloadTransformed}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              ดาวน์โหลด Excel ({transformedSheets.length} sheets)
            </button>
          </div>
          
          <div className="space-y-4">
            {transformedSheets.map(sheet => (
              <div key={sheet.name} className="border rounded-lg p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Sheet className="w-4 h-4" />
                  {sheet.name} ({sheet.data.length} แถว)
                </h4>
                
                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-green-50">
                      <tr>
                        {sheet.columns.map(column => (
                          <th key={column} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {column}
                            {selectedColumns.includes(column) && (
                              <span className="ml-1 text-green-600">✓</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sheet.data.slice(0, 5).map((row, index) => (
                        <tr key={index}>
                          {sheet.columns.map(column => (
                            <td key={column} className={`px-4 py-2 whitespace-nowrap text-sm ${
                              selectedColumns.includes(column) ? 'bg-green-50 font-medium' : 'text-gray-900'
                            }`}>
                              {String(row[column] || '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {sheets.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
            <div>
              ทั้งหมด: <span className="font-semibold">{sheets.length}</span> sheets
            </div>
            <div>
              เลือกแล้ว: <span className="font-semibold">{selectedSheets.length}</span> sheets
            </div>
            <div>
              Columns ที่เลือก: <span className="font-semibold">{selectedColumns.length}</span>
            </div>
            <div>
              รวมแถวที่เลือก: <span className="font-semibold">
                {selectedSheets.reduce((total, sheet) => total + sheet.data.length, 0)}
              </span>
            </div>
          </div>
          
          {selectedSheets.length > 1 && commonColumns.length > 0 && (
            <div className="mt-2 text-sm text-blue-600">
              <strong>Common Columns:</strong> {commonColumns.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExcelTextTransformer;