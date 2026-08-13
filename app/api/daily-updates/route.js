import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth, requireRole } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// GET - Fetch daily updates (active by default, or history)
export async function GET(request) {
  try {
    const auth = await requireRole(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const showHistory = searchParams.get('history') === 'true';
    const municipalityId = searchParams.get('municipality_id');

    // Build query - municipality_id is optional for now
    let query = supabase
      .from('daily_updates')
      .select('*')
      .order('start_time', { ascending: false });

    if (municipalityId) {
      query = query.eq('municipality_id', municipalityId);
    }

    if (!showHistory) {
      // Only active updates
      const now = new Date().toISOString();
      query = query
        .lte('start_time', now)
        .gt('end_time', now);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      updates: data || [],
      count: data?.length || 0
    });

  } catch (error) {
    console.error('Error fetching daily updates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily updates', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new daily update
export async function POST(request) {
  try {
    // Only operators and call_center_managers can create updates
    const auth = await requireRole(request, ['operator', 'call_center_manager']);
    if (auth.error) return auth.error;

    const body = await request.json();
    const {
      municipality_id,
      title,
      description,
      type,
      address,
      lat,
      lng,
      start_time,
      end_time
    } = body;

    // Validation - municipality_id is optional for testing
    if (!title || !type || !start_time || !end_time) {
      return NextResponse.json({
        error: 'Missing required fields',
        required: ['title', 'type', 'start_time', 'end_time']
      }, { status: 400 });
    }

    // Validate type
    const validTypes = ['road_closure', 'event', 'maintenance', 'alert', 'other'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({
        error: 'Invalid type',
        validTypes
      }, { status: 400 });
    }

    // Validate times
    if (new Date(start_time) >= new Date(end_time)) {
      return NextResponse.json({
        error: 'end_time must be after start_time'
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('daily_updates')
      .insert({
        municipality_id,
        title,
        description,
        type,
        address,
        lat,
        lng,
        start_time,
        end_time
        // created_by and updated_by are optional for testing
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      update: data,
      message: 'עדכון נוסף בהצלחה'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating daily update:', error);
    return NextResponse.json(
      { error: 'Failed to create daily update', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update existing daily update
export async function PUT(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['operator', 'call_center_manager', 'admin'].includes(authResult.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Update ID required' }, { status: 400 });
    }

    // Add updated_by
    updates.updated_by = authResult.user.id;

    const { data, error } = await supabase
      .from('daily_updates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      update: data,
      message: 'עדכון עודכן בהצלחה'
    });

  } catch (error) {
    console.error('Error updating daily update:', error);
    return NextResponse.json(
      { error: 'Failed to update daily update', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete daily update
export async function DELETE(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['call_center_manager', 'admin'].includes(authResult.user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Update ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('daily_updates')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'עדכון נמחק בהצלחה'
    });

  } catch (error) {
    console.error('Error deleting daily update:', error);
    return NextResponse.json(
      { error: 'Failed to delete daily update', details: error.message },
      { status: 500 }
    );
  }
}
