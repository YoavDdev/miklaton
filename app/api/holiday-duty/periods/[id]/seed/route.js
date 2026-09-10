import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { requireRole } from '@/lib/auth';

const EDITORS = ['call_center_manager', 'admin'];

/**
 * ממלא לוח חג ריק בטיוטה.
 *
 * body: { municipality_id, from_period_id? }
 * עם from_period_id - משכפל לוח חג קודם. בלעדיו - מעתיק את הקטגוריות הפעילות
 * מהמדריך. כך מנהל המוקד מדייק דלתאות ולא מתחיל מדף ריק.
 */
export async function POST(request, { params }) {
  const auth = await requireRole(request, EDITORS);
  if (auth.error) return auth.error;

  const { municipality_id: municipalityId, from_period_id: fromPeriodId } = await request.json();
  if (!municipalityId) {
    return NextResponse.json({ success: false, error: 'municipality_id חסר' }, { status: 400 });
  }

  const { count } = await supabase
    .from('holiday_duty_topics')
    .select('id', { count: 'exact', head: true })
    .eq('holiday_period_id', params.id);
  if (count > 0) {
    return NextResponse.json(
      { success: false, error: 'ללוח כבר יש תוכן. יש למחוק אותו לפני זריעה מחדש.' },
      { status: 409 }
    );
  }

  const topics = fromPeriodId
    ? await topicsFromPeriod(fromPeriodId)
    : await topicsFromGuide(municipalityId);

  for (const t of topics) {
    const { data: topic, error } = await supabase
      .from('holiday_duty_topics')
      .insert({
        municipality_id: municipalityId,
        holiday_period_id: params.id,
        call_category_id: t.call_category_id || null,
        name: t.name,
        display_order: t.display_order,
        instructions: t.instructions || null,
      })
      .select('id')
      .single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    if (t.entries.length) {
      const { error: e2 } = await supabase.from('holiday_duty_entries').insert(
        t.entries.map((e) => ({ ...e, municipality_id: municipalityId, topic_id: topic.id }))
      );
      if (e2) return NextResponse.json({ success: false, error: e2.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, seeded: topics.length });
}

async function topicsFromGuide(municipalityId) {
  const { data } = await supabase
    .from('call_categories')
    .select(
      'id, name, display_order,' +
        ' call_category_contacts(external_name, external_phone, external_role,' +
        ' escalation_order, note, active)'
    )
    .eq('municipality_id', municipalityId)
    .eq('active', true)
    .order('display_order');

  // ההוראות של המדריך אינן מועתקות בכוונה: אלה נהלי טיפול בשיחה, ארוכים
  // ולא רלוונטיים למוקדן שמחפש בחג למי להתקשר. מנהל המוקד יכול לכתוב הערה
  // קצרה משלו לכל נושא.
  return (data || []).map((c) => ({
    call_category_id: c.id,
    name: c.name,
    display_order: c.display_order || 0,
    instructions: null,
    entries: (c.call_category_contacts || [])
      .filter((x) => x.active && x.external_name?.trim())
      .map((x) => ({
        contact_name: x.external_name.trim(),
        contact_phone: x.external_phone || null,
        contact_role: x.external_role || null,
        order_index: x.escalation_order || 1,
        note: x.note || null,
      })),
  }));
}

async function topicsFromPeriod(periodId) {
  const { data } = await supabase
    .from('holiday_duty_topics')
    .select(
      'call_category_id, name, display_order, instructions,' +
        ' holiday_duty_entries(subtopic, contact_name, contact_phone, contact_role,' +
        ' order_index, split_group, split_note, requires_approval_from, note, active)'
    )
    .eq('holiday_period_id', periodId)
    .eq('active', true)
    .order('display_order');

  return (data || []).map((t) => ({
    call_category_id: t.call_category_id,
    name: t.name,
    display_order: t.display_order,
    instructions: t.instructions,
    // applies_dates לא משוכפל בכוונה: התאריכים שייכים לחג הקודם.
    entries: (t.holiday_duty_entries || [])
      .filter((e) => e.active)
      .map(({ active, ...e }) => e),
  }));
}
