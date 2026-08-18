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
    .from('contacts')
    .select('department_id')
    .eq('id', id)
    .single();
  if (!row) {
    return { error: NextResponse.json({ success: false, error: 'רשומה לא נמצאה' }, { status: 404 }) };
  }
  return requireDepartmentAccess(request, row.department_id);
}


export async function GET(request) {
  try {
    const auth = await requireRoleOrScreen(request);
    if (auth.error) return auth.error;

    const { data, error } = await supabase
      .from('contacts')
      .select(`
        *,
        departments (name)
      `)
      .eq('active', true)
      .order('full_name');

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const auth = await requireRole(request, ['call_center_manager', 'sector_manager']);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { department_id, full_name, phone, role } = body;
    const deptAccess = await requireDepartmentAccess(request, department_id);
    if (deptAccess.error) return deptAccess.error;


    const { data, error } = await supabase
      .from('contacts')
      .insert({ department_id, full_name, phone, role })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const auth = await requireRole(request, ['call_center_manager', 'sector_manager']);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { id, department_id, full_name, phone, role, active } = body;
    const rowAccess = await accessForRow(request, id);
    if (rowAccess.error) return rowAccess.error;


    const { data, error } = await supabase
      .from('contacts')
      .update({ department_id, full_name, phone, role, active })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const auth = await requireRole(request, ['call_center_manager', 'sector_manager']);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const rowAccess = await accessForRow(request, id);
    if (rowAccess.error) return rowAccess.error;


    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
