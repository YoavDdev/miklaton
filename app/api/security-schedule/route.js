import { NextResponse } from 'next/server';
import { requireRole, requireDepartmentAccess } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';

/**
 * המכלול נקבע לפי השורה הקיימת ולא לפי מה שהבקשה מצהירה (YOA-27).
 *
 * אחמ"ש (shift_supervisor) הוא סמכות משמרת חוצת-מכלולים על סידור
 * הביטחון - עורך מקונסולת המשמרת (בקשת יואב 26.08; תקדים YOA-43:
 * מסך המוקד כותב לפקודת היום). המכלול שלו הוא המוקד, לכן בדיקת
 * המכלול מדולגת עבורו בכתיבות כאן.
 */
const WRITE_ROLES = ['sector_manager', 'call_center_manager', 'shift_supervisor'];
async function accessForRow(request, id) {
  if (!id) {
    return { error: NextResponse.json({ success: false, error: 'id required' }, { status: 400 }) };
  }
  const { data: row } = await supabase
    .from('security_weekly_schedule')
    .select('department_id')
    .eq('id', id)
    .single();
  if (!row) {
    return { error: NextResponse.json({ success: false, error: 'רשומה לא נמצאה' }, { status: 404 }) };
  }
  return requireDepartmentAccess(request, row.department_id);
}


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
    const auth = await requireRole(request, WRITE_ROLES);
    if (auth.error) return auth.error;
    const body = await request.json();
    const { department_id, shift_id, staff_id, week_start, day_of_week, is_backup, notes } = body;
    if (auth.user.role !== 'shift_supervisor') {
      const deptAccess = await requireDepartmentAccess(request, department_id);
      if (deptAccess.error) return deptAccess.error;
    }


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
    const auth = await requireRole(request, WRITE_ROLES);
    if (auth.error) return auth.error;
    const body = await request.json();
    const { id, staff_id, is_backup, notes } = body;
    if (auth.user.role !== 'shift_supervisor') {
      const rowAccess = await accessForRow(request, id);
      if (rowAccess.error) return rowAccess.error;
    }


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

// DELETE - remove a schedule entry or bulk delete for a week
export async function DELETE(request) {
  try {
    const auth = await requireRole(request, WRITE_ROLES);
    if (auth.error) return auth.error;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (auth.user.role !== 'shift_supervisor') {
      const rowAccess = await accessForRow(request, id);
      if (rowAccess.error) return rowAccess.error;
    }

    const departmentId = searchParams.get('department_id');
    const weekStart = searchParams.get('week_start');

    // Bulk delete for entire week (for Excel import)
    if (departmentId && weekStart) {
      const { error } = await supabase
        .from('security_weekly_schedule')
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
      .from('security_weekly_schedule')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
