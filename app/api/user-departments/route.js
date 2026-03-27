import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Service role bypasses RLS
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    // שלוף את המחלקות של המשתמש - bypasses RLS with service role
    const { data, error } = await supabase
      .from('user_departments')
      .select(`
        department_id,
        is_primary,
        department:departments(id, name)
      `)
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user departments:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ departments: data || [] });
  } catch (error) {
    console.error('API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
