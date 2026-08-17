import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MAX_DESCRIPTION_LENGTH = 2000;

// GET - רשימת דוחות פיקוח (אופציונלית לפי אזור)
export async function GET(request) {
  try {
    const auth = await requireRole(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const zone = searchParams.get('zone');

    let query = supabase
      .from('inspection_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (zone) {
      query = query.eq('zone', zone);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error reading inspection reports:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - דיווח חדש (פקח / מנהל מכלול / מנהלת מוקד; אדמין תמיד)
export async function POST(request) {
  try {
    const auth = await requireRole(request, ['inspector', 'sector_manager', 'call_center_manager']);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { inspectorName, zone, locationType, locationName, locationAddress, description } = body;

    if (!inspectorName || !zone || !locationType || !locationName || !description) {
      return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 });
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json({ error: `תיאור ארוך מדי (מקסימום ${MAX_DESCRIPTION_LENGTH} תווים)` }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('inspection_reports')
      .insert({
        inspector_name: String(inspectorName).slice(0, 120),
        zone: String(zone).slice(0, 20),
        location_type: String(locationType).slice(0, 50),
        location_name: String(locationName).slice(0, 200),
        location_address: locationAddress ? String(locationAddress).slice(0, 300) : null,
        description,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, report: data });
  } catch (error) {
    console.error('Error saving inspection report:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - עדכון סטטוס דיווח
export async function PATCH(request) {
  try {
    const auth = await requireRole(request, ['inspector', 'sector_manager', 'call_center_manager']);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'חסרים שדות' }, { status: 400 });
    }
    if (!['open', 'resolved'].includes(status)) {
      return NextResponse.json({ error: 'סטטוס לא חוקי' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('inspection_reports')
      .update({
        status,
        resolved_at: status === 'resolved' ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'דיווח לא נמצא' }, { status: 404 });
    }

    return NextResponse.json({ success: true, report: data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
