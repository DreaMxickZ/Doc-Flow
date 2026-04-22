import "./globals.css";
import Navbar from "@/app/components/Navbar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        {/* Navbar ด้านบน */}
        <Navbar />

        {/* Content */}
        <main className="flex-1 p-6 bg-gray-50">
          {children}
        </main>
      </body>
    </html>
  );
}
