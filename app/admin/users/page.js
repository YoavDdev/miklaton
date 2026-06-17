'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [tempPassword, setTempPassword] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newDepartmentId, setNewDepartmentId] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // State for create user modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    role: 'sector_manager',
    departmentId: '',
    status: 'active'
  });

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('שגיאה בטעינת משתמשים');
      }

      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
      toast.error('שגיאה בטעינת משתמשים');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.data || data.departments || []);
      }
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserForm.email || !newUserForm.password || !newUserForm.fullName || !newUserForm.role) {
      toast.error('נא למלא את כל השדות החובה');
      return;
    }

    if (newUserForm.role === 'sector_manager' && !newUserForm.departmentId) {
      toast.error('נא לבחור מכלול עבור מנהל מכלול');
      return;
    }

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...newUserForm,
          mustChangePassword: true // תמיד נכפה שינוי סיסמה
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'שגיאה ביצירת משתמש');
      }

      toast.success('משתמש נוצר בהצלחה! 🎉 הסיסמה הזמנית נשלחה.');
      setShowCreateModal(false);
      setNewUserForm({
        email: '',
        password: '',
        fullName: '',
        phone: '',
        role: 'sector_manager',
        departmentId: '',
        status: 'active'
      });
      fetchUsers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleApprove = async (userId) => {
    if (!confirm('האם לאשר משתמש זה?')) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'שגיאה באישור משתמש');
      }

      toast.success('משתמש אושר בהצלחה! ✅');
      fetchUsers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSuspend = async (userId) => {
    if (!confirm('האם להשעות משתמש זה?')) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: 'suspended'
        })
      });

      if (!res.ok) {
        throw new Error('שגיאה בהשעיית משתמש');
      }

      toast.success('משתמש הושעה ✅');
      fetchUsers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleUnsuspend = async (userId) => {
    if (!confirm('האם לבטל השעיה של משתמש זה?')) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: 'active'
        })
      });

      if (!res.ok) {
        throw new Error('שגיאה בביטול השעיה');
      }

      toast.success('השעיה בוטלה - משתמש חזר לסטטוס פעיל ✅');
      fetchUsers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleChangeRole = async () => {
    if (!newRole) {
      toast.error('יש לבחור תפקיד');
      return;
    }

    if (newRole === 'sector_manager' && !newDepartmentId) {
      toast.error('יש לבחור מכלול עבור מנהל מכלול');
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          role: newRole,
          departmentId: newRole === 'sector_manager' ? newDepartmentId : null,
          fullName: selectedUser.full_name,
          phone: selectedUser.phone,
          status: selectedUser.status
        })
      });

      if (!res.ok) {
        throw new Error('שגיאה בשינוי תפקיד');
      }

      toast.success('תפקיד שונה בהצלחה! 🎯 המשתמש יצטרך להתחבר מחדש.');
      setShowModal(null);
      setSelectedUser(null);
      setNewRole('');
      setNewDepartmentId('');
      fetchUsers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleResetPassword = async (userId) => {
    try {
      const user = users.find(u => u.id === userId);
      if (!user) {
        toast.error('משתמש לא נמצא');
        return;
      }

      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'שגיאה באיפוס סיסמה');
      }

      const data = await res.json();
      setTempPassword(data.tempPassword);
      setSelectedUser({ ...user, ...data });
      setShowModal('password-reset');
      toast.success('סיסמה זמנית נוצרה! 🔐');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteUser = async () => {
    if (deleteConfirmText !== 'DELETE') {
      toast.error('נא להקליד DELETE בדיוק כדי לאשר מחיקה');
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'שגיאה במחיקת משתמש');
      }

      toast.success('משתמש נמחק בהצלחה! 🗑️');
      setShowModal(null);
      setSelectedUser(null);
      setDeleteConfirmText('');
      fetchUsers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('הועתק ללוח! 📋');
  };

  const openWhatsApp = (phone, message) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/972${cleanPhone.substring(1)}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const filteredUsers = users.filter(user => {
    if (filter === 'all') return true;
    if (filter === 'pending') return user.status === 'pending';
    if (filter === 'active') return user.status === 'active';
    if (filter === 'suspended') return user.status === 'suspended';
    return true;
  });

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      active: 'bg-green-100 text-green-800',
      suspended: 'bg-red-100 text-red-800'
    };
    const labels = {
      pending: 'ממתין',
      active: 'פעיל',
      suspended: 'מושעה'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const getRoleBadge = (role) => {
    const badges = {
      ceo: 'bg-purple-100 text-purple-800',
      call_center_manager: 'bg-pink-100 text-pink-800',
      sector_manager: 'bg-blue-100 text-blue-800',
      operator: 'bg-cyan-100 text-cyan-800',
      inspector: 'bg-orange-100 text-orange-800',
      shelter_manager: 'bg-green-100 text-green-800',
      admin: 'bg-red-100 text-red-800',
      // Legacy support
      manager: 'bg-purple-100 text-purple-800',
      leadership: 'bg-indigo-100 text-indigo-800'
    };
    const labels = {
      ceo: 'מנכ"ל עיריה',
      call_center_manager: 'מנהלת מוקד',
      sector_manager: 'מנהל מכלול',
      operator: 'מוקדן',
      inspector: 'פקח',
      shelter_manager: 'אחראי מקלטים',
      admin: 'מנהל מערכת',
      // Legacy support
      manager: 'מנהל מכלול',
      leadership: 'הנהלה'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[role] || 'bg-gray-100 text-gray-800'}`}>
        {labels[role] || role}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען משתמשים...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-gradient-to-l from-slate-800 to-slate-900 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">👥 ניהול משתמשים</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-white/10 hover:bg-white/20 border border-white/20 font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm"
          >
            ➕ צור משתמש חדש
          </button>
        </div>
      </header>
      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#363636',
            fontSize: '14px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">סך הכל משתמשים</div>
            <div className="text-3xl font-bold text-gray-900">{users.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">ממתינים לאישור</div>
            <div className="text-3xl font-bold text-yellow-600">
              {users.filter(u => u.status === 'pending').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">פעילים</div>
            <div className="text-3xl font-bold text-green-600">
              {users.filter(u => u.status === 'active').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">מושעים</div>
            <div className="text-3xl font-bold text-red-600">
              {users.filter(u => u.status === 'suspended').length}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex gap-2">
            {[
              { value: 'all', label: 'הכל' },
              { value: 'pending', label: 'ממתינים' },
              { value: 'active', label: 'פעילים' },
              { value: 'suspended', label: 'מושעים' }
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  filter === value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    שם
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    אימייל
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    טלפון
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    תפקיד
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    סטטוס
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{user.phone || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(user.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        {user.status === 'pending' && (
                          <button
                            onClick={() => handleApprove(user.id)}
                            className="text-green-600 hover:text-green-900 font-medium"
                          >
                            אשר
                          </button>
                        )}
                        {user.status === 'active' && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setNewRole(user.role);
                                setNewDepartmentId(user.department_id || '');
                                setShowModal('change-role');
                              }}
                              className="text-purple-600 hover:text-purple-900 font-medium"
                            >
                              שינוי תפקיד
                            </button>
                            <button
                              onClick={() => handleResetPassword(user.id)}
                              className="text-blue-600 hover:text-blue-900 font-medium"
                            >
                              איפוס סיסמה
                            </button>
                            <button
                              onClick={() => handleSuspend(user.id)}
                              className="text-orange-600 hover:text-orange-900 font-medium"
                            >
                              השעה
                            </button>
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setDeleteConfirmText('');
                                setShowModal('delete-user');
                              }}
                              className="text-red-600 hover:text-red-900 font-medium"
                            >
                              מחיקה
                            </button>
                          </>
                        )}
                        {user.status === 'suspended' && (
                          <button
                            onClick={() => handleUnsuspend(user.id)}
                            className="text-green-600 hover:text-green-900 font-medium"
                          >
                            ביטול השעיה
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">אין משתמשים להצגה</p>
            </div>
          )}
        </div>
      </div>

      {/* Password Reset Modal */}
      {showModal === 'password-reset' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-gray-900">סיסמה זמנית נוצרה</h3>
              <button
                onClick={() => {
                  setShowModal(null);
                  setTempPassword('');
                  setSelectedUser(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 mb-2">
                  <strong>משתמש:</strong> {selectedUser?.name}
                </p>
                {selectedUser?.phone && (
                  <p className="text-sm text-blue-800 mb-2">
                    <strong>טלפון:</strong> {selectedUser.phone}
                  </p>
                )}
                <div className="mt-3">
                  <p className="text-xs text-blue-700 mb-1">סיסמה זמנית:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tempPassword}
                      readOnly
                      className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded-md font-mono text-lg"
                    />
                    <button
                      onClick={() => copyToClipboard(tempPassword)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      📋 העתק
                    </button>
                  </div>
                </div>
              </div>

              {selectedUser?.phone && (
                <button
                  onClick={() => openWhatsApp(selectedUser.phone, selectedUser.whatsappMessage)}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  שלח ב-WhatsApp
                </button>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  ⚠️ הסיסמה הזמנית תקפה ל-24 שעות. המשתמש יידרש לשנות אותה בהתחברות הבאה.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Role Modal */}
      {showModal === 'change-role' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-gray-900">שינוי תפקיד משתמש</h3>
              <button
                onClick={() => {
                  setShowModal(null);
                  setSelectedUser(null);
                  setNewRole('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-800 mb-2">
                  <strong>משתמש:</strong> {selectedUser?.full_name}
                </p>
                <p className="text-sm text-purple-800 mb-2">
                  <strong>אימייל:</strong> {selectedUser?.email}
                </p>
                <p className="text-sm text-purple-800">
                  <strong>תפקיד נוכחי:</strong> {getRoleLabel(selectedUser?.role)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  תפקיד חדש
                </label>
                <select
                  value={newRole}
                  onChange={(e) => {
                    setNewRole(e.target.value);
                    if (e.target.value !== 'sector_manager') {
                      setNewDepartmentId('');
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="ceo">מנכ"ל עיריה</option>
                  <option value="call_center_manager">מנהלת מוקד עירוני</option>
                  <option value="sector_manager">מנהל מכלול</option>
                  <option value="operator">מוקדן</option>
                  <option value="inspector">פקח/שיטור עירוני</option>
                  <option value="shelter_manager">אחראי מקלטים</option>
                  <option value="admin">אדמין (מנהל מערכת)</option>
                </select>
              </div>

              {/* Department - only for sector_manager */}
              {newRole === 'sector_manager' && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-purple-900 mb-2">
                    מכלול (נדרש עבור מנהל מכלול) *
                  </label>
                  <select
                    value={newDepartmentId}
                    onChange={(e) => setNewDepartmentId(e.target.value)}
                    className="w-full px-3 py-2 border border-purple-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">בחר מכלול...</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} {dept.manager_name && `(מנהל: ${dept.manager_name})`}
                      </option>
                    ))}
                  </select>
                  {departments.length === 0 && (
                    <p className="text-xs text-purple-700 mt-2">
                      ⚠️ אין מכלולים במערכת. יש ליצור מכלול תחילה.
                    </p>
                  )}
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  ⚠️ המשתמש יצטרך להתנתק ולהתחבר מחדש כדי שהשינוי ייכנס לתוקף.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleChangeRole}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium"
                >
                  שמור שינויים
                </button>
                <button
                  onClick={() => {
                    setShowModal(null);
                    setSelectedUser(null);
                    setNewRole('');
                    setNewDepartmentId('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">➕ יצירת משתמש חדש</h3>
                <p className="text-sm text-gray-600 mt-1">המשתמש יקבל סיסמה זמנית ויאלץ לשנותה בהתחברות הראשונה</p>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewUserForm({
                    email: '',
                    password: '',
                    fullName: '',
                    phone: '',
                    role: 'sector_manager',
                    departmentId: '',
                    status: 'active'
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
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email (שם משתמש) *
                </label>
                <input
                  type="email"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({...newUserForm, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="user@example.com"
                  dir="ltr"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  סיסמה זמנית *
                </label>
                <input
                  type="text"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="לדוגמה: User2026!"
                />
                <p className="text-xs text-gray-500 mt-1">
                  המשתמש יאלץ לשנות סיסמה זו בהתחברות הראשונה
                </p>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  שם מלא *
                </label>
                <input
                  type="text"
                  value={newUserForm.fullName}
                  onChange={(e) => setNewUserForm({...newUserForm, fullName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="למשל: אוקסנה פרנק"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  טלפון (אופציונלי)
                </label>
                <input
                  type="tel"
                  value={newUserForm.phone}
                  onChange={(e) => setNewUserForm({...newUserForm, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="050-1234567 או +972 54-531-2875"
                  dir="ltr"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  תפקיד *
                </label>
                <select
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({...newUserForm, role: e.target.value, departmentId: ''})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="sector_manager">מנהל מכלול</option>
                  <option value="call_center_manager">מנהלת מוקד עירוני</option>
                  <option value="operator">מוקדן</option>
                  <option value="inspector">פקח/שיטור עירוני</option>
                  <option value="shelter_manager">אחראי מקלטים</option>
                  <option value="ceo">מנכ"ל עיריה</option>
                  <option value="admin">אדמין (מנהל מערכת)</option>
                </select>
              </div>

              {/* Department - only for sector_manager */}
              {newUserForm.role === 'sector_manager' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-blue-900 mb-2">
                    מכלול (נדרש עבור מנהל מכלול) *
                  </label>
                  <select
                    value={newUserForm.departmentId}
                    onChange={(e) => setNewUserForm({...newUserForm, departmentId: e.target.value})}
                    className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">בחר מכלול...</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} {dept.manager_name && `(מנהל: ${dept.manager_name})`}
                      </option>
                    ))}
                  </select>
                  {departments.length === 0 && (
                    <p className="text-xs text-blue-700 mt-2">
                      ⚠️ אין מכלולים במערכת. יש ליצור מכלול תחילה.
                    </p>
                  )}
                </div>
              )}

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  סטטוס
                </label>
                <select
                  value={newUserForm.status}
                  onChange={(e) => setNewUserForm({...newUserForm, status: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="active">פעיל</option>
                  <option value="pending">ממתין לאישור</option>
                  <option value="suspended">מושעה</option>
                </select>
              </div>

              {/* Summary Box */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900 mb-2">📋 סיכום:</p>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>✉️ Email: <span className="font-mono">{newUserForm.email || '(לא הוזן)'}</span></li>
                  <li>👤 שם: <strong>{newUserForm.fullName || '(לא הוזן)'}</strong></li>
                  <li>🎭 תפקיד: <strong>{getRoleLabel(newUserForm.role)}</strong></li>
                  {newUserForm.role === 'sector_manager' && (
                    <li>🏢 מכלול: <strong>{departments.find(d => d.id === newUserForm.departmentId)?.name || '(לא נבחר)'}</strong></li>
                  )}
                  <li>🔐 הסיסמה הזמנית תישלח למשתמש והוא יאלץ לשנות אותה</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateUser}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition-colors"
                >
                  ✅ צור משתמש
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewUserForm({
                      email: '',
                      password: '',
                      fullName: '',
                      phone: '',
                      role: 'sector_manager',
                      departmentId: '',
                      status: 'active'
                    });
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium transition-colors"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {showModal === 'delete-user' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-red-600">⚠️ אזהרה - מחיקת משתמש</h3>
              <button
                onClick={() => {
                  setShowModal(null);
                  setSelectedUser(null);
                  setDeleteConfirmText('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800 font-bold mb-2">
                  🚨 פעולה בלתי הפיכה!
                </p>
                <p className="text-sm text-red-700 mb-2">
                  אתה עומד למחוק את המשתמש:
                </p>
                <div className="bg-white rounded p-2 mb-2">
                  <p className="text-sm font-bold text-gray-900">{selectedUser?.full_name}</p>
                  <p className="text-xs text-gray-600">{selectedUser?.email}</p>
                  <p className="text-xs text-gray-600">תפקיד: {selectedUser?.role}</p>
                </div>
                <p className="text-sm text-red-700">
                  ⚠️ כל הנתונים של המשתמש יימחקו לצמיתות!
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  כדי לאשר, הקלד <span className="text-red-600 font-mono">DELETE</span> בדיוק:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-red-300 rounded-md focus:ring-red-500 focus:border-red-500 font-mono"
                  placeholder="הקלד DELETE"
                  autoFocus
                />
                {deleteConfirmText && deleteConfirmText !== 'DELETE' && (
                  <p className="text-xs text-red-600 mt-1">
                    ❌ יש להקליד DELETE באותיות גדולות בדיוק
                  </p>
                )}
                {deleteConfirmText === 'DELETE' && (
                  <p className="text-xs text-green-600 mt-1">
                    ✅ אישור נכון
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowModal(null);
                    setSelectedUser(null);
                    setDeleteConfirmText('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium"
                >
                  ביטול
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={deleteConfirmText !== 'DELETE'}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  🗑️ מחק לצמיתות
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getRoleLabel(role) {
  const roles = {
    ceo: 'מנכ"ל עיריה',
    call_center_manager: 'מנהלת מוקד עירוני',
    sector_manager: 'מנהל מכלול',
    operator: 'מוקדן',
    inspector: 'פקח/שיטור עירוני',
    shelter_manager: 'אחראי מקלטים',
    admin: 'אדמין (מנהל מערכת)'
  };
  return roles[role] || role;
}
