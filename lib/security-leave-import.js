/**
 * ייבוא היעדרויות מהטבלה הימנית של קובץ הסידור (YOA-38), משותף לשני
 * מסלולי ההעלאה כדי שלא יסטו זה מזה.
 *
 * הסמנטיקה: החלפה של מה שיובא בעבר לאותו שבוע בלבד - רשומות עם
 * source='excel' בטווח השבוע נמחקות ונכתבות מחדש; רשומות שהוזנו ידנית
 * במסך ניהול החופשים (source='manual') לא נגעות. שם שלא זוהה מול רשימת
 * העובדים מדולג - אין רשומת חופשה בלי staff_id.
 */
export async function replaceExcelLeaves(supabase, departmentId, weekStart, leaves) {
  if (!Array.isArray(leaves)) return { count: 0 };

  const weekEnd = new Date(new Date(`${weekStart}T00:00:00Z`).getTime() + 6 * 86400000)
    .toISOString()
    .slice(0, 10);

  const { error: deleteError } = await supabase
    .from('security_staff_leave')
    .delete()
    .eq('department_id', departmentId)
    .eq('source', 'excel')
    .gte('start_date', weekStart)
    .lte('end_date', weekEnd);
  if (deleteError) throw deleteError;

  const rows = leaves
    .filter((l) => l.staff_id)
    .map((l) => ({
      department_id: departmentId,
      staff_id: l.staff_id,
      start_date: l.start_date,
      end_date: l.end_date,
      reason: l.reason || null,
      source: 'excel',
    }));

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('security_staff_leave').insert(rows);
    if (insertError) throw insertError;
  }

  return { count: rows.length };
}
