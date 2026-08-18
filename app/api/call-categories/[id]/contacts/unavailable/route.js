import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';

// POST - Mark contact as unavailable
export async function POST(request, { params }) {
  try {
    const auth = await requireRole(request, ['call_center_manager']);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { contact_id, unavailable_until, reason } = body;

    if (!contact_id) {
      return NextResponse.json({ error: 'contact_id required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('call_category_contacts')
      .update({
        currently_unavailable: true,
        unavailable_until: unavailable_until || null,
        unavailable_reason: reason || 'לא זמין',
        updated_at: new Date().toISOString()
      })
      .eq('id', contact_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'כונן סומן כלא זמין',
      contact: data
    });

  } catch (error) {
    console.error('Error marking contact unavailable:', error);
    return NextResponse.json(
      { error: 'Failed to mark contact unavailable', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Mark contact as available again
export async function DELETE(request, { params }) {
  try {
    const auth = await requireRole(request, ['call_center_manager']);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contact_id');

    if (!contactId) {
      return NextResponse.json({ error: 'contact_id required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('call_category_contacts')
      .update({
        currently_unavailable: false,
        unavailable_until: null,
        unavailable_reason: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', contactId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'כונן סומן כזמין',
      contact: data
    });

  } catch (error) {
    console.error('Error marking contact available:', error);
    return NextResponse.json(
      { error: 'Failed to mark contact available', details: error.message },
      { status: 500 }
    );
  }
}
