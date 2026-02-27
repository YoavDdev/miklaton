'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminField, setShowAdminField] = useState(false);
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
        body: JSON.stringify({ password, adminPassword: showAdminField ? adminPassword : null }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.isAdmin) {
          window.location.href = '/admin';
        } else {
          window.location.href = '/operator';
        }
      } else {
        setError(data.error || 'שגיאה בהתחברות');
      }
    } catch (err) {
      setError('שגיאה בהתחברות לשרת');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">מקלטון</h1>
          <p className="text-gray-600">מערכת ניהול אירועי חירום</p>
          <p className="text-sm text-gray-500 mt-1">מוקד עירוני יהוד-מונוסון</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-lg font-semibold text-gray-900 mb-2">
              סיסמת מפעיל
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              placeholder="הזן סיסמה"
              autoComplete="current-password"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowAdminField(!showAdminField)}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              {showAdminField ? 'הסתר כניסה כאדמין' : 'כניסה כאדמין'}
            </button>
          </div>

          {showAdminField && (
            <div>
              <label htmlFor="adminPassword" className="block text-lg font-semibold text-gray-900 mb-2">
                סיסמת אדמין
              </label>
              <input
                id="adminPassword"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                placeholder="הזן סיסמת אדמין"
                autoComplete="off"
              />
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border-r-4 border-red-500 rounded">
              <p className="text-red-800 font-semibold">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-4 px-6 rounded-lg text-xl transition-colors"
          >
            {loading ? 'מתחבר...' : 'כניסה'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            מערכת זו מיועדת לשימוש פנימי בלבד
            <br />
            דורשת חיבור לאינטרנט
          </p>
        </div>
      </div>
    </div>
  );
}
