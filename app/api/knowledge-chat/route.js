import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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
    const context = contextEntries.map(entry => {
      let text = `## ${entry.title}\nקטגוריה: ${entry.category}\n${entry.content}`;
      if (entry.contacts && entry.contacts.length > 0) {
        text += '\nאנשי קשר: ' + entry.contacts.map(c => `${c.name} - ${c.phone}${c.role ? ` (${c.role})` : ''}`).join(', ');
      }
      return text;
    }).join('\n\n---\n\n');

    // Step 3: Call OpenAI
    const systemPrompt = `אתה עוזר ידע למוקדנים בעיריית יהוד-מונוסון. 
תפקידך לענות על שאלות של מוקדנים בצורה ברורה, תמציתית ומדויקת.
אתה עונה רק על בסיס המידע שנמסר לך במאגר הידע למטה.
אם אין לך מידע רלוונטי, אמור בבירור שאין לך מידע על הנושא ושיש לפנות למנהל המוקד.

כללים:
- ענה בעברית
- היה תמציתי וברור
- אם יש מספרי טלפון רלוונטיים, כלול אותם בתשובה
- אם יש כמה שלבים, מספר אותם
- אל תמציא מידע שלא נמצא במאגר

מאגר הידע:
${context}`;

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
