import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';

const DEFAULTS = {
  vehicles: ['קשקאי', 'חלופי', 'אופנוע', 'ניסאן שיטור'],
  tasks_pikuach: [
    'טיפול בפניות 106',
    'סיורי נוכחות בולטות',
    'אכיפת כלבים',
    'אכיפת שטחים נטושים',
    'אכיפת רכבים נטושים',
    'אכיפת אתרי בנייה',
  ],
  tasks_shitur: [
    'סיור שיטור',
    'טיפול באירועים',
    'סיורי נוכחות',
  ]
};

// GET - fetch settings for a department
export async function GET(request) {
  try {
    const auth = await requireRole(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('department_id');
    const key = searchParams.get('key'); // optional: specific key

    if (!departmentId) {
      return NextResponse.json({ success: false, error: 'department_id required' }, { status: 400 });
    }

    let query = supabase
      .from('security_settings')
      .select('*')
      .eq('department_id', departmentId);

    if (key) {
      query = query.eq('setting_key', key);
    }

    const { data, error } = await query;

    if (error) throw error;

    // If no data found, return defaults
    const result = {};
    for (const k of Object.keys(DEFAULTS)) {
      const found = data?.find(d => d.setting_key === k);
      result[k] = found ? found.setting_value : DEFAULTS[k];
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - save/update a setting
export async function POST(request) {
  try {
    const auth = await requireRole(request, ['sector_manager', 'call_center_manager']);
    if (auth.error) return auth.error;
    const body = await request.json();
    const { department_id, key, value } = body;

    if (!department_id || !key || value === undefined) {
      return NextResponse.json({ success: false, error: 'department_id, key, value required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('security_settings')
      .upsert({
        department_id,
        setting_key: key,
        setting_value: value,
        updated_at: new Date().toISOString()
      }, { onConflict: 'department_id,setting_key' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
