const crypto = require('crypto');

/**
 * בדיקות תקינות על תיקיית המיגרציות, לפני שמריצים `supabase db push`.
 *
 * למה זה קיים: ה-CLI **מדלג בשקט** על כל קובץ ששמו לא תואם ל-
 * "<timestamp>_name.sql" — הוא מדפיס שורת Skipping ומחזיר קוד יציאה 0.
 * ככה שלוש מיגרציות אמיתיות (20260817a/b/c) מעולם לא נרשמו כממתינות.
 * מי שלא קורא כל שורה בפלט מניח שהן רצו.
 *
 * הפונקציות כאן טהורות (בלי גישה ל-DB ובלי קריאת קבצים) כדי שיהיה אפשר
 * לבדוק אותן.
 */

// התבנית שה-CLI מקבל בפועל: ספרות, קו תחתון, שם, .sql
const CLI_PATTERN = /^(\d+)_(.+)\.sql$/;

function parseFilename(filename) {
  const match = CLI_PATTERN.exec(filename);
  if (!match) return null;
  return { version: match[1], name: match[2], filename };
}

/**
 * מחזיר את הקבצים שה-CLI יתעלם מהם בשקט.
 * README.md וקבצים שאינם .sql אינם ממצא - הם לא אמורים לרוץ.
 */
function findSilentlySkipped(filenames) {
  return filenames.filter((f) => f.endsWith('.sql') && !CLI_PATTERN.test(f));
}

/**
 * מחזיר גרסאות שמופיעות ביותר מקובץ אחד.
 * ה-CLI לא מתלונן על כפילות - הוא הציג שש פעמים 20260511 בלי אף אזהרה -
 * וזה בדיוק מה שאיפשר לשתי המיגרציות של 20260510 להתנגש.
 */
function findDuplicateVersions(filenames) {
  const byVersion = new Map();
  for (const filename of filenames) {
    const entry = parseFilename(filename);
    if (!entry) continue;
    if (!byVersion.has(entry.version)) byVersion.set(entry.version, []);
    byVersion.get(entry.version).push(filename);
  }
  return [...byVersion.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([version, files]) => ({ version, files: files.sort() }));
}

/** ממיין לפי גרסה - השוואת מחרוזות, כי חותמות זמן הן באורך קבוע. */
function orderMigrations(filenames) {
  return filenames
    .map(parseFilename)
    .filter(Boolean)
    .sort((a, b) => (a.version < b.version ? -1 : a.version > b.version ? 1 : 0));
}

function checksum(sql) {
  return crypto.createHash('sha256').update(sql, 'utf8').digest('hex');
}

module.exports = {
  parseFilename,
  findSilentlySkipped,
  findDuplicateVersions,
  orderMigrations,
  checksum,
};
