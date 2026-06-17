'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { municipalityConfig } from '@/lib/municipality';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email,
          password
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Save user info to localStorage for navbar and other components
        if (data.user) {
          localStorage.setItem('userId', data.user.id);
          localStorage.setItem('email', data.user.email);
          localStorage.setItem('full_name', data.user.fullName || '');
          localStorage.setItem('role', data.user.role);
          localStorage.setItem('username', data.user.fullName || data.user.email?.split('@')[0] || '');
        }
        // redirect לפי מה שה-API החזיר
        window.location.href = data.redirect || '/operator';
      } else {
        setError(data.error || 'שגיאה בהתחברות');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('שגיאה בהתחברות לשרת');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900 flex items-center justify-center p-4 sm:p-6" dir="rtl">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-10 w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="mb-3 sm:mb-4 flex justify-center">
            <img 
              src={municipalityConfig.logo} 
              alt={`לוגו ${municipalityConfig.name}`} 
              className="w-28 h-28 sm:w-32 sm:h-32 object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-300"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 sm:mb-3">{municipalityConfig.systemName}</h1>
          <div className="h-1 w-20 sm:w-24 bg-gradient-to-r from-blue-400 to-purple-400 mx-auto rounded-full mb-3 sm:mb-4"></div>
          <p className="text-blue-100 text-sm sm:text-base">{municipalityConfig.systemSubtitle}</p>
          <p className="text-blue-200 text-xs sm:text-sm mt-1">{municipalityConfig.name}</p>
        </div>

        {error && (
          <div className="p-3 sm:p-4 bg-red-500/20 backdrop-blur-sm border border-red-400/50 rounded-lg mb-4 sm:mb-6">
            <p className="text-red-100 font-semibold text-sm sm:text-base">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
          <div>
            <label htmlFor="email" className="block text-base sm:text-lg font-semibold text-white mb-2">
              📧 אימייל
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-base sm:text-lg border-2 border-white/30 bg-white/10 backdrop-blur-sm text-white placeholder-blue-200 rounded-lg focus:border-purple-400 focus:bg-white/20 focus:outline-none transition-all"
              placeholder="your.name@example.com"
              autoComplete="email"
              dir="ltr"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-base sm:text-lg font-semibold text-white mb-2">
              🔐 סיסמה
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-base sm:text-lg border-2 border-white/30 bg-white/10 backdrop-blur-sm text-white placeholder-blue-200 rounded-lg focus:border-purple-400 focus:bg-white/20 focus:outline-none transition-all"
              placeholder="הזן סיסמה"
              autoComplete="current-password"
              dir="ltr"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full font-bold py-3 sm:py-4 px-6 rounded-xl text-lg sm:text-xl transition-all duration-300 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-500 disabled:to-gray-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 disabled:hover:scale-100"
          >
            {loading ? '⏳ מתחבר...' : '🔐 כניסה למערכת'}
          </button>
        </form>

        <div className="mt-5 sm:mt-6 text-center space-y-2">
          <p className="text-sm sm:text-base text-blue-100">
            אין לך חשבון?{' '}
            <a href="/register" className="font-bold text-purple-300 hover:text-purple-200 underline">
              הירשם כאן
            </a>
          </p>
          <p className="text-xs sm:text-sm text-blue-200">
            שכחת סיסמה? פנה למנהל המערכת
          </p>
        </div>

        <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-white/20">
          <p className="text-[10px] sm:text-xs text-blue-200 text-center leading-relaxed">
            מערכת זו מיועדת לשימוש פנימי בלבד
            <br />
            דורשת חיבור לאינטרנט • מאובטחת ומוצפנת 🔒
          </p>
        </div>
      </div>
    </div>
  );
}
