import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// GET - fetch all active knowledge base entries (with optional search)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const category = searchParams.get('category');

    let query = supabase
      .from('knowledge_base')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, entries: data });
  } catch (error) {
    console.error('Knowledge base GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - create a new knowledge base entry
export async function POST(request) {
  try {
    const auth = await requireRole(request, ['call_center_manager']);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { title, content, category, tags, contacts, created_by } = body;

    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: 'title and content are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('knowledge_base')
      .insert({
        title,
        content,
        category: category || 'כללי',
        tags: tags || [],
        contacts: contacts || [],
        created_by: created_by || 'מנהל',
        updated_by: created_by || 'מנהל'
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, entry: data });
  } catch (error) {
    console.error('Knowledge base POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT - update an existing knowledge base entry
export async function PUT(request) {
  try {
    const auth = await requireRole(request, ['call_center_manager']);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { id, title, content, category, tags, contacts, updated_by } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const updateData = { updated_at: new Date().toISOString() };
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags;
    if (contacts !== undefined) updateData.contacts = contacts;
    if (updated_by) updateData.updated_by = updated_by;

    const { data, error } = await supabase
      .from('knowledge_base')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, entry: data });
  } catch (error) {
    console.error('Knowledge base PUT error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - soft delete (set is_active to false)
export async function DELETE(request) {
  try {
    const auth = await requireRole(request, ['call_center_manager']);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('knowledge_base')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Knowledge base DELETE error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
