'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userDepartments, setUserDepartments] = useState([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: ''
  });

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include'
      });

      if (!res.ok) {
        router.push('/login');
        return;
      }

      const data = await res.json();
      setUser(data.user);
      setEditForm({
        full_name: data.user.full_name || '',
        phone: data.user.phone || ''
      });

      // טעינת מכלולים למנהל מכלול
      if (data.user.role === 'sector_manager') {
        loadUserDepartments(data.user.id);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
      toast.error('שגיאה בטעינת פרטי משתמש');
    } finally {
      setLoading(false);
    }
  };

  const loadUserDepartments = async (userId) => {
    try {
      const res = await fetch(`/api/user-departments?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setUserDepartments(data.departments || []);
      }
    } catch (err) {
      console.error('Error loading departments:', err);
    }
  };

  const handleUpdateProfile = async () => {
    if (!editForm.full_name.trim()) {
      toast.error('שם מלא הוא שדה חובה');
      return;
    }

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm)
      });

      if (!res.ok) {
        throw new Error('שגיאה בעדכון פרטים');
      }

      toast.success('פרטים עודכנו בהצלחה! ✅');
      setEditMode(false);
      fetchUserData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error('יש למלא את כל השדות');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('הסיסמאות החדשות אינן תואמות');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('סיסמה חדשה חייבת להכיל לפחות 6 תווים');
      return;
    }

    try {
      const res = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'שגיאה בשינוי סיסמה');
      }

      toast.success('סיסמה שונתה בהצלחה! 🔐');
      setShowPasswordModal(false);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const getRoleBadge = (role) => {
    const badges = {
      ceo: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'מנכ"ל עיריה' },
      call_center_manager: { bg: 'bg-pink-100', text: 'text-pink-800', label: 'מנהלת מוקד' },
      sector_manager: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'מנהל מכלול' },
      operator: { bg: 'bg-cyan-100', text: 'text-cyan-800', label: 'מוקדן' },
      inspector: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'פקח' },
      shelter_manager: { bg: 'bg-green-100', text: 'text-green-800', label: 'אחראי מקלטים' },
      admin: { bg: 'bg-red-100', text: 'text-red-800', label: 'מנהל מערכת' }
    };
    const badge = badges[role] || { bg: 'bg-gray-100', text: 'text-gray-800', label: role };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען פרופיל...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Toaster position="top-center" />
      
      <header className="bg-gradient-to-l from-slate-800 to-slate-900 text-white shadow-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <h1 className="text-xl font-bold">👤 הפרופיל שלי</h1>
        </div>
      </header>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">

        {/* Main Profile Card */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-lg mb-4 sm:mb-6 overflow-hidden">
          {/* Header with gradient */}
          <div className="bg-gradient-to-l from-slate-700 to-slate-800 text-white p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl sm:text-4xl">
                  👤
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold">{user?.full_name}</h2>
                  <p className="text-slate-300 text-sm sm:text-base">{user?.email}</p>
                </div>
              </div>
              <div>
                {getRoleBadge(user?.role)}
              </div>
            </div>
          </div>

          {/* Profile Details */}
          <div className="p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">פרטים אישיים</h3>
              {!editMode && (
                <button
                  onClick={() => setEditMode(true)}
                  className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm sm:text-base flex items-center gap-2"
                >
                  ✏️ ערוך
                </button>
              )}
            </div>

            {editMode ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    שם מלא *
                  </label>
                  <input
                    type="text"
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    טלפון
                  </label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                    placeholder="050-1234567"
                    dir="ltr"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleUpdateProfile}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm sm:text-base"
                  >
                    ✅ שמור שינויים
                  </button>
                  <button
                    onClick={() => {
                      setEditMode(false);
                      setEditForm({
                        full_name: user?.full_name || '',
                        phone: user?.phone || ''
                      });
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-sm sm:text-base"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                  <div className="text-xs sm:text-sm text-gray-600 mb-1">📧 אימייל</div>
                  <div className="text-sm sm:text-base font-medium text-gray-900 break-all">{user?.email}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                  <div className="text-xs sm:text-sm text-gray-600 mb-1">👤 שם מלא</div>
                  <div className="text-sm sm:text-base font-medium text-gray-900">{user?.full_name}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                  <div className="text-xs sm:text-sm text-gray-600 mb-1">📞 טלפון</div>
                  <div className="text-sm sm:text-base font-medium text-gray-900">{user?.phone || 'לא הוזן'}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                  <div className="text-xs sm:text-sm text-gray-600 mb-1">🎭 תפקיד</div>
                  <div className="text-sm sm:text-base font-medium text-gray-900">{getRoleBadge(user?.role)}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Departments Card - Only for sector_manager */}
        {user?.role === 'sector_manager' && userDepartments.length > 0 && (
          <div className="bg-white rounded-lg sm:rounded-xl shadow-lg mb-4 sm:mb-6 p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">המכלולים שלי</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {userDepartments.map((dept) => (
                <div
                  key={dept.department_id}
                  className={`border-2 rounded-lg p-3 sm:p-4 ${
                    dept.is_primary
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl sm:text-2xl">🏢</span>
                        <span className="font-bold text-gray-900 text-sm sm:text-base truncate">{dept.department_name}</span>
                      </div>
                      {dept.is_primary && (
                        <span className="inline-block text-[10px] sm:text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">
                          מכלול ראשי
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security Section */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-lg p-4 sm:p-6">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">אבטחה והגדרות</h3>
          <div className="space-y-3">
            <button
              onClick={() => setShowPasswordModal(true)}
              className="w-full flex items-center justify-between p-3 sm:p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-purple-100 flex items-center justify-center text-xl sm:text-2xl">
                  🔐
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900 text-sm sm:text-base">שינוי סיסמה</div>
                  <div className="text-xs sm:text-sm text-gray-600">עדכן את הסיסמה שלך</div>
                </div>
              </div>
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="text-xl sm:text-2xl">ℹ️</div>
                <div>
                  <div className="font-medium text-gray-900 text-sm sm:text-base mb-1">מידע חשוב</div>
                  <ul className="text-xs sm:text-sm text-gray-600 space-y-1">
                    <li>• לשינוי תפקיד או מחלקה, פנה למנהל המערכת</li>
                    <li>• נתוני החשבון מאובטחים ומוצפנים</li>
                    <li>• שינוי סיסמה דורש אימות הסיסמה הנוכחית</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg sm:rounded-xl shadow-xl max-w-md w-full p-4 sm:p-6">
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">שינוי סיסמה</h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">הזן את הסיסמה הנוכחית והסיסמה החדשה</p>
              </div>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordForm({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                  });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  סיסמה נוכחית *
                </label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm sm:text-base"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  סיסמה חדשה *
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm sm:text-base"
                  dir="ltr"
                />
                <p className="text-xs text-gray-500 mt-1">לפחות 6 תווים</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  אימות סיסמה חדשה *
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm sm:text-base"
                  dir="ltr"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  ⚠️ לאחר שינוי הסיסמה, תידרש להתחבר מחדש
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleChangePassword}
                  className="flex-1 px-4 py-2 sm:py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium text-sm sm:text-base"
                >
                  🔐 שנה סיסמה
                </button>
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordForm({
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: ''
                    });
                  }}
                  className="flex-1 px-4 py-2 sm:py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-sm sm:text-base"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
