import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - Get all responses for a survey (for call center manager)
export async function GET(request, { params }) {
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

    const surveyId = params.id;

    console.log('🔍 Fetching responses for survey ID:', surveyId);
    console.log('🔑 Using service role key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'YES' : 'NO');
    
    // Get all responses for this survey
    // Note: Service role key should bypass RLS automatically
    const { data: responses, error } = await supabase
      .from('survey_responses')
      .select('*')
      .eq('survey_id', surveyId)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching responses:', error);
      return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 });
    }

    console.log(`📊 API: Found ${responses?.length || 0} responses for survey ${surveyId}`);
    console.log('Response IDs:', responses?.map(r => r.id));
    console.log('Full response data:', JSON.stringify(responses, null, 2));
    
    // Also check total count in table for debugging
    const { count, error: countError } = await supabase
      .from('survey_responses')
      .select('*', { count: 'exact', head: true })
      .eq('survey_id', surveyId);
    
    console.log(`🔢 Total count in DB for this survey: ${count}`);

    return NextResponse.json({ responses });
  } catch (error) {
    console.error('Error in GET /api/surveys/[id]/responses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
