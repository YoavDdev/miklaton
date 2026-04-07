'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

const SEVERITY_MAP = {
  low: { label: 'נמוך', color: 'text-blue-400', icon: 'ℹ️' },
  medium: { label: 'בינוני', color: 'text-yellow-400', icon: '⚠️' },
  high: { label: 'גבוה', color: 'text-orange-400', icon: '🔶' },
  critical: { label: 'קריטי', color: 'text-red-400', icon: '🚨' },
};

export default function JoinEventPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token;

  const [step, setStep] = useState('phone'); // phone -> confirm -> guest_register -> done
  const [phone, setPhone] = useState('');
  const [guestName, setGuestName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [contactInfo, setContactInfo] = useState(null);
  const [eventInfo, setEventInfo] = useState(null);
  const [participantId, setParticipantId] = useState(null);
  const [result, setResult] = useState(null); // joined / declined / already_joined

  // Auto-load saved phone from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('miklaton_phone');
    if (saved) {
      setPhone(saved);
      // Auto-lookup with saved phone
      autoLookup(saved);
    }
  }, [token]);

  const autoLookup = async (savedPhone) => {
    setLoading(true);
    try {
      const res = await fetch('/api/events/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_token: token, phone: savedPhone, action: 'lookup' }),
      });
      const data = await res.json();
      if (data.success) {
        setEventInfo(data.event);
        if (data.found) {
          setContactInfo(data.contact);
          setStep('confirm');
        } else {
          setStep('guest_register');
        }
      }
    } catch {}
    setLoading(false);
  };

  const handleLookup = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/events/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_token: token, phone: phone.trim(), action: 'lookup' }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error === 'Event not found' ? 'אירוע לא נמצא או שהלינק לא תקין' : data.error);
        setLoading(false);
        return;
      }

      setEventInfo(data.event);

      if (data.found) {
        setContactInfo(data.contact);
        setStep('confirm');
      } else {
        setStep('guest_register');
      }
    } catch (err) {
      setError('שגיאה בחיבור לשרת');
    }
    setLoading(false);
  };

  const handleConfirm = async (action) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/events/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invite_token: token,
          phone: phone.trim(),
          guest_name: guestName || undefined,
          action,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error);
        setLoading(false);
        return;
      }

      setParticipantId(data.data?.id);
      setResult(data.message);
      setEventInfo(data.event);
      // Save phone for next time
      localStorage.setItem('miklaton_phone', phone.trim());
      setStep('done');
    } catch (err) {
      setError('שגיאה בחיבור לשרת');
    }
    setLoading(false);
  };

  const goToLiveJournal = () => {
    router.push(`/event/live/${token}?phone=${encodeURIComponent(phone.trim())}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <p className="text-gray-400 text-sm">את/ה מצטרף/ת לאירוע חירום</p>
          <p className="text-gray-500 text-xs">מקלטון - עיריית יהוד-מונוסון</p>
        </div>

        <div className="bg-gray-800/80 backdrop-blur rounded-2xl shadow-2xl border border-gray-700 p-8">

          {/* Step: Phone */}
          {step === 'phone' && (
            <>
              <h1 className="text-2xl font-bold text-white text-center mb-2">הצטרפות לאירוע</h1>
              <p className="text-gray-400 text-center text-sm mb-8">הזן מספר טלפון לזיהוי</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">מספר טלפון</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                    placeholder="050-1234567"
                    dir="ltr"
                    className="w-full px-4 py-3.5 bg-gray-700/50 border-2 border-gray-600 rounded-xl text-white text-lg focus:border-blue-500 focus:outline-none placeholder-gray-500"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-3 text-sm text-center">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleLookup}
                  disabled={!phone.trim() || loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3.5 rounded-xl transition-colors text-lg"
                >
                  {loading ? 'בודק...' : 'המשך'}
                </button>
              </div>
            </>
          )}

          {/* Step: Confirm (known contact) */}
          {step === 'confirm' && contactInfo && (
            <>
              <h1 className="text-2xl font-bold text-white text-center mb-2">שלום {contactInfo.name}!</h1>
              {eventInfo && (
                <div className="bg-gray-700/50 rounded-xl p-4 mb-6 text-center">
                  <div className="text-sm text-gray-400 mb-1">אירוע חירום</div>
                  <div className="text-lg font-bold text-white">{eventInfo.title}</div>
                  {eventInfo.severity && (
                    <span className={`text-sm ${SEVERITY_MAP[eventInfo.severity]?.color}`}>
                      {SEVERITY_MAP[eventInfo.severity]?.icon} {SEVERITY_MAP[eventInfo.severity]?.label}
                    </span>
                  )}
                </div>
              )}

              <div className="bg-gray-700/30 rounded-xl p-4 mb-6 space-y-1">
                <div className="text-sm text-gray-400">זוהה כ:</div>
                <div className="text-white font-bold text-lg">{contactInfo.name}</div>
                {contactInfo.department && <div className="text-gray-300 text-sm">{contactInfo.department}</div>}
                {contactInfo.role && <div className="text-gray-400 text-sm">{contactInfo.role}</div>}
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-3 text-sm text-center mb-4">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={() => handleConfirm('confirm')}
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3.5 rounded-xl transition-colors text-lg"
                >
                  {loading ? 'מצטרף...' : '✅ להשתתף באירוע'}
                </button>
                <button
                  onClick={() => handleConfirm('decline')}
                  disabled={loading}
                  className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 text-gray-300 font-bold py-3.5 rounded-xl transition-colors"
                >
                  ❌ לא להשתתף
                </button>
              </div>

              <button
                onClick={() => { setStep('phone'); setContactInfo(null); }}
                className="w-full mt-4 text-gray-500 hover:text-gray-300 text-sm py-2 transition-colors"
              >
                החלפת מספר
              </button>
            </>
          )}

          {/* Step: Guest register (unknown phone) */}
          {step === 'guest_register' && (
            <>
              <h1 className="text-2xl font-bold text-white text-center mb-2">הרשמה מהירה</h1>
              <p className="text-gray-400 text-center text-sm mb-2">המספר {phone} לא נמצא במערכת</p>

              {eventInfo && (
                <div className="bg-gray-700/50 rounded-xl p-3 mb-6 text-center">
                  <div className="text-sm text-gray-400">אירוע:</div>
                  <div className="text-white font-bold">{eventInfo.title}</div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">שם מלא</label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && guestName.trim() && handleConfirm('confirm')}
                    placeholder="הזן את שמך"
                    className="w-full px-4 py-3.5 bg-gray-700/50 border-2 border-gray-600 rounded-xl text-white text-lg focus:border-blue-500 focus:outline-none placeholder-gray-500"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-3 text-sm text-center">
                    {error}
                  </div>
                )}

                <button
                  onClick={() => handleConfirm('confirm')}
                  disabled={!guestName.trim() || loading}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3.5 rounded-xl transition-colors text-lg"
                >
                  {loading ? 'מצטרף...' : '✅ הצטרף לאירוע'}
                </button>
                <button
                  onClick={() => handleConfirm('decline')}
                  disabled={loading}
                  className="w-full bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 text-gray-300 font-bold py-3 rounded-xl transition-colors"
                >
                  ❌ לא להשתתף
                </button>
              </div>

              <button
                onClick={() => { setStep('phone'); }}
                className="w-full mt-4 text-gray-500 hover:text-gray-300 text-sm py-2 transition-colors"
              >
                החלפת מספר
              </button>
            </>
          )}

          {/* Step: Done */}
          {step === 'done' && (
            <>
              {result === 'declined' ? (
                <div className="text-center">
                  <div className="text-5xl mb-4">❌</div>
                  <h1 className="text-2xl font-bold text-white mb-2">סירבת להשתתף</h1>
                  <p className="text-gray-400">אם תשנה דעתך, תוכל להשתמש באותו לינק שוב</p>
                </div>
              ) : result === 'already_joined' ? (
                <div className="text-center">
                  <div className="text-5xl mb-4">👋</div>
                  <h1 className="text-2xl font-bold text-white mb-2">כבר הצטרפת!</h1>
                  <p className="text-gray-400 mb-6">את/ה כבר רשום/ה לאירוע הזה</p>
                  <button
                    onClick={goToLiveJournal}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-colors text-lg"
                  >
                    📋 כנס ליומן האירוע
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-5xl mb-4">✅</div>
                  <h1 className="text-2xl font-bold text-white mb-2">הצטרפת בהצלחה!</h1>
                  {eventInfo && (
                    <p className="text-gray-400 mb-6">הצטרפת לאירוע: {eventInfo.title}</p>
                  )}
                  <button
                    onClick={goToLiveJournal}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-colors text-lg"
                  >
                    📋 כנס ליומן האירוע
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          מקלטון © {new Date().getFullYear()} עיריית יהוד-מונוסון
        </p>
      </div>
    </div>
  );
}
