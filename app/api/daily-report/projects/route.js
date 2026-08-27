import { NextResponse } from 'next/server';
import { requireRole, requireRoleOrScreen } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';
import { parseIlDate } from '@/lib/daily-report-city';

// עבודות בעיר (YOA-42 שלב 3, docs/16): רשימה מנוהלת עם טווחי תאריכים.
// כתיבה - סמכות משמרת כמו הדוח; קריאה פתוחה גם למסך המוקד ולמוקדנים
// (בקשת יואב 26.08: שהמוקדנים יראו על המסך מה פעיל בעיר).
const ROLES = ['shift_supervisor', 'call_center_manager'];

// "20.08.2026" → end_date; "ספטמבר" → end_date_approx; ריק/"אין צפי" → שניהם null
function endFields(end) {
  const text = (end || '').trim();
  const asDate = parseIlDate(text);
  if (asDate) return { end_date: asDate, end_date_approx: null };
  if (text && !text.includes('אין צפי')) return { end_date: null, end_date_approx: text };
  return { end_date: null, end_date_approx: null };
}

export async function GET(request) {
  try {
    const auth = await requireRoleOrScreen(request);
    if (auth.error) return auth.error;

    const { data, error } = await supabase
      .from('report_projects')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: true });
    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await requireRole(request, ROLES);
    if (auth.error) return auth.error;

    const { description, owner, start, end } = await request.json();
    if (!description?.trim()) {
      return NextResponse.json({ success: false, error: 'תיאור העבודה נדרש' }, { status: 400 });
    }

    // הרשות מהפרופיל בשרת, לא מהבקשה (העיקרון של YOA-29)
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('municipality_id')
      .eq('id', auth.user.userId)
      .single();
    if (profileError) throw profileError;
    if (!profile?.municipality_id) {
      return NextResponse.json(
        { success: false, error: 'לפרופיל שלך לא משויכת רשות - פנה למנהל המערכת' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('report_projects')
      .insert({
        municipality_id: profile.municipality_id,
        description: description.trim(),
        owner: owner?.trim() || null,
        start_date: parseIlDate(start),
        ...endFields(end),
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const auth = await requireRole(request, ROLES);
    if (auth.error) return auth.error;

    const { id, description, owner, start, end, status } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'id נדרש' }, { status: 400 });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (description !== undefined) updates.description = description.trim();
    if (owner !== undefined) updates.owner = owner?.trim() || null;
    if (start !== undefined) updates.start_date = parseIlDate(start);
    if (end !== undefined) Object.assign(updates, endFields(end));
    if (status !== undefined) updates.status = status === 'ended' ? 'ended' : 'active';

    const { data, error } = await supabase
      .from('report_projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
