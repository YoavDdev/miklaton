import { NextResponse } from 'next/server';
import { requireRole, requireDepartmentAccess } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';

/**
 * המכלול נקבע לפי השורה הקיימת ולא לפי מה שהבקשה מצהירה (YOA-27).
 */
async function accessForRow(request, id) {
  if (!id) {
    return { error: NextResponse.json({ success: false, error: 'id required' }, { status: 400 }) };
  }
  const { data: row } = await supabase
    .from('security_shifts')
    .select('department_id')
    .eq('id', id)
    .single();
  if (!row) {
    return { error: NextResponse.json({ success: false, error: 'רשומה לא נמצאה' }, { status: 404 }) };
  }
  return requireDepartmentAccess(request, row.department_id);
}


// GET - fetch shift types by department
export async function GET(request) {
  try {
    const auth = await requireRole(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('department_id');

    if (!departmentId) {
      return NextResponse.json({ success: false, error: 'department_id required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('security_shifts')
      .select('*')
      .eq('department_id', departmentId)
      .eq('active', true)
      .order('category')
      .order('display_order');

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - create new shift type
export async function POST(request) {
  try {
    const auth = await requireRole(request, ['sector_manager', 'call_center_manager']);
    if (auth.error) return auth.error;
    const body = await request.json();
    const { department_id, category, name, start_time, end_time, display_order } = body;
    const deptAccess = await requireDepartmentAccess(request, department_id);
    if (deptAccess.error) return deptAccess.error;


    if (!department_id || !name || !start_time || !end_time) {
      return NextResponse.json({ success: false, error: 'department_id, name, start_time, end_time required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('security_shifts')
      .insert({ 
        department_id, 
        category: category || 'פיקוח', 
        name, 
        start_time, 
        end_time, 
        display_order: display_order || 0 
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH - update shift type
export async function PATCH(request) {
  try {
    const auth = await requireRole(request, ['sector_manager', 'call_center_manager']);
    if (auth.error) return auth.error;
    const body = await request.json();
    const { id, name, category, start_time, end_time, display_order, active } = body;
    const rowAccess = await accessForRow(request, id);
    if (rowAccess.error) return rowAccess.error;


    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (category !== undefined) updateData.category = category;
    if (start_time !== undefined) updateData.start_time = start_time;
    if (end_time !== undefined) updateData.end_time = end_time;
    if (display_order !== undefined) updateData.display_order = display_order;
    if (active !== undefined) updateData.active = active;

    const { data, error } = await supabase
      .from('security_shifts')
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

// DELETE - deactivate shift type
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
      .from('security_shifts')
      .update({ active: false })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
