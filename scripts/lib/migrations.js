const crypto = require('crypto');

/**
 * הלוגיקה הטהורה של ה-migration runner: מיון, checksum, והחלטה מה להריץ.
 * מופרד מהגישה ל-DB כדי שיהיה אפשר לבדוק אותו בלי בסיס נתונים.
 *
 * שמות קבצים: <version>_<name>.sql כאשר version הוא מספר רץ (0001, 0002...).
 * מספר רץ ולא תאריך - תאריכים הם מה שיצר את התנגשויות 20260510 ו-20260817.
 */

const FILENAME = /^(\d{4,})_([a-z0-9_]+)\.sql$/;

function parseFilename(filename) {
  const match = FILENAME.exec(filename);
  if (!match) return null;
  return { version: Number(match[1]), name: match[2], filename };
}

/**
 * ממיין מיגרציות לפי מספר גרסה. זורק על גרסה כפולה - שתי מיגרציות עם אותו
 * מספר הן בדיוק התקלה של 20260510, ואסור שתעבור בשקט.
 */
function orderMigrations(filenames) {
  const parsed = [];
  const ignored = [];
  for (const filename of filenames) {
    const entry = parseFilename(filename);
    if (entry) parsed.push(entry);
    else ignored.push(filename);
  }

  const seen = new Map();
  for (const entry of parsed) {
    if (seen.has(entry.version)) {
      throw new Error(
        `גרסת מיגרציה כפולה ${entry.version}: ${seen.get(entry.version)} ו-${entry.filename}`
      );
    }
    seen.set(entry.version, entry.filename);
  }

  parsed.sort((a, b) => a.version - b.version);
  return { migrations: parsed, ignored };
}

function checksum(sql) {
  return crypto.createHash('sha256').update(sql, 'utf8').digest('hex');
}

/**
 * מחליט מה להריץ.
 *
 * available: [{ version, name, filename, sql }]
 * applied:   [{ version, checksum }] כפי שנקרא מטבלת schema_migrations
 *
 * מחזיר:
 *   pending  - מיגרציות שטרם הורצו, בסדר עולה
 *   changed  - מיגרציות שכבר הוחלו אבל תוכן הקובץ השתנה מאז (עריכה בדיעבד)
 *   missing  - גרסאות שרשומות כמוחלות אבל הקובץ שלהן נעלם מהריפו
 */
function planMigrations(available, applied) {
  const appliedByVersion = new Map(applied.map((a) => [a.version, a.checksum]));

  const pending = [];
  const changed = [];
  for (const migration of available) {
    const appliedChecksum = appliedByVersion.get(migration.version);
    if (appliedChecksum === undefined) {
      pending.push(migration);
    } else if (appliedChecksum !== checksum(migration.sql)) {
      changed.push(migration);
    }
  }

  const availableVersions = new Set(available.map((m) => m.version));
  const missing = applied
    .map((a) => a.version)
    .filter((v) => !availableVersions.has(v))
    .sort((a, b) => a - b);

  return { pending, changed, missing };
}

module.exports = { parseFilename, orderMigrations, checksum, planMigrations };
