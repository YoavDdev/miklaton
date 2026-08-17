#!/usr/bin/env node
/**
 * בודק שמצב ה-RLS בפרודקשן תואם את המדיניות המוצהרת ב-20260813_rls_anon_lockdown.sql.
 * קריאה בלבד - לא כותב שום דבר ל-DB.
 *
 * הרצה: npm run db:rls-check
 *
 * למה זה קיים: המדיניות היא תלת-שכבתית ומכוונת (חלק מהטבלאות פתוחות לקריאה
 * לאנונימי בכוונה, כי הדפדפן קורא אותן ישירות ו-realtime מכבד RLS). בלי בדיקה
 * שמצהירה על הכוונה, אי אפשר להבדיל בין "פתוח בכוונה" לבין רגרסיה.
 *
 * לא רץ ב-CI: ל-GitHub Actions אין - ובכוונה לא צריכה להיות - גישה לפרודקשן.
 */
const fs = require('fs');
const path = require('path');

// ── המדיניות המוצהרת ──────────────────────────────────────────────

// פתוחות לקריאה לאנונימי בכוונה. אלה בדיוק ארבע הטבלאות שנמצאות בפרסום
// supabase_realtime, ולכן היחידות שמנוי מהדפדפן באמת מקבל עליהן עדכונים.
// חמש טבלאות נוספות היו פתוחות עד YOA-18 בלי שאיש השתמש בהן (המנויים עליהן
// לא נורו מעולם) - הרשאתן בוטלה ב-20260817231500_revoke_unused_anon_grants.
const ANON_READABLE = ['contacts', 'departments', 'duty_roster', 'war_mode'];

// user_profiles: הרשאות ברמת עמודה - רק אלה חשופות לאנונימי.
const ANON_COLUMNS = { user_profiles: ['id', 'full_name', 'role', 'status'] };

// כל השאר חייבות להיות חסומות. טבלאות האירועים כאן במפורש: הן היו פתוחות
// לחלוטין עד ריפקטור YOA-5, ולכן חשוב שהבדיקה תשמור עליהן סגורות.
const MUST_BE_LOCKED_HIGHLIGHT = ['emergency_events', 'event_journal', 'event_participants'];

// ── ריצה ──────────────────────────────────────────────────────────

function loadEnv() {
  const env = {};
  const file = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(file)) {
    console.error('חסר .env.local - הבדיקה דורשת גישת קריאה לפרודקשן');
    process.exit(2);
  }
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

async function count(url, key, query) {
  const res = await fetch(`${url}/rest/v1/${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact', Range: '0-0' },
  });
  const total = (res.headers.get('content-range') || '').split('/')[1];
  return { status: res.status, rows: total === '*' || total === undefined ? null : Number(total) };
}

(async () => {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;

  const spec = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: service, Authorization: `Bearer ${service}` },
  }).then((r) => r.json());
  const tables = Object.keys(spec.definitions || {}).sort();

  const drift = [];
  const expectedOpen = new Set(ANON_READABLE);

  for (const table of tables) {
    if (ANON_COLUMNS[table]) continue; // נבדק בנפרד למטה

    const asAnon = await count(url, anon, `${table}?select=*`);
    const asService = await count(url, service, `${table}?select=*`);
    const anonSees = asAnon.status < 400 && asAnon.rows > 0;

    if (expectedOpen.has(table)) {
      // אמורה להיות פתוחה. אם יש בה נתונים ואנונימי לא רואה אותם - משהו השתנה.
      if (!anonSees && asService.rows > 0) {
        drift.push(`${table}: אמורה להיות קריאה לאנונימי אבל נחסמה (service רואה ${asService.rows})`);
      }
    } else if (anonSees) {
      drift.push(
        `⚠️  ${table}: חשופה לאנונימי ואינה ברשימה המוצהרת (${asAnon.rows} שורות)`
      );
    }
  }

  // user_profiles: רק העמודות המוצהרות, ולא יותר.
  for (const [table, allowed] of Object.entries(ANON_COLUMNS)) {
    const all = await count(url, anon, `${table}?select=*`);
    if (all.status < 400) {
      drift.push(`⚠️  ${table}: select=* פתוח לאנונימי - הרשאות העמודות נפרצו`);
    }
    const scoped = await count(url, anon, `${table}?select=${allowed.join(',')}`);
    if (scoped.status >= 400) {
      drift.push(`${table}: העמודות המוצהרות (${allowed.join(', ')}) נחסמו לאנונימי`);
    }
    const columns = (spec.definitions[table]?.properties) || {};
    for (const col of Object.keys(columns)) {
      if (allowed.includes(col)) continue;
      const one = await count(url, anon, `${table}?select=${col}`);
      if (one.status < 400) {
        drift.push(`⚠️  ${table}.${col}: חשופה לאנונימי ואינה ברשימה המותרת`);
      }
    }
  }

  console.log(`נבדקו ${tables.length} טבלאות בפרודקשן.`);
  console.log(`פתוחות לקריאה בכוונה: ${ANON_READABLE.length}`);
  console.log(`נעולות (כולל ${MUST_BE_LOCKED_HIGHLIGHT.join(', ')}): ${tables.length - ANON_READABLE.length - 1}`);

  if (drift.length) {
    console.error(`\n❌ ${drift.length} חריגות מהמדיניות המוצהרת:\n`);
    for (const d of drift) console.error('  ' + d);
    process.exit(1);
  }
  console.log('\n✅ מצב ה-RLS תואם את המדיניות המוצהרת.');
})().catch((e) => {
  console.error('הבדיקה נכשלה:', e.message);
  process.exit(2);
});
