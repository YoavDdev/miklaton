/**
 * לוגיקת חגים טהורה, בלי גישה לרשת ובלי DB.
 *
 * למה מודול נפרד: השאלה "האם עכשיו חג" מכריעה מי מוצג למוקדן בשלוש נקודות
 * שונות בקוד. כשהיא מפוזרת היא נשברת בשקט - בדיוק מה שקורה היום עם
 * `available_days`, שמחזיר את צוות יום החול ביום ראשון שהוא חג. כאן היא
 * במקום אחד ומכוסה בבדיקות.
 */

const ISRAEL_TZ = 'Asia/Jerusalem';

const dayOf = (iso) => iso.slice(0, 10);

function addDays(isoDate, n) {
  const t = new Date(`${isoDate}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/**
 * הופך את פלט Hebcal לתקופות חג רציפות.
 *
 * ימי יום-טוב עוקבים מתמזגים לתקופה אחת (ראש השנה = יומיים), והתקופה נמתחת
 * מההדלקה שלפני היום הראשון ועד ההבדלה הראשונה שאחרי היום האחרון. כשחג צמוד
 * לשבת אין הבדלה ביניהם, ולכן התקופה נמתחת נכון עד מוצאי שבת.
 */
export function buildPeriodsFromHebcal(items) {
  const yomtov = (items || [])
    .filter((i) => i.yomtov === true)
    .map((i) => ({ date: dayOf(i.date), hebrew: i.hebrew }));
  const candles = (items || []).filter((i) => i.category === 'candles');
  const havdalah = (items || []).filter((i) => i.category === 'havdalah');

  const blocks = [];
  for (const y of yomtov) {
    const last = blocks[blocks.length - 1];
    if (last && addDays(last.days[last.days.length - 1], 1) === y.date) {
      last.days.push(y.date);
    } else {
      blocks.push({ days: [y.date], name: y.hebrew });
    }
  }

  return blocks
    .map((b) => {
      const firstDay = b.days[0];
      const lastDay = b.days[b.days.length - 1];
      const start = candles.find((c) => dayOf(c.date) === addDays(firstDay, -1));
      const end = havdalah.find((h) => dayOf(h.date) >= lastDay);
      if (!start || !end) return null;
      return { name: b.name, days: b.days, starts_at: start.date, ends_at: end.date };
    })
    .filter(Boolean);
}

export function findActivePeriod(periods, now = new Date()) {
  const t = now.getTime();
  return (
    (periods || []).find(
      (p) => t >= new Date(p.starts_at).getTime() && t <= new Date(p.ends_at).getTime()
    ) || null
  );
}

export function findUpcomingPeriod(periods, now = new Date(), withinHours = 48) {
  const t = now.getTime();
  const limit = t + withinHours * 3600 * 1000;
  const future = (periods || [])
    .filter((p) => {
      const start = new Date(p.starts_at).getTime();
      return start > t && start <= limit;
    })
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  return future[0] || null;
}

export function isHolidayNow(periods, now = new Date()) {
  return findActivePeriod(periods, now) !== null;
}

/** יום השבוע בישראל, 0=ראשון. */
export function israelDayOfWeek(now = new Date()) {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: ISRAEL_TZ,
    weekday: 'short',
  }).format(now);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

/** התאריך בישראל בפורמט YYYY-MM-DD. */
export function israelDate(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: ISRAEL_TZ });
}

/**
 * יום השבוע שלפיו יש להעריך `available_days`.
 *
 * בחג מוחזר 6 - "חגים זה כמו שישי שבת". בלי זה, ביום ראשון שהוא חג המערכת
 * בוחרת את צוות יום החול ושולחת את המוקדן לכונן הלא נכון.
 */
export function effectiveDayOfWeek(periods, now = new Date()) {
  if (isHolidayNow(periods, now)) return 6;
  return israelDayOfWeek(now);
}
