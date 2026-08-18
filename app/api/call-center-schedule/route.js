import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';

// GET - fetch schedule for a specific week
export async function GET(request) {
  try {
    const auth = await requireRole(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('department_id');
    const weekStart = searchParams.get('week_start');

    if (!departmentId || !weekStart) {
      return NextResponse.json({ success: false, error: 'department_id and week_start required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('call_center_schedule')
      .select(`
        *,
        shift:call_center_shifts(*),
        staff:call_center_staff(*)
      `)
      .eq('department_id', departmentId)
      .eq('week_start', weekStart)
      .order('day_of_week')
      .order('position');

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - assign staff to a shift
export async function POST(request) {
  try {
    const auth = await requireRole(request, ['shift_supervisor', 'call_center_manager']);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { department_id, shift_id, staff_id, staff_name, week_start, day_of_week, position, notes } = body;

    if (!department_id || !shift_id || !week_start || day_of_week === undefined) {
      return NextResponse.json({ success: false, error: 'department_id, shift_id, week_start, day_of_week required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('call_center_schedule')
      .insert({ 
        department_id, 
        shift_id, 
        staff_id: staff_id || null,
        staff_name: staff_name || null,
        week_start, 
        day_of_week,
        position: position || 'נציג',
        notes 
      })
      .select(`
        *,
        shift:call_center_shifts(*),
        staff:call_center_staff(*)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - remove a schedule entry or bulk delete for a week
export async function DELETE(request) {
  try {
    const auth = await requireRole(request, ['shift_supervisor', 'call_center_manager']);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const departmentId = searchParams.get('department_id');
    const weekStart = searchParams.get('week_start');

    // Bulk delete for entire week (for Excel import)
    if (departmentId && weekStart) {
      const { error } = await supabase
        .from('call_center_schedule')
        .delete()
        .eq('department_id', departmentId)
        .eq('week_start', weekStart);

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Week schedule cleared' });
    }

    // Single entry delete
    if (!id) {
      return NextResponse.json({ success: false, error: 'id or (department_id + week_start) required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('call_center_schedule')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
