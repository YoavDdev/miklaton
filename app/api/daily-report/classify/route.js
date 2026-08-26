import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { supabase } from '@/lib/supabase-server';
import { DEFAULT_RULES, buildClassifyMessages, parseClassifyResponse } from '@/lib/daily-report-ai';

/**
 * סיווג האירועים החריגים (YOA-42 שלב 2, docs/16): קריאה אחת עם כל
 * פניות היום, נטולות PII. ה-AI אינו תנאי - כשל מחזיר שגיאה ברורה
 * והאחמ"ש ממשיך בסימון ידני. הכללים והמודל הם הגדרה, לא קוד.
 */
const ROLES = ['shift_supervisor', 'call_center_manager'];

async function loadSettings(userId) {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('municipality_id')
    .eq('id', userId)
    .single();
  if (error) throw error;
  const municipalityId = profile?.municipality_id || null;

  const { data: settings } = await supabase
    .from('daily_report_settings')
    .select('classification_rules, ai_model')
    .eq('municipality_id', municipalityId)
    .maybeSingle();

  return {
    municipalityId,
    rules: settings?.classification_rules || DEFAULT_RULES,
    model: settings?.ai_model || 'gpt-4o-mini',
  };
}

export async function GET(request) {
  try {
    const auth = await requireRole(request, ROLES);
    if (auth.error) return auth.error;
    const { rules, model } = await loadSettings(auth.user.userId);
    return NextResponse.json({ success: true, data: { classification_rules: rules, ai_model: model } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const auth = await requireRole(request, ROLES);
    if (auth.error) return auth.error;

    const { classification_rules, ai_model } = await request.json();
    if (!classification_rules?.trim()) {
      return NextResponse.json({ success: false, error: 'כללי הסיווג נדרשים' }, { status: 400 });
    }
    const { municipalityId } = await loadSettings(auth.user.userId);

    const { error } = await supabase.from('daily_report_settings').upsert({
      municipality_id: municipalityId,
      classification_rules: classification_rules.trim(),
      ...(ai_model ? { ai_model } : {}),
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await requireRole(request, ROLES);
    if (auth.error) return auth.error;

    const limited = rateLimit(request, 'daily-report-classify', { limit: 10, windowMs: 60_000 });
    if (limited) return limited;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'מפתח AI לא מוגדר - סמן ידנית' },
        { status: 503 }
      );
    }

    const { tickets } = await request.json();
    if (!Array.isArray(tickets) || tickets.length === 0) {
      return NextResponse.json({ success: false, error: 'tickets נדרש' }, { status: 400 });
    }

    // openedAt מגיע כמחרוזת מה-JSON; buildClassifyMessages מצפה ל-Date.
    // stripPii בפנים מוריד את זהות הפונה - שכבת ההגנה היא כאן, בשרת.
    const normalized = tickets.slice(0, 600).map(t => ({
      ...t,
      openedAt: t.openedAt ? new Date(t.openedAt) : null,
    }));

    const { rules, model } = await loadSettings(auth.user.userId);
    const messages = buildClassifyMessages(normalized, rules);

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0,
        response_format: { type: 'json_object' },
        max_tokens: 8000,
      }),
    });

    if (!aiRes.ok) {
      const errData = await aiRes.json().catch(() => ({}));
      console.error('OpenAI classify error:', errData);
      return NextResponse.json(
        { success: false, error: 'שירות ה-AI לא זמין כרגע - סמן ידנית' },
        { status: 502 }
      );
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || '';
    const map = parseClassifyResponse(raw, normalized);

    const data = [...map.entries()].map(([id, v]) => ({ id, category: v.category, reason: v.reason }));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Classify error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
