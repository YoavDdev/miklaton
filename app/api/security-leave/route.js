import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// GET - fetch leave entries for a department (optionally filter by date range)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('department_id');
    const date = searchParams.get('date'); // optional: check who's on leave on this date
    const staffId = searchParams.get('staff_id'); // optional: filter by staff

    if (!departmentId) {
      return NextResponse.json({ success: false, error: 'department_id required' }, { status: 400 });
    }

    let query = supabase
      .from('security_staff_leave')
      .select('*, security_staff(full_name, role)')
      .eq('department_id', departmentId)
      .order('start_date', { ascending: false });

    if (staffId) {
      query = query.eq('staff_id', staffId);
    }

    if (date) {
      // Find all leave records that overlap with this date
      query = query.lte('start_date', date).gte('end_date', date);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - create a new leave entry
export async function POST(request) {
  try {
    const auth = await requireRole(request, ['sector_manager', 'call_center_manager']);
    if (auth.error) return auth.error;
    const body = await request.json();
    const { department_id, staff_id, start_date, end_date, reason, notes } = body;

    if (!department_id || !staff_id || !start_date || !end_date) {
      return NextResponse.json({ success: false, error: 'department_id, staff_id, start_date, end_date required' }, { status: 400 });
    }

    if (new Date(end_date) < new Date(start_date)) {
      return NextResponse.json({ success: false, error: 'end_date must be after start_date' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('security_staff_leave')
      .insert({ department_id, staff_id, start_date, end_date, reason: reason || 'חופשה', notes })
      .select('*, security_staff(full_name, role)')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH - update a leave entry
export async function PATCH(request) {
  try {
    const auth = await requireRole(request, ['sector_manager', 'call_center_manager']);
    if (auth.error) return auth.error;
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('security_staff_leave')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, security_staff(full_name, role)')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - remove a leave entry
export async function DELETE(request) {
  try {
    const auth = await requireRole(request, ['sector_manager', 'call_center_manager']);
    if (auth.error) return auth.error;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('security_staff_leave')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
