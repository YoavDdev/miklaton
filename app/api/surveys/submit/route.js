import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rate-limit';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// POST - Submit survey response (public, no auth required)
export async function POST(request) {
  try {
    const limited = rateLimit(request, 'survey-submit', { limit: 5, windowMs: 60_000 });
    if (limited) return limited;

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

    // Get client IP for statistics (no blocking)
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';

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

    // התראה למנהלת המוקד. הטבלה היא general_notifications - אין טבלת
    // notifications, ואין בה user_id: ההתראות הן כלל-מערכתיות ולא אישיות.
    // supabase-js לא זורק שגיאה אלא מחזיר { error }, ולכן חובה לבדוק אותו
    // במפורש - try/catch לבדו בלע כאן כשל שקט.
    const notificationMessage = respondent_name
      ? `תשובה חדשה לסקר "${survey.title}" מאת ${respondent_name}`
      : `תשובה חדשה לסקר "${survey.title}" (אנונימי)`;

    const { error: notifError } = await supabase
      .from('general_notifications')
      .insert({
        title: '📊 תשובה חדשה לסקר',
        message: notificationMessage,
        type: 'info',
        author: 'מערכת סקרים'
      });

    // הגשת הסקר לא נכשלת בגלל התראה - אבל הכשל כן נרשם.
    if (notifError) {
      console.error('Failed to create survey notification:', notifError);
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
