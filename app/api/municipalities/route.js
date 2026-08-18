import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';

// GET - Fetch all municipalities
export async function GET(request) {
  try {
    const auth = await requireRole(request);
    if (auth.error) return auth.error;

    const { data, error } = await supabase
      .from('municipalities')
      .select('*')
      .eq('active', true)
      .order('name');

    if (error) throw error;

    return NextResponse.json({
      success: true,
      municipalities: data || []
    });

  } catch (error) {
    console.error('Error fetching municipalities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch municipalities', details: error.message },
      { status: 500 }
    );
  }
}
