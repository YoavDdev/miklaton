import { NextResponse } from 'next/server';
import { requireRole, requireRoleOrScreen, requireDepartmentAccess } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';

/**
 * המכלול נקבע לפי השורה הקיימת ולא לפי מה שהבקשה מצהירה (YOA-27).
 */
async function accessForRow(request, id) {
  if (!id) {
    return { error: NextResponse.json({ success: false, error: 'id required' }, { status: 400 }) };
  }
  const { data: row } = await supabase
    .from('security_staff')
    .select('department_id')
    .eq('id', id)
    .single();
  if (!row) {
    return { error: NextResponse.json({ success: false, error: 'רשומה לא נמצאה' }, { status: 404 }) };
  }
  return requireDepartmentAccess(request, row.department_id);
}


// GET - fetch staff by department
export async function GET(request) {
  try {
    const auth = await requireRoleOrScreen(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('department_id');

    if (!departmentId) {
      return NextResponse.json({ success: false, error: 'department_id required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('security_staff')
      .select('*')
      .eq('department_id', departmentId)
      .eq('active', true)
      .order('role')
      .order('full_name');

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - create new staff member
export async function POST(request) {
  try {
    const auth = await requireRole(request, ['sector_manager', 'call_center_manager']);
    if (auth.error) return auth.error;
    const body = await request.json();
    const { department_id, full_name, phone, role } = body;

    if (!department_id || !full_name) {
      return NextResponse.json({ success: false, error: 'department_id and full_name required' }, { status: 400 });
    }

    const deptAccess = await requireDepartmentAccess(request, department_id);
    if (deptAccess.error) return deptAccess.error;

    const { data, error } = await supabase
      .from('security_staff')
      .insert({ department_id, full_name, phone, role: role || 'פיקוח' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH - update staff member
export async function PATCH(request) {
  try {
    const auth = await requireRole(request, ['sector_manager', 'call_center_manager']);
    if (auth.error) return auth.error;
    const body = await request.json();
    const { id, full_name, phone, role, active } = body;
    const rowAccess = await accessForRow(request, id);
    if (rowAccess.error) return rowAccess.error;


    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    }

    const updateData = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (phone !== undefined) updateData.phone = phone;
    if (role !== undefined) updateData.role = role;
    if (active !== undefined) updateData.active = active;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('security_staff')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - deactivate staff member
export async function DELETE(request) {
  try {
    const auth = await requireRole(request, ['sector_manager', 'call_center_manager']);
    if (auth.error) return auth.error;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const rowAccess = await accessForRow(request, id);
    if (rowAccess.error) return rowAccess.error;


    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('security_staff')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
