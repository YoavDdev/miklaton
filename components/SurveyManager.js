'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function SurveyManager() {
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResponsesModal, setShowResponsesModal] = useState(false);
  const [newSurveyTitle, setNewSurveyTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loadingResponses, setLoadingResponses] = useState(false);

  useEffect(() => {
    loadSurveys();
  }, []);

  const loadSurveys = async () => {
    try {
      const res = await fetch('/api/surveys', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setSurveys(data.surveys || []);
      }
    } catch (error) {
      console.error('Error loading surveys:', error);
      toast.error('שגיאה בטעינת סקרים');
    } finally {
      setLoading(false);
    }
  };

  const createSurvey = async () => {
    if (!newSurveyTitle.trim()) {
      toast.error('נא להזין כותרת לסקר');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: newSurveyTitle })
      });

      if (res.ok) {
        toast.success('סקר נוצר בהצלחה! 📊');
        setShowCreateModal(false);
        setNewSurveyTitle('');
        loadSurveys();
      } else {
        toast.error('שגיאה ביצירת סקר');
      }
    } catch (error) {
      console.error('Error creating survey:', error);
      toast.error('שגיאה ביצירת סקר');
    } finally {
      setCreating(false);
    }
  };

  const closeSurvey = async (surveyId) => {
    if (!confirm('האם לסגור את הסקר? לא יהיה ניתן למלא אותו יותר.')) {
      return;
    }

    try {
      const res = await fetch('/api/surveys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: surveyId, status: 'closed' })
      });

      if (res.ok) {
        toast.success('הסקר נסגר בהצלחה');
        loadSurveys();
      } else {
        toast.error('שגיאה בסגירת סקר');
      }
    } catch (error) {
      console.error('Error closing survey:', error);
      toast.error('שגיאה בסגירת סקר');
    }
  };

  const reopenSurvey = async (surveyId) => {
    try {
      const res = await fetch('/api/surveys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: surveyId, status: 'active' })
      });

      if (res.ok) {
        toast.success('הסקר נפתח מחדש');
        loadSurveys();
      } else {
        toast.error('שגיאה בפתיחת סקר');
      }
    } catch (error) {
      console.error('Error reopening survey:', error);
      toast.error('שגיאה בפתיחת סקר');
    }
  };

  const deleteSurvey = async (surveyId) => {
    if (!confirm('האם למחוק את הסקר לצמיתות? פעולה זו אינה הפיכה!\n\nכל התשובות שהתקבלו ימחקו גם כן.')) {
      return;
    }

    try {
      const res = await fetch('/api/surveys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: surveyId })
      });

      if (res.ok) {
        toast.success('הסקר נמחק בהצלחה');
        loadSurveys();
      } else {
        toast.error('שגיאה במחיקת סקר');
      }
    } catch (error) {
      console.error('Error deleting survey:', error);
      toast.error('שגיאה במחיקת סקר');
    }
  };

  const loadResponses = async (survey) => {
    setSelectedSurvey(survey);
    setShowResponsesModal(true);
    setLoadingResponses(true);

    try {
      const res = await fetch(`/api/surveys/${survey.id}/responses`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        console.log('📊 Loaded responses:', data.responses?.length || 0, 'responses');
        console.log('Full data:', data.responses);
        setResponses(data.responses || []);
      }
    } catch (error) {
      console.error('Error loading responses:', error);
      toast.error('שגיאה בטעינת תשובות');
    } finally {
      setLoadingResponses(false);
    }
  };

  const copyWhatsAppMessage = (survey) => {
    const surveyUrl = `${window.location.origin}/survey/${survey.token}`;
    const message = `היי! 👋\nנשמח לשמוע את דעתך על השירות שלנו - מוקד עירוני 106 עיריית יהוד מונוסון.\nמלא/י סקר קצר (2-3 דקות):\n${surveyUrl}\nתודה! 🙏`;
    
    navigator.clipboard.writeText(message);
    toast.success('הודעת WhatsApp הועתקה! 📋');
  };

  const copyLink = (survey) => {
    const surveyUrl = `${window.location.origin}/survey/${survey.token}`;
    navigator.clipboard.writeText(surveyUrl);
    toast.success('הלינק הועתק! 🔗');
  };

  const exportToExcel = (survey) => {
    // Filter responses for this survey
    const surveyResponses = responses.filter(r => r.survey_id === survey.id);
    
    if (surveyResponses.length === 0) {
      toast.error('אין תשובות לייצא');
      return;
    }

    // Create CSV content
    const headers = ['תאריך', 'שעה', 'שם', 'שאלה 1', 'שאלה 2', 'שאלה 3', 'שאלה 4', 'הערות לשיפור'];
    const rows = surveyResponses.map(r => {
      const date = new Date(r.submitted_at);
      return [
        date.toLocaleDateString('he-IL'),
        date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
        r.respondent_name || 'אנונימי',
        r.q1_courtesy || 'לא ענה',
        r.q2_professional || 'לא ענה',
        r.q3_helpful || 'לא ענה',
        r.q4_problem_solving || 'לא ענה',
        r.improvements_text || ''
      ];
    });

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const bom = '\uFEFF'; // UTF-8 BOM for Hebrew support in Excel
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `סקר_${survey.title}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast.success('הקובץ יוצא! 📊');
  };

  const calculateStats = () => {
    if (responses.length === 0) return null;

    const stats = {
      q1: responses.filter(r => r.q1_courtesy).map(r => r.q1_courtesy),
      q2: responses.filter(r => r.q2_professional).map(r => r.q2_professional),
      q3: responses.filter(r => r.q3_helpful).map(r => r.q3_helpful),
      q4: responses.filter(r => r.q4_problem_solving).map(r => r.q4_problem_solving)
    };

    return {
      q1_avg: stats.q1.length > 0 ? (stats.q1.reduce((a, b) => a + b, 0) / stats.q1.length).toFixed(1) : 'N/A',
      q2_avg: stats.q2.length > 0 ? (stats.q2.reduce((a, b) => a + b, 0) / stats.q2.length).toFixed(1) : 'N/A',
      q3_avg: stats.q3.length > 0 ? (stats.q3.reduce((a, b) => a + b, 0) / stats.q3.length).toFixed(1) : 'N/A',
      q4_avg: stats.q4.length > 0 ? (stats.q4.reduce((a, b) => a + b, 0) / stats.q4.length).toFixed(1) : 'N/A',
      total: responses.length,
      with_name: responses.filter(r => r.respondent_name).length,
      anonymous: responses.filter(r => !r.respondent_name).length,
      with_comments: responses.filter(r => r.improvements_text && r.improvements_text.trim()).length
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 sm:p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">📊 סקרי שביעות רצון</h2>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">צור סקרים ושלח למטפלים דרך WhatsApp</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full sm:w-auto px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 font-medium flex items-center justify-center gap-2 text-sm sm:text-base"
        >
          ➕ סקר חדש
        </button>
      </div>

      <div className="p-4 sm:p-6">
        {surveys.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">📊</div>
            <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">אין סקרים עדיין</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 font-medium text-sm sm:text-base"
            >
              צור סקר ראשון
            </button>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {surveys.map((survey) => (
              <div
                key={survey.id}
                className={`border-2 rounded-lg p-4 sm:p-6 ${
                  survey.status === 'active' ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900">{survey.title}</h3>
                      {survey.status === 'active' ? (
                        <span className="px-2 sm:px-3 py-1 bg-green-500 text-white text-[10px] sm:text-xs font-bold rounded-full w-fit">
                          ✓ פעיל
                        </span>
                      ) : (
                        <span className="px-2 sm:px-3 py-1 bg-gray-500 text-white text-[10px] sm:text-xs font-bold rounded-full w-fit">
                          ✕ סגור
                        </span>
                      )}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0">
                      <span>נוצר: {new Date(survey.created_at).toLocaleDateString('he-IL')}</span>
                      {survey.closed_at && (
                        <span className="sm:mr-4"><span className="hidden sm:inline">• </span>נסגר: {new Date(survey.closed_at).toLocaleDateString('he-IL')}</span>
                      )}
                      <span className="sm:mr-4 font-bold text-blue-600"><span className="hidden sm:inline">• </span>{survey.response_count} תשובות</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
                  <button
                    onClick={() => copyWhatsAppMessage(survey)}
                    className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 active:scale-95 font-medium flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-base"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    WhatsApp
                  </button>

                  <button
                    onClick={() => copyLink(survey)}
                    className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 active:scale-95 font-medium flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-base"
                  >
                    🔗 העתק לינק
                  </button>

                  <button
                    onClick={() => loadResponses(survey)}
                    className="px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 active:scale-95 font-medium flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-base"
                  >
                    📊 תוצאות ({survey.response_count})
                  </button>

                  {survey.status === 'active' ? (
                    <button
                      onClick={() => closeSurvey(survey.id)}
                      className="px-3 sm:px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 active:scale-95 font-medium text-xs sm:text-base"
                    >
                      🔒 סגור סקר
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => reopenSurvey(survey.id)}
                        className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 active:scale-95 font-medium text-xs sm:text-base"
                      >
                        🔓 פתח מחדש
                      </button>
                      <button
                        onClick={() => deleteSurvey(survey.id)}
                        className="px-3 sm:px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 active:scale-95 font-medium text-xs sm:text-base"
                      >
                        🗑️ מחק
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Survey Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 sm:p-6">
            <div className="flex justify-between items-start mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">📊 סקר חדש</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewSurveyTitle('');
                }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">כותרת הסקר</label>
                <input
                  type="text"
                  value={newSurveyTitle}
                  onChange={(e) => setNewSurveyTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-pink-500 focus:border-pink-500"
                  placeholder="למשל: סקר שביעות רצון - אפריל 2026"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>💡 טיפ:</strong> כדאי לכלול את החודש/תקופה בכותרת כדי לעקוב בקלות
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={createSurvey}
                  disabled={creating || !newSurveyTitle.trim()}
                  className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'יוצר...' : '✅ צור סקר'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewSurveyTitle('');
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

      {/* Responses Modal */}
      {showResponsesModal && selectedSurvey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-gray-900">📊 תוצאות: {selectedSurvey.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{responses.length} תשובות</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => exportToExcel(selectedSurvey)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
                >
                  📥 ייצא לאקסל
                </button>
                <button
                  onClick={() => {
                    setShowResponsesModal(false);
                    setSelectedSurvey(null);
                    setResponses([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingResponses ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
                </div>
              ) : responses.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📭</div>
                  <p className="text-gray-600">אין תשובות עדיין</p>
                </div>
              ) : (
                <>
                  {/* Statistics */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-6">
                    <h4 className="font-bold text-lg mb-4">📈 סטטיסטיקה</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {(() => {
                        const stats = calculateStats();
                        return (
                          <>
                            <div className="bg-white rounded-lg p-4 text-center">
                              <div className="text-2xl font-bold text-blue-600">{stats.q1_avg}</div>
                              <div className="text-xs text-gray-600 mt-1">אדיבות</div>
                            </div>
                            <div className="bg-white rounded-lg p-4 text-center">
                              <div className="text-2xl font-bold text-green-600">{stats.q2_avg}</div>
                              <div className="text-xs text-gray-600 mt-1">מקצועיות</div>
                            </div>
                            <div className="bg-white rounded-lg p-4 text-center">
                              <div className="text-2xl font-bold text-purple-600">{stats.q3_avg}</div>
                              <div className="text-xs text-gray-600 mt-1">נכונות לסייע</div>
                            </div>
                            <div className="bg-white rounded-lg p-4 text-center">
                              <div className="text-2xl font-bold text-orange-600">{stats.q4_avg}</div>
                              <div className="text-xs text-gray-600 mt-1">פתרון בעיות</div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <div className="mt-4 flex gap-4 text-sm text-gray-700">
                      <span>👤 עם שם: {calculateStats().with_name}</span>
                      <span>🕶️ אנונימי: {calculateStats().anonymous}</span>
                      <span>💬 הערות: {calculateStats().with_comments}</span>
                    </div>
                  </div>

                  {/* Individual Responses */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-lg mb-4">📝 תשובות מפורטות</h4>
                    {responses.map((response, index) => (
                      <div key={response.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <span className="font-bold text-gray-900">
                              {response.respondent_name || '🕶️ אנונימי'}
                            </span>
                            <span className="text-sm text-gray-500 mr-3">
                              #{responses.length - index}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(response.submitted_at).toLocaleString('he-IL')}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-4 gap-3 mb-3">
                          <div className="text-center">
                            <div className="text-sm font-medium text-gray-600">אדיבות</div>
                            <div className="text-2xl font-bold text-blue-600">
                              {response.q1_courtesy || '-'}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-medium text-gray-600">מקצועיות</div>
                            <div className="text-2xl font-bold text-green-600">
                              {response.q2_professional || '-'}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-medium text-gray-600">נכונות לסייע</div>
                            <div className="text-2xl font-bold text-purple-600">
                              {response.q3_helpful || '-'}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-medium text-gray-600">פתרון בעיות</div>
                            <div className="text-2xl font-bold text-orange-600">
                              {response.q4_problem_solving || '-'}
                            </div>
                          </div>
                        </div>

                        {response.improvements_text && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-3">
                            <div className="text-sm font-medium text-yellow-900 mb-1">💡 הערות לשיפור:</div>
                            <div className="text-sm text-yellow-800">{response.improvements_text}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
