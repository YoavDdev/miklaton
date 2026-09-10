import { supabase } from '@/lib/supabase-server';
import { findActivePeriod } from '@/lib/holidays';

/**
 * מטמון קצר בזיכרון. מנוע הזמינות שואל "האם עכשיו חג" בכל טעינה של מדריך
 * הכוננויות, ותאריכי חג אינם משתנים - אין סיבה לפגוע ב-DB בכל בקשה.
 */
const CACHE_TTL_MS = 60 * 1000;
const cache = new Map();

export async function loadPeriods(municipalityId) {
  const hit = cache.get(municipalityId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.periods;

  const { data, error } = await supabase
    .from('holiday_periods')
    .select('id, name, slug, starts_at, ends_at, status, notes')
    .eq('municipality_id', municipalityId)
    .order('starts_at');
  if (error) throw new Error(error.message);

  const periods = data || [];
  cache.set(municipalityId, { at: Date.now(), periods });
  return periods;
}

export async function getActivePeriod(municipalityId, now = new Date()) {
  return findActivePeriod(await loadPeriods(municipalityId), now);
}

/** לבדיקות ולזריעה מחדש. */
export function clearHolidayCache() {
  cache.clear();
}
