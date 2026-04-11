import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata = {
  title: 'מקלטון - מערכת ניהול אירועי חירום',
  description: 'מערכת פנימית למוקד העירוני יהוד-מונוסון',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <body className="antialiased bg-gray-50">
        <Navbar />
        {children}
      </body>
    </html>
  );
}
