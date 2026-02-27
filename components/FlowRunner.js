'use client';

import { useState, useEffect } from 'react';

export default function FlowRunner({ flow, onEnd }) {
  const [currentStepId, setCurrentStepId] = useState(null);
  const [sessionLog, setSessionLog] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});
  const [timer, setTimer] = useState(null);
  const [timerActive, setTimerActive] = useState(false);

  useEffect(() => {
    if (flow && flow.steps && flow.steps.length > 0) {
      const firstStep = flow.steps[0];
      setCurrentStepId(firstStep.id);
      const now = new Date();
      setStartTime(now);
      addToLog(`התחלת אירוע: ${flow.title}`, now);
    }
  }, [flow]);

  useEffect(() => {
    if (currentStep?.timer && !timerActive) {
      setTimer(currentStep.timer);
      setTimerActive(true);
    }
  }, [currentStepId]);

  useEffect(() => {
    if (timer > 0 && timerActive) {
      const interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer, timerActive]);

  const addToLog = (message, timestamp = new Date()) => {
    setSessionLog((prev) => [...prev, { message, timestamp: timestamp.toISOString() }]);
  };

  const currentStep = flow?.steps?.find((s) => s.id === currentStepId);

  const handleDecision = (answer) => {
    if (!currentStep) return;
    
    const nextStepId = answer === 'yes' ? currentStep.yesNext : currentStep.noNext;
    addToLog(`${currentStep.label}: ${answer === 'yes' ? 'כן' : 'לא'}`);
    
    if (nextStepId) {
      setCurrentStepId(nextStepId);
      setCheckedItems({});
      setTimerActive(false);
      setTimer(null);
    } else {
      handleEndEvent();
    }
  };

  const handleAction = () => {
    if (!currentStep) return;
    
    addToLog(`בוצע: ${currentStep.label}`);
    
    if (currentStep.nextStep) {
      setCurrentStepId(currentStep.nextStep);
      setCheckedItems({});
      setTimerActive(false);
      setTimer(null);
    } else {
      handleEndEvent();
    }
  };

  const handleEndEvent = () => {
    const endTime = new Date();
    addToLog(`סיום אירוע: ${flow.title}`, endTime);
    
    const summary = {
      eventType: flow.title,
      startTime: startTime?.toISOString(),
      endTime: endTime.toISOString(),
      duration: startTime ? Math.round((endTime - startTime) / 1000 / 60) : 0,
      log: sessionLog,
    };
    
    localStorage.setItem('lastEventLog', JSON.stringify(summary));
    
    if (onEnd) {
      onEnd(summary);
    }
  };

  const downloadLog = () => {
    const summary = {
      eventType: flow.title,
      startTime: startTime?.toISOString(),
      endTime: new Date().toISOString(),
      log: sessionLog,
    };
    
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!currentStep) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500 text-center">בחר סוג אירוע והתחל</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg border-2 border-gray-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-red-500 to-orange-500 text-white rounded-full p-3 shadow-lg">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">{currentStep.label}</h3>
              <p className="text-sm text-gray-500">⏱️ משך האירוע: {startTime ? Math.round((new Date() - startTime) / 1000 / 60) : 0} דקות</p>
            </div>
          </div>
          {timer !== null && timerActive && (
            <div className={`px-5 py-3 rounded-xl shadow-lg ${timer <= 60 ? 'bg-gradient-to-br from-red-500 to-pink-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'}`}>
              <div className="text-center text-white">
                <div className="text-sm font-semibold mb-1">טיימר</div>
                <div className="text-3xl font-bold">
                  {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
                </div>
              </div>
            </div>
          )}
        </div>

        {currentStep.criticalNote && (
          <div className="mb-5 p-5 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-300 rounded-xl shadow-md">
            <div className="flex items-start gap-3">
              <div className="bg-red-500 text-white rounded-full p-2 shadow-lg">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-red-900 font-bold text-lg">התראה חשובה!</p>
                <p className="text-red-800 font-medium">{currentStep.criticalNote}</p>
              </div>
            </div>
          </div>
        )}

        {currentStep.type === 'decision' && (
          <div>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 mb-6">
              <p className="text-xl font-semibold text-gray-900">{currentStep.question}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleDecision('yes')}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-5 px-6 rounded-xl text-2xl transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center gap-2"
              >
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                כן
              </button>
              <button
                onClick={() => handleDecision('no')}
                className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold py-5 px-6 rounded-xl text-2xl transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center gap-2"
              >
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                לא
              </button>
            </div>
          </div>
        )}

        {currentStep.type === 'action' && (
          <div>
            {currentStep.checklist && (
              <div className="mb-6 space-y-3">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-3 mb-4">
                  <p className="text-purple-900 font-bold">✓ רשימת משימות לביצוע:</p>
                </div>
                {currentStep.checklist.map((item, index) => (
                  <label key={index} className="flex items-center p-4 bg-gradient-to-r from-white to-gray-50 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-blue-400 hover:shadow-md transition-all">
                    <input
                      type="checkbox"
                      checked={checkedItems[index] || false}
                      onChange={(e) => setCheckedItems({ ...checkedItems, [index]: e.target.checked })}
                      className="w-6 h-6 ml-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-lg text-gray-900 font-medium">{item}</span>
                  </label>
                ))}
              </div>
            )}
            <button
              onClick={handleAction}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-5 px-6 rounded-xl text-2xl transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center gap-3"
            >
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              בוצע בהצלחה
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleEndEvent}
          className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold py-4 px-5 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          סיום אירוע
        </button>
        <button
          onClick={downloadLog}
          className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-bold py-4 px-5 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          ייצוא לוג
        </button>
      </div>

      <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white rounded-full p-2 shadow-md">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <h4 className="text-lg font-bold text-gray-900">היסטוריית פעולות</h4>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto bg-gray-50 rounded-lg p-3 border border-gray-200">
          {sessionLog.length === 0 ? (
            <p className="text-gray-400 text-center py-4">אין פעולות עדיין</p>
          ) : (
            sessionLog.map((entry, index) => (
              <div key={index} className="bg-white rounded-lg p-3 border border-gray-200 hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-3">
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded font-mono text-xs font-semibold">
                    {new Date(entry.timestamp).toLocaleTimeString('he-IL')}
                  </span>
                  <span className="text-sm text-gray-800 flex-1">{entry.message}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
