'use client';

import { useState, useMemo, useEffect } from 'react';
import { getMunicipalityId } from '@/lib/municipality';

export default function CallGuide({ compact = false }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [copiedPhone, setCopiedPhone] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(true); // Show only currently available contacts
  const [hiddenContacts, setHiddenContacts] = useState([]); // Locally hidden contacts (client-side only)

  // Load categories from API
  useEffect(() => {
    loadCategories();
  }, [showOnlyAvailable]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      let municipalityId = getMunicipalityId();
      
      // If no municipality ID, fetch Yehud ID
      if (!municipalityId) {
        const yehudResponse = await fetch('/api/municipalities/yehud');
        const yehudData = await yehudResponse.json();
        if (yehudData.success && yehudData.id) {
          municipalityId = yehudData.id;
          localStorage.setItem('municipality_id', municipalityId);
        }
      }
      
      const response = await fetch(`/api/call-categories?municipality_id=${municipalityId}&current_time=${showOnlyAvailable}`);
      const data = await response.json();
      
      if (data.success) {
        setCategories(data.categories || []);
      } else {
        setError(data.error || 'שגיאה בטעינת נתונים');
      }
    } catch (err) {
      console.error('Error loading categories:', err);
      setError('שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  };

  // Filter categories based on search
  const filteredCategories = useMemo(() => {
    if (!searchTerm) return categories;
    
    const term = searchTerm.toLowerCase();
    return categories.filter(cat => 
      cat.name.toLowerCase().includes(term) ||
      cat.description?.toLowerCase().includes(term) ||
      cat.contacts?.some(c => {
        const contactName = c.external_name || c.contact?.name || '';
        return contactName.toLowerCase().includes(term);
      })
    );
  }, [searchTerm, categories]);

  const copyPhone = (phone) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const callPhone = (phone) => {
    window.location.href = `tel:${phone}`;
  };

  const copyMessage = (message) => {
    navigator.clipboard.writeText(message);
    alert('✅ הודעה הועתקה ללוח');
  };

  const toggleCategory = (categoryId) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  const markUnavailable = (categoryId, contactId, contactName) => {
    // Client-side only - just hide the contact temporarily
    // This is a visual guide for the operator, not a DB change
    if (!confirm(`להסתיר זמנית את ${contactName} ולעבור לכונן הבא?`)) {
      return;
    }

    // Add to hidden list
    setHiddenContacts([...hiddenContacts, contactId]);
    
    // Show feedback
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-orange-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    toast.innerHTML = `✅ ${contactName} הוסתר זמנית<br/><small>רענן דף להצגה מחדש</small>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען מדריך פניות...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-red-600 font-semibold mb-2">{error}</p>
          <button
            onClick={loadCategories}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all"
          >
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          📋 מדריך פניות למוקדן
        </h2>
        
        {/* Toggle: Show only available */}
        <div className="mb-4 flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyAvailable}
              onChange={(e) => setShowOnlyAvailable(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              הצג רק כוננים זמינים כרגע
            </span>
          </label>
          
          <div className="flex items-center gap-3">
            {hiddenContacts.length > 0 && (
              <button
                onClick={() => setHiddenContacts([])}
                className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-all"
                title="הצג מחדש את כל הכוננים שהוסתרו"
              >
                🔄 הצג הכל ({hiddenContacts.length} מוסתרים)
              </button>
            )}
            <span className="text-xs text-gray-500">
              {new Date().toLocaleString('he-IL', { 
                weekday: 'long', 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="🔍 חיפוש מהיר... (לדוגמה: כלב, חשמל, נזילה)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 pr-10 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all text-lg"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Categories List */}
      <div className="p-4 space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto">
        {filteredCategories.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-2">🔍</div>
            <p>לא נמצאו תוצאות עבור "{searchTerm}"</p>
          </div>
        ) : (
          filteredCategories.map((category) => (
            <div
              key={category.id}
              className="border-2 border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-all"
            >
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full p-4 bg-gradient-to-l from-blue-50 to-white hover:from-blue-100 hover:to-blue-50 transition-all text-right flex items-start justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">{category.icon}</span>
                    <h3 className="text-xl font-bold text-gray-900">
                      {category.name}
                    </h3>
                    {category.priority <= 2 && (
                      <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-bold">
                        דחוף
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm">
                    {category.description}
                  </p>
                </div>
                <div className="mr-4 text-2xl text-gray-400">
                  {expandedCategory === category.id ? '▼' : '◀'}
                </div>
              </button>

              {/* Category Content */}
              {expandedCategory === category.id && (
                <div className="p-4 bg-gray-50 border-t-2 border-gray-200">
                  {/* Warning */}
                  {category.warning && (
                    <div className="mb-4 p-3 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                      <p className="text-yellow-800 font-semibold">{category.warning}</p>
                    </div>
                  )}

                  {/* Instructions */}
                  {category.instructions && (
                    <div className="mb-4 p-3 bg-blue-50 border-2 border-blue-200 rounded-lg">
                      <p className="text-blue-900 font-medium">📝 {category.instructions}</p>
                    </div>
                  )}

                  {/* Questions */}
                  {category.rules?.questions && category.rules.questions.length > 0 && (
                    <div className="mb-4 p-3 bg-purple-50 border-2 border-purple-200 rounded-lg">
                      <p className="font-bold text-purple-900 mb-2">❓ שאלות להבהרת דחיפות:</p>
                      <ul className="list-disc list-inside space-y-1 text-purple-800">
                        {category.rules.questions.map((q, i) => (
                          <li key={i}>{q.rule_text}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Rules */}
                  {category.rules?.rules && category.rules.rules.length > 0 && (
                    <div className="mb-4 p-3 bg-green-50 border-2 border-green-200 rounded-lg">
                      <p className="font-bold text-green-900 mb-2">📌 כללים:</p>
                      <ul className="list-disc list-inside space-y-1 text-green-800">
                        {category.rules.rules.map((rule, i) => (
                          <li key={i}>{rule.rule_text}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Special Cases */}
                  {category.rules?.special_cases && category.rules.special_cases.length > 0 && (
                    <div className="mb-4 p-3 bg-indigo-50 border-2 border-indigo-200 rounded-lg">
                      <p className="font-bold text-indigo-900 mb-2">⭐ מקרים מיוחדים:</p>
                      <ul className="list-disc list-inside space-y-1 text-indigo-800">
                        {category.rules.special_cases.map((sc, i) => (
                          <li key={i}>{sc.rule_text}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Contacts */}
                  {category.contacts && category.contacts.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <p className="font-bold text-gray-900 mb-2">📞 אנשי קשר:</p>
                      {(() => {
                        const visibleContacts = category.contacts
                          .filter(contact => !hiddenContacts.includes(contact.id));
                        
                        // Separate: contacts with phone (callable) and without (info only)
                        let callStep = 0;
                        
                        return visibleContacts.map((contact, idx) => {
                          const displayName = contact.external_name || contact.contact?.name || 'לא ידוע';
                          const displayPhone = contact.external_phone || contact.contact?.phone;
                          const displayRole = contact.external_role || contact.contact?.role_description;
                          const hasPhone = !!displayPhone;
                          
                          if (hasPhone) callStep++;
                          const stepNum = hasPhone ? callStep : null;

                          // Info-only card (no phone)
                          if (!hasPhone) {
                            return (
                              <div key={idx} className="p-3 rounded-lg border-2 bg-blue-50 border-blue-200">
                                <div className="flex items-start gap-2">
                                  <span className="text-blue-500 text-lg mt-0.5">ℹ️</span>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                      <span className="font-bold text-blue-900">{displayName}</span>
                                      {contact.contact_type === 'notification' && (
                                        <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">לעדכון בלבד</span>
                                      )}
                                    </div>
                                    {displayRole && <p className="text-sm text-blue-700">{displayRole}</p>}
                                    {contact.notes_for_operator && (
                                      <p className="text-sm font-semibold text-blue-800 mt-1">
                                        💡 {contact.notes_for_operator}
                                      </p>
                                    )}
                                    {contact.note && (
                                      <p className="text-sm text-blue-700">📝 {contact.note}</p>
                                    )}
                                    <p className="text-xs text-blue-500 mt-1">* מסונכן בנפרד</p>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          // Callable contact card
                          const isFirst = stepNum === 1;
                          return (
                            <div
                              key={idx}
                              className={`p-3 rounded-lg border-2 ${
                                isFirst
                                  ? 'bg-green-50 border-green-400'
                                  : 'bg-orange-50 border-orange-300'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                      isFirst ? 'bg-green-600 text-white' : 'bg-orange-500 text-white'
                                    }`}>
                                      {isFirst ? '📞 התקשר ראשון' : `אם אין מענה → שלב ${stepNum}`}
                                    </span>
                                    <span className="font-bold text-gray-900">{displayName}</span>
                                    {contact.contact_type === 'notification' && (
                                      <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">לעדכון בלבד</span>
                                    )}
                                  </div>
                                  {displayRole && <p className="text-sm text-gray-600">{displayRole}</p>}
                                  {contact.hours && <p className="text-sm text-blue-600">⏰ {contact.hours}</p>}
                                  {contact.notes_for_operator && (
                                    <p className="text-sm font-semibold text-purple-700 bg-purple-50 px-2 py-1 rounded mt-1">
                                      💡 {contact.notes_for_operator}
                                    </p>
                                  )}
                                  {contact.note && (
                                    <p className="text-sm text-gray-600">📝 {contact.note}</p>
                                  )}
                                </div>
                                <div className="flex flex-col gap-2">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => copyPhone(displayPhone)}
                                      className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all text-sm font-semibold"
                                    >
                                      {copiedPhone === displayPhone ? '✓' : '📋'} {displayPhone}
                                    </button>
                                    <button
                                      onClick={() => callPhone(displayPhone)}
                                      className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-all"
                                    >
                                      📞
                                    </button>
                                  </div>
                                  <button
                                    onClick={() => markUnavailable(category.id, contact.id, displayName)}
                                    className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-all text-xs font-semibold"
                                  >
                                    ❌ לא זמין / אין מענה
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}

                  {/* Subcategories */}
                  {category.subcategories && (
                    <div className="space-y-3">
                      {category.subcategories.map((sub, idx) => (
                        <div key={idx} className="p-3 bg-white border-2 border-gray-300 rounded-lg">
                          <p className="font-bold text-gray-900 mb-2">🔹 {sub.name}</p>
                          <div className="space-y-2">
                            {sub.contacts.map((contact, cidx) => (
                              <div
                                key={cidx}
                                className={`p-2 rounded-lg border ${
                                  contact.primary
                                    ? 'bg-green-50 border-green-300'
                                    : 'bg-gray-50 border-gray-200'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <span className="font-semibold text-gray-900">
                                      {contact.name}
                                    </span>
                                    {contact.hours && (
                                      <span className="text-sm text-blue-600 mr-2">
                                        ⏰ {contact.hours}
                                      </span>
                                    )}
                                    {contact.note && (
                                      <p className="text-sm text-gray-600">{contact.note}</p>
                                    )}
                                    {contact.escalation && (
                                      <p className="text-sm text-orange-600">
                                        🔄 {contact.escalation}
                                      </p>
                                    )}
                                  </div>
                                  {contact.phone && (
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => copyPhone(contact.phone)}
                                        className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm"
                                      >
                                        {copiedPhone === contact.phone ? '✓' : '📋'} {contact.phone}
                                      </button>
                                      <button
                                        onClick={() => callPhone(contact.phone)}
                                        className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded"
                                      >
                                        📞
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Special Cases */}
                  {category.specialCases && (
                    <div className="mt-4 p-3 bg-indigo-50 border-2 border-indigo-200 rounded-lg">
                      <p className="font-bold text-indigo-900 mb-2">
                        ⭐ {category.specialCases.title}
                      </p>
                      <p className="text-indigo-800">{category.specialCases.action}</p>
                    </div>
                  )}

                  {/* Wild Animals */}
                  {category.wildAnimals && (
                    <div className="mt-4 p-3 bg-amber-50 border-2 border-amber-200 rounded-lg">
                      <p className="font-bold text-amber-900 mb-2">
                        🦊 {category.wildAnimals.title}
                      </p>
                      <p className="text-amber-800 mb-2">{category.wildAnimals.authority}</p>
                      {category.wildAnimals.autoMessage && (
                        <button
                          onClick={() => copyMessage(category.wildAnimals.autoMessage)}
                          className="mb-3 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-all font-semibold"
                        >
                          📋 העתק הודעה אוטומטית לפונה
                        </button>
                      )}
                      <div className="space-y-1">
                        {category.wildAnimals.contacts.map((c, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-white rounded">
                            <span className="font-semibold">{c.name}</span>
                            {c.phone && (
                              <button
                                onClick={() => copyPhone(c.phone)}
                                className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm"
                              >
                                {copiedPhone === c.phone ? '✓' : '📋'} {c.phone}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Snake Capture */}
                  {category.snakeCapture && (
                    <div className="mt-4 p-3 bg-red-50 border-2 border-red-200 rounded-lg">
                      <p className="font-bold text-red-900 mb-2">
                        🐍 {category.snakeCapture.title}
                      </p>
                      <div className="space-y-2">
                        {category.snakeCapture.contacts.map((c, i) => (
                          <div
                            key={i}
                            className={`p-2 rounded border ${
                              c.primary ? 'bg-red-100 border-red-300' : 'bg-white border-gray-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <span className="font-semibold">{c.name}</span>
                                {c.note && <span className="text-sm text-gray-600 mr-2">({c.note})</span>}
                                {c.escalation && (
                                  <p className="text-sm text-orange-600">🔄 {c.escalation}</p>
                                )}
                              </div>
                              {c.phone && (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => copyPhone(c.phone)}
                                    className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm"
                                  >
                                    {copiedPhone === c.phone ? '✓' : '📋'} {c.phone}
                                  </button>
                                  <button
                                    onClick={() => callPhone(c.phone)}
                                    className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded"
                                  >
                                    📞
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Additional Info */}
                  {category.additionalInfo && (
                    <div className="mt-4 p-3 bg-gray-100 border-2 border-gray-300 rounded-lg">
                      <p className="text-gray-800 font-semibold">ℹ️ {category.additionalInfo}</p>
                    </div>
                  )}

                  {category.note && (
                    <div className="mt-4 p-3 bg-gray-100 border-2 border-gray-300 rounded-lg">
                      <p className="text-gray-800">💡 {category.note}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
