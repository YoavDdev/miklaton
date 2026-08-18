import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';

// GET - fetch all shifts for a department
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
      .from('call_center_shifts')
      .select('*')
      .eq('department_id', departmentId)
      .eq('is_active', true)
      .order('start_time');

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
