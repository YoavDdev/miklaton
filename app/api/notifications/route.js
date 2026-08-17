import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole, requireRoleOrScreen } from '@/lib/auth';

// Create Supabase client locally to ensure env vars are available at runtime
const getSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(supabaseUrl, supabaseKey);
};

// GET all notifications
export async function GET(request) {
  const supabase = getSupabase();
  try {
    const auth = await requireRoleOrScreen(request);
    if (auth.error) return auth.error;

    if (!supabase) {
      return NextResponse.json({ 
        notifications: [],
        error: 'Database not configured' 
      }, { status: 503 });
    }

    const { data, error } = await supabase
      .from('general_notifications')
      .select('*')
      .or('start_date.is.null,start_date.lte.' + new Date().toISOString())
      .or('end_date.is.null,end_date.gte.' + new Date().toISOString())
      .or('expires_at.is.null,expires_at.gte.' + new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      notifications: data || [],
      success: true
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ 
      notifications: [],
      error: error.message 
    }, { status: 500 });
  }
}

// POST new notification
export async function POST(request) {
  try {
    const auth = await requireRole(request, ['operator', 'call_center_manager']);
    if (auth.error) return auth.error;

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json({ 
        error: 'Database not configured' 
      }, { status: 503 });
    }

    const body = await request.json();
    const { title, message, type, author, expires_at, start_date, end_date } = body;

    if (!title || !message) {
      return NextResponse.json({
        error: 'Title and message are required'
      }, { status: 400 });
    }

    // הגבלת אורך — התוכן מוצג לכל המוקד ולמסך הקיר
    if (title.length > 200 || message.length > 2000) {
      return NextResponse.json({
        error: 'כותרת עד 200 תווים, הודעה עד 2000 תווים'
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('general_notifications')
      .insert({
        title,
        message,
        type: type || 'info',
        author: author || 'מוקדן',
        expires_at: expires_at || null,
        start_date: start_date || null,
        end_date: end_date || null
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      notification: data,
      success: true
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

// DELETE notification by ID
export async function DELETE(request) {
  try {
    const auth = await requireRole(request, ['operator', 'call_center_manager']);
    if (auth.error) return auth.error;

    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ 
        error: 'Notification ID is required' 
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('general_notifications')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}
