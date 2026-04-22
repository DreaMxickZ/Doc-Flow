import Link from 'next/link'; 
export default function Navbar() {
  return (
    <nav className="w-full bg-gray-900 text-white px-6 py-3 flex items-center justify-between shadow-md">
      {/* โลโก้ */}

      <Link href="/">
        <h1 className="text-lg font-bold cursor-pointer">Docflow</h1>
      </Link>
     

      {/* เมนู */}
      <ul className="flex gap-6">
        {/* <li className="hover:underline cursor-pointer">Login</li> */}
        
      </ul>
    </nav>
  );
}
