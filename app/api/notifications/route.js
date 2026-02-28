import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET all notifications
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('general_notifications')
      .select('*')
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
    const body = await request.json();
    const { title, message, type, author } = body;

    if (!title || !message) {
      return NextResponse.json({ 
        error: 'Title and message are required' 
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('general_notifications')
      .insert({
        title,
        message,
        type: type || 'info',
        author: author || 'מוקדן'
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

// DELETE notification
export async function DELETE(request) {
  try {
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
