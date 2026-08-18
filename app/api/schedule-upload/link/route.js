import { NextResponse } from 'next/server';
import { requireRole, signScheduleUploadToken } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';

// GET - מייצר את קישור ההעלאה הקבוע של מכלול, לשליחה בוואטסאפ
export async function GET(request) {
  try {
    const auth = await requireRole(request, ['call_center_manager']);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    if (!departmentId) {
      return NextResponse.json(
        { success: false, error: 'departmentId is required' },
        { status: 400 }
      );
    }

    const { data: department, error } = await supabase
      .from('departments')
      .select('id, name, manager_name, manager_phone')
      .eq('id', departmentId)
      .single();
    if (error) throw error;

    return NextResponse.json({
      success: true,
      department,
      path: `/schedule-upload/${departmentId}?t=${signScheduleUploadToken(departmentId)}`,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
