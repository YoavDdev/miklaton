'use client';

import { useRouter } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import CityWorksManager from '@/components/CityWorksManager';

/**
 * עבודות בעיר מאזור האדמין.
 *
 * אותו רכיב ואותה רשימה (report_projects) שמנוהלים מקונסולת האחמ"ש - לא
 * עותק מקביל. מה שמתעדכן כאן מופיע מיד גם על מסך המוקד ובדוח היומי.
 */
export default function AdminCityWorksPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Toaster position="top-center" />

      <header className="bg-gradient-to-l from-amber-700 to-amber-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => router.push('/admin')}
            className="text-white/70 hover:text-white transition-colors"
          >
            ← חזור
          </button>
          <h1 className="text-xl font-bold">🚧 עבודות בעיר</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <p className="text-sm text-gray-500 mb-4">
          אותה רשימה שמנוהלת מקונסולת האחמ״ש. עבודה שתאריך הסיום שלה עבר נעלמת
          מעצמה למחרת ואינה מוצגת כאן.
        </p>
        <CityWorksManager />
      </main>
    </div>
  );
}
