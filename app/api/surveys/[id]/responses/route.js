import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@/lib/auth';

// Disable Next.js caching - always fetch fresh data
export const dynamic = 'force-dynamic';

// Create Supabase client inside function to ensure env vars are available at runtime
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// GET - Get all responses for a survey (for call center manager)
export async function GET(request, { params }) {
  try {
    const supabase = getSupabase();
    
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

    if (userError || !userData || !['call_center_manager', 'admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const surveyId = params.id;

    
    // Get all responses for this survey
    const { data: responses, error } = await supabase
      .from('survey_responses')
      .select('*')
      .eq('survey_id', surveyId)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching responses:', error);
      return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 });
    }


    return NextResponse.json({ responses });
  } catch (error) {
    console.error('Error in GET /api/surveys/[id]/responses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
