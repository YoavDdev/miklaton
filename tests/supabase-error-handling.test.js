import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

/**
 * YOA-34: supabase-js מחזיר { error } במקום לזרוק, ולכן `await supabase...`
 * שזורק את התוצאה לפח הוא כתיבה שנכשלת בשקט - המשתמש רואה "הצלחה" על פעולה
 * שלא קרתה. הדפוס הזה פגע פעמיים בפרודקשן (YOA-17, ה-audit של מצב חירום).
 *
 * הבדיקה סורקת כל ראוט ונכשלת על שורה שמתחילה ב-`await supabase` - כלומר
 * קריאה שהתוצאה שלה לא נקלטת. הכלל: כל קריאה קולטת לפחות את ה-error,
 * ומחליטה במפורש - לזרוק (כשל שמפיל את הבקשה) או console.error (best-effort).
 */
const API_DIR = path.join(process.cwd(), 'app', 'api');

function collectRouteFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectRouteFiles(full));
    else if (entry.name === 'route.js') files.push(full);
  }
  return files;
}

describe('כל קריאת supabase קולטת את התוצאה שלה', () => {
  const routeFiles = collectRouteFiles(API_DIR);

  it('נמצאו ראוטים לסריקה', () => {
    expect(routeFiles.length).toBeGreaterThan(30);
  });

  it.each(routeFiles.map((f) => [path.relative(API_DIR, f), f]))(
    '%s',
    (_rel, file) => {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      const discarded = [];
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('await supabase')) {
          discarded.push(`שורה ${i + 1}: ${trimmed.slice(0, 80)}`);
        }
      });
      expect(discarded, 'קריאות supabase שהתוצאה שלהן נזרקת').toEqual([]);
    }
  );
});
