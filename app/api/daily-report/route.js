import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';

// דוח הסיכום היומי (YOA-42, docs/16): הפקה היא סמכות משמרת -
// אחמ"ש ומנהלת המוקד בלבד, כמו ההודעות ומצב החירום.
const ROLES = ['shift_supervisor', 'call_center_manager'];

export async function GET(request) {
  try {
    const auth = await requireRole(request, ROLES);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 30, 100);

    const { data, error } = await supabase
      .from('daily_reports')
      .select('*')
      .order('produced_at', { ascending: false })
      .limit(limit);
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

    const { report_date, source_file_name, snapshot } = await request.json();
    if (!report_date || !snapshot || typeof snapshot !== 'object') {
      return NextResponse.json(
        { success: false, error: 'report_date ו-snapshot נדרשים' },
        { status: 400 }
      );
    }

    // הרשות מהפרופיל בשרת, לא מהבקשה (העיקרון של YOA-29)
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('municipality_id')
      .eq('id', auth.user.userId)
      .single();
    if (profileError) throw profileError;

    const { data, error } = await supabase
      .from('daily_reports')
      .insert({
        municipality_id: profile?.municipality_id || null,
        report_date,
        produced_by: auth.user.userId,
        produced_by_name: auth.user.name || null,
        source_file_name: source_file_name || null,
        snapshot,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
