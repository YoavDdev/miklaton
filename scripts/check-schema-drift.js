#!/usr/bin/env node
/**
 * משווה את supabase/baseline/0001_baseline.sql לסכימה החיה בפרודקשן.
 * קריאה בלבד. הרצה: npm run db:check-drift
 *
 * למה: ה-baseline הוא צילום של רגע אחד. ברגע שמישהו מריץ SQL ידנית
 * בדשבורד - וזה בדיוק מה שקרה כאן במשך שנה - הריפו והפרודקשן נפרדים
 * בלי ששום דבר מתריע. זה הכלי שמתריע.
 *
 * דורש Docker (ה-CLI מריץ pg_dump בקונטיינר). לא רץ ב-CI, ובכוונה:
 * ל-GitHub Actions אין גישה לפרודקשן.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const baselinePath = path.join(process.cwd(), 'supabase', 'baseline', '0001_baseline.sql');
if (!fs.existsSync(baselinePath)) {
  console.error('לא נמצא supabase/baseline/0001_baseline.sql');
  process.exit(2);
}

const tmp = path.join(os.tmpdir(), `miklaton-live-schema-${process.pid}.sql`);

try {
  console.log('שולף את הסכימה החיה מהפרודקשן...');
  execFileSync('supabase', ['db', 'dump', '--linked', '-f', tmp], { stdio: 'pipe' });
} catch (error) {
  console.error('שליפת הסכימה נכשלה. ודא ש-Docker רץ (colima start) ושה-CLI מחובר.');
  console.error(String(error.stderr || error.message).split('\n').slice(-3).join('\n'));
  process.exit(2);
}

const normalise = (sql) =>
  sql
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l && !l.startsWith('--'))
    .join('\n');

const baseline = normalise(fs.readFileSync(baselinePath, 'utf8'));
const live = normalise(fs.readFileSync(tmp, 'utf8'));
fs.unlinkSync(tmp);

if (baseline === live) {
  console.log('✅ ה-baseline תואם בדיוק לסכימה החיה.');
  process.exit(0);
}

// מציג את ההפרש ברמת השורה, בלי להיות תלוי בכלי diff חיצוני
const baseLines = new Set(baseline.split('\n'));
const liveLines = new Set(live.split('\n'));
const onlyLive = [...liveLines].filter((l) => !baseLines.has(l));
const onlyBaseline = [...baseLines].filter((l) => !liveLines.has(l));

console.error('\n❌ יש דריפט בין ה-baseline לפרודקשן.\n');
if (onlyLive.length) {
  console.error(`בפרודקשן ואין ב-baseline (${onlyLive.length} שורות):`);
  for (const l of onlyLive.slice(0, 40)) console.error('  + ' + l);
  if (onlyLive.length > 40) console.error(`  ... ועוד ${onlyLive.length - 40}`);
}
if (onlyBaseline.length) {
  console.error(`\nב-baseline ואין בפרודקשן (${onlyBaseline.length} שורות):`);
  for (const l of onlyBaseline.slice(0, 40)) console.error('  - ' + l);
  if (onlyBaseline.length > 40) console.error(`  ... ועוד ${onlyBaseline.length - 40}`);
}
console.error('\nאם השינוי מכוון: הוסף מיגרציה (supabase migration new) ורענן את ה-baseline.');
process.exit(1);
