import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - קבלת מידע מפה
export async function GET(request, { params }) {
  const { id } = params;

  try {
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
  const { id } = params;

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
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
