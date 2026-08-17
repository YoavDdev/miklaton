'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: ''
  });
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const validateForm = () => {
    const newErrors = [];

    if (!formData.email || !formData.email.includes('@')) {
      newErrors.push('נא להזין כתובת אימייל תקינה');
    }

    if (!formData.fullName || formData.fullName.length < 2) {
      newErrors.push('נא להזין שם מלא');
    }

    if (!formData.password || formData.password.length < 8) {
      newErrors.push('הסיסמה חייבת להכיל לפחות 8 תווים');
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.push('הסיסמאות אינן תואמות');
    }

    if (!/[A-Z]/.test(formData.password)) {
      newErrors.push('הסיסמה חייבת להכיל לפחות אות גדולה אחת באנגלית');
    }

    if (!/[a-z]/.test(formData.password)) {
      newErrors.push('הסיסמה חייבת להכיל לפחות אות קטנה אחת באנגלית');
    }

    if (!/[0-9]/.test(formData.password)) {
      newErrors.push('הסיסמה חייבת להכיל לפחות ספרה אחת');
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    setErrors([]);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          phone: formData.phone || null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors([data.error || 'שגיאה ברישום']);
        if (data.details) {
          setErrors(prev => [...prev, ...data.details]);
        }
        return;
      }

      setSuccess(true);
      
      setTimeout(() => {
        router.push('/login');
      }, 3000);

    } catch (error) {
      console.error('Registration error:', error);
      setErrors(['שגיאה בתקשורת עם השרת']);
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = () => {
    if (!formData.password) return { strength: 0, label: '', color: '' };
    
    let strength = 0;
    if (formData.password.length >= 8) strength++;
    if (/[A-Z]/.test(formData.password)) strength++;
    if (/[a-z]/.test(formData.password)) strength++;
    if (/[0-9]/.test(formData.password)) strength++;
    if (/[!@#$%^&*]/.test(formData.password)) strength++;

    if (strength <= 2) return { strength, label: 'חלשה', color: 'bg-red-500' };
    if (strength === 3) return { strength, label: 'בינונית', color: 'bg-yellow-500' };
    if (strength === 4) return { strength, label: 'חזקה', color: 'bg-green-500' };
    return { strength, label: 'חזקה מאוד', color: 'bg-green-600' };
  };

  const passwordStrength = getPasswordStrength();

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900 p-4" dir="rtl">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-8 text-center">
          <div className="mb-6">
            <div className="mx-auto w-20 h-20 bg-green-500/20 backdrop-blur-sm border-2 border-green-400 rounded-full flex items-center justify-center animate-bounce">
              <svg className="w-12 h-12 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">רישום הושלם בהצלחה! 🎉</h2>
          <p className="text-blue-100 mb-4 text-sm sm:text-base">
            חשבונך נוצר בהצלחה וממתין לאישור מנהל המערכת.
          </p>
          <div className="bg-white/10 border border-white/20 rounded-lg p-4 mb-4">
            <p className="text-blue-200 text-xs sm:text-sm">
              תקבל הודעה ברגע שהחשבון יאושר ותוכל להתחבר למערכת
            </p>
          </div>
          <p className="text-sm text-purple-200">
            ⏳ מעביר אותך לדף ההתחברות...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900 py-6 sm:py-12 px-4 sm:px-6" dir="rtl">
      <div className="max-w-md w-full space-y-4 sm:space-y-6">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl sm:rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8">
          {/* Logo & Title */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="mb-3 sm:mb-4 flex justify-center">
              <img 
                src="/images/yehud-logo.png" 
                alt="לוגו עיריית יהוד-מונוסון" 
                className="w-24 h-24 sm:w-28 sm:h-28 object-contain drop-shadow-2xl"
              />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">מקלטון</h1>
            <div className="h-1 w-20 sm:w-24 bg-gradient-to-r from-blue-400 to-purple-400 mx-auto rounded-full mb-3 sm:mb-4"></div>
            <p className="text-blue-100 text-sm sm:text-base font-medium">רישום משתמש חדש</p>
            <p className="text-blue-200 text-xs sm:text-sm mt-1">מוקד עירוני יהוד-מונוסון</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm sm:text-base font-semibold text-white mb-2">
                📧 אימייל
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border-2 border-white/30 bg-white/10 backdrop-blur-sm text-white placeholder-blue-200 rounded-lg focus:border-purple-400 focus:bg-white/20 focus:outline-none transition-all"
                placeholder="your.name@example.com"
                dir="ltr"
              />
            </div>

            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-sm sm:text-base font-semibold text-white mb-2">
                👤 שם מלא
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                value={formData.fullName}
                onChange={handleChange}
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border-2 border-white/30 bg-white/10 backdrop-blur-sm text-white placeholder-blue-200 rounded-lg focus:border-purple-400 focus:bg-white/20 focus:outline-none transition-all"
                placeholder="שם פרטי ושם משפחה"
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm sm:text-base font-semibold text-white mb-2">
                📞 טלפון (אופציונלי)
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border-2 border-white/30 bg-white/10 backdrop-blur-sm text-white placeholder-blue-200 rounded-lg focus:border-purple-400 focus:bg-white/20 focus:outline-none transition-all"
                placeholder="050-1234567"
                dir="ltr"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm sm:text-base font-semibold text-white mb-2">
                🔐 סיסמה
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border-2 border-white/30 bg-white/10 backdrop-blur-sm text-white placeholder-blue-200 rounded-lg focus:border-purple-400 focus:bg-white/20 focus:outline-none transition-all"
                placeholder="לפחות 8 תווים"
                dir="ltr"
              />
              
              {formData.password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-blue-200">חוזק הסיסמה:</span>
                    <span className={`text-xs font-bold ${passwordStrength.strength >= 3 ? 'text-green-300' : 'text-yellow-300'}`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2">
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
              <label htmlFor="confirmPassword" className="block text-sm sm:text-base font-semibold text-white mb-2">
                ✅ אימות סיסמה
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border-2 border-white/30 bg-white/10 backdrop-blur-sm text-white placeholder-blue-200 rounded-lg focus:border-purple-400 focus:bg-white/20 focus:outline-none transition-all"
                placeholder="הזן את הסיסמה שוב"
                dir="ltr"
              />
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="mt-1 text-xs text-red-300 font-medium">❌ הסיסמאות אינן תואמות</p>
              )}
            </div>

            {/* Errors */}
            {errors.length > 0 && (
              <div className="bg-red-500/20 backdrop-blur-sm border border-red-400/50 rounded-lg p-3 sm:p-4">
                <h3 className="text-sm font-bold text-red-200 mb-2">❌ שגיאות ברישום:</h3>
                <ul className="text-xs sm:text-sm text-red-100 space-y-1">
                  {errors.map((error, idx) => (
                    <li key={idx}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full font-bold py-3 sm:py-4 px-6 rounded-xl text-base sm:text-lg transition-all duration-300 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-500 disabled:to-gray-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>רושם...</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>הרשמה למערכת</span>
                </>
              )}
            </button>

            {/* Login Link */}
            <div className="text-center pt-2">
              <p className="text-sm sm:text-base text-blue-100">
                כבר יש לך חשבון?{' '}
                <a href="/login" className="font-bold text-purple-300 hover:text-purple-200 underline">
                  התחבר כאן
                </a>
              </p>
            </div>
          </form>
        </div>

        {/* Info Box */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl sm:rounded-2xl p-4 sm:p-5">
          <p className="font-bold mb-3 text-white text-sm sm:text-base flex items-center gap-2">
            <span className="text-xl">💡</span>
            <span>שים לב:</span>
          </p>
          <ul className="space-y-2 text-xs sm:text-sm text-blue-100">
            <li className="flex items-start gap-2">
              <span className="text-purple-300 font-bold">•</span>
              <span>חשבונך יצטרך לקבל אישור ממנהל המערכת</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-300 font-bold">•</span>
              <span>תקבל הודעה ברגע שהחשבון יאושר</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-300 font-bold">•</span>
              <span>הסיסמה חייבת להיות חזקה (8+ תווים, אותיות ומספרים)</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
