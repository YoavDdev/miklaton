'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { municipalityConfig } from '@/lib/municipality';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Detect Supabase recovery token in hash and redirect to reset-password page
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      router.replace('/reset-password' + hash);
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900 flex flex-col items-center justify-center p-4 sm:p-6" dir="rtl">
      <div className="w-full max-w-md sm:max-w-lg">
        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-10">
          {/* Logo & Title */}
          <div className="text-center mb-8 sm:mb-12">
            <div className="mb-4 sm:mb-6 flex justify-center">
              <img 
                src={municipalityConfig.logo} 
                alt={`לוגו ${municipalityConfig.name}`} 
                className="w-32 h-32 sm:w-40 sm:h-40 object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-300"
              />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3 sm:mb-4">{municipalityConfig.systemName}</h1>
            <div className="h-1 w-24 sm:w-32 bg-gradient-to-r from-blue-400 to-purple-400 mx-auto rounded-full mb-4 sm:mb-6"></div>
            <p className="text-blue-100 text-base sm:text-lg font-medium">{municipalityConfig.systemSubtitle}</p>
            <p className="text-blue-200 text-sm sm:text-base mt-2">{municipalityConfig.name}</p>
          </div>

          {/* Welcome Message */}
          <div className="bg-white/5 rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8 border border-white/10">
            <h2 className="text-white text-lg sm:text-xl font-bold mb-3">ברוכים הבאים למערכת 👋</h2>
            <p className="text-blue-100 text-sm sm:text-base leading-relaxed">
              מערכת מקלטון מאפשרת ניהול יעיל ומקצועי של אירועי חירום, תקלות ופעילות שוטפת במוקד העירוני.
              היכנסו למערכת כדי להתחיל לעבוד.
            </p>
          </div>

          {/* Login Button */}
          <button
            onClick={() => router.push('/login')}
            className="w-full py-4 sm:py-5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold text-lg sm:text-xl rounded-xl sm:rounded-2xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
          >
            <span className="text-2xl">🔐</span>
            כניסה למערכת
          </button>

          {/* Features List */}
          <div className="mt-8 sm:mt-10 space-y-3">
            <div className="flex items-center gap-3 text-blue-100 text-sm sm:text-base">
              <span className="text-xl sm:text-2xl">✅</span>
              <span>ניהול כוננויות ומשמרות</span>
            </div>
            <div className="flex items-center gap-3 text-blue-100 text-sm sm:text-base">
              <span className="text-xl sm:text-2xl">✅</span>
              <span>תיאום אירועי חירום</span>
            </div>
            <div className="flex items-center gap-3 text-blue-100 text-sm sm:text-base">
              <span className="text-xl sm:text-2xl">✅</span>
              <span>מעקב אחר תקלות ופניות</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 sm:mt-8">
          <p className="text-blue-200 text-xs sm:text-sm">
            © {new Date().getFullYear()} {municipalityConfig.name}
          </p>
          <p className="text-blue-300 text-[10px] sm:text-xs mt-2">
            מערכת מאובטחת ומוצפנת
          </p>
        </div>
      </div>
    </div>
  );
}
