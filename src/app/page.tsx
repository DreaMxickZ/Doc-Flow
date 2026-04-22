import ExcelButton from "@/app/components/ExcelButton";
import RunningButton from "./components/RunningButton";
import PDFButton from "@/app/components/PDFButton"; 



export default function HomePage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4 ">Excel</h1>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
             <ExcelButton href="/ExcelColumnSelector" label="เลือก Column และ เพิ่ม" />
             <ExcelButton href="/ExcelMerger" label="Merge Excel โดยใช้  Column" />
             <ExcelButton href="/ExcelSheetManager" label="จัดการ Sheet ใน Excel" />
              <ExcelButton href="/ExcelTextUpperLower" label="แปลงตัวอักษรเป็นตัวพิมพ์ใหญ่/เล็ก" />
              <ExcelButton href="/CSVExcelColumnCompare" label="ค้นหาและแทนที่ข้อความใน Excel" />
            </div>

      <h1 className="text-2xl font-bold mb-4 mt-10">PDF</h1>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
             <PDFButton href="/PDFMerger" label="Merge PDF" />
              <PDFButton href="/PDFsplit" label="Split PDF" />
              <PDFButton href="/Imagetopdf" label="แปลงรูปภาพเป็น PDF" />
            </div>


      <h1 className="text-2xl font-bold mb-4 mt-10">Runing</h1>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            
            </div>
    
      
    
           
     
    </div>
  );
}