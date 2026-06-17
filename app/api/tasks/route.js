import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// GET - Fetch tasks
export async function GET(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const municipalityId = searchParams.get('municipality_id');
    const assignedTo = searchParams.get('assigned_to');
    const status = searchParams.get('status');
    const myTasks = searchParams.get('my_tasks') === 'true';

    if (!municipalityId) {
      return NextResponse.json({ error: 'municipality_id required' }, { status: 400 });
    }

    let query = supabase
      .from('operator_tasks')
      .select(`
        *,
        assigned_to_user:users!operator_tasks_assigned_to_fkey(id, full_name, email, role),
        created_by_user:users!operator_tasks_created_by_fkey(id, full_name, email),
        completed_by_user:users!operator_tasks_completed_by_fkey(id, full_name, email)
      `)
      .eq('municipality_id', municipalityId)
      .order('created_at', { ascending: false });

    if (myTasks) {
      query = query.eq('assigned_to', authResult.user.id);
    } else if (assignedTo) {
      query = query.eq('assigned_to', assignedTo);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      tasks: data || [],
      count: data?.length || 0
    });

  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new task
export async function POST(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      municipality_id,
      assigned_to,
      title,
      description,
      priority,
      due_date
    } = body;

    if (!municipality_id || !title) {
      return NextResponse.json({
        error: 'Missing required fields',
        required: ['municipality_id', 'title']
      }, { status: 400 });
    }

    // Validate priority
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json({
        error: 'Invalid priority',
        validPriorities
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('operator_tasks')
      .insert({
        municipality_id,
        assigned_to: assigned_to || authResult.user.id, // Default to self
        created_by: authResult.user.id,
        title,
        description,
        priority: priority || 'medium',
        due_date,
        status: 'pending'
      })
      .select(`
        *,
        assigned_to_user:users!operator_tasks_assigned_to_fkey(id, full_name, email),
        created_by_user:users!operator_tasks_created_by_fkey(id, full_name, email)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      task: data,
      message: 'משימה נוצרה בהצלחה'
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Failed to create task', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update task
export async function PUT(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, status, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
    }

    // If marking as completed, set completed_at and completed_by
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
      updates.completed_by = authResult.user.id;
      updates.status = 'completed';
    } else if (status) {
      updates.status = status;
    }

    const { data, error } = await supabase
      .from('operator_tasks')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        assigned_to_user:users!operator_tasks_assigned_to_fkey(id, full_name, email),
        created_by_user:users!operator_tasks_created_by_fkey(id, full_name, email),
        completed_by_user:users!operator_tasks_completed_by_fkey(id, full_name, email)
      `)
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      task: data,
      message: 'משימה עודכנה בהצלחה'
    });

  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Failed to update task', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete task
export async function DELETE(request) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.valid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
    }

    // Only creator or admin can delete
    const { data: task } = await supabase
      .from('operator_tasks')
      .select('created_by')
      .eq('id', id)
      .single();

    if (task && task.created_by !== authResult.user.id && authResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Only task creator can delete' }, { status: 403 });
    }

    const { error } = await supabase
      .from('operator_tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'משימה נמחקה בהצלחה'
    });

  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: 'Failed to delete task', details: error.message },
      { status: 500 }
    );
  }
}
