import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import appGuide from '@/data/app-guide.json';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// =====================================================
// SESSION MEMORY - conversation history per session
// =====================================================
const sessions = {};
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes
const MAX_MESSAGES = 20;

function getSession(sessionId) {
  if (!sessionId) return null;
  const session = sessions[sessionId];
  if (!session) return null;
  if (Date.now() - session.lastActive > SESSION_TTL) {
    delete sessions[sessionId];
    return null;
  }
  session.lastActive = Date.now();
  return session;
}

function createSession(sessionId) {
  sessions[sessionId] = { messages: [], lastActive: Date.now() };
  // Cleanup old sessions
  const now = Date.now();
  Object.keys(sessions).forEach(id => {
    if (now - sessions[id].lastActive > SESSION_TTL) delete sessions[id];
  });
  return sessions[sessionId];
}

// =====================================================
// HELPERS
// =====================================================

function getIsraelDate() {
  const now = new Date();
  const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const year = israelTime.getFullYear();
  const month = String(israelTime.getMonth() + 1).padStart(2, '0');
  const day = String(israelTime.getDate()).padStart(2, '0');
  return { dateStr: `${year}-${month}-${day}`, dayOfWeek: israelTime.getDay(), currentHour: israelTime.getHours(), currentMinute: israelTime.getMinutes() };
}

function isShiftActive(startHour, endHour, currentHour) {
  if (startHour === endHour) return true;
  if (endHour < startHour) return currentHour >= startHour || currentHour < endHour;
  return currentHour >= startHour && currentHour < endHour;
}

// =====================================================
// SMART SEARCH - scoring-based knowledge search
// =====================================================

async function searchKnowledgeBase(question) {
  const { data: allEntries } = await supabase
    .from('knowledge_base')
    .select('id, title, content, category, tags, contacts')
    .eq('is_active', true);

  if (!allEntries || allEntries.length === 0) return [];

  const queryWords = question.split(/\s+/).filter(w => w.length > 1);
  
  const scored = allEntries.map(entry => {
    let score = 0;
    const titleLower = (entry.title || '').toLowerCase();
    const contentLower = (entry.content || '').toLowerCase();
    const questionLower = question.toLowerCase();

    // Exact title match
    if (titleLower.includes(questionLower)) score += 100;

    // Word-by-word scoring
    for (const word of queryWords) {
      const w = word.toLowerCase();
      if (titleLower.includes(w)) score += 30;
      if (contentLower.includes(w)) score += 15;
      if (entry.tags && entry.tags.some(t => t.toLowerCase().includes(w))) score += 25;
    }

    // Bonus for multiple word matches in title
    const titleMatches = queryWords.filter(w => titleLower.includes(w.toLowerCase())).length;
    if (titleMatches >= 2) score += titleMatches * 20;

    return { ...entry, score };
  });

  return scored
    .filter(e => e.score > 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

// =====================================================
// FETCH DAILY UPDATES & NOTIFICATIONS
// =====================================================

async function fetchDailyUpdatesAndNotifications() {
  let context = '';

  try {
    // Daily updates
    const now = new Date().toISOString();
    const { data: updates } = await supabase
      .from('daily_updates')
      .select('*')
      .lte('start_time', now)
      .gt('end_time', now)
      .order('start_time', { ascending: false });

    if (updates && updates.length > 0) {
      context += '\n## עדכונים יומיים פעילים:\n';
      updates.forEach(u => {
        context += `- 📢 **${u.title}**: ${u.content || u.message || ''}`;
        if (u.category) context += ` [${u.category}]`;
        context += '\n';
      });
    }

    // General notifications
    const { data: notifications } = await supabase
      .from('general_notifications')
      .select('*')
      .or('start_date.is.null,start_date.lte.' + now)
      .or('end_date.is.null,end_date.gte.' + now)
      .or('expires_at.is.null,expires_at.gte.' + now)
      .order('created_at', { ascending: false })
      .limit(10);

    if (notifications && notifications.length > 0) {
      context += '\n## הודעות והנחיות פעילות:\n';
      notifications.forEach(n => {
        const important = n.is_important ? '⚠️ ' : '';
        context += `- ${important}**${n.title}**: ${n.message || ''}\n`;
      });
    }
  } catch (error) {
    console.error('Error fetching updates/notifications:', error);
  }

  return context;
}

// =====================================================
// FETCH LIVE OPERATIONAL DATA
// =====================================================

async function fetchLiveData() {
  const { dateStr, dayOfWeek, currentHour, currentMinute } = getIsraelDate();
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  let liveContext = `\n\n=== מידע חי - יום ${dayNames[dayOfWeek]}, ${dateStr}, שעה ${currentHour}:${String(currentMinute).padStart(2, '0')} ===\n`;

  try {
    // 1. Security daily order
    const { data: departments } = await supabase
      .from('departments')
      .select('id, name')
      .eq('active', true);

    if (departments) {
      for (const dept of departments) {
        const { data: order } = await supabase
          .from('security_daily_orders')
          .select('*')
          .eq('department_id', dept.id)
          .eq('order_date', dateStr)
          .single();

        if (order) {
          const { data: orderEntries } = await supabase
            .from('security_daily_order_entries')
            .select('*, staff:security_staff(*)')
            .eq('order_id', order.id)
            .eq('is_removed', false)
            .order('display_order');

          if (orderEntries && orderEntries.length > 0) {
            const nowWorking = [];
            const allDay = [];
            orderEntries.forEach(e => {
              const name = e.staff_name || e.staff?.name || 'לא ידוע';
              const startH = parseInt(e.start_time?.split(':')[0] || '0');
              const endH = parseInt(e.end_time?.split(':')[0] || '0');
              const info = `${name} | ${e.role_title || ''} | ${e.start_time}-${e.end_time} | רכב: ${e.vehicle || 'לא צוין'}`;
              const tasks = (e.tasks && e.tasks.length > 0) ? ` | משימות: ${e.tasks.join(', ')}` : '';
              allDay.push(`- ${info}${tasks}`);
              if (isShiftActive(startH, endH, currentHour)) {
                nowWorking.push(`- ${info}${tasks}`);
              }
            });

            liveContext += `\n## עובדים כרגע ב${dept.name} (שעה ${currentHour}:${String(currentMinute).padStart(2, '0')}):\n`;
            liveContext += nowWorking.length > 0 ? nowWorking.join('\n') + '\n' : 'אין עובדים כרגע\n';
            liveContext += `\n## כל העובדים היום ב${dept.name}:\n`;
            liveContext += allDay.join('\n') + '\n';
            if (order.general_notes) liveContext += `הערות כלליות: ${order.general_notes}\n`;
          }
        }
      }
    }

    // 2. Duty roster - emergency on-call
    const { data: duties } = await supabase
      .from('duty_roster')
      .select('*, contacts(*), departments(name)')
      .eq('day_of_week', dayOfWeek)
      .eq('active', true);

    if (duties && duties.length > 0) {
      const currentlyOnCall = duties.filter(d => isShiftActive(d.start_hour, d.end_hour, currentHour));
      if (currentlyOnCall.length > 0) {
        liveContext += `\n## כוננים כרגע (כוננות חירום, שעה ${currentHour}:00):\n`;
        currentlyOnCall.forEach(d => {
          const name = d.contacts?.full_name || 'לא ידוע';
          const phone = d.contacts?.phone || '';
          const dept = d.departments?.name || '';
          liveContext += `- ${name} | ${dept} | ${d.start_hour}:00-${d.end_hour}:00 | ${phone}\n`;
        });
      }
    }

    // 3. On-call contacts
    const { data: onCallContacts } = await supabase
      .from('on_call_contacts')
      .select('*')
      .eq('active', true);

    if (onCallContacts && onCallContacts.length > 0) {
      liveContext += '\n## אנשי קשר כוננות (רשימה קבועה):\n';
      onCallContacts.forEach(c => {
        const vacation = c.on_vacation ? ' (בחופש)' : '';
        liveContext += `- ${c.name} | ${c.phone}${vacation}\n`;
      });
    }

    // 4. Garbage collection schedule
    const { data: garbageSchedule } = await supabase
      .from('garbage_collection_schedule')
      .select('*')
      .eq('is_active', true)
      .order('collection_day')
      .order('street_name');

    if (garbageSchedule && garbageSchedule.length > 0) {
      liveContext += '\n## לוח זמנים פינוי גזם:\n';
      liveContext += 'חשוב: יום ההוצאה = יום לפני הפינוי. יש לומר לתושב מתי להוציא ומתי הפינוי.\n\n';
      garbageSchedule.forEach(s => {
        if (s.street_name === 'אנשי קשר תברואה') return;
        liveContext += `- ${s.street_name}: פינוי יום ${s.collection_day_hebrew}`;
        if (s.takeout_day_hebrew) liveContext += ` | הוצאה יום ${s.takeout_day_hebrew}`;
        liveContext += ` | ${s.zone}`;
        if (s.notes) liveContext += ` | ${s.notes}`;
        liveContext += '\n';
      });
    }

  } catch (error) {
    console.error('Error fetching live data:', error);
    liveContext += '\n(שגיאה בטעינת מידע חי)\n';
  }

  return liveContext;
}

// =====================================================
// SYSTEM PROMPT
// =====================================================

const SYSTEM_PROMPT_BASE = `אתה עוזר AI מתקדם למוקדנים במוקד עיריית יהוד-מונוסון, במערכת "מקלטון".

**תפקידך:**
1. לענות על שאלות מוקדנים בצורה מקצועית, ברורה ותמציתית
2. לספק מידע מדויק על נהלים, תהליכים, אנשי קשר
3. לעזור לזהות סוג פנייה ולהפנות לגורם המתאים
4. לספק מידע חי - מי עובד/כונן, עדכונים פעילים
5. לענות על שאלות טכניות על איך להשתמש במערכת

**חשוב - הבחנה בין סוגי שאלות:**

**1. שאלת מידע (תשובה פשוטה):**
דוגמאות: "מי עובד היום?", "מה הנוהל לגרירה?", "איך מפעילים מצב חירום?"
→ תן תשובה ישירה וקצרה

**2. דיווח/תלונה (צריך הכוונה):**
דוגמאות: "תושב מתלונן על רכב נטוש", "יש כלב משוטט ברחוב"
→ תן למוקדן:
• למי להפנות (שם + טלפון)
• שאלות לבירור מול התושב
• הערות חשובות

**כללים:**
- ענה תמיד בעברית
- היה תמציתי - אל תחזור על מידע שכבר נאמר בשיחה
- אם יש טלפון רלוונטי, ציין אותו
- אם יש כמה שלבים, מספר אותם
- אל תמציא מידע שלא נמצא במקורות
- אם אין לך מידע, אמור בבירור שאין ושיש לפנות למנהל המוקד
- כששואלים "מי עובד עכשיו/כרגע" - הצג רק את מי שהמשמרת שלו פעילה עכשיו
- כששואלים "מי עובד היום" - הצג את כל רשימת העובדים ליום
- "כוננים" = כוננות חירום, לא עובדים רגילים
- כששואלים על גזם ברחוב ספציפי: חפש ברשימה, תן יום פינוי + יום הוצאה + אנשי קשר. מונוסון = שישי וראשון
- זכור את ההקשר של השיחה ואל תחזור על עצמך`;

// =====================================================
// POST - Main chat endpoint
// =====================================================

export async function POST(request) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ success: false, error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { question, user_name, session_id } = body;

    if (!question) {
      return NextResponse.json({ success: false, error: 'question is required' }, { status: 400 });
    }

    // Session management
    const sid = session_id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let session = getSession(sid) || createSession(sid);

    // Parallel data fetching
    const [scoredEntries, liveData, updatesContext] = await Promise.all([
      searchKnowledgeBase(question),
      fetchLiveData(),
      fetchDailyUpdatesAndNotifications()
    ]);

    // Build knowledge context (only relevant entries)
    const knowledgeContext = scoredEntries.map(entry => {
      let text = `## ${entry.title} (רלוונטיות: ${entry.score})\nקטגוריה: ${entry.category}\n${entry.content}`;
      if (entry.contacts && entry.contacts.length > 0) {
        text += '\nאנשי קשר: ' + entry.contacts.map(c => `${c.name} - ${c.phone}${c.role ? ` (${c.role})` : ''}`).join(', ');
      }
      return text;
    }).join('\n\n---\n\n');

    // App guide
    const appGuideContext = appGuide.guide.map(g => `## ${g.topic}\n${g.content}`).join('\n\n');

    // Build full system prompt with all context
    const fullSystemPrompt = `${SYSTEM_PROMPT_BASE}

=== מדריך המערכת ===
${appGuideContext}

=== מאגר ידע מבצעי ===
${knowledgeContext || '(אין ערכים רלוונטיים במאגר)'}

${updatesContext}

${liveData}`;

    // Build messages array with conversation history
    const messages = [
      { role: 'system', content: fullSystemPrompt },
      ...session.messages.slice(-MAX_MESSAGES),
      { role: 'user', content: question }
    ];

    // Call OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!openaiResponse.ok) {
      const errData = await openaiResponse.json().catch(() => ({}));
      console.error('OpenAI API error:', errData);
      return NextResponse.json({ success: false, error: 'שגיאה בשירות ה-AI' }, { status: 502 });
    }

    const aiData = await openaiResponse.json();
    const answer = aiData.choices?.[0]?.message?.content || 'לא הצלחתי לייצר תשובה';

    // Save to session memory
    session.messages.push(
      { role: 'user', content: question },
      { role: 'assistant', content: answer }
    );
    // Trim session if too long
    if (session.messages.length > MAX_MESSAGES * 2) {
      session.messages = session.messages.slice(-MAX_MESSAGES);
    }

    // Save to chat history (async, don't block response)
    supabase.from('knowledge_chat_history').insert({
      user_name: user_name || 'מוקדן',
      question,
      answer,
      sources: scoredEntries.map(e => e.id)
    }).then(() => {}).catch(err => console.error('Failed to save chat history:', err));

    return NextResponse.json({
      success: true,
      answer,
      session_id: sid
    });

  } catch (error) {
    console.error('Knowledge chat error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
