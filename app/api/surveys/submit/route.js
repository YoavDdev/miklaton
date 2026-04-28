import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// POST - Submit survey response (public, no auth required)
export async function POST(request) {
  try {
    const {
      token,
      respondent_name,
      q1_courtesy,
      q2_professional,
      q3_helpful,
      q4_problem_solving,
      improvements_text
    } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Survey token is required' }, { status: 400 });
    }

    // Get survey by token
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .select('*')
      .eq('token', token)
      .single();

    if (surveyError || !survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    if (survey.status === 'closed') {
      return NextResponse.json({ error: 'Survey is closed' }, { status: 400 });
    }

    // Get client IP for spam prevention
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';

    // Check if IP already submitted today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: existingResponse } = await supabase
      .from('survey_responses')
      .select('id')
      .eq('survey_id', survey.id)
      .eq('respondent_ip', ip)
      .gte('submitted_at', today.toISOString())
      .limit(1);

    if (existingResponse && existingResponse.length > 0) {
      return NextResponse.json({ 
        error: 'כבר מילאת את הסקר היום. תוכל למלא שוב מחר.' 
      }, { status: 429 });
    }

    // Validate question values (1-4 or null)
    const questions = [q1_courtesy, q2_professional, q3_helpful, q4_problem_solving];
    for (const q of questions) {
      if (q !== null && q !== undefined && (q < 1 || q > 4)) {
        return NextResponse.json({ error: 'Invalid question value' }, { status: 400 });
      }
    }

    // Insert response
    const { data: response, error } = await supabase
      .from('survey_responses')
      .insert({
        survey_id: survey.id,
        respondent_name: respondent_name || null,
        respondent_ip: ip,
        q1_courtesy: q1_courtesy || null,
        q2_professional: q2_professional || null,
        q3_helpful: q3_helpful || null,
        q4_problem_solving: q4_problem_solving || null,
        improvements_text: improvements_text || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error submitting response:', error);
      return NextResponse.json({ error: 'Failed to submit response' }, { status: 500 });
    }

    // Send notification to call center manager
    try {
      const notificationMessage = respondent_name 
        ? `תשובה חדשה לסקר "${survey.title}" מאת ${respondent_name}`
        : `תשובה חדשה לסקר "${survey.title}" (אנונימי)`;
      
      await supabase
        .from('notifications')
        .insert({
          user_id: survey.created_by,
          title: '📊 תשובה חדשה לסקר',
          message: notificationMessage,
          type: 'info',
          author: 'מערכת סקרים'
        });
    } catch (notifError) {
      console.error('Failed to send notification:', notifError);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({ 
      success: true,
      message: 'תודה על מילוי הסקר!' 
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/surveys/submit:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
