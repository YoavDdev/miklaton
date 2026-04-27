import './globals.css';
import ConditionalNavbar from '@/components/ConditionalNavbar';

export const metadata = {
  title: 'מקלטון - מערכת ניהול אירועי חירום',
  description: 'מערכת פנימית למוקד העירוני יהוד-מונוסון',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <body className="antialiased bg-gray-50">
        <ConditionalNavbar />
        {children}
      </body>
    </html>
  );
}
