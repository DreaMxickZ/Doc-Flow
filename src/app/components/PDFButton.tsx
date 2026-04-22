import { FileSpreadsheet } from "lucide-react";
import Link from "next/link";

interface ExcelButtonProps {
  label?: string;
  href: string; // route ที่จะไป
}

export default function ExcelButton({ label = "ไปหน้า Excel", href }: ExcelButtonProps) {
  return (
    <Link
      href={href}
      className="
        flex items-center gap-2
        bg-red-200 text-red-800 font-medium
        px-4 py-2 rounded-xl shadow-md
        hover:bg-red-300 hover:shadow-lg
        transition-all
      "
    >
      <FileSpreadsheet className="w-5 h-5" />
      {label}
    </Link>
  );
}
