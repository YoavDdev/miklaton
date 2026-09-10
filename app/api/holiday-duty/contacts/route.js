import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { requireRole } from '@/lib/auth';

const EDITORS = ['call_center_manager', 'admin'];

/**
 * מאחד אנשי קשר משתי הטבלאות.
 *
 * למה שתיהן: המדריך שומר אנשי קשר בשדות external_* של call_category_contacts,
 * אך יש אנשי קשר שקיימים רק ב-on_call_contacts ואינם משויכים לאף קטגוריה -
 * דוד דרזי הוא דוגמה קיימת. קריאה מטבלה אחת בלבד הייתה מסתירה אותם מהבורר.
 */
export async function GET(request) {
  const auth = await requireRole(request, EDITORS);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const municipalityId = searchParams.get('municipality_id');
  if (!municipalityId) {
    return NextResponse.json({ success: false, error: 'municipality_id חסר' }, { status: 400 });
  }

  const [guide, onCall] = await Promise.all([
    supabase
      .from('call_category_contacts')
      .select(
        'id, external_name, external_phone, external_role, active,' +
          ' call_categories!inner(name, municipality_id)'
      )
      .eq('active', true)
      .eq('call_categories.municipality_id', municipalityId),
    supabase
      .from('on_call_contacts')
      .select('id, name, phone, role_description, active')
      .eq('active', true)
      .eq('municipality_id', municipalityId),
  ]);

  const rows = [];
  for (const c of guide.data || []) {
    if (!c.external_name?.trim()) continue;
    rows.push({
      source_table: 'call_category_contacts',
      source_contact_id: c.id,
      name: c.external_name.trim(),
      phone: c.external_phone || null,
      role: c.external_role || null,
      from: c.call_categories?.name || null,
    });
  }
  for (const c of onCall.data || []) {
    if (!c.name?.trim()) continue;
    rows.push({
      source_table: 'on_call_contacts',
      source_contact_id: c.id,
      name: c.name.trim(),
      phone: c.phone || null,
      role: c.role_description || null,
      from: 'אנשי קשר כלליים',
    });
  }

  // ניכוי כפילויות לפי שם+טלפון. אותו אדם מופיע בכמה קטגוריות במדריך.
  const seen = new Map();
  for (const r of rows) {
    const key = `${r.name}|${r.phone || ''}`;
    if (!seen.has(key)) seen.set(key, r);
  }

  const contacts = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'he'));
  return NextResponse.json({ success: true, contacts });
}
