import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';

export async function GET(request) {
  try {
    const auth = await requireRole(request);
    if (auth.error) return auth.error;

    const { data, error } = await supabase
      .from('municipalities')
      .select('id, name, code')
      .eq('code', 'yehud')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error('Error fetching Yehud municipality:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
