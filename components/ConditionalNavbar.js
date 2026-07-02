'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar';

export default function ConditionalNavbar() {
  const pathname = usePathname();
  
  // Don't show navbar on home page and screen page
  if (pathname === '/' || pathname === '/screen') {
    return null;
  }
  
  return <Navbar />;
}
