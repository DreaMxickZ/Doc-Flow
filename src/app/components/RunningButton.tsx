import { FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import {Scroll  }from "lucide-react";
interface ExcelButtonProps {
  label?: string;
  href: string; // route ที่จะไป
}

export default function RunningButton({ label = "ไปหน้า Excel", href }: ExcelButtonProps) {
  return (
    <Link
      href={href}
      className="
        flex items-center gap-2
        bg-amber-200 text-amber-800 font-medium
        px-4 py-2 rounded-xl shadow-md
        hover:bg-amber-300 hover:shadow-lg
        transition-all
      "
    >
      
      <Scroll className="w-5 h-5" />
      {label}
    </Link>
  );
}
