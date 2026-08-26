import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { supabase } from '@/lib/supabase-server';
import { DEFAULT_RULES } from '@/lib/daily-report-ai';
import { buildWhatsappMessages, parseWhatsappResponse } from '@/lib/daily-report-whatsapp';

/**
 * ניסוח אירועים חריגים מעדכוני WhatsApp (YOA-42, החלטת יואב 26.08).
 * ה-AI אינו תנאי - כשל מחזיר שגיאה ברורה והאחמ"ש מקליד ידנית.
 */
const ROLES = ['shift_supervisor', 'call_center_manager'];

export async function POST(request) {
  try {
    const auth = await requireRole(request, ROLES);
    if (auth.error) return auth.error;

    const limited = rateLimit(request, 'daily-report-whatsapp', { limit: 10, windowMs: 60_000 });
    if (limited) return limited;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ success: false, error: 'מפתח AI לא מוגדר' }, { status: 503 });
    }

    const { text, tickets } = await request.json();
    if (!text?.trim()) {
      return NextResponse.json({ success: false, error: 'text נדרש' }, { status: 400 });
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

    const normalized = (Array.isArray(tickets) ? tickets : []).slice(0, 600).map(t => ({
      ...t,
      openedAt: t.openedAt ? new Date(t.openedAt) : null,
    }));

    const messages = buildWhatsappMessages(
      text.slice(0, 30000),
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
      console.error('OpenAI whatsapp error:', errData);
      return NextResponse.json(
        { success: false, error: 'שירות ה-AI לא זמין כרגע - הוסף ידנית' },
        { status: 502 }
      );
    }

    const aiData = await aiRes.json();
    const events = parseWhatsappResponse(aiData.choices?.[0]?.message?.content || '', normalized);
    return NextResponse.json({ success: true, data: events });
  } catch (error) {
    console.error('WhatsApp parse error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
