'use client';

import { useState, useEffect } from 'react';

export default function WhatsAppDutyLinks() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState('');
  const [copied, setCopied] = useState(null);
  const [sentStatus, setSentStatus] = useState({});
  const [formTokens, setFormTokens] = useState({});

  useEffect(() => {
    // Detect current base URL
    setBaseUrl(window.location.origin);
    fetchDepartments();
    fetchFormTokens();

    // Load sent status from localStorage
    const saved = localStorage.getItem('dutyLinksSentStatus');
    if (saved) {
      try {
        setSentStatus(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments');
      const data = await res.json();
      if (data.success) {
        setDepartments(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
    setLoading(false);
  };

  // הקישור כולל טוקן חתום (?t=) - בלעדיו הטופס לא ייפתח
  const fetchFormTokens = async () => {
    try {
      const res = await fetch('/api/duty-form/links');
      const data = await res.json();
      if (data.success) {
        setFormTokens(data.tokens || {});
      }
    } catch (error) {
      console.error('Failed to fetch duty form tokens:', error);
    }
  };

  const getFormUrl = (deptId) => {
    const token = formTokens[deptId];
    return `${baseUrl}/duty-form/${deptId}${token ? `?t=${token}` : ''}`;
  };

  const getWhatsAppMessage = (dept) => {
    const formUrl = getFormUrl(dept.id);
    const managerName = dept.manager_name;

    const message = `שלום${managerName ? ` ${managerName}` : ''},

אני צריך עדכון כוננויות ל*${dept.name}* לשבוע הקרוב.

נא למלא את הטופס בלינק:
${formUrl}

הטופס פשוט - רק לסמן מי כונן ובאיזה שעות.
תודה! 🙏`;

    return message;
  };

  const getWhatsAppLink = (dept, phone) => {
    if (!phone || phone === 'אין טלפון') return null;
    
    // Clean phone number for WhatsApp (Israeli format)
    let cleanPhone = phone.replace(/[-\s()]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '972' + cleanPhone.substring(1);
    }
    if (!cleanPhone.startsWith('972')) {
      cleanPhone = '972' + cleanPhone;
    }

    const message = encodeURIComponent(getWhatsAppMessage(dept));
    return `https://wa.me/${cleanPhone}?text=${message}`;
  };

  const copyFormLink = (deptId) => {
    navigator.clipboard.writeText(getFormUrl(deptId));
    setCopied(deptId);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyMessage = (dept) => {
    navigator.clipboard.writeText(getWhatsAppMessage(dept));
    setCopied(`msg-${dept.id}`);
    setTimeout(() => setCopied(null), 2000);
  };

  const markAsSent = (deptId) => {
    const newStatus = {
      ...sentStatus,
      [deptId]: new Date().toISOString()
    };
    setSentStatus(newStatus);
    localStorage.setItem('dutyLinksSentStatus', JSON.stringify(newStatus));
  };

  const clearSentStatus = () => {
    setSentStatus({});
    localStorage.removeItem('dutyLinksSentStatus');
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">טוען מכלולים...</div>;
  }

  const sentCount = Object.keys(sentStatus).length;
  const totalDepts = departments.length;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-green-500 text-3xl">📱</span>
            שליחת לינקים למנהלי מכלולים
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            שלח לכל מנהל מכלול לינק לעדכון כוננויות דרך WhatsApp
          </p>
        </div>
        {sentCount > 0 && (
          <div className="text-left">
            <div className="text-sm font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full">
              נשלחו {sentCount}/{totalDepts}
            </div>
            <button
              onClick={clearSentStatus}
              className="text-xs text-gray-500 hover:text-gray-700 mt-1 underline"
            >
              אפס סטטוס
            </button>
          </div>
        )}
      </div>

      {/* Quick Send All */}
      <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-xl">
        <h3 className="font-bold text-green-800 mb-2">שליחה מהירה</h3>
        <p className="text-sm text-green-700 mb-3">
          לחץ על כפתור ה-WhatsApp ליד כל מכלול כדי לשלוח את ההודעה ישירות למנהל המכלול.
          ההודעה כוללת לינק לטופס פשוט שהמנהל ממלא בטלפון.
        </p>
      </div>

      {/* Department Cards */}
      <div className="space-y-3">
        {departments
          .map(dept => {
            const hasPhone = !!dept.manager_phone;
            const waLink = hasPhone ? getWhatsAppLink(dept, dept.manager_phone) : null;
            const isSent = sentStatus[dept.id];

            return (
              <div
                key={dept.id}
                className={`border-2 rounded-xl p-4 transition-all ${
                  isSent
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-purple-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900">{dept.name}</h3>
                      {isSent && (
                        <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-semibold">
                          ✓ נשלח {new Date(isSent).toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    {dept.manager_name && (
                      <p className="text-sm text-gray-600 mt-1">
                        👤 {dept.manager_name}
                        {dept.manager_phone && (
                          <span className="text-gray-400 mr-2" dir="ltr"> {dept.manager_phone}</span>
                        )}
                      </p>
                    )}
                    {!dept.manager_name && (
                      <p className="text-sm text-yellow-600 mt-1">⚠️ לא הוגדר מנהל מכלול</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {dept.contacts.length} אנשי קשר במכלול
                    </p>
                  </div>

                  <div className="flex gap-2 mr-4">
                    {/* Copy form link */}
                    <button
                      onClick={() => copyFormLink(dept.id)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                        copied === dept.id
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      title="העתק לינק לטופס"
                    >
                      {copied === dept.id ? '✓ הועתק' : '🔗 לינק'}
                    </button>

                    {/* Copy message */}
                    <button
                      onClick={() => copyMessage(dept)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                        copied === `msg-${dept.id}`
                          ? 'bg-green-500 text-white'
                          : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                      }`}
                      title="העתק הודעה"
                    >
                      {copied === `msg-${dept.id}` ? '✓ הועתק' : '📋 הודעה'}
                    </button>

                    {/* WhatsApp direct send */}
                    {waLink ? (
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => markAsSent(dept.id)}
                        className="px-4 py-2 rounded-lg text-sm font-bold bg-green-500 hover:bg-green-600 text-white transition-all flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        WhatsApp
                      </a>
                    ) : (
                      <span className="px-3 py-2 rounded-lg text-xs text-gray-400 bg-gray-100">
                        אין טלפון
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border-r-4 border-blue-500 rounded">
        <p className="text-sm text-blue-800">
          <strong>איך זה עובד?</strong>
        </p>
        <ol className="text-sm text-blue-700 mt-2 space-y-1 list-decimal list-inside">
          <li>לחץ על כפתור ה-WhatsApp ליד כל מכלול</li>
          <li>ההודעה נפתחת ב-WhatsApp עם לינק לטופס</li>
          <li>המנהל פותח את הלינק בטלפון ← טופס סופר פשוט</li>
          <li>הוא מסמן מי כונן ובאיזה שעות ← לוחץ שמור</li>
          <li>הכוננויות מתעדכנות אוטומטית במערכת!</li>
        </ol>
      </div>
    </div>
  );
}
