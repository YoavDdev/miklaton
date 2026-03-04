'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [role, setRole] = useState('operator');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const isAdmin = role === 'admin';
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          password: password, 
          adminPassword: isAdmin ? password : null 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        window.location.href = isAdmin ? '/admin' : '/operator';
      } else {
        setError(data.error || `סיסמת ${isAdmin ? 'מנהל' : 'מוקדן'} שגויה`);
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

        {error && (
          <div className="p-4 bg-red-50 border-r-4 border-red-500 rounded mb-6">
            <p className="text-red-800 font-semibold">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="role" className="block text-lg font-semibold text-gray-900 mb-2">
              תפקיד
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none bg-white"
            >
              <option value="operator">מוקדן</option>
              <option value="admin">מנהל</option>
            </select>
          </div>

          <div>
            <label htmlFor="password" className="block text-lg font-semibold text-gray-900 mb-2">
              סיסמה
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

          <button
            type="submit"
            disabled={loading}
            className={`w-full font-bold py-4 px-6 rounded-lg text-xl transition-colors ${
              role === 'admin' 
                ? 'bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400' 
                : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400'
            } text-white`}
          >
            {loading ? 'מתחבר...' : `כניסה ${role === 'admin' ? 'כמנהל' : 'כמוקדן'}`}
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
