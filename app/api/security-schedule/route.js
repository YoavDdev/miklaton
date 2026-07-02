import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// GET - fetch schedule for a specific week
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('department_id');
    const weekStart = searchParams.get('week_start');

    if (!departmentId || !weekStart) {
      return NextResponse.json({ success: false, error: 'department_id and week_start required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('security_weekly_schedule')
      .select(`
        *,
        shift:security_shifts(*),
        staff:security_staff(*)
      `)
      .eq('department_id', departmentId)
      .eq('week_start', weekStart);

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - assign staff to a shift on a specific day
export async function POST(request) {
  try {
    const body = await request.json();
    const { department_id, shift_id, staff_id, week_start, day_of_week, is_backup, notes } = body;

    if (!department_id || !shift_id || !staff_id || !week_start || day_of_week === undefined) {
      return NextResponse.json({ success: false, error: 'department_id, shift_id, staff_id, week_start, day_of_week required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('security_weekly_schedule')
      .insert({ 
        department_id, 
        shift_id, 
        staff_id, 
        week_start, 
        day_of_week, 
        is_backup: is_backup || false,
        notes 
      })
      .select(`
        *,
        shift:security_shifts(*),
        staff:security_staff(*)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH - update a schedule entry
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, staff_id, is_backup, notes } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    }

    const updateData = { updated_at: new Date().toISOString() };
    if (staff_id !== undefined) updateData.staff_id = staff_id;
    if (is_backup !== undefined) updateData.is_backup = is_backup;
    if (notes !== undefined) updateData.notes = notes;

    const { data, error } = await supabase
      .from('security_weekly_schedule')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        shift:security_shifts(*),
        staff:security_staff(*)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - remove a schedule entry
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('security_weekly_schedule')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
