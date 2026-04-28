'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function SurveyPage() {
  const params = useParams();
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [surveyNotFound, setSurveyNotFound] = useState(false);
  const [surveyClosed, setSurveyClosed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    respondent_name: '',
    q1_courtesy: null,
    q2_professional: null,
    q3_helpful: null,
    q4_problem_solving: null,
    improvements_text: ''
  });

  useEffect(() => {
    // Check if survey exists and is active
    checkSurvey();
  }, [token]);

  const checkSurvey = async () => {
    try {
      const res = await fetch(`/api/surveys/submit`, {
        method: 'HEAD'
      });
      // For now, just mark as loaded
      setLoading(false);
    } catch (error) {
      console.error('Error checking survey:', error);
      setLoading(false);
    }
  };

  const handleQuestionChange = (question, value) => {
    setFormData(prev => ({
      ...prev,
      [question]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if at least one question is answered
    if (!formData.q1_courtesy && !formData.q2_professional && !formData.q3_helpful && !formData.q4_problem_solving) {
      alert('נא לענות לפחות על שאלה אחת');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/surveys/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          ...formData
        })
      });

      const data = await res.json();

      if (res.ok) {
        setSubmitted(true);
      } else if (res.status === 429) {
        alert(data.error || 'כבר מילאת את הסקר היום');
      } else if (res.status === 404) {
        setSurveyNotFound(true);
      } else if (res.status === 400 && data.error.includes('closed')) {
        setSurveyClosed(true);
      } else {
        alert('שגיאה בשליחת הסקר. נסה שוב.');
      }
    } catch (error) {
      console.error('Error submitting survey:', error);
      alert('שגיאה בשליחת הסקר. נסה שוב.');
    } finally {
      setSubmitting(false);
    }
  };

  const QuestionRadioGroup = ({ question, questionText }) => {
    const value = formData[question];
    
    return (
      <div className="bg-white border-2 border-gray-200 rounded-lg p-4 sm:p-6 hover:border-blue-300 transition-colors">
        <p className="text-gray-900 font-medium mb-4 leading-relaxed text-base sm:text-lg">{questionText}</p>
        
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3">
          {[1, 2, 3, 4].map((num) => (
            <label
              key={num}
              className={`cursor-pointer ${
                value === num ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <input
                type="radio"
                name={question}
                value={num}
                checked={value === num}
                onChange={() => handleQuestionChange(question, num)}
                className="sr-only"
              />
              <div className={`border-2 rounded-lg p-3 sm:p-4 text-center transition-all min-h-[70px] sm:min-h-[80px] flex flex-col items-center justify-center ${
                value === num
                  ? 'bg-blue-500 border-blue-500 text-white font-bold'
                  : 'bg-white border-gray-300 hover:border-blue-400 hover:bg-blue-50 active:scale-95'
              }`}>
                <div className="text-xl sm:text-2xl font-bold">{num}</div>
                <div className="text-[10px] sm:text-xs mt-1">
                  {num === 1 && 'נמוך מאוד'}
                  {num === 2 && 'נמוך'}
                  {num === 3 && 'גבוה'}
                  {num === 4 && 'גבוה מאוד'}
                </div>
              </div>
            </label>
          ))}
          
          <label className="col-span-2 sm:flex-1 sm:min-w-[120px] cursor-pointer">
            <input
              type="radio"
              name={question}
              checked={value === null}
              onChange={() => handleQuestionChange(question, null)}
              className="sr-only"
            />
            <div className={`border-2 rounded-lg p-3 sm:p-4 text-center transition-all min-h-[70px] sm:min-h-[80px] flex items-center justify-center ${
              value === null
                ? 'bg-gray-500 border-gray-500 text-white font-bold'
                : 'bg-white border-gray-300 hover:border-gray-400 hover:bg-gray-50 active:scale-95'
            }`}>
              <div className="text-xs sm:text-sm font-medium">לא רלוונטי / אין דעה</div>
            </div>
          </label>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">טוען סקר...</p>
        </div>
      </div>
    );
  }

  if (surveyNotFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">סקר לא נמצא</h1>
          <p className="text-gray-600">הלינק לסקר אינו תקף או שהסקר נמחק.</p>
        </div>
      </div>
    );
  }

  if (surveyClosed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">הסקר נסגר</h1>
          <p className="text-gray-600">מצטערים, סקר זה כבר לא פעיל.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">תודה רבה!</h1>
          <p className="text-gray-600 text-lg leading-relaxed">
            הסקר נשלח בהצלחה.<br/>
            המשוב שלך חשוב לנו ויעזור לנו להשתפר.
          </p>
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-900">
              💙 המוקד העירוני יהוד-מונוסון
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-6 sm:py-12 px-3 sm:px-4" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-8 mb-4 sm:mb-6">
          <div className="text-center mb-4 sm:mb-6">
            <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">📊</div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4 leading-tight">
              סקר שביעות רצון – ממשק עבודה עם המוקד העירוני
            </h1>
            <div className="h-1 w-16 sm:w-24 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full mb-4 sm:mb-6"></div>
          </div>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
            <p className="text-sm sm:text-base text-gray-900 leading-relaxed mb-4">
              אנו במוקד העירוני פועלים באופן תמידי לשיפור השירות הן לתושבים והן לכם — הגורמים המטפלים. 
              נשמח אם תוכלו להקדיש מספר דקות למילוי סקר שביעות רצון ממשק העבודה עמנו, על מנת שנוכל ללמוד ולהשתפר.
            </p>
          </div>

          <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4 sm:p-6">
            <h3 className="font-bold text-purple-900 mb-3 text-sm sm:text-base">📋 הוראות למילוי הסקר:</h3>
            <ul className="space-y-2 text-gray-800 text-xs sm:text-sm">
              <li className="flex items-start gap-2">
                <span className="text-purple-500 font-bold mt-1">•</span>
                <span>אנא סמנו את התשובה המתאימה לכל אחד מהמשפטים, בהתאם לניסיונכם בעבודה מול המוקד</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 font-bold mt-1">•</span>
                <span>ניתן לסמן גם "לא רלוונטי / אין דעה" במידה ולא התעסקתם בנושא</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 font-bold mt-1">•</span>
                <span><strong>משך זמן משוער למילוי: 2–3 דקות</strong></span>
              </li>
            </ul>

            <div className="mt-4 pt-4 border-t-2 border-purple-200">
              <p className="font-bold text-purple-900 mb-2 text-sm">📊 סולם דירוג:</p>
              <div className="flex gap-2 sm:gap-3 flex-wrap text-xs sm:text-sm">
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full font-medium">1 - נמוך מאוד</span>
                <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full font-medium">2 - נמוך</span>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-medium">3 - גבוה</span>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">4 - גבוה מאוד</span>
                <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full font-medium">לא רלוונטי / אין דעה</span>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Optional Name Field */}
          <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
            <label className="block text-gray-700 font-medium mb-2 sm:mb-3 text-sm sm:text-base">
              שם (אופציונלי - ניתן להשאיר ריק למילוי אנונימי)
            </label>
            <input
              type="text"
              value={formData.respondent_name}
              onChange={(e) => setFormData(prev => ({ ...prev, respondent_name: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-base sm:text-lg"
              placeholder="לדוגמה: יוסי כהן"
            />
          </div>

          {/* Questions */}
          <QuestionRadioGroup
            question="q1_courtesy"
            questionText="נציגי המוקד מתנהגים באדיבות כלפיך."
          />

          <QuestionRadioGroup
            question="q2_professional"
            questionText="נציגי המוקד מקצועיים בהעברת פרטי הפנייה ובמתן המידע הנדרש לטיפול."
          />

          <QuestionRadioGroup
            question="q3_helpful"
            questionText="נציגי המוקד מוכנים לסייע כאשר מתעוררת בעיה בשטח."
          />

          <QuestionRadioGroup
            question="q4_problem_solving"
            questionText="נציגי המוקד מתאמצים לעזור בפתרון הבעיה של התושב."
          />

          {/* Free Text */}
          <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
            <label className="block text-gray-900 font-medium mb-2 sm:mb-3 text-sm sm:text-base">
              האם לדעתך ישנם נושאים שבהם המוקד צריך להשתפר? אנא פרט/י:
            </label>
            <textarea
              value={formData.improvements_text}
              onChange={(e) => setFormData(prev => ({ ...prev, improvements_text: e.target.value }))}
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-base sm:text-lg resize-none min-h-[120px]"
              placeholder="כאן ניתן לכתוב הערות, הצעות לשיפור, או כל דבר אחר שחשוב לך..."
            />
          </div>

          {/* Submit Button */}
          <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 sm:px-8 rounded-xl font-bold text-lg sm:text-xl hover:from-blue-700 hover:to-purple-700 transition-all transform active:scale-95 sm:hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg min-h-[56px]"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  שולח...
                </span>
              ) : (
                '✅ שלח סקר'
              )}
            </button>
            
            <p className="text-center text-xs sm:text-sm text-gray-500 mt-3 sm:mt-4">
              לחיצה על "שלח סקר" תשלח את התשובות שלך באופן מאובטח
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-600 text-sm">
          <p>💙 המוקד העירוני יהוד-מונוסון</p>
          <p className="mt-1">תודה על שיתוף הפעולה!</p>
        </div>
      </div>
    </div>
  );
}
