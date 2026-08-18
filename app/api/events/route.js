import { NextResponse } from 'next/server';
import { requireRole, generateEventToken } from '@/lib/auth';
import { supabase } from '@/lib/supabase-server';

// GET - list events
export async function GET(request) {
  try {
    const auth = await requireRole(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabase
      .from('emergency_events')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - create event
export async function POST(request) {
  try {
    const auth = await requireRole(request);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { title, description, severity, event_type } = body;

    if (!title) {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 });
    }

    // Get user name
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', auth.user.userId)
      .single();

    const invite_token = generateEventToken();

    const { data, error } = await supabase
      .from('emergency_events')
      .insert({
        title,
        description: description || '',
        severity: severity || 'medium',
        event_type: event_type || 'general',
        invite_token,
        created_by: auth.user.userId,
        created_by_name: userProfile?.full_name || 'לא ידוע',
      })
      .select()
      .single();

    if (error) throw error;

    // Auto-add creator as participant
    await supabase.from('event_participants').insert({
      event_id: data.id,
      user_id: auth.user.userId,
      display_name: userProfile?.full_name || 'לא ידוע',
      role: auth.user.role,
      status: 'confirmed',
    });

    // Add system journal entry
    await supabase.from('event_journal').insert({
      event_id: data.id,
      author_name: 'מערכת',
      entry_type: 'system',
      content: `אירוע נפתח על ידי ${userProfile?.full_name || 'לא ידוע'}`,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH - close/update event
export async function PATCH(request) {
  try {
    const auth = await requireRole(request);
    if (auth.error) return auth.error;
    const decoded = auth.user;

    const body = await request.json();
    const { id, status, summary } = body;

    if (status === 'closed') {
      // Only creator, admin, or operator can close
      const { data: event } = await supabase
        .from('emergency_events')
        .select('created_by')
        .eq('id', id)
        .single();

      if (event?.created_by !== decoded.userId && decoded.role !== 'admin' && decoded.role !== 'operator') {
        return NextResponse.json({ success: false, error: 'Only creator, admin, or operator can close' }, { status: 403 });
      }

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', decoded.userId)
        .single();

      const { data, error } = await supabase
        .from('emergency_events')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: decoded.userId,
          closed_by_name: userProfile?.full_name || 'לא ידוע',
          ...(summary !== undefined ? { summary } : {}),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // System journal entry
      await supabase.from('event_journal').insert({
        event_id: id,
        author_name: 'מערכת',
        entry_type: 'system',
        content: `אירוע נסגר על ידי ${userProfile?.full_name || 'לא ידוע'}`,
      });

      return NextResponse.json({ success: true, data });
    }

    if (summary !== undefined) {
      const { data: event } = await supabase
        .from('emergency_events').select('created_by').eq('id', id).single();
      if (event?.created_by !== decoded.userId && decoded.role !== 'admin' && decoded.role !== 'operator') {
        return NextResponse.json({ success: false, error: 'אין הרשאה' }, { status: 403 });
      }
      const { data, error } = await supabase
        .from('emergency_events').update({ summary }).eq('id', id).select().single();
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - delete a closed event
export async function DELETE(request) {
  try {
    const auth = await requireRole(request);
    if (auth.error) return auth.error;
    const decoded = auth.user;

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: 'Event ID required' }, { status: 400 });
    }

    const { data: event } = await supabase
      .from('emergency_events')
      .select('status, created_by')
      .eq('id', id)
      .single();

    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
    }

    if (event.status !== 'closed') {
      return NextResponse.json({ success: false, error: 'Only closed events can be deleted' }, { status: 400 });
    }

    if (event.created_by !== decoded.userId && decoded.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Only creator or admin can delete' }, { status: 403 });
    }

    // CASCADE will handle journal and participants
    const { error } = await supabase
      .from('emergency_events')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
