import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import appGuide from '@/data/app-guide.json';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Helper: Get today's date in Israel timezone
function getIsraelDate() {
  const now = new Date();
  const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const year = israelTime.getFullYear();
  const month = String(israelTime.getMonth() + 1).padStart(2, '0');
  const day = String(israelTime.getDate()).padStart(2, '0');
  return { dateStr: `${year}-${month}-${day}`, dayOfWeek: israelTime.getDay(), currentHour: israelTime.getHours() };
}

// Helper: Check if a shift is active at a given hour
function isShiftActive(startHour, endHour, currentHour) {
  if (startHour === endHour) return true; // 24h shift
  if (endHour < startHour) {
    // Overnight shift (e.g. 22:00-06:00)
    return currentHour >= startHour || currentHour < endHour;
  }
  return currentHour >= startHour && currentHour < endHour;
}

// Helper: Fetch live data from Supabase
async function fetchLiveData() {
  const { dateStr, dayOfWeek, currentHour } = getIsraelDate();
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  let liveContext = `\n\n=== מידע חי - יום ${dayNames[dayOfWeek]}, ${dateStr}, שעה ${currentHour}:00 ===\n`;

  try {
    // 1. Security daily order for today (פקחים/ביטחון - מי עובד היום)
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
            // Split into currently working vs full schedule
            const now = [];
            const allDay = [];
            orderEntries.forEach(e => {
              const name = e.staff_name || e.staff?.name || 'לא ידוע';
              const startH = parseInt(e.start_time?.split(':')[0] || '0');
              const endH = parseInt(e.end_time?.split(':')[0] || '0');
              const info = `${name} | ${e.role_title || ''} | ${e.start_time}-${e.end_time} | רכב: ${e.vehicle || 'לא צוין'}`;
              const tasks = (e.tasks && e.tasks.length > 0) ? ` | משימות: ${e.tasks.join(', ')}` : '';
              allDay.push(`- ${info}${tasks}`);
              if (isShiftActive(startH, endH, currentHour)) {
                now.push(`- ${info}${tasks}`);
              }
            });

            liveContext += `\n## עובדים כרגע ב${dept.name} (שעה ${currentHour}:00):\n`;
            liveContext += now.length > 0 ? now.join('\n') + '\n' : 'אין עובדים כרגע\n';
            
            liveContext += `\n## כל העובדים היום ב${dept.name}:\n`;
            liveContext += allDay.join('\n') + '\n';

            if (order.general_notes) {
              liveContext += `הערות כלליות: ${order.general_notes}\n`;
            }
          }
        }
      }
    }

    // 2. Duty roster - כוננות חירום (לא עובדים רגילים!)
    const { data: duties } = await supabase
      .from('duty_roster')
      .select('*, contacts(*), departments(name)')
      .eq('day_of_week', dayOfWeek)
      .eq('active', true);

    if (duties && duties.length > 0) {
      // Currently on-call
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

    // 3. On-call contacts (רשימת כוננים קבועה)
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

  } catch (error) {
    console.error('Error fetching live data:', error);
    liveContext += '\n(שגיאה בטעינת מידע חי)\n';
  }

  return liveContext;
}

// POST - ask a question to the AI knowledge assistant
export async function POST(request) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { question, user_name } = body;

    if (!question) {
      return NextResponse.json(
        { success: false, error: 'question is required' },
        { status: 400 }
      );
    }

    // Step 1: Search knowledge base for relevant entries
    const { data: entries, error: searchError } = await supabase
      .from('knowledge_base')
      .select('id, title, content, category, contacts')
      .eq('is_active', true)
      .or(`title.ilike.%${question}%,content.ilike.%${question}%`);

    // Also do a broader search with individual words
    const words = question.split(/\s+/).filter(w => w.length > 2);
    let broadEntries = [];
    if (words.length > 0) {
      const orConditions = words.map(w => `title.ilike.%${w}%,content.ilike.%${w}%`).join(',');
      const { data: broad } = await supabase
        .from('knowledge_base')
        .select('id, title, content, category, contacts')
        .eq('is_active', true)
        .or(orConditions);
      broadEntries = broad || [];
    }

    // Combine and deduplicate results
    const allEntries = [...(entries || []), ...broadEntries];
    const uniqueEntries = Array.from(new Map(allEntries.map(e => [e.id, e])).values());

    // If no entries found at all, fetch all entries (let AI decide relevance)
    let contextEntries = uniqueEntries;
    if (contextEntries.length === 0) {
      const { data: allData } = await supabase
        .from('knowledge_base')
        .select('id, title, content, category, contacts')
        .eq('is_active', true)
        .limit(20);
      contextEntries = allData || [];
    }

    // Step 2: Build context from knowledge base entries
    const knowledgeContext = contextEntries.map(entry => {
      let text = `## ${entry.title}\nקטגוריה: ${entry.category}\n${entry.content}`;
      if (entry.contacts && entry.contacts.length > 0) {
        text += '\nאנשי קשר: ' + entry.contacts.map(c => `${c.name} - ${c.phone}${c.role ? ` (${c.role})` : ''}`).join(', ');
      }
      return text;
    }).join('\n\n---\n\n');

    // Step 3: Build app guide context
    const appGuideContext = appGuide.guide.map(g => `## ${g.topic}\n${g.content}`).join('\n\n');

    // Step 4: Fetch live data
    const liveData = await fetchLiveData();

    // Step 5: Call OpenAI
    const systemPrompt = `אתה עוזר ידע למוקדנים בעיריית יהוד-מונוסון במערכת "מקלטון".
תפקידך לענות על שאלות של מוקדנים בצורה ברורה, תמציתית ומדויקת.
יש לך 3 מקורות מידע:
1. מאגר ידע מבצעי (נהלים, תהליכים, אנשי קשר)
2. מדריך המערכת (איך להשתמש באפליקציה)
3. מידע חי (מי עובד/כונן היום, פקודת יום)

כללים:
- ענה בעברית
- היה תמציתי וברור
- אם יש מספרי טלפון רלוונטיים, כלול אותם בתשובה
- אם יש כמה שלבים, מספר אותם
- אל תמציא מידע שלא נמצא במקורות
- אם אין לך מידע, אמור שאין לך מידע ושיש לפנות למנהל המוקד

חשוב - הבחנה בין סוגי מידע חי:
- "עובדים כרגע" = אנשים שהמשמרת שלהם פעילה עכשיו (לפי השעה הנוכחית)
- "כל העובדים היום" = כל מי שעובד היום בכל השעות
- "כוננים כרגע" = כוננות חירום (לא עובדים רגילים), רק מי שכונן עכשיו
- "אנשי קשר כוננות" = רשימת כוננים קבועה
- כששואלים "מי עובד עכשיו/כרגע" - הצג רק את העובדים כרגע, לא את כל היום
- כששואלים "מי עובד היום" - הצג את רשימת כל העובדים היום

=== מדריך המערכת ===
${appGuideContext}

=== מאגר ידע מבצעי ===
${knowledgeContext}

${liveData}`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!openaiResponse.ok) {
      const errData = await openaiResponse.json().catch(() => ({}));
      console.error('OpenAI API error:', errData);
      return NextResponse.json(
        { success: false, error: 'שגיאה בשירות ה-AI' },
        { status: 502 }
      );
    }

    const aiData = await openaiResponse.json();
    const answer = aiData.choices?.[0]?.message?.content || 'לא הצלחתי לייצר תשובה';

    // Step 4: Save to chat history
    const sourceIds = contextEntries.map(e => e.id);
    await supabase.from('knowledge_chat_history').insert({
      user_name: user_name || 'מוקדן',
      question,
      answer,
      sources: sourceIds
    });

    return NextResponse.json({
      success: true,
      answer,
      sources: contextEntries.map(e => ({ id: e.id, title: e.title }))
    });

  } catch (error) {
    console.error('Knowledge chat error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
