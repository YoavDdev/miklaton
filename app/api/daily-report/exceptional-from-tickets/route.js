import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { supabase } from '@/lib/supabase-server';
import {
  DEFAULT_RULES,
  buildTicketExceptionalMessages,
  parseTicketExceptionalResponse,
} from '@/lib/daily-report-ai';

/**
 * אירועים חריגים מתוך פניות היום, כשאין הדבקת WhatsApp (החלטת יואב 10.09).
 *
 * המקור המועדף נשאר ה-WhatsApp; זהו מסלול הנפילה אחורה. ה-AI אינו תנאי -
 * כשל מחזיר שגיאה ברורה והאחמ"ש מקליד ידנית, כמו בשאר מסלולי הדוח.
 */
const ROLES = ['shift_supervisor', 'call_center_manager'];

export async function POST(request) {
  try {
    const auth = await requireRole(request, ROLES);
    if (auth.error) return auth.error;

    const limited = rateLimit(request, 'daily-report-exceptional-tickets', {
      limit: 10,
      windowMs: 60_000,
    });
    if (limited) return limited;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ success: false, error: 'מפתח AI לא מוגדר' }, { status: 503 });
    }

    const { tickets } = await request.json();
    if (!Array.isArray(tickets) || tickets.length === 0) {
      return NextResponse.json({ success: false, error: 'אין פניות לניתוח' }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('municipality_id')
      .eq('id', auth.user.userId)
      .single();
    if (profileError) throw profileError;

    const { data: settings } = await supabase
      .from('daily_report_settings')
      .select('classification_rules, ai_model')
      .eq('municipality_id', profile?.municipality_id || null)
      .maybeSingle();

    const normalized = tickets.slice(0, 600).map((t) => ({
      ...t,
      openedAt: t.openedAt ? new Date(t.openedAt) : null,
    }));

    const messages = buildTicketExceptionalMessages(
      normalized,
      settings?.classification_rules || DEFAULT_RULES
    );

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: settings?.ai_model || 'gpt-4o-mini',
        messages,
        temperature: 0,
        response_format: { type: 'json_object' },
        max_tokens: 8000,
      }),
    });

    if (!aiRes.ok) {
      const errData = await aiRes.json().catch(() => ({}));
      console.error('OpenAI exceptional-from-tickets error:', errData);
      return NextResponse.json(
        { success: false, error: 'שירות ה-AI לא זמין כרגע - הוסף ידנית' },
        { status: 502 }
      );
    }

    const aiData = await aiRes.json();
    const events = parseTicketExceptionalResponse(
      aiData.choices?.[0]?.message?.content || '',
      normalized
    );
    return NextResponse.json({
      success: true,
      data: events,
      missing_treatment: events.filter((e) => e.needs_treatment).length,
    });
  } catch (error) {
    console.error('exceptional-from-tickets error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
