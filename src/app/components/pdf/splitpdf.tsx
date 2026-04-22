import React, { useState, useCallback } from 'react';
import { Upload, FileText, Download, Eye, EyeOff, Trash2, Check } from 'lucide-react';

// Declare window properties for TypeScript
declare global {
  interface Window {
    pdfjsLib: any;
    PDFLib: any;
  }
}

interface PageInfo {
  pageNumber: number;
  selected: boolean;
}

const PDFSplitter = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [previewUrls, setPreviewUrls] = useState<Record<number, string>>({});

  // โหลด PDF.js library
  const loadPDFJS = async () => {
    if (window.pdfjsLib) return window.pdfjsLib;
    
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      document.head.appendChild(script);
    });
  };

  // โหลด PDF-lib library
  const loadPDFLib = async () => {
    if (window.PDFLib) return window.PDFLib;
    
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
      script.onload = () => resolve(window.PDFLib);
      document.head.appendChild(script);
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      alert('กรุณาเลือกไฟล์ PDF');
      return;
    }

    setIsLoading(true);
    setPdfFile(file);
    setSelectedPages(new Set());
    setPages([]);
    setPreviewUrls({});

    try {
      const pdfjsLib = await loadPDFJS();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      
      const pageList: PageInfo[] = [];
      const newPreviewUrls: Record<number, string> = {};
      
      // สร้าง preview ทุกหน้าเลย
      for (let i = 1; i <= pdf.numPages; i++) {
        pageList.push({
          pageNumber: i,
          selected: false
        });
        
        // สร้าง preview แต่ละหน้า
        try {
          const page = await pdf.getPage(i);
          const scale = 0.5;
          const viewport = page.getViewport({ scale });
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;
          
          newPreviewUrls[i] = canvas.toDataURL();
        } catch (pageError) {
          console.error(`Error rendering page ${i}:`, pageError);
        }
      }
      
      setPages(pageList);
      setPreviewUrls(newPreviewUrls);
    } catch (error) {
      console.error('Error loading PDF:', error);
      alert('เกิดข้อผิดพลาดในการโหลด PDF');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePageSelection = (pageNum: number) => {
    const newSelected = new Set(selectedPages);
    if (newSelected.has(pageNum)) {
      newSelected.delete(pageNum);
    } else {
      newSelected.add(pageNum);
    }
    setSelectedPages(newSelected);
  };

  const selectAllPages = () => {
    const allPages = new Set(pages.map(p => p.pageNumber));
    setSelectedPages(allPages);
  };

  const clearSelection = () => {
    setSelectedPages(new Set<number>());
  };

  const downloadSelectedPages = async () => {
    if (selectedPages.size === 0) {
      alert('กรุณาเลือกหน้าที่ต้องการ');
      return;
    }

    if (!pdfFile) {
      alert('ไม่พบไฟล์ PDF');
      return;
    }

    setIsLoading(true);

    try {
      const PDFLib = await loadPDFLib();
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
      const newPdfDoc = await PDFLib.PDFDocument.create();

      // เรียงลำดับหน้าที่เลือก
      const sortedPages = Array.from(selectedPages).sort((a, b) => a - b);
      
      for (const pageNum of sortedPages) {
        const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageNum - 1]);
        newPdfDoc.addPage(copiedPage);
      }

      const pdfBytes = await newPdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `selected_pages_${pdfFile.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Error creating PDF:', error);
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF');
    } finally {
      setIsLoading(false);
    }
  };

  const resetAll = () => {
    setPdfFile(null);
    setPages([]);
    setSelectedPages(new Set<number>());
    setPreviewUrls({});
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">
            PDF Splitter & Merger
          </h1>
          <p className="text-gray-600 text-center mb-6">
            อัพโหลด PDF เลือกหน้าที่ต้องการ และดาวน์โหลดไฟล์ใหม่
          </p>

          {/* File Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center mb-6 hover:border-blue-400 transition-colors">
            <input
              id="file-input"
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              htmlFor="file-input"
              className="cursor-pointer flex flex-col items-center"
            >
              <Upload className="w-12 h-12 text-gray-400 mb-4" />
              <span className="text-lg text-gray-600 mb-2">
                {pdfFile ? pdfFile.name : 'คลิกเพื่อเลือกไฟล์ PDF'}
              </span>
              <span className="text-sm text-gray-400">
                รองรับไฟล์ PDF เท่านั้น
              </span>
            </label>
          </div>

          {/* Controls */}
          {pages.length > 0 && (
            <div className="flex flex-wrap gap-4 items-center justify-between mb-6 p-4 bg-gray-50 rounded-xl">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={selectAllPages}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  เลือกทั้งหมด
                </button>
                <button
                  onClick={clearSelection}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
                >
                  <EyeOff className="w-4 h-4" />
                  ยกเลิกทั้งหมด
                </button>
                <button
                  onClick={resetAll}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  รีเซ็ต
                </button>
              </div>
              
              <div className="flex items-center gap-4">
                <span className="text-gray-600">
                  เลือก {selectedPages.size} จาก {pages.length} หน้า
                </span>
                <button
                  onClick={downloadSelectedPages}
                  disabled={selectedPages.size === 0 || isLoading}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {isLoading ? 'กำลังสร้างไฟล์...' : 'ดาวน์โหลด'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Pages Grid */}
        {pages.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {pages.map((page) => (
              <PageCard
                key={page.pageNumber}
                pageNumber={page.pageNumber}
                isSelected={selectedPages.has(page.pageNumber)}
                onToggle={() => togglePageSelection(page.pageNumber)}
                previewUrl={previewUrls[page.pageNumber]}
              />
            ))}
          </div>
        )}

          {/* Loading Overlay */}
        {isLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-10 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 text-center max-w-sm mx-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600 text-lg font-medium mb-2">กำลังประมวลผล PDF</p>
              <p className="text-gray-500 text-sm">กำลังสร้าง Preview ทุกหน้า...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface PageCardProps {
  pageNumber: number;
  isSelected: boolean;
  onToggle: () => void;
  previewUrl?: string;
}

const PageCard: React.FC<PageCardProps> = ({ pageNumber, isSelected, onToggle, previewUrl }) => {
  return (
    <div
      className={`relative bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-xl transform hover:scale-105 ${
        isSelected ? 'ring-4 ring-blue-500' : 'hover:ring-2 hover:ring-gray-300'
      }`}
      onClick={onToggle}
    >
      {/* Selection Indicator */}
      <div className="absolute top-3 right-3 z-10">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition-all ${
          isSelected ? 'bg-blue-500 text-white scale-110' : 'bg-white border-2 border-gray-300 hover:border-blue-400'
        }`}>
          {isSelected && <Check className="w-4 h-4" />}
        </div>
      </div>

      {/* Page Preview */}
      <div className="aspect-[3/4] flex items-center justify-center bg-gray-50">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={`Page ${pageNumber}`}
            className="max-w-full max-h-full object-contain rounded-t-xl"
          />
        ) : (
          <div className="flex flex-col items-center text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
            <span className="text-xs">กำลังโหลด...</span>
          </div>
        )}
      </div>

      {/* Page Number */}
      <div className="p-3 text-center bg-white">
        <span className={`text-sm font-semibold ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
          หน้า {pageNumber}
        </span>
      </div>
    </div>
  );
};

export default PDFSplitter;