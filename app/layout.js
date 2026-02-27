import './globals.css';

export const metadata = {
  title: 'מקלטון - מערכת ניהול אירועי חירום',
  description: 'מערכת פנימית למוקד העירוני יהוד-מונוסון',
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <body className="antialiased bg-gray-50">{children}</body>
    </html>
  );
}
