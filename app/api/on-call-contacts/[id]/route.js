import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';

// PATCH - Update on-call contact (e.g., return from vacation)
export async function PATCH(request, { params }) {
  try {
    const auth = await requireRole(request, ['call_center_manager']);
    if (auth.error) return auth.error;

    const { id } = params;
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('on_call_contacts')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      contact: data
    });
  } catch (error) {
    console.error('Error updating on-call contact:', error);
    return NextResponse.json(
      { error: 'Failed to update on-call contact', details: error.message },
      { status: 500 }
    );
  }
}
