import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - List all surveys (for call center manager)
export async function GET(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Verify user is call center manager
    const { data: userData, error: userError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', decoded.userId)
      .single();

    if (userError || !userData || userData.role !== 'call_center_manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all surveys with response counts
    const { data: surveys, error } = await supabase
      .from('surveys')
      .select(`
        *,
        survey_responses(count)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching surveys:', error);
      return NextResponse.json({ error: 'Failed to fetch surveys' }, { status: 500 });
    }

    // Transform the response to include count
    const surveysWithCounts = surveys.map(survey => ({
      ...survey,
      response_count: survey.survey_responses[0]?.count || 0,
      survey_responses: undefined
    }));

    return NextResponse.json({ surveys: surveysWithCounts });
  } catch (error) {
    console.error('Error in GET /api/surveys:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new survey
export async function POST(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Verify user is call center manager
    const { data: userData, error: userError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', decoded.userId)
      .single();

    if (userError || !userData || userData.role !== 'call_center_manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { title } = await request.json();

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Generate unique survey token (8 characters, URL-safe)
    const generateToken = () => {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    let surveyToken = generateToken();
    
    // Make sure token is unique (very unlikely collision, but let's be safe)
    const { data: existing } = await supabase
      .from('surveys')
      .select('id')
      .eq('token', surveyToken)
      .single();
    
    // If by chance token exists, generate a new one
    while (existing) {
      surveyToken = generateToken();
      const { data: check } = await supabase
        .from('surveys')
        .select('id')
        .eq('token', surveyToken)
        .single();
      if (!check) break;
    }
    
    // Create survey
    const { data: survey, error } = await supabase
      .from('surveys')
      .insert({
        title: title.trim(),
        token: surveyToken,
        created_by: decoded.userId,
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating survey:', error);
      return NextResponse.json({ error: 'Failed to create survey' }, { status: 500 });
    }

    return NextResponse.json({ survey }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/surveys:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update survey (close/reopen)
export async function PUT(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Verify user is call center manager
    const { data: userData, error: userError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', decoded.userId)
      .single();

    if (userError || !userData || userData.role !== 'call_center_manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id, status } = await request.json();

    if (!id || !status || !['active', 'closed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // Update survey status
    const updateData = {
      status,
      closed_at: status === 'closed' ? new Date().toISOString() : null
    };

    const { data: survey, error } = await supabase
      .from('surveys')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating survey:', error);
      return NextResponse.json({ error: 'Failed to update survey' }, { status: 500 });
    }

    return NextResponse.json({ survey });
  } catch (error) {
    console.error('Error in PUT /api/surveys:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a closed survey
export async function DELETE(request) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Verify user is call center manager
    const { data: userData, error: userError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', decoded.userId)
      .single();

    if (userError || !userData || userData.role !== 'call_center_manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 });
    }

    // Check if survey is closed before deleting
    const { data: survey } = await supabase
      .from('surveys')
      .select('status')
      .eq('id', id)
      .single();

    if (survey && survey.status === 'active') {
      return NextResponse.json({ error: 'Cannot delete active survey. Close it first.' }, { status: 400 });
    }

    // Delete survey (cascade will delete responses automatically)
    const { error } = await supabase
      .from('surveys')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting survey:', error);
      return NextResponse.json({ error: 'Failed to delete survey' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/surveys:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
