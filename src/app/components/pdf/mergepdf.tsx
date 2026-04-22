'use client';
import React, { useState, useCallback} from 'react';
import { Upload, FileText, Download, Trash2, ArrowUpDown, X, Eye, ZoomIn } from 'lucide-react';

interface PDFFile {
  id: string;
  file: File;
  name: string;
  size: number;
  preview?: string;
  pageCount?: number;
}

// Extend Window interface for PDF.js
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

export default function PDFMerger() {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mergedPdfUrl, setMergedPdfUrl] = useState<string | null>(null);
  const [previewModal, setPreviewModal] = useState<{ isOpen: boolean; fileId: string | null }>({
    isOpen: false,
    fileId: null
  });
  const [loadingPreviews, setLoadingPreviews] = useState<Set<string>>(new Set());

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const generatePreview = async (file: File): Promise<{ preview: string; pageCount: number }> => {
    try {
      // Load PDF.js from CDN if not already loaded
      if (!window.pdfjsLib) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        document.head.appendChild(script);
        
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
        });
        
        // Set worker source
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      // Get first page for preview
      const page = await pdf.getPage(1);
      const scale = 1;
      const viewport = page.getViewport({ scale });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: context!,
        viewport: viewport
      }).promise;
      
      const preview = canvas.toDataURL('image/jpeg', 0.8);
      return { preview, pageCount: pdf.numPages };
    } catch (error) {
      console.error('Error generating preview:', error);
      return { preview: '', pageCount: 0 };
    }
  };

  const addFiles = async (newFiles: File[]) => {
    const pdfFiles = newFiles.filter(file => file.type === 'application/pdf');
    
    const fileObjects: PDFFile[] = pdfFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size
    }));

    setFiles(prev => [...prev, ...fileObjects]);

    // Generate previews for each file
    for (const fileObj of fileObjects) {
      setLoadingPreviews(prev => new Set([...prev, fileObj.id]));
      
      const { preview, pageCount } = await generatePreview(fileObj.file);
      
      setFiles(prev => prev.map(f => 
        f.id === fileObj.id 
          ? { ...f, preview, pageCount }
          : f
      ));
      
      setLoadingPreviews(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileObj.id);
        return newSet;
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(file => file.id !== id));
    setLoadingPreviews(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const moveFile = (id: string, direction: 'up' | 'down') => {
    setFiles(prev => {
      const index = prev.findIndex(file => file.id === id);
      if (index === -1) return prev;
      
      const newFiles = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      
      if (targetIndex < 0 || targetIndex >= newFiles.length) return prev;
      
      [newFiles[index], newFiles[targetIndex]] = [newFiles[targetIndex], newFiles[index]];
      return newFiles;
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const mergePDFs = async () => {
    if (files.length < 2) {
      alert('กรุณาเลือกไฟล์ PDF อย่างน้อย 2 ไฟล์เพื่อรวมกัน');
      return;
    }

    setIsProcessing(true);
    
    try {
      // Import PDF-lib dynamically
      const { PDFDocument } = await import('pdf-lib');
      
      const mergedPdf = await PDFDocument.create();
      
      for (const fileObj of files) {
        const arrayBuffer = await fileObj.file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }
      
      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      setMergedPdfUrl(url);
    } catch (error) {
      console.error('Error merging PDFs:', error);
      alert('เกิดข้อผิดพลาดในการรวมไฟล์ PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadMergedPDF = () => {
    if (!mergedPdfUrl) return;
    
    const link = document.createElement('a');
    link.href = mergedPdfUrl;
    link.download = 'merged-document.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearAll = () => {
    setFiles([]);
    setLoadingPreviews(new Set());
    if (mergedPdfUrl) {
      URL.revokeObjectURL(mergedPdfUrl);
      setMergedPdfUrl(null);
    }
  };

  const openPreview = (fileId: string) => {
    setPreviewModal({ isOpen: true, fileId });
  };

  const closePreview = () => {
    setPreviewModal({ isOpen: false, fileId: null });
  };

  const previewFile = files.find(f => f.id === previewModal.fileId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-xl p-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">
            PDF Merger System
          </h1>
          <p className="text-gray-600 text-center mb-8">
            อัพโหลดไฟล์ PDF พร้อม preview หน้าแรกของแต่ละไฟล์
          </p>

          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์
            </h3>
            <p className="text-gray-500 mb-4">รองรับเฉพาะไฟล์ PDF เท่านั้น</p>
            <input
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium cursor-pointer hover:bg-blue-700 transition-colors"
            >
              เลือกไฟล์ PDF
            </label>
          </div>

          {/* File List with Previews */}
          {files.length > 0 && (
            <div className="mt-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-800">
                  ไฟล์ที่เลือก ({files.length} ไฟล์)
                </h3>
                <button
                  onClick={clearAll}
                  className="text-red-600 hover:text-red-800 font-medium"
                >
                  ลบทั้งหมด
                </button>
              </div>
              
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {files.map((file, index) => (
                  <div
                    key={file.id}
                    className="bg-gray-50 rounded-lg border overflow-hidden hover:shadow-md transition-shadow"
                  >
                    {/* Preview Section */}
                    <div className="relative h-48 bg-gray-100 flex items-center justify-center">
                      {loadingPreviews.has(file.id) ? (
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                          <span className="text-sm text-gray-500">กำลังโหลด preview...</span>
                        </div>
                      ) : file.preview ? (
                        <div className="relative w-full h-full">
                          <img
                            src={file.preview}
                            alt={`Preview of ${file.name}`}
                            className="w-full h-full object-contain cursor-pointer"
                            onClick={() => openPreview(file.id)}
                          />
                          <button
                            onClick={() => openPreview(file.id)}
                            className="absolute top-2 right-2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-opacity"
                            title="ดู preview แบบใหญ่"
                          >
                            <ZoomIn className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-gray-400">
                          <FileText className="w-12 h-12 mb-2" />
                          <span className="text-sm">ไม่สามารถแสดง preview ได้</span>
                        </div>
                      )}
                      
                      {/* File Order Badge */}
                      <div className="absolute top-2 left-2 bg-blue-600 text-white px-2 py-1 rounded-full text-sm font-medium">
                        #{index + 1}
                      </div>
                    </div>

                    {/* File Info Section */}
                    <div className="p-4">
                      <h4 className="font-medium text-gray-800 mb-1 truncate" title={file.name}>
                        {file.name}
                      </h4>
                      <div className="flex justify-between items-center text-sm text-gray-500 mb-3">
                        <span>{formatFileSize(file.size)}</span>
                        {file.pageCount && (
                          <span>{file.pageCount} หน้า</span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => moveFile(file.id, 'up')}
                            disabled={index === 0}
                            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                            title="ย้ายขึ้น"
                          >
                            <ArrowUpDown className="w-4 h-4 rotate-180" />
                          </button>
                          <button
                            onClick={() => moveFile(file.id, 'down')}
                            disabled={index === files.length - 1}
                            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                            title="ย้ายลง"
                          >
                            <ArrowUpDown className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          {file.preview && (
                            <button
                              onClick={() => openPreview(file.id)}
                              className="p-2 text-blue-400 hover:text-blue-600 rounded"
                              title="ดู preview"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => removeFile(file.id)}
                            className="p-2 text-red-400 hover:text-red-600 rounded"
                            title="ลบไฟล์"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Merge Button */}
          {files.length > 1 && (
            <div className="mt-8 text-center">
              <button
                onClick={mergePDFs}
                disabled={isProcessing || loadingPreviews.size > 0}
                className={`px-8 py-3 rounded-lg font-medium text-white text-lg ${
                  isProcessing || loadingPreviews.size > 0
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                } transition-colors`}
              >
                {isProcessing ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>กำลังรวมไฟล์...</span>
                  </div>
                ) : loadingPreviews.size > 0 ? (
                  `กำลังโหลด preview (${loadingPreviews.size} ไฟล์)`
                ) : (
                  `รวมไฟล์ PDF (${files.length} ไฟล์)`
                )}
              </button>
            </div>
          )}

          {/* Download Section */}
          {mergedPdfUrl && (
            <div className="mt-8 p-6 bg-green-50 rounded-lg border border-green-200">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-green-800 mb-2">
                  รวมไฟล์สำเร็จ!
                </h3>
                <p className="text-green-600 mb-4">
                  ไฟล์ PDF ถูกรวมเรียบร้อยแล้ว
                </p>
                <button
                  onClick={downloadMergedPDF}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors inline-flex items-center space-x-2"
                >
                  <Download className="w-5 h-5" />
                  <span>ดาวน์โหลดไฟล์ที่รวมแล้ว</span>
                </button>
              </div>
            </div>
          )}

          {/* Preview Modal */}
          {previewModal.isOpen && previewFile && previewFile.preview && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg max-w-4xl max-h-full overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b">
                  <div>
                    <h3 className="text-lg font-semibold">{previewFile.name}</h3>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(previewFile.size)} • {previewFile.pageCount} หน้า
                    </p>
                  </div>
                  <button
                    onClick={closePreview}
                    className="p-2 hover:bg-gray-100 rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4 max-h-96 overflow-auto">
                  <img
                    src={previewFile.preview}
                    alt={`Preview of ${previewFile.name}`}
                    className="max-w-full h-auto mx-auto"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}