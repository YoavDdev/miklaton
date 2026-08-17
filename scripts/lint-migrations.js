#!/usr/bin/env node
/**
 * בודק את supabase/migrations/ לפני `supabase db push`.
 * הרצה: npm run db:lint-migrations
 */
const fs = require('fs');
const path = require('path');
const { findSilentlySkipped, findDuplicateVersions, orderMigrations } = require('./lib/migrations');

const dir = path.join(process.cwd(), 'supabase', 'migrations');
if (!fs.existsSync(dir)) {
  console.error('supabase/migrations/ לא קיימת');
  process.exit(2);
}

const files = fs.readdirSync(dir).filter((f) => f !== 'README.md');
const skipped = findSilentlySkipped(files);
const duplicates = findDuplicateVersions(files);
const ordered = orderMigrations(files);

console.log(`נבדקו ${files.length} קבצים ב-supabase/migrations/`);
console.log(`מיגרציות תקינות: ${ordered.length}`);

let failed = false;

if (skipped.length) {
  failed = true;
  console.error('\n❌ קבצים שה-CLI ידלג עליהם בשקט (לא יורצו, בלי שגיאה):');
  for (const f of skipped) console.error('  ' + f);
  console.error('  התבנית הנדרשת: <timestamp>_name.sql — עדיף ליצור עם `supabase migration new`');
}

if (duplicates.length) {
  failed = true;
  console.error('\n❌ גרסאות כפולות (ה-CLI לא מתלונן, וסדר ההרצה ביניהן שרירותי):');
  for (const d of duplicates) console.error(`  ${d.version}: ${d.files.join(', ')}`);
}

if (failed) process.exit(1);
console.log('\n✅ תיקיית המיגרציות תקינה.');
