'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isForced, setIsForced] = useState(false);

  useEffect(() => {
    // בדיקה אם זה שינוי מאולץ או רצוני
    const params = new URLSearchParams(window.location.search);
    setIsForced(params.get('forced') === 'true');
  }, []);

  const validatePassword = () => {
    const newErrors = [];

    if (!oldPassword) {
      newErrors.push(isForced ? 'נא להזין את הסיסמה הזמנית שקיבלת' : 'נא להזין את הסיסמה הנוכחית');
    }

    if (!newPassword || newPassword.length < 8) {
      newErrors.push('הסיסמה החדשה חייבת להכיל לפחות 8 תווים');
    }

    if (!/[A-Z]/.test(newPassword)) {
      newErrors.push('הסיסמה חייבת להכיל לפחות אות גדולה אחת באנגלית');
    }

    if (!/[a-z]/.test(newPassword)) {
      newErrors.push('הסיסמה חייבת להכיל לפחות אות קטנה אחת באנגלית');
    }

    if (!/[0-9]/.test(newPassword)) {
      newErrors.push('הסיסמה חייבת להכיל לפחות ספרה אחת');
    }

    if (newPassword !== confirmPassword) {
      newErrors.push('הסיסמאות אינן תואמות');
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validatePassword();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    setErrors([]);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          oldPassword,
          newPassword
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors([data.error || 'שגיאה בשינוי סיסמה']);
        if (data.details) {
          setErrors(prev => [...prev, ...data.details]);
        }
        return;
      }

      // הצלחה - redirect לדף הבית
      alert('הסיסמה שונתה בהצלחה!');
      window.location.href = '/operator';

    } catch (error) {
      console.error('Change password error:', error);
      setErrors(['שגיאה בתקשורת עם השרת']);
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = () => {
    if (!newPassword) return { strength: 0, label: '', color: '' };
    
    let strength = 0;
    if (newPassword.length >= 8) strength++;
    if (/[A-Z]/.test(newPassword)) strength++;
    if (/[a-z]/.test(newPassword)) strength++;
    if (/[0-9]/.test(newPassword)) strength++;
    if (/[!@#$%^&*]/.test(newPassword)) strength++;

    if (strength <= 2) return { strength, label: 'חלשה', color: 'bg-red-500' };
    if (strength === 3) return { strength, label: 'בינונית', color: 'bg-yellow-500' };
    if (strength === 4) return { strength, label: 'חזקה', color: 'bg-green-500' };
    return { strength, label: 'חזקה מאוד', color: 'bg-green-600' };
  };

  const passwordStrength = getPasswordStrength();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8" dir="rtl">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            {isForced ? (
              <>
                <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">שינוי סיסמה נדרש</h1>
                <p className="mt-2 text-sm text-gray-600">
                  עליך להחליף את הסיסמה הזמנית שקיבלת
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-900">שינוי סיסמה</h1>
                <p className="mt-2 text-sm text-gray-600">
                  הגדרת סיסמה חדשה לחשבון שלך
                </p>
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Old Password — באיפוס זו הסיסמה הזמנית שנשלחה למשתמש */}
            <div>
              <label htmlFor="oldPassword" className="block text-sm font-medium text-gray-700 mb-1">
                {isForced ? 'הסיסמה הזמנית שקיבלת' : 'סיסמה נוכחית'}
              </label>
              <input
                id="oldPassword"
                name="oldPassword"
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={isForced ? 'הזן את הסיסמה הזמנית' : 'הזן סיסמה נוכחית'}
              />
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                סיסמה חדשה
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="לפחות 8 תווים"
              />
              
              {newPassword && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">חוזק הסיסמה:</span>
                    <span className={`text-xs font-medium ${passwordStrength.strength >= 3 ? 'text-green-600' : 'text-gray-600'}`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`${passwordStrength.color} h-2 rounded-full transition-all`}
                      style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                אישור סיסמה חדשה
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="הזן את הסיסמה שוב"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="mt-1 text-xs text-red-600">הסיסמאות אינן תואמות</p>
              )}
            </div>

            {/* Errors */}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="mr-3">
                    <h3 className="text-sm font-medium text-red-800">שגיאות:</h3>
                    <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                      {errors.map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  משנה סיסמה...
                </span>
              ) : (
                'שנה סיסמה'
              )}
            </button>
          </form>

          {/* Requirements */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h4 className="text-sm font-medium text-blue-900 mb-2">דרישות סיסמה:</h4>
            <ul className="text-xs text-blue-800 space-y-1">
              <li className="flex items-center">
                <svg className="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                לפחות 8 תווים
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                אות גדולה באנגלית (A-Z)
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                אות קטנה באנגלית (a-z)
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                מספר (0-9)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
