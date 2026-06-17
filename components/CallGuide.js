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
  const [hiddenContacts, setHiddenContacts] = useState([]);

  useEffect(() => { loadCategories(); }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
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

  const markUnavailable = (contactId) => {
    setHiddenContacts(prev => [...prev, contactId]);
  };

  // Sync selectedCategory when categories reload (to reflect hidden contacts)
  const openCategory = (cat) => setSelectedCategory(cat);
  const closeCategory = () => setSelectedCategory(null);

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
            const visibleCount = (cat.contacts || []).filter(c => !hiddenContacts.includes(c.id) && (c.external_phone || c.contact?.phone)).length;
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
        const callableContacts = (cat.contacts || [])
          .filter(c => !hiddenContacts.includes(c.id) && (c.external_phone || c.contact?.phone));
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
            <div className="absolute inset-0 bg-black/50" onClick={closeCategory} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">

              {/* Modal header */}
              <div className="bg-gradient-to-l from-slate-800 to-slate-900 px-5 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-white font-bold text-lg leading-tight">{cat.name}</h2>
                  {cat.description && <p className="text-slate-400 text-xs mt-0.5">{cat.description}</p>}
                </div>
                <button onClick={closeCategory} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors text-base font-bold">✕</button>
              </div>

              {/* Warning / instructions strip */}
              {(cat.warning || cat.instructions) && (
                <div className="bg-amber-50 border-b border-amber-100 px-4 py-2.5 space-y-1">
                  {cat.warning && <p className="text-xs text-amber-800 font-semibold">⚠️ {cat.warning}</p>}
                  {cat.instructions && <p className="text-xs text-amber-700">{cat.instructions}</p>}
                </div>
              )}

              {/* Contacts list */}
              <div className="overflow-y-auto flex-1">
                {callableContacts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <span className="text-3xl mb-2">📵</span>
                    <p className="text-sm">אין כוננים זמינים כרגע</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {callableContacts.map((contact, idx) => {
                      const name = contact.external_name || contact.contact?.name || 'לא ידוע';
                      const phone = contact.external_phone || contact.contact?.phone;
                      const role = contact.external_role || contact.contact?.role_description;
                      const isFirst = idx === 0;
                      return (
                        <div key={contact.id || idx} className={`px-4 py-3.5 ${isFirst ? 'bg-emerald-50/60' : ''}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                {isFirst && <span className="text-xs bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold shrink-0">ראשון</span>}
                                <span className="font-semibold text-gray-900 text-sm truncate">{name}</span>
                              </div>
                              {role && <p className="text-xs text-gray-400">{role}</p>}
                              {contact.notes_for_operator && <p className="text-xs text-amber-600 mt-0.5">💡 {contact.notes_for_operator}</p>}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <a
                                href={`tel:${phone}`}
                                className={`text-xs font-bold px-3 py-2 rounded-lg text-white transition-colors ${isFirst ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-700 hover:bg-slate-800'}`}
                              >
                                {phone}
                              </a>
                              <button onClick={() => copyPhone(phone)} className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors" title="העתק">
                                {copiedPhone === phone ? '✓' : '📋'}
                              </button>
                              <button onClick={() => markUnavailable(contact.id)} className="w-8 h-8 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 rounded-lg text-sm transition-colors" title="לא ענה">
                                📵
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
