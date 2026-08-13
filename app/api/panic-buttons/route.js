import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/auth';

const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase environment variables');
  return createClient(supabaseUrl, supabaseKey);
};

// GET - list all or search by name
export async function GET(request) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const id = searchParams.get('id');

    if (id) {
      const { data, error } = await supabase
        .from('panic_buttons')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return NextResponse.json({ button: data, success: true });
    }

    let query = supabase
      .from('panic_buttons')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (q.trim()) {
      query = query.ilike('name', `%${q.trim()}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ buttons: data || [], success: true });
  } catch (error) {
    console.error('Error fetching panic buttons:', error);
    return NextResponse.json({ buttons: [], error: error.message }, { status: 500 });
  }
}

// POST - create new
export async function POST(request) {
  try {
    const auth = await requireRole(request, ['operator', 'call_center_manager']);
    if (auth.error) return auth.error;

    const supabase = getSupabase();
    const body = await request.json();
    const { name, category, address, directions, contacts, operator_instructions, municipality_id } = body;

    if (!name || !address) {
      return NextResponse.json({ error: 'שם וכתובת הם שדות חובה' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('panic_buttons')
      .insert({
        name,
        category: category || 'other',
        address,
        directions: directions || null,
        contacts: contacts || [],
        operator_instructions: operator_instructions || null,
        municipality_id: municipality_id || null,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ button: data, success: true });
  } catch (error) {
    console.error('Error creating panic button:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - update existing
export async function PUT(request) {
  try {
    const auth = await requireRole(request, ['operator', 'call_center_manager']);
    if (auth.error) return auth.error;

    const supabase = getSupabase();
    const body = await request.json();
    const { id, name, category, address, directions, contacts, operator_instructions, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (category !== undefined) updateData.category = category;
    if (address !== undefined) updateData.address = address;
    if (directions !== undefined) updateData.directions = directions;
    if (contacts !== undefined) updateData.contacts = contacts;
    if (operator_instructions !== undefined) updateData.operator_instructions = operator_instructions;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabase
      .from('panic_buttons')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ button: data, success: true });
  } catch (error) {
    console.error('Error updating panic button:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE
export async function DELETE(request) {
  try {
    const auth = await requireRole(request, ['operator', 'call_center_manager']);
    if (auth.error) return auth.error;

    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('panic_buttons')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting panic button:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
