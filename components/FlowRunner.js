'use client';

import { useState, useEffect } from 'react';
import onCallData from '@/data/onCall.json';
import AddressInput from './AddressInput';

export default function FlowRunner({ flow, onEnd }) {
  const [currentStepId, setCurrentStepId] = useState(null);
  const [sessionLog, setSessionLog] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});
  const [timer, setTimer] = useState(null);
  const [timerActive, setTimerActive] = useState(false);
  const [formData, setFormData] = useState({});
  const [eventData, setEventData] = useState({});
  const [activations, setActivations] = useState({});
  const [copySuccess, setCopySuccess] = useState(false);
  const [stepHistory, setStepHistory] = useState([]);
  const [warMode, setWarMode] = useState(false);
  const [nearbyShelters, setNearbyShelters] = useState([]);
  const [actionCompleted, setActionCompleted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('warMode');
    if (saved) {
      try {
        setWarMode(JSON.parse(saved));
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (flow && flow.steps && flow.steps.length > 0) {
      const firstStep = flow.steps[0];
      setCurrentStepId(firstStep.id);
      const now = new Date();
      setStartTime(now);
      setSessionLog([]);
      setCheckedItems({});
      setFormData({});
      setEventData({});
      setActivations({});
      setTimer(null);
      setTimerActive(false);
      setStepHistory([]);
      setActionCompleted(false);
      addToLog(`התחלת אירוע: ${flow.title}`, now);
      if (warMode) {
        addToLog('🚨 מצב מלחמה פעיל - מדלג על שלבי מקלטים והתקשרויות');
      }
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
        setTimer(prev => {
          if (prev === 1) {
            // Play sound when timer ends
            try {
              const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+Dyvm');
              audio.play().catch(() => {}); // Ignore errors if audio fails
            } catch (e) {}
            addToLog('⏰ הטיימר הסתיים! בדוק מצב.');
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer, timerActive]);

  const addToLog = (message, timestamp = new Date()) => {
    setSessionLog((prev) => [...prev, { message, timestamp: timestamp.toISOString() }]);
  };

  const currentStep = flow?.steps?.find((s) => s.id === currentStepId);

  const resolveTemplate = (template) => {
    if (!template) return '';
    const now = new Date();
    const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('he-IL');
    
    // Add checked items from checklist
    let checklistText = '';
    if (currentStep?.checklist && currentStep.checklist.length > 0) {
      const checkedList = currentStep.checklist
        .map((item, idx) => checkedItems[idx] ? `✓ ${item}` : null)
        .filter(Boolean);
      if (checkedList.length > 0) {
        checklistText = '\n\nפעולות שבוצעו:\n' + checkedList.join('\n');
      }
    }
    
    // Add nearby shelters if available
    let sheltersText = '';
    if (nearbyShelters.length > 0) {
      sheltersText = '\n\nמקלטים קרובים:\n';
      nearbyShelters.forEach((shelter, idx) => {
        const distance = (shelter.distance / 1000).toFixed(2);
        sheltersText += `${idx + 1}. ${shelter.name} (${shelter.number}) - ${shelter.address} (${distance} ק"מ)\n`;
      });
    }
    
    let result = template
      .replace(/\{time\}/g, `${dateStr} ${timeStr}`)
      .replace(/\{activated_count\}/g, String(Object.values(activations).filter(Boolean).length));
    Object.entries(eventData).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
    });
    return result + checklistText + sheltersText;
  };

  const handleCopyMessage = (template) => {
    const text = resolveTemplate(template);
    navigator.clipboard.writeText(text).then(() => {
      setCopySuccess(true);
      addToLog(`העתקת הודעה: ${text.substring(0, 50)}...`);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const goToStep = (nextStepId) => {
    if (nextStepId) {
      let targetStepId = nextStepId;
      const targetStep = flow?.steps?.find(s => s.id === targetStepId);
      
      // Skip steps with skipInWarMode flag when war mode is active
      if (warMode && targetStep?.skipInWarMode) {
        addToLog(`⏭️ מדלג על שלב: ${targetStep.label} (מצב מלחמה)`);
        // Find the next step and recursively check
        if (targetStep.nextStep) {
          targetStepId = targetStep.nextStep;
          const recursiveCheck = (stepId) => {
            const step = flow?.steps?.find(s => s.id === stepId);
            if (step && warMode && step.skipInWarMode && step.nextStep) {
              addToLog(`⏭️ מדלג על שלב: ${step.label} (מצב מלחמה)`);
              return recursiveCheck(step.nextStep);
            }
            return stepId;
          };
          targetStepId = recursiveCheck(targetStepId);
        } else if (targetStep.yesNext) {
          // For decision steps, use yesNext path
          targetStepId = targetStep.yesNext;
          const recursiveCheck = (stepId) => {
            const step = flow?.steps?.find(s => s.id === stepId);
            if (step && warMode && step.skipInWarMode) {
              addToLog(`⏭️ מדלג על שלב: ${step.label} (מצב מלחמה)`);
              if (step.nextStep) return recursiveCheck(step.nextStep);
              if (step.yesNext) return recursiveCheck(step.yesNext);
            }
            return stepId;
          };
          targetStepId = recursiveCheck(targetStepId);
        }
      }
      
      setStepHistory(prev => [...prev, currentStepId]);
      setCurrentStepId(targetStepId);
      addToLog(`מעבר לשלב: ${targetStep.label}`);
      setCheckedItems({});
      setFormData({});
      setTimerActive(false);
      setTimer(null);
      setActionCompleted(false);
    } else {
      handleEndEvent();
    }
  };

  const goBack = () => {
    if (stepHistory.length === 0) return;
    const prevStepId = stepHistory[stepHistory.length - 1];
    setStepHistory(prev => prev.slice(0, -1));
    setCurrentStepId(prevStepId);
    setCheckedItems({});
    setFormData({});
    setTimerActive(false);
    setTimer(null);
    addToLog(`חזרה לשלב: ${flow.steps.find(s => s.id === prevStepId)?.label || prevStepId}`);
  };

  const handleDecision = (answer) => {
    if (!currentStep) return;
    const nextStepId = answer === 'yes' ? currentStep.yesNext : currentStep.noNext;
    addToLog(`${currentStep.label}: ${answer === 'yes' ? 'כן' : 'לא'}`);
    goToStep(nextStepId);
  };

  const handleMultiOption = (option) => {
    addToLog(`${currentStep.label}: ${option.label}`);
    goToStep(option.next);
  };

  const handleChecklistChange = (index, item, checked) => {
    setCheckedItems({ ...checkedItems, [index]: checked });
    const status = checked ? '✓ הושלם' : '✗ בוטל';
    addToLog(`${status}: ${item}`);
  };

  const handleFormSubmit = () => {
    if (!currentStep) return;
    const merged = { ...eventData, ...formData };
    setEventData(merged);
    addToLog(`טופס מולא: ${currentStep.label}`);
    Object.entries(formData).forEach(([key, value]) => {
      if (value) addToLog(`  ${key}: ${value}`);
    });
    goToStep(currentStep.nextStep);
  };

  const handleAction = () => {
    if (!currentStep) return;
    if (currentStep.formFields) {
      const merged = { ...eventData, ...formData };
      setEventData(merged);
    }
    addToLog(`בוצע: ${currentStep.label}`);
    setActionCompleted(true);
  };

  const handleActionContinue = () => {
    setActionCompleted(false);
    goToStep(currentStep.nextStep);
  };

  const handleActivationToggle = (contactId, contactName) => {
    const newState = !activations[contactId];
    setActivations({ ...activations, [contactId]: newState });
    const status = newState ? '✓ הוקפץ' : '✗ בוטל';
    const time = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    addToLog(`${status}: ${contactName} (${time})`);
  };

  const handleActivationsNext = () => {
    const count = Object.values(activations).filter(Boolean).length;
    addToLog(`סה"כ הוקפצו: ${count} אנשים`);
    setEventData({ ...eventData, activated_count: count });
    goToStep(currentStep.nextStep);
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
      eventData,
      activations,
    };
    localStorage.setItem('lastEventLog', JSON.stringify(summary));
    downloadLog();
    if (onEnd) onEnd(summary);
  };

  const downloadLog = () => {
    const endTime = new Date();
    const duration = startTime ? Math.round((endTime - startTime) / 1000 / 60) : 0;
    let textContent = `סיכום אירוע - ${flow.title}\n`;
    textContent += `${'='.repeat(60)}\n\n`;
    textContent += `🕐 התחלה: ${startTime?.toLocaleString('he-IL')}\n`;
    textContent += `🕐 סיום: ${endTime.toLocaleString('he-IL')}\n`;
    textContent += `⏱️ משך זמן: ${duration} דקות\n\n`;
    textContent += `${'='.repeat(60)}\n`;
    textContent += `📋 היסטוריית פעולות:\n`;
    textContent += `${'='.repeat(60)}\n\n`;
    sessionLog.forEach((entry, index) => {
      const time = new Date(entry.timestamp).toLocaleTimeString('he-IL');
      textContent += `${index + 1}. [${time}] ${entry.message}\n`;
    });
    if (Object.keys(eventData).length > 0) {
      textContent += `\n${'='.repeat(60)}\n`;
      textContent += `📝 נתוני אירוע:\n`;
      Object.entries(eventData).forEach(([k, v]) => {
        textContent += `  ${k}: ${v}\n`;
      });
    }
    const activatedCount = Object.values(activations).filter(Boolean).length;
    if (activatedCount > 0) {
      textContent += `\n${'='.repeat(60)}\n`;
      textContent += `📞 הקפצות (${activatedCount}):\n`;
      Object.entries(activations).forEach(([id, activated]) => {
        if (activated) textContent += `  ✓ ${id}\n`;
      });
    }
    textContent += `\n${'='.repeat(60)}\n`;
    textContent += `סוף דוח\n`;
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    a.download = `סיכום-אירוע-${timestamp}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getAllOnCallContacts = () => {
    const contacts = [];
    const overrides = typeof window !== 'undefined' ? localStorage.getItem('onCallActiveOverrides') : null;
    let parsed = null;
    if (overrides) {
      try { parsed = JSON.parse(overrides); } catch {}
    }
    Object.keys(onCallData.departments).forEach(deptKey => {
      const dept = onCallData.departments[deptKey];
      dept.contacts.forEach(contact => {
        const isActive = parsed ? (parsed[contact.id] !== undefined ? parsed[contact.id] : contact.active) : contact.active;
        if (isActive) {
          contacts.push({ ...contact, department: dept.name });
        }
      });
    });
    return contacts;
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
            <div className={`px-8 py-6 rounded-2xl shadow-2xl border-4 ${timer <= 60 ? 'bg-gradient-to-br from-red-500 to-pink-600 border-red-300 animate-pulse' : 'bg-gradient-to-br from-blue-500 to-indigo-600 border-blue-300'}`}>
              <div className="text-center text-white">
                <div className="text-lg font-bold mb-2">⏱️ טיימר</div>
                <div className="text-6xl font-black tracking-wider">
                  {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
                </div>
                {timer <= 60 && (
                  <div className="text-sm font-semibold mt-2 animate-pulse">⚠️ פחות מדקה!</div>
                )}
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

        {currentStep.reminder && (
          <div className="mb-5 p-5 bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-400 rounded-xl shadow-md">
            <div className="flex items-start gap-3">
              <span className="text-3xl">📱</span>
              <div>
                <p className="text-yellow-900 font-bold text-lg">תזכורת וואטסאפ</p>
                <p className="text-yellow-800 font-medium text-lg">{currentStep.reminder}</p>
              </div>
            </div>
          </div>
        )}

        {currentStep.roleNote && (
          <div className="mb-5 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border-2 border-indigo-300 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-2xl">👥</span>
              <p className="text-indigo-900 font-bold">{currentStep.roleNote}</p>
            </div>
          </div>
        )}

        {currentStep.copyMessage && (!currentStep.checklist || Object.values(checkedItems).some(Boolean)) && (
          <div className="mb-5 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📋</span>
                <p className="text-green-900 font-bold">הודעה להעתקה:</p>
              </div>
              <button
                onClick={() => handleCopyMessage(currentStep.copyMessage)}
                className={`px-5 py-2 rounded-lg font-bold transition-all shadow-md ${
                  copySuccess
                    ? 'bg-green-600 text-white'
                    : 'bg-green-500 hover:bg-green-600 text-white hover:shadow-lg'
                }`}
              >
                {copySuccess ? '✓ הועתק!' : '📋 העתק'}
              </button>
            </div>
            <pre className="bg-white rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap border border-green-200 font-sans leading-relaxed" dir="rtl">
              {resolveTemplate(currentStep.copyMessage)}
            </pre>
          </div>
        )}

        {/* DECISION step */}
        {currentStep.type === 'decision' && !currentStep.options && (
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

        {/* MULTI-OPTION DECISION step */}
        {currentStep.type === 'decision' && currentStep.options && (
          <div>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 mb-6">
              <p className="text-xl font-semibold text-gray-900">{currentStep.question}</p>
            </div>
            <div className="space-y-3">
              {currentStep.options.map((option, idx) => {
                const colors = [
                  'from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700',
                  'from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700',
                  'from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700',
                  'from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700',
                ];
                return (
                  <button
                    key={idx}
                    onClick={() => handleMultiOption(option)}
                    className={`w-full bg-gradient-to-r ${colors[idx % colors.length]} text-white font-bold py-4 px-6 rounded-xl text-lg transition-all shadow-lg hover:shadow-xl hover:scale-105`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ACTION step */}
        {currentStep.type === 'action' && (
          <div>
            {!actionCompleted ? (
              <>
                {currentStep.formFields && (
                  <div className="mb-6 space-y-3">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <p className="text-blue-900 font-bold">📝 מלא פרטים:</p>
                    </div>
                    {currentStep.formFields.map((field) => (
                      <div key={field.id}>
                        <label className="block text-sm font-bold text-gray-900 mb-1">{field.label}{field.required && ' *'}</label>
                        {field.id === 'address' ? (
                          <AddressInput
                            value={formData[field.id] || ''}
                            onChange={(value) => setFormData({ ...formData, [field.id]: value })}
                            onNearbySheltersChange={setNearbyShelters}
                          />
                        ) : field.type === 'textarea' ? (
                          <textarea
                            value={formData[field.id] || ''}
                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                            rows={3}
                            required={field.required}
                          />
                        ) : (
                          <input
                            type={field.type || 'text'}
                            value={formData[field.id] || ''}
                            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                            required={field.required}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {currentStep.checklist && currentStep.checklist.length > 0 && (
                  <div className="mb-6 space-y-3">
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-3 mb-4">
                      <p className="text-purple-900 font-bold">✓ רשימת משימות לביצוע:</p>
                    </div>
                    {currentStep.checklist.map((item, index) => (
                      <label key={index} className="flex items-center p-4 bg-gradient-to-r from-white to-gray-50 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-blue-400 hover:shadow-md transition-all">
                        <input
                          type="checkbox"
                          checked={checkedItems[index] || false}
                          onChange={(e) => handleChecklistChange(index, item, e.target.checked)}
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
              </>
            ) : (
              <>
                {currentStep.copyMessage && (
                  <div className="mb-6 p-6 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-orange-400 rounded-xl">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-4xl">⚠️</span>
                      <div>
                        <p className="text-orange-900 font-bold text-xl">שלח הודעה זו לקבוצת החירום!</p>
                        <p className="text-orange-700 text-sm">העתק את ההודעה ושלח בוואטסאפ</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-green-900 font-bold">📋 הודעה להעתקה:</p>
                      <button
                        onClick={() => handleCopyMessage(currentStep.copyMessage)}
                        className={`px-5 py-2 rounded-lg font-bold transition-all shadow-md ${
                          copySuccess
                            ? 'bg-green-600 text-white'
                            : 'bg-green-500 hover:bg-green-600 text-white hover:shadow-lg'
                        }`}
                      >
                        {copySuccess ? '✓ הועתק!' : '📋 העתק'}
                      </button>
                    </div>
                    <pre className="bg-white rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap border border-green-200 font-sans leading-relaxed" dir="rtl">
                      {resolveTemplate(currentStep.copyMessage)}
                    </pre>
                  </div>
                )}
                <button
                  onClick={handleActionContinue}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-5 px-6 rounded-xl text-2xl transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center gap-3"
                >
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  המשך לשלב הבא
                </button>
              </>
            )}
          </div>
        )}

        {/* FORM step */}
        {currentStep.type === 'form' && (
          <div>
            <div className="mb-6 space-y-4">
              {currentStep.formFields?.map((field) => (
                <div key={field.id}>
                  <label className="block text-lg font-bold text-gray-900 mb-2">
                    {field.label}{field.required && ' *'}
                  </label>
                  {field.id === 'address' ? (
                    <AddressInput
                      value={formData[field.id] || ''}
                      onChange={(value) => setFormData({ ...formData, [field.id]: value })}
                      onNearbySheltersChange={setNearbyShelters}
                    />
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={formData[field.id] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                      className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      rows={3}
                      required={field.required}
                    />
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={formData[field.id] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                      className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      required={field.required}
                    />
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={handleFormSubmit}
              disabled={currentStep.formFields?.some(f => f.required && !formData[f.id])}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-5 px-6 rounded-xl text-2xl transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center gap-3"
            >
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              שלח ועבור לשלב הבא
            </button>
          </div>
        )}

        {/* ACTIVATIONS step - הקפצת מכלול */}
        {currentStep.type === 'activations' && (
          <div>
            <div className="mb-4 p-4 bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-300 rounded-xl">
              <div className="flex items-center justify-between">
                <p className="text-orange-900 font-bold text-lg">📞 רשימת הקפצות — סמן כל איש שהוקפץ</p>
                <span className="bg-orange-600 text-white px-3 py-1 rounded-full font-bold">
                  {Object.values(activations).filter(Boolean).length} הוקפצו
                </span>
              </div>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {getAllOnCallContacts().map((contact) => (
                <label
                  key={contact.id}
                  className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    activations[contact.id]
                      ? 'border-green-400 bg-green-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={activations[contact.id] || false}
                      onChange={() => handleActivationToggle(contact.id, contact.name)}
                      className="w-6 h-6 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <div>
                      <p className="font-bold text-gray-900">{contact.name}</p>
                      <p className="text-sm text-gray-600">{contact.department}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-mono text-gray-700" dir="ltr">{contact.phone}</p>
                    {activations[contact.id] && (
                      <p className="text-xs text-green-600 font-bold">✓ הוקפץ</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
            <button
              onClick={handleActivationsNext}
              className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-5 px-6 rounded-xl text-2xl transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center justify-center gap-3"
            >
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              סיימתי הקפצות — המשך
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={goBack}
          disabled={stepHistory.length === 0}
          className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-bold py-4 px-5 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          חזור אחורה
        </button>
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
