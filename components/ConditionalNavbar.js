'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar';

/**
 * הניווט הראשי מוצג רק במסכים הפנימיים.
 *
 * דפים שנפתחים מקישור חתום נצרכים על ידי אנשים שאינם מחוברים - מנהל מכלול
 * שקיבל קישור בוואטסאפ, אורח באירוע, תושב שממלא סקר. ניווט שמצביע על אזורים
 * שאין להם גישה אליהם רק מבלבל, ובמקרים מסוימים אף מציג שם משתמש ישן שנשמר
 * מקומית בדפדפן.
 */
const PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/reset-password',
  '/event/live/',
  '/event/join/',
  '/survey/',
  '/duty-form/',
  '/schedule-upload/',
];

const EXACT_HIDDEN = ['/', '/screen'];

export default function ConditionalNavbar() {
  const pathname = usePathname();

  if (EXACT_HIDDEN.includes(pathname)) return null;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return <Navbar />;
}
