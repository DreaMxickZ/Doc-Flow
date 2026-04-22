"use client";

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from "react";

// ── Types ──────────────────────────────────────────────────────
interface ImageItem {
  id: string;
  file: File;
  preview: string;
  name: string;
  size: string;
}

interface Dimensions {
  w: number;
  h: number;
}

interface JsPDFInstance {
  addPage: (format: [number, number], orientation: string) => void;
  addImage: (
    data: string,
    format: string,
    x: number,
    y: number,
    w: number,
    h: number,
    alias: undefined,
    compression: string
  ) => void;
  save: (filename: string) => void;
}

declare global {
  interface Window {
    jspdf?: { jsPDF: new (opts: object) => JsPDFInstance };
  }
}

// ── Helpers ────────────────────────────────────────────────────
async function getJsPDF(): Promise<new (opts: object) => JsPDFInstance> {
  if (typeof window !== "undefined" && window.jspdf) return window.jspdf.jsPDF;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return window.jspdf!.jsPDF;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => res(e.target!.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function getImageDimensions(dataUrl: string): Promise<Dimensions> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = dataUrl;
  });
}

// ── Component ──────────────────────────────────────────────────
export default function ImageToPDF() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [dropzoneActive, setDropzoneActive] = useState(false);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [previewImage, setPreviewImage] = useState<ImageItem | null>(null);

  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropCounter = useRef(0);

  // ── Add files ──────────────────────────────────────────────
  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const valid = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"];
    const next: ImageItem[] = Array.from(files)
      .filter((f) => valid.includes(f.type))
      .map((file) => ({
        id: Math.random().toString(36).slice(2),
        file,
        preview: URL.createObjectURL(file),
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB",
      }));
    if (!next.length) return;
    setImages((prev) => [...prev, ...next]);
    setDone(false);
  }, []);

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  // ── Dropzone (upload) ──────────────────────────────────────
  const onZoneDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dropCounter.current++;
    setDropzoneActive(true);
  };
  const onZoneDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dropCounter.current--;
    if (dropCounter.current === 0) setDropzoneActive(false);
  };
  const onZoneDragOver = (e: DragEvent<HTMLDivElement>) => e.preventDefault();
  const onZoneDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dropCounter.current = 0;
    setDropzoneActive(false);
    addFiles(e.dataTransfer.files);
  };

  // ── Remove / clear ─────────────────────────────────────────
  const removeImage = (id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter((i) => i.id !== id);
    });
    setDone(false);
  };
  const clearAll = () => {
    images.forEach((i) => URL.revokeObjectURL(i.preview));
    setImages([]);
    setDone(false);
  };

  // ── Drag-to-reorder ────────────────────────────────────────
  const onCardDragStart = (e: DragEvent<HTMLDivElement>, idx: number) => {
    dragIndex.current = idx;
    e.dataTransfer.effectAllowed = "move";
  };
  const onCardDragEnter = (e: DragEvent<HTMLDivElement>, idx: number) => {
    e.preventDefault();
    if (dragIndex.current !== idx) setDragOver(idx);
  };
  const onCardDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onCardDrop = (e: DragEvent<HTMLDivElement>, idx: number) => {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === idx) return;
    setImages((prev) => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(idx, 0, item);
      return arr;
    });
    dragIndex.current = null;
    setDragOver(null);
    setDone(false);
  };
  const onCardDragEnd = () => {
    dragIndex.current = null;
    setDragOver(null);
  };

  // ── Convert to PDF ─────────────────────────────────────────
  const convertToPDF = async () => {
    if (!images.length) return;
    setConverting(true);
    setProgress(0);
    setDone(false);
    try {
      const JsPDF = await getJsPDF();
      let pdf: JsPDFInstance | null = null;

      for (let i = 0; i < images.length; i++) {
        setProgress(Math.round((i / images.length) * 90));
        const dataUrl = await readFileAsDataUrl(images[i].file);
        const { w, h } = await getImageDimensions(dataUrl);
        const pxToMm = 25.4 / 96;
        const pw = w * pxToMm;
        const ph = h * pxToMm;
        const orientation = w >= h ? "l" : "p";
        if (i === 0) {
          pdf = new JsPDF({ orientation, unit: "mm", format: [pw, ph] });
        } else {
          pdf!.addPage([pw, ph], orientation);
        }
        pdf!.addImage(
          dataUrl,
          images[i].file.type === "image/png" ? "PNG" : "JPEG",
          0, 0, pw, ph,
          undefined,
          "FAST"
        );
      }
      setProgress(95);
      pdf!.save("images.pdf");
      setProgress(100);
      setDone(true);
    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + (err as Error).message);
    } finally {
      setConverting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">รูปภาพ → PDF</h1>
          <p className="text-sm text-gray-500 mt-1">
            อัปโหลดรูปหลายรูป จัดลำดับด้วยการลาก แล้วแปลงเป็น PDF — ทำงานในเบราว์เซอร์ ไม่ส่งข้อมูลขึ้น server
          </p>
        </div>

        {/* Drop Zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={onZoneDragEnter}
          onDragLeave={onZoneDragLeave}
          onDragOver={onZoneDragOver}
          onDrop={onZoneDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            dropzoneActive
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/40"
          }`}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-700">
                วางรูปภาพที่นี่ หรือ{" "}
                <span className="text-blue-500 underline">คลิกเพื่อเลือก</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP, GIF, BMP</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onFileInput}
          />
        </div>

        {/* Image Grid */}
        {images.length > 0 && (
          <div className="mt-8">

            {/* Toolbar */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-700">
                {images.length} รูป{" "}
                <span className="text-gray-400 font-normal text-xs">— ลากการ์ดเพื่อเรียงลำดับ</span>
              </p>
              <div className="flex items-center gap-4">
                <button onClick={() => fileInputRef.current?.click()} className="text-sm text-blue-600 hover:underline">
                  + เพิ่มรูป
                </button>
                <button onClick={clearAll} className="text-sm text-red-500 hover:underline">
                  ล้างทั้งหมด
                </button>
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {images.map((img, idx) => (
                <div
                  key={img.id}
                  draggable
                  onDragStart={(e) => onCardDragStart(e, idx)}
                  onDragEnter={(e) => onCardDragEnter(e, idx)}
                  onDragOver={onCardDragOver}
                  onDragLeave={() => {}}
                  onDrop={(e) => onCardDrop(e, idx)}
                  onDragEnd={onCardDragEnd}
                  className={`group relative bg-white rounded-xl border-2 overflow-hidden transition-all duration-150
                    cursor-grab active:cursor-grabbing select-none ${
                      dragOver === idx
                        ? "border-blue-500 scale-105 shadow-xl ring-2 ring-blue-300"
                        : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                    }`}
                >
                  {/* Thumbnail */}
                  <div className="aspect-square overflow-hidden bg-gray-100">
                    <img
                      src={img.preview}
                      alt={img.name}
                      draggable={false}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                  </div>

                  {/* Page badge */}
                  <span className="absolute top-2 left-2 bg-black/60 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                    {idx + 1}
                  </span>

                  {/* Drag handle */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-white/90 rounded-md p-1 shadow">
                      <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 6a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm8-16a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4z" />
                      </svg>
                    </div>
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  <div className="absolute bottom-10 inset-x-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); setPreviewImage(img); }}
                      className="bg-white hover:bg-blue-500 hover:text-white text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg shadow-md transition-colors"
                    >
                      ดูรูป
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                      className="bg-white hover:bg-red-500 hover:text-white text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg shadow-md transition-colors"
                    >
                      ลบ
                    </button>
                  </div>

                  {/* File info */}
                  <div className="px-2.5 py-2 border-t border-gray-100">
                    <p className="text-xs text-gray-600 truncate font-medium">{img.name}</p>
                    <p className="text-xs text-gray-400">{img.size}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Convert bar */}
            <div className="mt-6 bg-white border border-gray-200 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-gray-800 text-sm">
                  พร้อมแปลง {images.length} รูป เป็น PDF
                </p>
                <p className="text-xs text-gray-400 mt-0.5">แต่ละรูปจะเป็น 1 หน้า • ขนาดหน้าตามรูปต้นฉบับ</p>
              </div>
              <button
                onClick={convertToPDF}
                disabled={converting}
                className="shrink-0 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                {converting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    กำลังแปลง...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    ดาวน์โหลด PDF
                  </>
                )}
              </button>
            </div>

            {/* Progress */}
            {converting && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>กำลังประมวลผล...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Success */}
            {done && (
              <div className="mt-4 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                ดาวน์โหลด PDF สำเร็จแล้ว!
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImage.preview}
              alt={previewImage.name}
              className="w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
            />
            <div className="mt-3 flex items-center justify-between px-1">
              <p className="text-white/70 text-sm truncate">
                {previewImage.name} — {previewImage.size}
              </p>
              <button
                onClick={() => setPreviewImage(null)}
                className="ml-4 shrink-0 text-white/60 hover:text-white text-sm border border-white/30 hover:border-white/60 px-3 py-1 rounded-lg transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
