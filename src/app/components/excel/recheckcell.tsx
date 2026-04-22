import React, { useState, useCallback } from 'react';
import { Upload, FileText, Check, X, BarChart3 } from 'lucide-react';

interface DataRow {
  [key: string]: any;
}

interface ComparisonDetail {
  rowIndex: number;
  combinedValue: string;
  value1: string;
  value2: string;
  reconstructed: string;
  isMatch: boolean;
}

interface ComparisonResults {
  total: number;
  match: number;
  mismatch: number;
  matchPercentage: string;
  details: ComparisonDetail[];
}

const CSVExcelColumnCompare = () => {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<DataRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedCombinedColumn, setSelectedCombinedColumn] = useState<string>('');
  const [selectedColumn1, setSelectedColumn1] = useState<string>('');
  const [selectedColumn2, setSelectedColumn2] = useState<string>('');
  const [separator, setSeparator] = useState<string>(',');
  const [results, setResults] = useState<ComparisonResults | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const parseCSV = (text: string): DataRow[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    // Parse CSV properly handling quoted fields and commas
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      result.push(current.trim());
      return result.map(field => field.replace(/^"(.*)"$/, '$1')); // Remove surrounding quotes
    };

    const headers = parseCSVLine(lines[0]);
    console.log('Headers found:', headers);

    const parsedData = lines.slice(1).map((line, index) => {
      const values = parseCSVLine(line);
      console.log(`Row ${index + 1}:`, values);
      
      const row: DataRow = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      return row;
    });

    console.log('Sample parsed data:', parsedData.slice(0, 3));
    return parsedData;
  };

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setLoading(true);

    try {
      const fileExtension = uploadedFile.name.split('.').pop()?.toLowerCase();
      let parsedData: DataRow[] = [];

      if (fileExtension === 'csv') {
        const text = await uploadedFile.text();
        parsedData = parseCSV(text);
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        // Parse Excel
        const XLSX = await import('xlsx');
        const arrayBuffer = await uploadedFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        parsedData = XLSX.utils.sheet_to_json(worksheet) as DataRow[];
      } else {
        alert('รองรับเฉพาะไฟล์ CSV และ Excel เท่านั้น');
        return;
      }

      console.log('Final parsed data:', parsedData);
      setData(parsedData);
      setColumns(Object.keys(parsedData[0] || {}));
      setResults(null);
    } catch (error) {
      console.error('Error parsing file:', error);
      alert('เกิดข้อผิดพลาดในการอ่านไฟล์');
    } finally {
      setLoading(false);
    }
  }, []);

  const compareColumns = useCallback(() => {
    if (!selectedCombinedColumn || !selectedColumn1 || !selectedColumn2) {
      alert('กรุณาเลือก columns ให้ครบทั้ง 3 อัน');
      return;
    }

    let matchCount = 0;
    let mismatchCount = 0;
    const details: ComparisonDetail[] = [];

    data.forEach((row, index) => {
      const combinedValue = String(row[selectedCombinedColumn] || '').trim();
      const value1 = String(row[selectedColumn1] || '').trim();
      const value2 = String(row[selectedColumn2] || '').trim();
      
      // รวมค่าจาก 2 columns ด้วย separator
      const reconstructed = `${value1}${separator}${value2}`;
      
      const isMatch = combinedValue === reconstructed;
      
      if (isMatch) {
        matchCount++;
      } else {
        mismatchCount++;
      }

      details.push({
        rowIndex: index + 1,
        combinedValue,
        value1,
        value2,
        reconstructed,
        isMatch
      });
    });

    setResults({
      total: data.length,
      match: matchCount,
      mismatch: mismatchCount,
      matchPercentage: ((matchCount / data.length) * 100).toFixed(2),
      details
    });
  }, [data, selectedCombinedColumn, selectedColumn1, selectedColumn2, separator]);

  const resetData = () => {
    setFile(null);
    setData([]);
    setColumns([]);
    setSelectedCombinedColumn('');
    setSelectedColumn1('');
    setSelectedColumn2('');
    setResults(null);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
          <BarChart3 className="text-blue-600" />
          เครื่องมือเปรียบเทียบ Columns
        </h1>
        <p className="text-gray-600">อัพโหลดไฟล์ CSV หรือ Excel เพื่อเปรียบเทียบค่าใน columns</p>
      </div>

      {/* File Upload */}
      <div className="mb-6">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
            id="fileInput"
            disabled={loading}
          />
          <label htmlFor="fileInput" className="cursor-pointer">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg text-gray-600 mb-2">
              {loading ? 'กำลังโหลดไฟล์...' : 'คลิกเพื่อเลือกไฟล์ CSV หรือ Excel'}
            </p>
            <p className="text-sm text-gray-500">รองรับไฟล์ .csv, .xlsx, .xls</p>
          </label>
        </div>
        
        {file && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg flex items-center gap-3">
            <FileText className="text-blue-600" />
            <div className="flex-1">
              <p className="font-medium text-blue-800">{file.name}</p>
              <p className="text-sm text-blue-600">{data.length} แถว</p>
            </div>
            <button
              onClick={resetData}
              className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
            >
              ลบไฟล์
            </button>
          </div>
        )}
      </div>

      {/* Column Selection */}
      {columns.length > 0 && (
        <div className="mb-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">เลือก Columns</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Column ที่มีค่ารวม
              </label>
              <select
                value={selectedCombinedColumn}
                onChange={(e) => setSelectedCombinedColumn(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">เลือก column...</option>
                {columns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Column แรก
              </label>
              <select
                value={selectedColumn1}
                onChange={(e) => setSelectedColumn1(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">เลือก column...</option>
                {columns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Column ที่สอง
              </label>
              <select
                value={selectedColumn2}
                onChange={(e) => setSelectedColumn2(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">เลือก column...</option>
                {columns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ตัวคั่น (Separator)
              </label>
              <input
                type="text"
                value={separator}
                onChange={(e) => setSeparator(e.target.value)}
                placeholder=","
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <button
            onClick={compareColumns}
            disabled={!selectedCombinedColumn || !selectedColumn1 || !selectedColumn2}
            className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            เปรียบเทียบ Columns
          </button>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-800">ทั้งหมด</h3>
              <p className="text-2xl font-bold text-blue-600">{results.total}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-medium text-green-800">ตรงกัน</h3>
              <p className="text-2xl font-bold text-green-600">{results.match}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <h3 className="font-medium text-red-800">ไม่ตรงกัน</h3>
              <p className="text-2xl font-bold text-red-600">{results.mismatch}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-medium text-purple-800">เปอร์เซ็นต์ที่ตรง</h3>
              <p className="text-2xl font-bold text-purple-600">{results.matchPercentage}%</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-800 mb-4">รายละเอียด (แสดง 10 รายการแรก)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg overflow-hidden">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">แถว</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">ค่ารวม</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">ค่าที่ 1</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">ค่าที่ 2</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">ค่าที่สร้างใหม่</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {results.details.slice(0, 10).map((detail, index) => (
                    <tr key={index} className={`border-b ${detail.isMatch ? 'bg-green-50' : 'bg-red-50'}`}>
                      <td className="px-4 py-3 text-sm text-gray-700">{detail.rowIndex}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-mono">{detail.combinedValue}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-mono">{detail.value1}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-mono">{detail.value2}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-mono">{detail.reconstructed}</td>
                      <td className="px-4 py-3 text-sm">
                        {detail.isMatch ? (
                          <span className="inline-flex items-center gap-1 text-green-700">
                            <Check size={16} />
                            ตรง
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-700">
                            <X size={16} />
                            ไม่ตรง
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {results.details.length > 10 && (
              <p className="text-sm text-gray-600 mt-2">
                แสดง 10 จาก {results.details.length} รายการ
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CSVExcelColumnCompare;