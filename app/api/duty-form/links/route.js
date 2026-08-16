import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireRole, signDutyFormToken } from '@/lib/auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// GET - קישורים חתומים לטופסי תורנות, לפי מכלול.
// רק מנהלים מחוברים מקבלים את הטוקנים (הם אלה ששולחים את הקישורים ב-WhatsApp).
export async function GET(request) {
  try {
    const auth = await requireRole(request, ['call_center_manager', 'sector_manager']);
    if (auth.error) return auth.error;

    const { data: departments, error } = await supabase
      .from('departments')
      .select('id')
      .eq('active', true);

    if (error) throw error;

    const tokens = {};
    for (const dept of departments || []) {
      tokens[dept.id] = signDutyFormToken(dept.id);
    }

    return NextResponse.json({ success: true, tokens });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
