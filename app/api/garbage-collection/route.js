import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// GET - Fetch garbage collection schedule
export async function GET(request) {
  try {
    const auth = await requireRole(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const street = searchParams.get('street');
    const day = searchParams.get('day');
    const type = searchParams.get('type');

    let query = supabase
      .from('garbage_collection_schedule')
      .select('*')
      .eq('is_active', true)
      .order('collection_day', { ascending: true })
      .order('street_name', { ascending: true });

    if (street) {
      query = query.ilike('street_name', `%${street}%`);
    }
    if (day) {
      query = query.eq('collection_day', day);
    }
    if (type) {
      query = query.eq('collection_type', type);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, schedule: data || [] });
  } catch (error) {
    console.error('Error fetching garbage schedule:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Add new schedule entry
export async function POST(request) {
  try {
    const auth = await requireRole(request, ['call_center_manager', 'operator']);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { street_name, collection_day, collection_day_hebrew, takeout_day_hebrew, collection_time, collection_type, zone, notes } = body;

    if (!street_name || !collection_day || !collection_day_hebrew) {
      return NextResponse.json({ success: false, error: 'street_name, collection_day, and collection_day_hebrew are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('garbage_collection_schedule')
      .insert({
        street_name,
        collection_day,
        collection_day_hebrew,
        takeout_day_hebrew,
        collection_time: collection_time || '06:00-14:00',
        collection_type: collection_type || 'גזם',
        zone: zone || 'יהוד',
        notes
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, entry: data });
  } catch (error) {
    console.error('Error creating garbage schedule entry:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT - Update schedule entry
export async function PUT(request) {
  try {
    const auth = await requireRole(request, ['call_center_manager', 'operator']);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('garbage_collection_schedule')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, entry: data });
  } catch (error) {
    console.error('Error updating garbage schedule entry:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - Remove schedule entry
export async function DELETE(request) {
  try {
    const auth = await requireRole(request, ['call_center_manager', 'operator']);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('garbage_collection_schedule')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting garbage schedule entry:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
