"use client";
import React, { useState } from 'react';
import * as XLSX from 'xlsx';

type RowObject = Record<string, any>;
type MatchType = 'both-columns' | 'column1' | 'column2' | 'none';
type MatchCondition = { id: 1 | 2 | 3; name: string; enabled: boolean; priority: number };
type MergeStats = {
  total03: number;
  total01: number;
  matched: number;
  unmatched: number;
  unusedFrom01: number;
  matchPercentage: string;
  bothColumnsMatches: number;
  column1Matches: number;
  column2Matches: number;
  noMatches: number;
};
type MergedRow = RowObject & { _source?: string; _matchType?: MatchType };

const ExcelMerger = () => {
  const [file03Data, setFile03Data] = useState<RowObject[] | null>(null);
  const [file01Data, setFile01Data] = useState<RowObject[] | null>(null);
  const [mergedData, setMergedData] = useState<MergedRow[] | null>(null);
  const [mergeStats, setMergeStats] = useState<MergeStats | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Column selection states
  const [file03Columns, setFile03Columns] = useState<string[]>([]);
  const [file01Columns, setFile01Columns] = useState<string[]>([]);
  const [selectedFile03Cols, setSelectedFile03Cols] = useState<[string, string]>(['', '']);
  const [selectedFile01Cols, setSelectedFile01Cols] = useState<[string, string]>(['', '']);
  
  // Matching conditions
  const [matchConditions, setMatchConditions] = useState<MatchCondition[]>([
    { id: 1, name: 'Both Columns', enabled: true, priority: 1 },
    { id: 2, name: 'Column 1 Only', enabled: true, priority: 2 },
    { id: 3, name: 'Column 2 Only', enabled: true, priority: 3 }
  ]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, fileType: '03' | '01') => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const result = e.target?.result as ArrayBuffer;
        const data = new Uint8Array(result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<RowObject>(worksheet);
        
        if (jsonData.length > 0) {
          const columns = Object.keys(jsonData[0] as RowObject);
          
          if (fileType === '03') {
            setFile03Data(jsonData);
            setFile03Columns(columns);
            setSelectedFile03Cols(['', '']);
          } else {
            setFile01Data(jsonData);
            setFile01Columns(columns);
            setSelectedFile01Cols(['', '']);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์: ' + message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const normalizeText = (text: unknown) => {
    if (!text) return '';
    return text.toString().toLowerCase().trim();
  };

  const updateMatchCondition = (
    id: MatchCondition['id'],
    field: 'enabled' | 'priority',
    value: boolean | number
  ) => {
    setMatchConditions(prev => 
      prev.map(condition => 
        condition.id === id ? { ...condition, [field]: value } : condition
      ).sort((a, b) => a.priority - b.priority)
    );
  };

  const findBestMatch = (
    targetItem: RowObject,
    sourceData: RowObject[],
    usedIndices: Set<number>
  ): { index: number; matchType: MatchType } => {
    const enabledConditions = matchConditions
      .filter(c => c.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const condition of enabledConditions) {
      for (let i = 0; i < sourceData.length; i++) {
        if (usedIndices.has(i)) continue;
        
        const sourceItem = sourceData[i];
        
        if (condition.id === 1) { // Both columns
          const targetCol1 = normalizeText(targetItem[selectedFile03Cols[0]] || '');
          const targetCol2 = normalizeText(targetItem[selectedFile03Cols[1]] || '');
          const sourceCol1 = normalizeText(sourceItem[selectedFile01Cols[0]] || '');
          const sourceCol2 = normalizeText(sourceItem[selectedFile01Cols[1]] || '');
          
          if (targetCol1 && sourceCol1 && targetCol1 === sourceCol1 &&
              targetCol2 && sourceCol2 && targetCol2 === sourceCol2) {
            return { index: i, matchType: 'both-columns' };
          }
        } else if (condition.id === 2) { // Column 1 only
          const targetCol1 = normalizeText(targetItem[selectedFile03Cols[0]] || '');
          const sourceCol1 = normalizeText(sourceItem[selectedFile01Cols[0]] || '');
          
          if (targetCol1 && sourceCol1 && targetCol1 === sourceCol1) {
            return { index: i, matchType: 'column1' };
          }
        } else if (condition.id === 3) { // Column 2 only
          const targetCol2 = normalizeText(targetItem[selectedFile03Cols[1]] || '');
          const sourceCol2 = normalizeText(sourceItem[selectedFile01Cols[1]] || '');
          
          if (targetCol2 && sourceCol2 && targetCol2 === sourceCol2) {
            return { index: i, matchType: 'column2' };
          }
        }
      }
    }
    
    return { index: -1, matchType: 'none' };
  };

  const mergeData = () => {
    if (!file03Data || !file01Data) {
      alert('กรุณาอัปโหลดทั้งสองไฟล์');
      return;
    }

    if (!selectedFile03Cols[0] || !selectedFile03Cols[1] || 
        !selectedFile01Cols[0] || !selectedFile01Cols[1]) {
      alert('กรุณาเลือกคอลัมน์ให้ครบทั้ง 2 คอลัมน์ในแต่ละไฟล์');
      return;
    }

    if (!matchConditions.some(c => c.enabled)) {
      alert('กรุณาเปิดใช้งานเงื่อนไขการจับคู่อย่างน้อย 1 เงื่อนไข');
      return;
    }

    setLoading(true);
    const data03 = file03Data;
    const data01 = file01Data;
    
    setTimeout(() => {
      try {
        const usedIndices = new Set<number>();
        const result: MergedRow[] = [];

        data03.forEach((item03) => {
          const mergedItem: MergedRow = { ...item03 };
          
          const matchResult = findBestMatch(item03, data01, usedIndices);
          const matchIndex = matchResult.index;
          const matchType = matchResult.matchType;
          
          if (matchIndex !== -1) {
            const item01 = data01[matchIndex];
            usedIndices.add(matchIndex);
            
            Object.keys(item01).forEach(key => {
              if (!mergedItem.hasOwnProperty(key) || !mergedItem[key]) {
                mergedItem[key] = item01[key];
              }
            });
          }
          
          mergedItem._source = matchIndex !== -1 ? '03+01' : '03 only';
          mergedItem._matchType = matchType;
          result.push(mergedItem);
        });

        setMergedData(result);
        
        // สถิติการ merge
        const matchedCount = result.filter(item => item._source === '03+01').length;
        const unmatchedCount = result.filter(item => item._source === '03 only').length;
        const unusedFrom01 = data01.length - matchedCount;
        
        const bothColumnsMatches = result.filter(item => item._matchType === 'both-columns').length;
        const column1Matches = result.filter(item => item._matchType === 'column1').length;
        const column2Matches = result.filter(item => item._matchType === 'column2').length;
        const noMatches = result.filter(item => item._matchType === 'none').length;
        
        setMergeStats({
          total03: data03.length,
          total01: data01.length,
          matched: matchedCount,
          unmatched: unmatchedCount,
          unusedFrom01: unusedFrom01,
          matchPercentage: ((matchedCount / file03Data.length) * 100).toFixed(1),
          bothColumnsMatches,
          column1Matches,
          column2Matches,
          noMatches
        });
        
        alert(`เสร็จสิ้น!\n- จับคู่ได้: ${matchedCount} รายการ\n  • ทั้ง 2 คอลัมน์: ${bothColumnsMatches}\n  • คอลัมน์ 1: ${column1Matches}\n  • คอลัมน์ 2: ${column2Matches}\n- ไม่มีคู่: ${noMatches} รายการ\n- ไม่ได้ใช้จากไฟล์ 01: ${unusedFrom01} รายการ`);
        
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        alert('เกิดข้อผิดพลาด: ' + message);
      } finally {
        setLoading(false);
      }
    }, 100);
  };

  const downloadMergedFile = () => {
    if (!mergedData) return;

    const ws = XLSX.utils.json_to_sheet(mergedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Merged Data');
    XLSX.writeFile(wb, 'merged_data.xlsx');
  };

  const renderTable = (data: MergedRow[], title: string) => {
    if (!data || data.length === 0) return null;

    const keys = Object.keys(data[0]).filter(key => key !== '_source' && key !== '_matchType');
    
    return (
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3">{title}</h3>
        <div className="overflow-x-auto max-h-96 border rounded-lg">
          <table className="min-w-full bg-white text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {keys.slice(0, 6).map(key => (
                  <th key={key} className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                    {key}
                  </th>
                ))}
                {data[0]._source && (
                  <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                    Status
                  </th>
                )}
                {data[0]._matchType && (
                  <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                    Match Type
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 20).map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  {keys.slice(0, 6).map(key => (
                    <td key={key} className="px-3 py-2 text-gray-900 border-b">
                      {item[key] || '-'}
                    </td>
                  ))}
                  {item._source && (
                    <td className={`px-3 py-2 border-b text-xs font-medium ${
                      item._source === '03+01' ? 'text-green-600' : 'text-orange-600'
                    }`}>
                      {item._source}
                    </td>
                  )}
                  {item._matchType && (
                    <td className={`px-3 py-2 border-b text-xs font-medium ${
                      item._matchType === 'both-columns' ? 'text-purple-600' :
                      item._matchType === 'column1' ? 'text-blue-600' :
                      item._matchType === 'column2' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {item._matchType === 'both-columns' ? 'Both Columns' :
                       item._matchType === 'column1' ? 'Column 1' :
                       item._matchType === 'column2' ? 'Column 2' : 'No Match'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.length > 20 && (
          <p className="text-sm text-gray-500 mt-2">
            แสดง 20 รายการแรกจากทั้งหมด {data.length} รายการ
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Advanced Excel Merger Tool</h1>
        <p className="text-gray-600">รวมไฟล์ Excel โดยเลือกคอลัมน์และเงื่อนไขการจับคู่ได้</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-blue-50 p-6 rounded-lg border-2 border-dashed border-blue-200">
          <h2 className="text-xl font-semibold text-blue-800 mb-4">ไฟล์ (หลัก)</h2>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => handleFileUpload(e, '03')}
            className="w-full p-3 border border-blue-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
          />
          {file03Data && (
            <div className="mt-4 p-3 bg-blue-100 rounded-md mb-4">
              <p className="text-blue-800 font-medium">✓ อัปโหลดแล้ว: {file03Data.length} รายการ</p>
            </div>
          )}
          
          {file03Columns.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-blue-800">เลือกคอลัมน์ (2 คอลัมน์):</h3>
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-1">คอลัมน์ 1</label>
                <select
                  value={selectedFile03Cols[0]}
                  onChange={(e) => setSelectedFile03Cols([e.target.value, selectedFile03Cols[1]])}
                  className="w-full p-2 border border-blue-300 rounded-md bg-white"
                >
                  <option value="">เลือกคอลัมน์</option>
                  {file03Columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-700 mb-1">คอลัมน์ 2</label>
                <select
                  value={selectedFile03Cols[1]}
                  onChange={(e) => setSelectedFile03Cols([selectedFile03Cols[0], e.target.value])}
                  className="w-full p-2 border border-blue-300 rounded-md bg-white"
                >
                  <option value="">เลือกคอลัมน์</option>
                  {file03Columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="bg-green-50 p-6 rounded-lg border-2 border-dashed border-green-200">
          <h2 className="text-xl font-semibold text-green-800 mb-4">ไฟล์  (รอง)</h2>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => handleFileUpload(e, '01')}
            className="w-full p-3 border border-green-300 rounded-md bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 mb-4"
          />
          {file01Data && (
            <div className="mt-4 p-3 bg-green-100 rounded-md mb-4">
              <p className="text-green-800 font-medium">✓ อัปโหลดแล้ว: {file01Data.length} รายการ</p>
            </div>
          )}
          
          {file01Columns.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-green-800">เลือกคอลัมน์ (2 คอลัมน์):</h3>
              <div>
                <label className="block text-sm font-medium text-green-700 mb-1">คอลัมน์ 1</label>
                <select
                  value={selectedFile01Cols[0]}
                  onChange={(e) => setSelectedFile01Cols([e.target.value, selectedFile01Cols[1]])}
                  className="w-full p-2 border border-green-300 rounded-md bg-white"
                >
                  <option value="">เลือกคอลัมน์</option>
                  {file01Columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-green-700 mb-1">คอลัมน์ 2</label>
                <select
                  value={selectedFile01Cols[1]}
                  onChange={(e) => setSelectedFile01Cols([selectedFile01Cols[0], e.target.value])}
                  className="w-full p-2 border border-green-300 rounded-md bg-white"
                >
                  <option value="">เลือกคอลัมน์</option>
                  {file01Columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Matching Conditions */}
      {file03Columns.length > 0 && file01Columns.length > 0 && (
        <div className="bg-purple-50 p-6 rounded-lg border border-purple-200 mb-8">
          <h2 className="text-xl font-semibold text-purple-800 mb-4">เงื่อนไขการจับคู่</h2>
          <div className="space-y-4">
            {matchConditions.map(condition => (
              <div key={condition.id} className="bg-white p-4 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={condition.enabled}
                      onChange={(e) => updateMatchCondition(condition.id, 'enabled', e.target.checked)}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="font-medium text-gray-800">{condition.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-sm text-gray-600">ลำดับ:</label>
                    <input
                      type="number"
                      min="1"
                      max="3"
                      value={condition.priority}
                      onChange={(e) => updateMatchCondition(condition.id, 'priority', parseInt(e.target.value))}
                      className="w-16 p-1 border border-gray-300 rounded text-center"
                    />
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  {condition.id === 1 && 'จับคู่ทั้ง 2 คอลัมน์พร้อมกัน (แม่นยำสูงสุด)'}
                  {condition.id === 2 && 'จับคู่ด้วยคอลัมน์ที่ 1 เท่านั้น'}
                  {condition.id === 3 && 'จับคู่ด้วยคอลัมน์ที่ 2 เท่านั้น'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center mb-8">
        <button
          onClick={mergeData}
          disabled={!file03Data || !file01Data || loading}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold py-3 px-8 rounded-lg text-lg transition-colors duration-200 disabled:cursor-not-allowed"
        >
          {loading ? 'กำลังรวมไฟล์...' : 'รวมไฟล์'}
        </button>
      </div>

      {mergedData && mergeStats && (
        <div className="bg-gray-50 p-6 rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">ผลลัพธ์การรวม</h2>
            <button
              onClick={downloadMergedFile}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-md transition-colors duration-200"
            >
              ดาวน์โหลดไฟล์
            </button>
          </div>
          
          {/* สถิติการรวม */}
          <div className="mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
                <div className="text-2xl font-bold text-blue-600">{mergeStats.total03}</div>
                <div className="text-sm text-gray-600">รายการในไฟล์ 03</div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
                <div className="text-2xl font-bold text-green-600">{mergeStats.matched}</div>
                <div className="text-sm text-gray-600">จับคู่ได้ทั้งหมด</div>
                <div className="text-xs text-green-500 font-medium">{mergeStats.matchPercentage}%</div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
                <div className="text-2xl font-bold text-orange-600">{mergeStats.unmatched}</div>
                <div className="text-sm text-gray-600">จับคู่ไม่ได้</div>
                <div className="text-xs text-orange-500 font-medium">{(100 - parseFloat(mergeStats.matchPercentage)).toFixed(1)}%</div>
              </div>
              <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
                <div className="text-2xl font-bold text-gray-600">{mergeStats.unusedFrom01}</div>
                <div className="text-sm text-gray-600">ไม่ใช้จากไฟล์ 01</div>
              </div>
            </div>
            
            {/* รายละเอียดประเภทการ match */}
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">รายละเอียดการจับคู่</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-purple-600">{mergeStats.bothColumnsMatches}</div>
                  <div className="text-sm text-purple-600">ทั้ง 2 คอลัมน์</div>
                  <div className="text-xs text-gray-500">แม่นยำสูงสุด</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-600">{mergeStats.column1Matches}</div>
                  <div className="text-sm text-blue-600">คอลัมน์ 1</div>
                  <div className="text-xs text-gray-500">{selectedFile03Cols[0] || 'ไม่ได้เลือก'}</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600">{mergeStats.column2Matches}</div>
                  <div className="text-sm text-green-600">คอลัมน์ 2</div>
                  <div className="text-xs text-gray-500">{selectedFile03Cols[1] || 'ไม่ได้เลือก'}</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-red-600">{mergeStats.noMatches}</div>
                  <div className="text-sm text-red-600">ไม่มีการจับคู่</div>
                  <div className="text-xs text-gray-500">ไฟล์ 03 เท่านั้น</div>
                </div>
              </div>
            </div>
          </div>
          
          {renderTable(mergedData, `ข้อมูลที่รวมแล้ว (${mergedData.length} รายการ)`)}
        </div>
      )}

      <div className="mt-8 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
        <h3 className="font-semibold text-yellow-800 mb-2">วิธีการทำงาน:</h3>
        <ol className="text-yellow-700 space-y-1 text-sm">
          <li>1. เลือกคอลัมน์ที่ต้องการใช้ในการจับคู่ (ไฟล์ละ 2 คอลัมน์)</li>
          <li>2. ตั้งค่าเงื่อนไขการจับคู่และลำดับความสำคัญ</li>
          <li>3. 🟣 <strong>ทั้ง 2 คอลัมน์</strong> - จับคู่ทั้ง 2 คอลัมน์พร้อมกัน</li>
          <li>4. 🔵 <strong>คอลัมน์ 1</strong> - จับคู่ด้วยคอลัมน์แรกเท่านั้น</li>
          <li>5. 🟢 <strong>คอลัมน์ 2</strong> - จับคู่ด้วยคอลัมน์ที่สองเท่านั้น</li>
          <li>6. 🔴 <strong>ไม่มีการจับคู่</strong> - เก็บข้อมูลจากไฟล์ 03 เท่านั้น</li>
        </ol>
      </div>
    </div>
  );
};

export default ExcelMerger;