'use client';

import React, { useState, useCallback, ChangeEvent, KeyboardEvent } from 'react';
import { Upload, FileSpreadsheet, Download, SortAsc, SortDesc, X } from 'lucide-react';
import * as XLSX from 'xlsx';

// Types
interface DataRow {
  _rowIndex: number;
  [key: string]: any;
}

interface Sheet {
  name: string;
  data: DataRow[];
  startRow?: number;
  endRow?: number;
}

interface PrefixSheet {
  name: string;
  data: DataRow[];
  prefix: string;
  prefixList?: string[];
  column: string;
  count: number;
}

const ExcelSheetManager: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<DataRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [filteredData, setFilteredData] = useState<DataRow[]>([]);
  const [splitSheets, setSplitSheets] = useState<Sheet[]>([]);
  const [splitBy, setSplitBy] = useState<string>('row');
  const [rowInterval, setRowInterval] = useState<number>(10);
  const [sortKey, setSortKey] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState<boolean>(false);
  const [prefixColumn, setPrefixColumn] = useState<string>('');
  const [prefixValue, setPrefixValue] = useState<string>('');
  const [prefixSheets, setPrefixSheets] = useState<PrefixSheet[]>([]);

  const handleFileUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result;
        if (!result) return;

        const workbook = XLSX.read(result, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        if (jsonData.length > 0) {
          const headerRow: string[] = jsonData[0];
          const dataRows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ''));
          
          setHeaders(headerRow);
          
          // Convert array format to object format
          const formattedData: DataRow[] = dataRows.map((row, index) => {
            const rowObj: DataRow = { _rowIndex: index };
            headerRow.forEach((header, colIndex) => {
              rowObj[header] = row[colIndex] || '';
            });
            return rowObj;
          });
          
          setData(formattedData);
          setFilteredData(formattedData);
        }
      } catch (error) {
        console.error('Error reading Excel file:', error);
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์ Excel');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(uploadedFile);
  }, []);

  const handleSplitByRow = useCallback(() => {
    if (filteredData.length === 0) return;

    const sheets: Sheet[] = [];
    for (let i = 0; i < filteredData.length; i += rowInterval) {
      const chunk = filteredData.slice(i, i + rowInterval);
      sheets.push({
        name: `Sheet_${Math.floor(i / rowInterval) + 1}`,
        data: chunk,
        startRow: i + 1,
        endRow: Math.min(i + rowInterval, filteredData.length)
      });
    }
    setSplitSheets(sheets);
  }, [filteredData, rowInterval]);

  const handleSplitByPrefix = useCallback(() => {
    if (!prefixColumn || !prefixValue || filteredData.length === 0) return;

    // Split by comma and trim whitespace
    const prefixList = prefixValue.split(',').map(p => p.trim()).filter(p => p !== '');
    
    if (prefixList.length === 0) return;

    const matchingRows = filteredData.filter(row => {
      const cellValue = String(row[prefixColumn] || '');
      // Check if cell value starts with any of the prefixes
      return prefixList.some(prefix => cellValue.toString().startsWith(prefix));
    });

    if (matchingRows.length > 0) {
      const sheetName = prefixList.length === 1 ? 
        `Prefix_${prefixList[0]}` : 
        `Multi_${prefixList.join('_')}`;

      const newSheet: PrefixSheet = {
        name: sheetName,
        data: matchingRows,
        prefix: prefixValue, // Keep original input for reference
        prefixList: prefixList, // Store individual prefixes
        column: prefixColumn,
        count: matchingRows.length
      };

      // Check if sheet with same prefix combination already exists
      const existingIndex = prefixSheets.findIndex(sheet => sheet.prefix === prefixValue);
      if (existingIndex >= 0) {
        const updatedSheets = [...prefixSheets];
        updatedSheets[existingIndex] = newSheet;
        setPrefixSheets(updatedSheets);
      } else {
        setPrefixSheets(prev => [...prev, newSheet]);
      }
      
      // Clear prefix value for next input
      setPrefixValue('');
    } else {
      alert(`ไม่พบข้อมูลที่เริ่มต้นด้วย "${prefixList.join(', ')}" ใน column "${prefixColumn}"`);
    }
  }, [filteredData, prefixColumn, prefixValue, prefixSheets]);

  const handleSortByKey = useCallback(() => {
    if (!sortKey || filteredData.length === 0) return;

    const sorted = [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const aStr = String(aVal || '').toLowerCase();
      const bStr = String(bVal || '').toLowerCase();
      
      if (sortOrder === 'asc') {
        return aStr.localeCompare(bStr, 'th');
      } else {
        return bStr.localeCompare(aStr, 'th');
      }
    });

    setFilteredData(sorted);
  }, [filteredData, sortKey, sortOrder]);

  const removePrefixSheet = useCallback((prefix: string) => {
    setPrefixSheets(prev => prev.filter(sheet => sheet.prefix !== prefix));
  }, []);

  const downloadSheet = useCallback((sheetData: DataRow[], fileName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  }, []);

  const downloadAllSheets = useCallback(() => {
    if (splitSheets.length === 0) return;

    const workbook = XLSX.utils.book_new();
    splitSheets.forEach((sheet) => {
      const worksheet = XLSX.utils.json_to_sheet(sheet.data);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
    });
    XLSX.writeFile(workbook, `split_sheets_${Date.now()}.xlsx`);
  }, [splitSheets]);

  const downloadAllPrefixSheets = useCallback(() => {
    if (prefixSheets.length === 0) return;

    const workbook = XLSX.utils.book_new();
    prefixSheets.forEach((sheet) => {
      const worksheet = XLSX.utils.json_to_sheet(sheet.data);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
    });
    XLSX.writeFile(workbook, `prefix_sheets_${Date.now()}.xlsx`);
  }, [prefixSheets]);

  const handlePrefixKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSplitByPrefix();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Excel Sheet Manager</h1>
          <p className="text-gray-600">อัปโหลด Excel และแบ่ง Sheet ตามต้องการ</p>
        </div>

        {/* File Upload */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-4 text-gray-500" />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">คลิกเพื่อเลือกไฟล์</span> หรือลากไฟล์มาวาง
                </p>
                <p className="text-xs text-gray-500">Excel (XLS, XLSX)</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
              />
            </label>
          </div>
          {file && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center">
                <FileSpreadsheet className="w-5 h-5 text-blue-600 mr-2" />
                <span className="text-sm text-blue-800">{file.name}</span>
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">กำลังประมวลผลไฟล์...</p>
          </div>
        )}

        {data.length > 0 && (
          <>
            {/* Controls */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Split by Row */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">แบ่ง Sheet ตาม Row</h3>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="row"
                        checked={splitBy === 'row'}
                        onChange={(e) => setSplitBy(e.target.value)}
                        className="mr-2"
                      />
                      แบ่งทุก
                    </label>
                    <input
                      type="number"
                      value={rowInterval}
                      onChange={(e) => setRowInterval(parseInt(e.target.value) || 10)}
                      className="w-20 px-3 py-1 border border-gray-300 rounded-md"
                      min="1"
                    />
                    <span>แถว</span>
                  </div>
                  <button
                    onClick={handleSplitByRow}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    แบ่ง Sheet
                  </button>
                </div>

                {/* Split by Prefix */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">แบ่ง Sheet ตาม Prefix</h3>
                  <div className="space-y-3">
                    <select
                      value={prefixColumn}
                      onChange={(e) => setPrefixColumn(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">เลือก Column</option>
                      {headers.map((header, index) => (
                        <option key={index} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={prefixValue}
                        onChange={(e) => setPrefixValue(e.target.value)}
                        placeholder="ค่าที่นำหน้า เช่น 11,10,20 หรือ ABC,DEF"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                        onKeyPress={handlePrefixKeyPress}
                      />
                    </div>
                    <div className="text-xs text-gray-500">
                      💡 ใส่หลายค่าโดยคั่นด้วยเครื่องหมายจุลภาค เช่น: 10,11,12
                    </div>
                  </div>
                  <button
                    onClick={handleSplitByPrefix}
                    disabled={!prefixColumn || !prefixValue}
                    className="w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    เพิ่ม Sheet
                  </button>
                </div>

                {/* Sort by Key */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">เรียงลำดับตาม Column</h3>
                  <div className="space-y-3">
                    <select
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">เลือก Column</option>
                      {headers.map((header, index) => (
                        <option key={index} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="asc">น้อย → มาก</option>
                      <option value="desc">มาก → น้อย</option>
                    </select>
                  </div>
                  <button
                    onClick={handleSortByKey}
                    disabled={!sortKey}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {sortOrder === 'asc' ? <SortAsc className="w-4 h-4 mr-2" /> : <SortDesc className="w-4 h-4 mr-2" />}
                    เรียงลำดับ
                  </button>
                </div>
              </div>
            </div>

            {/* Data Preview */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  ข้อมูล ({filteredData.length} แถว)
                </h3>
                <button
                  onClick={() => downloadSheet(filteredData, 'filtered_data')}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  ดาวน์โหลด
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto">
                  <thead>
                    <tr className="bg-gray-50">
                      {headers.map((header, index) => (
                        <th key={index} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredData.slice(0, 10).map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        {headers.map((header, colIndex) => (
                          <td key={colIndex} className="px-4 py-3 text-sm text-gray-900 border-b">
                            {row[header]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredData.length > 10 && (
                  <p className="text-center text-gray-500 py-4">
                    แสดง 10 แถวแรก จากทั้งหมด {filteredData.length} แถว
                  </p>
                )}
              </div>
            </div>

            {/* Prefix Sheets */}
            {prefixSheets.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Sheet ที่แบ่งตาม Prefix ({prefixSheets.length} sheets)
                  </h3>
                  <button
                    onClick={downloadAllPrefixSheets}
                    className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors flex items-center"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    ดาวน์โหลดทั้งหมด
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {prefixSheets.map((sheet, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 relative">
                      <button
                        onClick={() => removePrefixSheet(sheet.prefix)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <h4 className="font-medium text-gray-900 mb-2">{sheet.name}</h4>
                      <p className="text-sm text-gray-600 mb-1">
                        Column: {sheet.column}
                      </p>
                      <p className="text-sm text-gray-600 mb-3">
                        Prefix: "{sheet.prefixList ? sheet.prefixList.join(', ') : sheet.prefix}" ({sheet.count} แถว)
                      </p>
                      <button
                        onClick={() => downloadSheet(sheet.data, sheet.name)}
                        className="w-full px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors text-sm flex items-center justify-center"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        ดาวน์โหลด
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Split Sheets */}
            {splitSheets.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Sheet ที่แบ่งแล้ว ({splitSheets.length} sheets)
                  </h3>
                  <button
                    onClick={downloadAllSheets}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors flex items-center"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    ดาวน์โหลดทั้งหมด
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {splitSheets.map((sheet, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">{sheet.name}</h4>
                      <p className="text-sm text-gray-600 mb-3">
                        แถวที่ {sheet.startRow} - {sheet.endRow} ({sheet.data.length} แถว)
                      </p>
                      <button
                        onClick={() => downloadSheet(sheet.data, sheet.name)}
                        className="w-full px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm flex items-center justify-center"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        ดาวน์โหลด
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ExcelSheetManager;