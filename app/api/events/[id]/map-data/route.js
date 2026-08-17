import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireEventAccess } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - קבלת מידע מפה
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const access = await requireEventAccess(request, id);
    if (access.error) return access.error;

    const { data, error } = await supabase
      .from('emergency_events')
      .select('event_locations, road_blocks')
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      event_locations: data?.event_locations || [],
      road_blocks: data?.road_blocks || []
    });
  } catch (error) {
    console.error('Error fetching map data:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT - עדכון מידע מפה
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const access = await requireEventAccess(request, id);
    if (access.error) return access.error;
    if (access.event.status === 'closed') {
      return NextResponse.json({ success: false, error: 'Event is closed' }, { status: 400 });
    }

    const body = await request.json();
    const { event_locations, road_blocks } = body;

    const updateData = {};
    if (event_locations !== undefined) updateData.event_locations = event_locations;
    if (road_blocks !== undefined) updateData.road_blocks = road_blocks;

    const { data, error } = await supabase
      .from('emergency_events')
      .update(updateData)
      .eq('id', id)
      .select('event_locations, road_blocks')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      event_locations: data.event_locations || [],
      road_blocks: data.road_blocks || []
    });
  } catch (error) {
    console.error('Error updating map data:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
