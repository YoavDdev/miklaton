'use client';

import { useState, useMemo, useEffect } from 'react';
import { getMunicipalityId } from '@/lib/municipality';

export default function CallGuide({ compact = false }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [copiedPhone, setCopiedPhone] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [missedCounts, setMissedCounts] = useState({});
  const [selectedPrimary, setSelectedPrimary] = useState(null); // chosen primary contact id

  useEffect(() => {
    loadCategories();
    const interval = setInterval(() => loadCategories(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadCategories = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      let municipalityId = getMunicipalityId();
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(municipalityId);
      if (!municipalityId || !isUUID) {
        const res = await fetch('/api/municipalities/yehud');
        const d = await res.json();
        if (d.success && d.id) {
          municipalityId = d.id;
          localStorage.setItem('municipality_id', municipalityId);
        }
      }
      const res = await fetch(`/api/call-categories?municipality_id=${municipalityId}&current_time=true`);
      const data = await res.json();
      if (data.success) setCategories(data.categories || []);
      else setError(data.error || 'שגיאה בטעינת נתונים');
    } catch (err) {
      setError('שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = useMemo(() => {
    if (!searchTerm) return categories;
    const term = searchTerm.toLowerCase();
    return categories.filter(cat =>
      cat.name.toLowerCase().includes(term) ||
      cat.description?.toLowerCase().includes(term) ||
      cat.contacts?.some(c => (c.external_name || c.contact?.name || '').toLowerCase().includes(term))
    );
  }, [searchTerm, categories]);

  const copyPhone = (phone) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const MISSED_THRESHOLD = 3;

  const markUnavailable = (contactId) => {
    setMissedCounts(prev => ({ ...prev, [contactId]: (prev[contactId] || 0) + 1 }));
  };

  const openCategory = (cat) => { setSelectedCategory(cat); setSelectedPrimary(null); setMissedCounts({}); };
  const closeCategory = () => { setSelectedCategory(null); setSelectedPrimary(null); setMissedCounts({}); };
  const backToPicker = () => { setSelectedPrimary(null); setMissedCounts({}); };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-slate-200 border-t-slate-700 mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">טוען כוננויות...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <p className="text-red-600 font-semibold mb-4">{error}</p>
          <button onClick={loadCategories} className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold">נסה שוב</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden" dir="rtl">

      {/* ── Header ── */}
      <div className="bg-slate-800 px-4 py-3">
        <span className="text-white font-bold text-base">📞 כוננויות</span>
      </div>

      {/* ── Department cards grid ── */}
      <div className="p-3 pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {filteredCategories.map(cat => {
            const visibleCount = (cat.contacts || []).filter(c => (c.external_phone || c.contact?.phone)).length;
            return (
              <button
                key={cat.id}
                onClick={() => openCategory(cat)}
                className="relative bg-white rounded-xl border border-gray-200 hover:border-slate-400 hover:bg-slate-50 active:scale-95 transition-all px-3 py-2.5 text-right flex flex-col items-start gap-0.5"
              >
                <span className="font-semibold text-gray-900 text-sm leading-tight">{cat.name}</span>
                {visibleCount > 0
                  ? <span className="text-xs text-emerald-600">{visibleCount} זמינים</span>
                  : <span className="text-xs text-gray-400">לפרטים ▸</span>
                }
                {cat.warning && <span className="absolute top-1.5 left-1.5 text-yellow-500 text-xs">⚠️</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Contact panel (slide-up overlay) ── */}
      {selectedCategory && (() => {
        const cat = selectedCategory;
        
        const allCallable = (cat.contacts || []).filter(c => c.external_phone || c.contact?.phone);
        const primaryContacts = allCallable.filter(c => c.is_primary);
        const needsPicker = primaryContacts.length > 1 && !selectedPrimary;

        // After picking: show chosen primary + its non-primary followers (escalation)
        // Without picker: show all as usual
        const visibleContacts = selectedPrimary
          ? allCallable.filter(c => c.id === selectedPrimary || !c.is_primary)
          : allCallable;

        const callableContacts = [
          ...visibleContacts.filter(c => (missedCounts[c.id] || 0) < MISSED_THRESHOLD),
          ...visibleContacts.filter(c => (missedCounts[c.id] || 0) >= MISSED_THRESHOLD),
        ];

        const chosenPrimary = primaryContacts.find(c => c.id === selectedPrimary);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
            <div className="absolute inset-0 bg-black/50" onClick={closeCategory} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">

              {/* Modal header */}
              <div className="bg-gradient-to-l from-slate-800 to-slate-900 px-5 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-white font-bold text-lg leading-tight">
                    {chosenPrimary ? `${cat.name} · ${chosenPrimary.external_name || chosenPrimary.contact?.name}` : cat.name}
                  </h2>
                  {!chosenPrimary && cat.description && <p className="text-slate-400 text-xs mt-0.5">{cat.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {chosenPrimary && (
                    <button onClick={backToPicker} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors text-base" title="חזור">←</button>
                  )}
                  <button onClick={closeCategory} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors text-base font-bold">✕</button>
                </div>
              </div>

              {/* Warning / instructions strip */}
              {(cat.warning || cat.instructions) && (
                <div className="bg-amber-50 border-b border-amber-100 px-4 py-2.5 space-y-1">
                  {cat.warning && <p className="text-xs text-amber-800 font-semibold">⚠️ {cat.warning}</p>}
                  {cat.instructions && <p className="text-xs text-amber-700">{cat.instructions}</p>}
                </div>
              )}

              {/* ── PRIMARY PICKER ── */}
              {needsPicker && (
                <div className="overflow-y-auto flex-1 p-5">
                  <p className="text-sm font-bold text-gray-700 mb-4 text-center">בחר את סוג המקרה:</p>
                  <div className="space-y-3">
                    {primaryContacts.map(c => {
                      const name = c.external_name || c.contact?.name || 'לא ידוע';
                      const role = c.external_role || c.contact?.role_description;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setSelectedPrimary(c.id)}
                          className="w-full text-right bg-white border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 active:scale-[0.98] transition-all rounded-xl px-5 py-4 flex items-center justify-between gap-3"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-gray-900 text-base">{name}</p>
                            </div>
                            {role && <p className="text-xs text-gray-500 mt-0.5">{role}</p>}
                          </div>
                          <span className="text-gray-400 text-xl shrink-0">›</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Contacts list */}
              {!needsPicker && <div className="overflow-y-auto flex-1">
                {callableContacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <span className="text-3xl mb-2">📵</span>
                    <p className="text-sm">אין כוננים זמינים כרגע</p>
                  </div>
                ) : cat.escalation_type === 'parallel' ? (
                  // ── PARALLEL MODE: כולם ביחד ──
                  <div>
                    <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2 flex items-center gap-2">
                      <span className="text-xs bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">📢 התקשר לכולם</span>
                      <span className="text-xs text-emerald-700">{callableContacts.length} כוננים זמינים</span>
                    </div>
                    {callableContacts.map((contact, idx) => {
                      const name = contact.external_name || contact.contact?.name || 'לא ידוע';
                      const phone = contact.external_phone || contact.contact?.phone;
                      const role = contact.external_role || contact.contact?.role_description;
                      return (
                        <div key={contact.id || idx} className="px-4 py-3 border-b border-gray-100">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-gray-900 text-base">{name}</p>
                              </div>
                              {role && <p className="text-xs text-gray-500 mt-0.5">{role}</p>}
                              {contact.notes_for_operator && <p className="text-xs text-amber-700 mt-1 font-medium">💡 {contact.notes_for_operator}</p>}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <a href={`tel:${phone}`} className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-2.5 rounded-xl text-sm transition-colors">
                              📞 {phone}
                            </a>
                            <button onClick={() => copyPhone(phone)} className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-base transition-colors" title="העתק">
                              {copiedPhone === phone ? '✓' : '📋'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // ── SEQUENTIAL MODE: לפי סדר ──
                  <div>
                    {callableContacts.map((contact, idx) => {
                      const name = contact.external_name || contact.contact?.name || 'לא ידוע';
                      const phone = contact.external_phone || contact.contact?.phone;
                      const role = contact.external_role || contact.contact?.role_description;
                      const missedCount = missedCounts[contact.id] || 0;
                      const isUnavailable = missedCount >= MISSED_THRESHOLD;
                      const activeContacts = callableContacts.filter(c => (missedCounts[c.id] || 0) < MISSED_THRESHOLD);
                      const isFirst = !isUnavailable && activeContacts[0]?.id === contact.id;

                      if (isFirst) {
                        return (
                          <div key={contact.id || idx} className="bg-emerald-50 border-b-2 border-emerald-200 px-5 py-5">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="bg-emerald-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">📞 להתקשר עכשיו</span>
                            </div>
                            <div className="mb-3">
                              <div className="flex items-center gap-2">
                                <p className="text-xl font-bold text-gray-900">{name}</p>
                              </div>
                              {role && <p className="text-sm text-gray-500 mt-0.5">{role}</p>}
                              {contact.notes_for_operator && <p className="text-sm text-amber-700 mt-1 font-medium">💡 {contact.notes_for_operator}</p>}
                            </div>
                            <div className="flex gap-2">
                              <a href={`tel:${phone}`} className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-3 rounded-xl text-base transition-colors">
                                📞 {phone}
                              </a>
                              <button onClick={() => copyPhone(phone)} className="w-12 h-12 flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-lg transition-colors" title="העתק">
                                {copiedPhone === phone ? '✓' : '📋'}
                              </button>
                            </div>
                            <button
                              onClick={() => markUnavailable(contact.id)}
                              className="mt-2 w-full flex items-center justify-center gap-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 font-semibold py-2.5 rounded-xl text-sm transition-colors"
                            >
                              {missedCount === 0 && '❌ לא ענה – לחץ 3 פעמים לעבור לבא'}
                              {missedCount === 1 && '❌ לא ענה (1/3)'}
                              {missedCount === 2 && '❌ לא ענה (2/3) – לחץ עוד פעם לעבור'}
                            </button>
                          </div>
                        );
                      }

                      if (isUnavailable) {
                        return (
                          <div key={contact.id || idx} className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3 opacity-60">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs bg-red-100 text-red-500 font-semibold px-2 py-0.5 rounded-full shrink-0">לא ענה</span>
                                <span className="text-sm font-medium text-gray-500 truncate line-through">{name}</span>
                              </div>
                              {role && <p className="text-xs text-gray-400 mt-0.5">{role}</p>}
                            </div>
                            <span className="text-xs text-gray-400 shrink-0">{phone}</span>
                          </div>
                        );
                      }

                      return (
                        <div key={contact.id || idx} className="px-5 py-3 border-b border-gray-100 opacity-50 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 font-medium shrink-0">שלב {idx + 1}</span>
                              <span className="text-sm font-medium text-gray-600 truncate">{name}</span>
                            </div>
                            {role && <p className="text-xs text-gray-400 mt-0.5 mr-10">{role}</p>}
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">{phone}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
