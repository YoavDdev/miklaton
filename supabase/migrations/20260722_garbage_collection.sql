-- Garbage/Brush Collection Schedule for Yehud-Monosson
CREATE TABLE IF NOT EXISTS garbage_collection_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  street_name TEXT NOT NULL,
  collection_day TEXT NOT NULL, -- 'sunday','monday','tuesday','wednesday','thursday','friday'
  collection_day_hebrew TEXT NOT NULL, -- 'ראשון','שני','שלישי' etc.
  takeout_day_hebrew TEXT, -- יום ההוצאה (יום לפני הפינוי)
  collection_time TEXT DEFAULT '06:00-14:00',
  collection_type TEXT DEFAULT 'גזם',
  zone TEXT DEFAULT 'יהוד', -- יהוד / מונוסון
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_garbage_street ON garbage_collection_schedule(street_name);
CREATE INDEX IF NOT EXISTS idx_garbage_day ON garbage_collection_schedule(collection_day);
CREATE INDEX IF NOT EXISTS idx_garbage_zone ON garbage_collection_schedule(zone);
CREATE INDEX IF NOT EXISTS idx_garbage_active ON garbage_collection_schedule(is_active);

-- RLS
ALTER TABLE garbage_collection_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read garbage_collection_schedule" ON garbage_collection_schedule FOR SELECT USING (true);
CREATE POLICY "Allow insert garbage_collection_schedule" ON garbage_collection_schedule FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update garbage_collection_schedule" ON garbage_collection_schedule FOR UPDATE USING (true);
CREATE POLICY "Allow delete garbage_collection_schedule" ON garbage_collection_schedule FOR DELETE USING (true);

-- =====================================================
-- Yehud streets - Monday (ב) collection
-- Takeout day: Sunday (ראשון)
-- =====================================================
INSERT INTO garbage_collection_schedule (street_name, collection_day, collection_day_hebrew, takeout_day_hebrew, zone) VALUES
('אנילביץ''', 'monday', 'שני', 'ראשון', 'יהוד'),
('אשכול', 'monday', 'שני', 'ראשון', 'יהוד'),
('ביאליק', 'monday', 'שני', 'ראשון', 'יהוד'),
('בילו', 'monday', 'שני', 'ראשון', 'יהוד'),
('ברנר', 'monday', 'שני', 'ראשון', 'יהוד'),
('ברסימנטוב', 'monday', 'שני', 'ראשון', 'יהוד'),
('גורדון', 'monday', 'שני', 'ראשון', 'יהוד'),
('הגדוד העברי', 'monday', 'שני', 'ראשון', 'יהוד'),
('הורדים', 'monday', 'שני', 'ראשון', 'יהוד'),
('המייסדים', 'monday', 'שני', 'ראשון', 'יהוד'),
('הנרקיס', 'monday', 'שני', 'ראשון', 'יהוד'),
('הקונגרס הציוני', 'monday', 'שני', 'ראשון', 'יהוד'),
('הרצל', 'monday', 'שני', 'ראשון', 'יהוד'),
('ויינהויז', 'monday', 'שני', 'ראשון', 'יהוד'),
('ז''בוטינסקי', 'monday', 'שני', 'ראשון', 'יהוד'),
('טרומפלדור', 'monday', 'שני', 'ראשון', 'יהוד'),
('יונה', 'monday', 'שני', 'ראשון', 'יהוד'),
('יצחק שדה', 'monday', 'שני', 'ראשון', 'יהוד'),
('מוצקין', 'monday', 'שני', 'ראשון', 'יהוד'),
('מקלב', 'monday', 'שני', 'ראשון', 'יהוד'),
('נילי', 'monday', 'שני', 'ראשון', 'יהוד'),
('סינווני חיים', 'monday', 'שני', 'ראשון', 'יהוד'),
('עץ האפרסק', 'monday', 'שני', 'ראשון', 'יהוד'),
('צה"ל', 'monday', 'שני', 'ראשון', 'יהוד'),
('קפלן', 'monday', 'שני', 'ראשון', 'יהוד'),
('רמב"ם', 'monday', 'שני', 'ראשון', 'יהוד'),
('רמז', 'monday', 'שני', 'ראשון', 'יהוד'),
('שבטי ישראל', 'monday', 'שני', 'ראשון', 'יהוד'),
('שזר', 'monday', 'שני', 'ראשון', 'יהוד'),
('שפירא', 'monday', 'שני', 'ראשון', 'יהוד');

-- =====================================================
-- Yehud streets - Tuesday (ג) collection
-- Takeout day: Monday (שני)
-- =====================================================
INSERT INTO garbage_collection_schedule (street_name, collection_day, collection_day_hebrew, takeout_day_hebrew, zone) VALUES
('אבן גבירול', 'tuesday', 'שלישי', 'שני', 'יהוד'),
('אברבנאל', 'tuesday', 'שלישי', 'שני', 'יהוד'),
('ארלוזורוב', 'tuesday', 'שלישי', 'שני', 'יהוד'),
('אשכנזי', 'tuesday', 'שלישי', 'שני', 'יהוד'),
('ביקובסקי', 'tuesday', 'שלישי', 'שני', 'יהוד'),
('המעפילים', 'tuesday', 'שלישי', 'שני', 'יהוד'),
('הרואה', 'tuesday', 'שלישי', 'שני', 'יהוד'),
('ויצמן', 'tuesday', 'שלישי', 'שני', 'יהוד'),
('חנה סנש', 'tuesday', 'שלישי', 'שני', 'יהוד'),
('טורצ''ין ניסן', 'tuesday', 'שלישי', 'שני', 'יהוד'),
('יהודה הלוי', 'tuesday', 'שלישי', 'שני', 'יהוד'),
('יוספטל גיורא', 'tuesday', 'שלישי', 'שני', 'יהוד'),
('מרבד הקסמים', 'tuesday', 'שלישי', 'שני', 'יהוד'),
('מרכוס', 'tuesday', 'שלישי', 'שני', 'יהוד'),
('סעדיה חתוכה', 'tuesday', 'שלישי', 'שני', 'יהוד'),
('צבי ישי', 'tuesday', 'שלישי', 'שני', 'יהוד'),
('קדושי מצרים', 'tuesday', 'שלישי', 'שני', 'יהוד');

-- =====================================================
-- Yehud streets - Wednesday (ד) collection
-- Takeout day: Tuesday (שלישי)
-- =====================================================
INSERT INTO garbage_collection_schedule (street_name, collection_day, collection_day_hebrew, takeout_day_hebrew, zone) VALUES
('אלי כהן', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('אלפרט', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('בכור שיטרית', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('בן גוריון', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('בן צבי', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('גולדה מאיר', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('דוד אלעזר', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('האצ"ל', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('הגפן', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('ההגנה', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('השלום', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('הרימון', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('השלושה', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('חזנוביץ''', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('טננבאום', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('כצנלסון', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('לוחמי הגטאות', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('מוהליבר', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('מלמד', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('משה חסיד', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('נורדאו', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('נתניהו', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('סוקניק', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('סירקין', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('צוקרמן', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('קפלנסקי', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('שיבת ציון', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('שצ''יופק מרים', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('ששת הימים', 'wednesday', 'רביעי', 'שלישי', 'יהוד'),
('תאנה', 'wednesday', 'רביעי', 'שלישי', 'יהוד');

-- =====================================================
-- Yehud streets - Thursday (ה) collection
-- Takeout day: Wednesday (רביעי)
-- =====================================================
INSERT INTO garbage_collection_schedule (street_name, collection_day, collection_day_hebrew, takeout_day_hebrew, zone) VALUES
('אגוז', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('אלטלף אברהם', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('ארבעת המינים', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('גרון אברהם', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('דרך החורש', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('החרוב', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('החרושת', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('המלאכה', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('העצמאות', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('הרצוג', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('התמר', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('ורבנה', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('מבוא אלה', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('מבוא אתרוג', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('מבוא ברוניקה', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('מבוא ברוש', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('מבוא גומא', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('מבוא דולב', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('מבוא דליה', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('מבוא האירוס', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('מבוא הדגנים', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('מבוא הדס', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('מבוא הזית', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('מבוא הרדוף', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('מבוא זהבית', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('מבוא חבצלת', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('מבוא חיטה', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('מבוא טופח', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('מבוא יסמין', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('מבוא לולב', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('מבוא ערבה', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('מבוא שיבולת', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('מבוא שיפון', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('מבוא שעורה', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('מנחם בגין', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('משה דיין', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('פרחי הבר', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('שבזי', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('תאשור', 'thursday', 'חמישי', 'רביעי', 'יהוד'),
('תדהר', 'thursday', 'חמישי', 'רביעי', 'יהוד');

-- =====================================================
-- Monosson - Every Sunday (collection) / Friday (takeout)
-- and every Friday (collection) / Thursday (takeout)
-- =====================================================
INSERT INTO garbage_collection_schedule (street_name, collection_day, collection_day_hebrew, takeout_day_hebrew, zone, notes) VALUES
('כל מונוסון', 'sunday', 'ראשון', 'שישי', 'מונוסון', 'כל הרחובות במונוסון - פינוי ביום ראשון, הוצאה ביום שישי'),
('כל מונוסון', 'friday', 'שישי', 'חמישי', 'מונוסון', 'כל הרחובות במונוסון - פינוי ביום שישי, הוצאה ביום חמישי');

-- Contact info for garbage dept
INSERT INTO garbage_collection_schedule (street_name, collection_day, collection_day_hebrew, takeout_day_hebrew, zone, notes) VALUES
('אנשי קשר תברואה', 'sunday', 'ראשון', '', 'יהוד', 'שמשון: 050-6917771, יוסי מססה: 050-8440888');
