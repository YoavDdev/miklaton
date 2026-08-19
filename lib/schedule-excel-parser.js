/**
 * הפרסר של קובץ סידור הביטחון (YOA-35). חולץ מ-ExcelImporter כדי שאפשר
 * יהיה להריץ אותו בבדיקות מול הקובץ האמיתי של מנהל הביטחון - הכשלים
 * שנמצאו בו (שורות הערה שהפכו ל"עובדים", שבוע שמנוהל רק בטבלה הימנית)
 * קרו בפרודקשן בדיוק כי הלוגיקה הזו חיה בתוך קומפוננטה ולא נבדקה.
 */

export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// Words that mean "not a person on shift" when found in a day cell
export const SKIP_WORDS = ['חסר', 'פגרה', 'קורס', 'מחלה', 'חופש', 'ללא', 'הערות', 'אין'];

// מילים שמסגירות שהשורה היא הערה ולא שם אדם (רכבים, משמרות, ניסוחים).
// שם שלא זוהה ברשימת העובדים ומכיל אחת מאלה - מדולג ומדווח, לא מיובא.
const NOT_A_NAME_WORDS = [
  'בוקר', 'ערב', 'צהריים', 'לילה', 'מתואמת', 'שלדי', 'שילדי',
  'אופנוע', 'סיאט', 'קשקאי', 'משעה', 'במקום', 'ירד', 'סידור',
  'מטווחים', 'הכשרה', 'הכשרות', 'שעה',
];

/**
 * האם שורה שלא זוהתה ברשימת העובדים סבירה כשם אדם? בקובץ האמיתי נמצאו
 * "שמות" כמו "15:00", "בוקר" ו"הילולה משעה 21:00" שיובאו כעובדים (YOA-35).
 * הכלל: בלי ספרות, בלי מילות הערה, ועד שלוש מילים.
 */
function looksLikePersonName(name) {
  if (/\d/.test(name)) return false;
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length > 3) return false;
  if (words.some(w => NOT_A_NAME_WORDS.some(marker => w.includes(marker)))) return false;
  return true;
}

export const TIME_RANGE_RE = /(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/;

export function normalizeTime(t) {
  if (!t) return '';
  return t.toString().slice(0, 5); // '07:00:00' -> '07:00'
}

export function extractTimeRange(text) {
  const m = text?.match(TIME_RANGE_RE);
  if (!m) return null;
  return {
    start: `${m[1].padStart(2, '0')}:${m[2]}`,
    end: `${m[3].padStart(2, '0')}:${m[4]}`,
  };
}

// Excel serial number -> JS Date (UTC parts hold the calendar date)
export function serialToDate(serial) {
  return new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
}

export function sameCalendarDate(utcDate, localDate) {
  return (
    utcDate.getUTCFullYear() === localDate.getFullYear() &&
    utcDate.getUTCMonth() === localDate.getMonth() &&
    utcDate.getUTCDate() === localDate.getDate()
  );
}

// ---- Sheet detection ------------------------------------------------
// A "schedule sheet" has a header row with "משמרת" + "מחלקה" and a row of
// Excel date serials for the week days.
export function analyzeSheet(rows) {
  let isSchedule = false;
  let weekSunday = null;
  for (const row of rows.slice(0, 8)) {
    if (!row) continue;
    const cells = Array.from(row, c => c?.toString().trim() || '');
    if (cells.includes('משמרת') && cells.includes('מחלקה')) isSchedule = true;
    if (!weekSunday) {
      const serial = row.find(c => typeof c === 'number' && c > 40000 && c < 60000);
      if (serial) weekSunday = serialToDate(serial);
    }
  }
  return { isSchedule, weekSunday };
}

// סטטוסים בטבלה הימנית שמשמעותם היעדרות. כל השאר (בוקר/ערב/ללא/שעות)
// הם סטטוסי עבודה ואינם נוגעים לחופשות.
export const LEAVE_WORDS = ['חופש', 'מחלה', 'פגרה', 'קורס'];

/**
 * הטבלה הימנית בגיליון (YOA-38): שורה לכל עובד - שם מלא ולידו סטטוס
 * יומי לכל יום בשבוע. חופש/מחלה/פגרה/קורס שם הם מקור האמת של ההיעדרויות.
 * תא נחשב היעדרות רק כשהוא מילת היעדרות לבדה - "בוקר / פגרה" הוא עבודה
 * חלקית, לא חופשה.
 *
 * מחזיר טווחים רצופים לכל עובד וסוג: [{staff_id, staff_name, type, from_day, to_day}]
 */
function parseLeaveTable(rows, staff) {
  // איתור קבוצת הימים השנייה: כותרת "ראשון...שבת" (הראשונה היא "יום א'...")
  let dayCol = -1;
  let nameCol = -1;
  for (const row of rows.slice(0, 8)) {
    if (!row) continue;
    const cells = Array.from(row, c => c?.toString().trim() || '');
    const idx = cells.findIndex((c, i) => c === 'ראשון' && cells[i + 6] === 'שבת');
    if (idx !== -1) {
      dayCol = idx;
      nameCol = idx - 1;
      break;
    }
  }
  if (dayCol === -1) return [];

  // התאמת שם מלא מהטבלה הימנית: הכתיב שם לא תמיד זהה לרשומת העובד
  // ("מיכאל יוספוב" מול "מיכאל יוסף"), ולכן אחרי הכללים הרגילים מנסים
  // שם פרטי - רק כשהוא ייחודי ברשימה, אחרת עדיף לוותר מלנחש.
  const matchStaff = (name) => {
    const clean = name.trim();
    if (!clean) return null;
    const direct =
      staff.find(s => s.full_name?.trim() === clean) ||
      staff.find(s => s.full_name && (s.full_name.includes(clean) || clean.includes(s.full_name)));
    if (direct) return direct;
    const first = clean.split(/\s+/)[0];
    const byFirst = staff.filter(s => s.full_name?.split(/\s+/)[0] === first);
    return byFirst.length === 1 ? byFirst[0] : null;
  };

  const ranges = [];
  for (const row of rows) {
    if (!row) continue;
    const cells = Array.from(row, c => (c === null || c === undefined) ? '' : c.toString().trim());
    const name = cells[nameCol];
    if (!name || !/[א-ת]/.test(name)) continue;

    const member = matchStaff(name);
    let open = null; // {type, from_day, to_day}
    for (let day = 0; day < 7; day++) {
      const type = LEAVE_WORDS.includes(cells[dayCol + day]) ? cells[dayCol + day] : null;
      if (type && open && open.type === type && open.to_day === day - 1) {
        open.to_day = day;
      } else {
        if (open) ranges.push(open);
        open = type
          ? {
              staff_id: member?.id || null,
              staff_name: member?.full_name || name,
              type,
              from_day: day,
              to_day: day,
            }
          : null;
      }
    }
    if (open) ranges.push(open);
  }
  return ranges;
}

// ---- Real-format parser: rows = shifts, day cells = names -----------
export function parseScheduleSheet(rows, staff, shifts) {
  const entries = [];
  const manualNames = new Set();
  const skippedTokens = [];
  const neededShifts = new Map(); // key -> {category, start, end, name}

  let shiftCol = -1;
  let catCol = -1;
  let dayCols = [];
  let lastCategory = 'פיקוח';

  const findStaff = (name) => {
    const clean = name.trim();
    if (!clean) return null;
    return (
      staff.find(s => s.full_name?.trim() === clean) ||
      staff.find(s => s.full_name?.split(/\s+/)[0] === clean) ||
      staff.find(s => s.full_name && (s.full_name.includes(clean) || clean.includes(s.full_name))) ||
      null
    );
  };

  for (const row of rows) {
    if (!row || row.length === 0) continue;
    const cells = Array.from(row, c => (c === null || c === undefined) ? '' : c.toString());

    // Header row -> locate columns (take the FIRST day group, right after מחלקה)
    const headerIdx = cells.findIndex(c => c.trim() === 'משמרת');
    if (headerIdx !== -1 && cells.some(c => c.trim() === 'מחלקה')) {
      shiftCol = headerIdx;
      catCol = cells.findIndex(c => c.trim() === 'מחלקה');
      dayCols = Array.from({ length: 7 }, (_, i) => catCol + 1 + i);
      continue;
    }
    if (shiftCol === -1) continue;

    // Shift row = has a time range in the shift column
    const shiftCell = cells[shiftCol] || '';
    const shiftTime = extractTimeRange(shiftCell);
    if (!shiftTime) continue;

    const category = (cells[catCol] || '').trim() || lastCategory;
    lastCategory = category;

    // Shift label = the non-time text in the shift cell (e.g. "מתואמת בוקר")
    const shiftLabel = shiftCell
      .replace(TIME_RANGE_RE, '')
      .replace(/[\r\n]+/g, ' ')
      .trim();

    const shiftKey = `${category}|${shiftTime.start}|${shiftTime.end}`;
    if (!neededShifts.has(shiftKey)) {
      neededShifts.set(shiftKey, {
        category,
        start: shiftTime.start,
        end: shiftTime.end,
        name: shiftLabel || category,
      });
    }

    // Day cells
    for (let day = 0; day < 7; day++) {
      const cell = cells[dayCols[day]];
      if (!cell || !cell.trim()) continue;

      let lastEntry = null;
      for (const rawLine of cell.split(/\r?\n/)) {
        let line = rawLine.trim();
        if (!line) continue;

        const noteParts = [];

        // Vehicle / info in parentheses -> note
        line = line.replace(/\(([^)]*)\)/g, (_, inner) => {
          if (inner.trim()) noteParts.push(inner.trim());
          return ' ';
        });

        // שעות בתוך התא הן השעות שבהן עובדים בפועל - ככה המנהל עושה
        // שינויים במשמרת (YOA-37). שורת המשמרת היא תבנית ברירת מחדל.
        let actualStart = null;
        let actualEnd = null;

        const override = extractTimeRange(line);
        if (override) {
          actualStart = override.start;
          actualEnd = override.end;
          line = line.replace(TIME_RANGE_RE, ' ');
        }

        // "עד 11:00" / "מ 14:00" - קובעים צד אחד; הצד השני יורש מהמשמרת
        line = line.replace(/(עד|מ-?)\s*(\d{1,2})(:\d{2})?/g, (_, word, hour, minutes) => {
          const t = `${hour.padStart(2, '0')}${minutes || ':00'}`;
          if (word === 'עד') actualEnd = actualEnd || t;
          else actualStart = actualStart || t;
          return ' ';
        });

        const isBackup = /חלופי|backup/.test(line);
        line = line.replace(/חלופי|backup/g, ' ');
        line = line.replace(/[?"']/g, ' ').replace(/\s+/g, ' ').trim();

        // Nothing left = a time/info-only line -> attach to previous person
        if (!line) {
          if (lastEntry) {
            if (actualStart) lastEntry.actual_start = actualStart;
            if (actualEnd) lastEntry.actual_end = actualEnd;
            if (noteParts.length) {
              lastEntry.notes = [lastEntry.notes, ...noteParts].filter(Boolean).join(' | ');
            }
          }
          continue;
        }

        if (SKIP_WORDS.some(w => line.includes(w))) {
          skippedTokens.push(`${DAY_NAMES[day]} ${shiftTime.start}: "${rawLine.trim()}"`);
          continue;
        }

        // A line can hold several names: "נופר + סימה"
        for (const namePart of line.split(/[+,،]/)) {
          const name = namePart.trim();
          if (!name || name.length < 2) continue;

          const member = findStaff(name);
          if (!member) {
            // לא ברשימת העובדים ולא נראה כשם אדם => הערה, לא שיבוץ.
            if (!looksLikePersonName(name)) {
              skippedTokens.push(`${DAY_NAMES[day]} ${shiftTime.start}: "${rawLine.trim()}"`);
              continue;
            }
            manualNames.add(name);
          }

          const entry = {
            shift_key: shiftKey,
            category,
            shift_start: shiftTime.start,
            shift_end: shiftTime.end,
            staff_id: member?.id || null,
            staff_name: member?.full_name || name,
            day_of_week: day,
            is_backup: isBackup,
            actual_start: actualStart,
            actual_end: actualEnd,
            notes: noteParts.join(' | ') || null,
          };
          entries.push(entry);
          lastEntry = entry;
        }
      }
    }
  }

  // Which shifts need to be created? (only ones that actually have assignments)
  const usedKeys = new Set(entries.map(e => e.shift_key));
  const newShifts = [];
  for (const [key, s] of neededShifts) {
    if (!usedKeys.has(key)) continue;
    const exists = shifts.find(sh =>
      sh.category === s.category &&
      normalizeTime(sh.start_time) === s.start &&
      normalizeTime(sh.end_time) === s.end
    );
    if (!exists) newShifts.push({ key, ...s });
  }

  return {
    entries,
    newShifts,
    manualNames: [...manualNames],
    skippedTokens,
    leaveRanges: parseLeaveTable(rows, staff),
  };
}
