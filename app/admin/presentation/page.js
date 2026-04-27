'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield, Clock, Users, TrendingUp, CheckCircle, AlertTriangle, BarChart3, Zap, Target, DollarSign, Award } from 'lucide-react';

export default function PresentationPage() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') setCurrentSlide(prev => Math.min(prev + 1, slides.length - 1));
      if (e.key === 'ArrowLeft') setCurrentSlide(prev => Math.max(prev - 1, 0));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const slides = [
    // שקף 1: פתיחה
    {
      title: "מערכת מקלטון",
      subtitle: "מערכת ניהול חירום משולבת לעיריית יהוד-מונוסון",
      content: (
        <div className="text-center space-y-8">
          <div className="text-8xl mb-8">🚨</div>
          <h1 className="text-6xl font-bold bg-gradient-to-r from-red-600 via-orange-500 to-red-700 bg-clip-text text-transparent">
            מקלטון
          </h1>
          <p className="text-3xl text-gray-600 font-medium">
            הפתרון המקיף לניהול חירום עירוני
          </p>
          <div className="grid grid-cols-3 gap-6 mt-12 text-center">
            <div className="p-6 bg-blue-50 rounded-xl">
              <Shield className="w-12 h-12 mx-auto mb-3 text-blue-600" />
              <div className="text-2xl font-bold text-blue-900">100%</div>
              <div className="text-sm text-gray-600">כיסוי מלא</div>
            </div>
            <div className="p-6 bg-green-50 rounded-xl">
              <Zap className="w-12 h-12 mx-auto mb-3 text-green-600" />
              <div className="text-2xl font-bold text-green-900">7 דק׳</div>
              <div className="text-sm text-gray-600">זמן תגובה ממוצע</div>
            </div>
            <div className="p-6 bg-purple-50 rounded-xl">
              <Users className="w-12 h-12 mx-auto mb-3 text-purple-600" />
              <div className="text-2xl font-bold text-purple-900">7</div>
              <div className="text-sm text-gray-600">תפקידים במערכת</div>
            </div>
          </div>
        </div>
      )
    },

    // שקף 2: הבעיה
    {
      title: "המצב לפני המערכת",
      subtitle: "אתגרים קריטיים בניהול חירום",
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-red-50 border-r-4 border-red-500 p-6 rounded-lg">
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-bold text-red-900 mb-2">אין תקשורת אחידה</h3>
                  <p className="text-gray-700">כל מוקדן עובד אחרת, אין נוהל מוגדר, טעויות תפעוליות</p>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 border-r-4 border-orange-500 p-6 rounded-lg">
              <div className="flex items-start gap-4">
                <Clock className="w-8 h-8 text-orange-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-bold text-orange-900 mb-2">בזבוז זמן קריטי</h3>
                  <p className="text-gray-700">חיפוש מידע, עיכובים, חוסר ידע היכן הדברים</p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border-r-4 border-yellow-500 p-6 rounded-lg">
              <div className="flex items-start gap-4">
                <Users className="w-8 h-8 text-yellow-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-bold text-yellow-900 mb-2">קושי לתאם גורמים</h3>
                  <p className="text-gray-700">מוקד, מכלולים, מנהלי מקלטים - כל אחד בנפרד</p>
                </div>
              </div>
            </div>

            <div className="bg-red-50 border-r-4 border-red-500 p-6 rounded-lg">
              <div className="flex items-start gap-4">
                <BarChart3 className="w-8 h-8 text-red-600 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-xl font-bold text-red-900 mb-2">אין תיעוד ומעקב</h3>
                  <p className="text-gray-700">קשה לדעת מה קרה, מי עשה מה, ולמדוד ביצועים</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-red-100 to-orange-100 p-6 rounded-xl border-2 border-red-300 mt-8">
            <p className="text-2xl font-bold text-center text-red-900">
              ⏱️ בחירום, כל שנייה קובעת - אי אפשר להרשות לעצמנו לבזבז זמן!
            </p>
          </div>
        </div>
      )
    },

    // שקף 3: הפתרון
    {
      title: "מקלטון - הפתרון המשולב",
      subtitle: "כל מה שצריך במקום אחד",
      content: (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-2xl">📋</div>
              <h3 className="text-2xl font-bold text-blue-900">נהלי תפעול חכמים</h3>
            </div>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>הדרכה שלב-אחר-שלב למוקדנים</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>הודעות מוכנות להעתקה לתושבים</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>טיימרים אוטומטיים לבדיקות</span>
              </li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center text-2xl">🏠</div>
              <h3 className="text-2xl font-bold text-green-900">מקלטים חכמים</h3>
            </div>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>חיפוש מקלט קרוב לפי כתובת</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>פתיחה/סגירה בלחיצת כפתור</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>מעקב סטטוס בזמן אמת</span>
              </li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center text-2xl">📞</div>
              <h3 className="text-2xl font-bold text-purple-900">כוננויות ותיאום</h3>
            </div>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>לוח תורנויות שבועי דיגיטלי</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>הקפצות מכלולים בקליק</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>רשימת אנשי קשר מעודכנת</span>
              </li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl border border-orange-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-orange-600 rounded-lg flex items-center justify-center text-2xl">🗺️</div>
              <h3 className="text-2xl font-bold text-orange-900">מפה חיה</h3>
            </div>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>סימון אירועים ונקודות עניין</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>חסימות כבישים בזמן אמת</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>שיתוף מידע בין כל הגורמים</span>
              </li>
            </ul>
          </div>
        </div>
      )
    },

    // שקף 4: 7 תפקידים
    {
      title: "מערכת משולבת - 7 תפקידים",
      subtitle: "כל אחד רואה ועושה בדיוק מה שצריך",
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border-2 border-blue-200 p-4 rounded-lg shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">1</div>
                <h3 className="text-lg font-bold text-blue-900">מוקדן (Operator)</h3>
              </div>
              <p className="text-sm text-gray-600">מריץ נהלים, מחפש מקלטים, מעדכן תושבים</p>
            </div>

            <div className="bg-white border-2 border-green-200 p-4 rounded-lg shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">2</div>
                <h3 className="text-lg font-bold text-green-900">מנהל מוקד</h3>
              </div>
              <p className="text-sm text-gray-600">מנהל מוקדנים, מקצה משימות, שולח הודעות</p>
            </div>

            <div className="bg-white border-2 border-purple-200 p-4 rounded-lg shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">3</div>
                <h3 className="text-lg font-bold text-purple-900">מנהל מכלול</h3>
              </div>
              <p className="text-sm text-gray-600">מנהל כוננויות במכלול, משמרות, אנשי קשר</p>
            </div>

            <div className="bg-white border-2 border-orange-200 p-4 rounded-lg shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold">4</div>
                <h3 className="text-lg font-bold text-orange-900">מנהל מקלטים</h3>
              </div>
              <p className="text-sm text-gray-600">אחראי על מקלטים, תחזוקה, דוחות</p>
            </div>

            <div className="bg-white border-2 border-red-200 p-4 rounded-lg shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-bold">5</div>
                <h3 className="text-lg font-bold text-red-900">פקח (Inspector)</h3>
              </div>
              <p className="text-sm text-gray-600">מעדכן שטח, מוסיף סימונים, דוחות בדיקה</p>
            </div>

            <div className="bg-white border-2 border-indigo-200 p-4 rounded-lg shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">6</div>
                <h3 className="text-lg font-bold text-indigo-900">מנכ״ל (CEO)</h3>
              </div>
              <p className="text-sm text-gray-600">דשבורד ניהולי, תצוגה כללית, צפייה בהכל</p>
            </div>

            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-400 p-4 rounded-lg shadow-md">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-yellow-600 rounded-full flex items-center justify-center text-white font-bold">7</div>
                <h3 className="text-lg font-bold text-yellow-900">מנהל מערכת (Admin)</h3>
              </div>
              <p className="text-sm text-gray-700 font-medium">שליטה מלאה - ניהול משתמשים, הרשאות, תוכן</p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-100 to-purple-100 p-6 rounded-xl border-2 border-blue-300 mt-6">
            <p className="text-xl font-bold text-center text-blue-900">
              🔐 RBAC - כל תפקיד רואה רק מה שרלוונטי לו | אבטחה מלאה
            </p>
          </div>
        </div>
      )
    },

    // שקף 5: יתרונות עסקיים
    {
      title: "ערך עסקי וחיסכון",
      subtitle: "למה המערכת משתלמת?",
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                <Clock className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-green-600 mb-2">60%</h3>
              <p className="text-gray-700 font-medium">חיסכון בזמן תגובה</p>
              <p className="text-sm text-gray-500 mt-1">מ-15 דק׳ ל-7 דק׳</p>
            </div>

            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                <TrendingUp className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-blue-600 mb-2">80%</h3>
              <p className="text-gray-700 font-medium">פחות טעויות תפעוליות</p>
              <p className="text-sm text-gray-500 mt-1">נהלים אחידים</p>
            </div>

            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                <Users className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-3xl font-bold text-purple-600 mb-2">100%</h3>
              <p className="text-gray-700 font-medium">שקיפות ומעקב</p>
              <p className="text-sm text-gray-500 mt-1">יומן מלא של כל פעולה</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-400 rounded-xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <DollarSign className="w-12 h-12 text-yellow-600" />
              <h3 className="text-2xl font-bold text-yellow-900">ROI - החזר השקעה</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-gray-700">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span><strong>חיסכון בשעות עבודה:</strong> 40+ שעות/חודש</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span><strong>פחות תלונות תושבים:</strong> שירות מהיר ומקצועי</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span><strong>מוניטין עירוני:</strong> עירייה מתקדמת וטכנולוגית</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span><strong>ציות לתקנות:</strong> תיעוד מלא לכל אירוע</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl text-center">
            <Award className="w-16 h-16 mx-auto mb-3" />
            <p className="text-2xl font-bold">
              📊 משפרים את הביצועים שלנו ב-60% - מציבים את יהוד-מונוסון בחזית הטכנולוגיה!
            </p>
          </div>
        </div>
      )
    },

    // שקף 6: הדגמה חיה
    {
      title: "הדגמה חיה",
      subtitle: "נראה את המערכת בפעולה",
      content: (
        <div className="space-y-8">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-8 rounded-2xl border-2 border-blue-300">
            <h2 className="text-4xl font-bold text-center text-blue-900 mb-8">
              🎬 הדגמה חיה - 5 דקות
            </h2>
            
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-lg shadow-md border-r-4 border-blue-500">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">1</div>
                  <div>
                    <h3 className="font-bold text-lg text-blue-900">מוקדן מריץ נוהל חירום</h3>
                    <p className="text-sm text-gray-600">התראה מוקדמת ← אזעקה | הדרכה שלב-אחר-שלב</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-md border-r-4 border-green-500">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">2</div>
                  <div>
                    <h3 className="font-bold text-lg text-green-900">חיפוש מקלט קרוב לתושב</h3>
                    <p className="text-sm text-gray-600">הזנת כתובת → 3 מקלטים קרובים + מפה</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-md border-r-4 border-purple-500">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">3</div>
                  <div>
                    <h3 className="font-bold text-lg text-purple-900">מפה חיה - סימון אירוע</h3>
                    <p className="text-sm text-gray-600">קליק אחד על המפה → כולם רואים בזמן אמת</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-md border-r-4 border-orange-500">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold">4</div>
                  <div>
                    <h3 className="font-bold text-lg text-orange-900">דשבורד מנכ״ל</h3>
                    <p className="text-sm text-gray-600">תצוגה כללית של כל מה שקורה במערכת</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-2xl text-gray-700">
              ⏱️ <strong>בואו נראה את זה בפעולה...</strong>
            </p>
          </div>
        </div>
      )
    },

    // שקף 7: סיכום וצעדים הבאים
    {
      title: "סיכום וצעדים הבאים",
      subtitle: "איפה אנחנו הולכים מכאן?",
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border-2 border-green-300">
            <h3 className="text-2xl font-bold text-green-900 mb-4 flex items-center gap-3">
              <CheckCircle className="w-8 h-8" />
              מה כבר עובד היום?
            </h3>
            <div className="grid grid-cols-2 gap-3 text-gray-700">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span>✅ 7 תפקידים פעילים</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span>✅ נהלי חירום שלמים</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span>✅ מערכת מקלטים</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span>✅ מפה חיה</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span>✅ ניהול כוננויות</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span>✅ יומן ותיעוד מלא</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border-2 border-blue-300">
            <h3 className="text-2xl font-bold text-blue-900 mb-4 flex items-center gap-3">
              <Target className="w-8 h-8" />
              שדרוגים עתידיים (3-6 חודשים)
            </h3>
            <div className="grid grid-cols-2 gap-3 text-gray-700">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-blue-600 text-white rounded flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                <span><strong>אפליקציית מובייל</strong> - למנהלים וכוננים בשטח</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-blue-600 text-white rounded flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                <span><strong>התראות Push</strong> - עדכונים אוטומטיים</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-blue-600 text-white rounded flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
                <span><strong>אינטגרציה עם Ekron</strong> - קישור למערכות עירוניות</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-blue-600 text-white rounded flex items-center justify-center text-xs font-bold flex-shrink-0">4</div>
                <span><strong>דוחות PDF</strong> - דוחות מעוצבים למנהלים</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-blue-600 text-white rounded flex items-center justify-center text-xs font-bold flex-shrink-0">5</div>
                <span><strong>אנליטיקה מתקדמת</strong> - ניתוח ביצועים</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 bg-blue-600 text-white rounded flex items-center justify-center text-xs font-bold flex-shrink-0">6</div>
                <span><strong>AI Assistant</strong> - עוזר וירטואלי חכם</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-8 rounded-2xl text-center">
            <h2 className="text-4xl font-bold mb-4">🚀 מקלטון - מוכן לפעולה!</h2>
            <p className="text-2xl font-medium">
              מערכת שמצילה זמן, מפחיתה טעויות, ומציבה את יהוד-מונוסון בחזית הטכנולוגיה
            </p>
            <div className="mt-6 pt-6 border-t-2 border-white/30">
              <p className="text-xl">שאלות? בואו נדבר!</p>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <>
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          .print\\:show-all-slides .slide-container {
            display: block !important;
            page-break-after: always;
            margin-bottom: 2rem;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
      
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 print:show-all-slides" dir="rtl">
        {/* Header */}
      <div className="bg-white border-b shadow-sm print:hidden">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              חזרה למנהל מערכת
            </button>
            <div className="text-center flex-1">
              <h1 className="text-xl font-bold text-gray-900">מצגת מקלטון</h1>
              <p className="text-sm text-gray-500">
                שקף {currentSlide + 1} מתוך {slides.length}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                🖨️ הדפסה/PDF
              </button>
              <div className="text-sm text-gray-500">
                ⌨️ חצים לניווט
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Slide Header */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-8 py-6">
            <h2 className="text-4xl font-bold mb-2">{slides[currentSlide].title}</h2>
            <p className="text-xl text-blue-100">{slides[currentSlide].subtitle}</p>
          </div>

          {/* Slide Content */}
          <div className="p-8 min-h-[600px]">
            {slides[currentSlide].content}
          </div>

          {/* Navigation */}
          <div className="border-t bg-gray-50 px-8 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentSlide(prev => Math.max(prev - 1, 0))}
                disabled={currentSlide === 0}
                className="px-6 py-3 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 rounded-lg font-medium transition-colors"
              >
                ← שקף קודם
              </button>

              {/* Slide Indicators */}
              <div className="flex gap-2">
                {slides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`w-3 h-3 rounded-full transition-all ${
                      index === currentSlide 
                        ? 'bg-blue-600 w-8' 
                        : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={() => setCurrentSlide(prev => Math.min(prev + 1, slides.length - 1))}
                disabled={currentSlide === slides.length - 1}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-lg font-medium transition-colors"
              >
                שקף הבא →
              </button>
            </div>
          </div>
        </div>

        {/* Quick Tips */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-4">
          <div className="flex items-center gap-6 justify-center text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-gray-100 rounded border">←</kbd>
              <kbd className="px-2 py-1 bg-gray-100 rounded border">→</kbd>
              <span>ניווט בין שקפים</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-600">●</span>
              <span>לחיצה על נקודה לקפיצה לשקף</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>זמן משוער: 7 דקות</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
