-- Garbage/Brush Collection Schedule
CREATE TABLE IF NOT EXISTS garbage_collection_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  street_name TEXT NOT NULL,
  street_name_alt TEXT, -- alternative name or transliteration
  collection_day TEXT NOT NULL, -- 'sunday','monday','tuesday','wednesday','thursday','friday'
  collection_day_hebrew TEXT NOT NULL, -- 'ראשון','שני','שלישי' etc.
  collection_time TEXT DEFAULT '06:00-14:00',
  collection_type TEXT DEFAULT 'גזם', -- גזם, אשפה כללית, מיחזור, פסולת גושית
  zone TEXT, -- area/zone in the city
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_garbage_street ON garbage_collection_schedule(street_name);
CREATE INDEX IF NOT EXISTS idx_garbage_day ON garbage_collection_schedule(collection_day);
CREATE INDEX IF NOT EXISTS idx_garbage_type ON garbage_collection_schedule(collection_type);
CREATE INDEX IF NOT EXISTS idx_garbage_active ON garbage_collection_schedule(is_active);

-- RLS
ALTER TABLE garbage_collection_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read garbage_collection_schedule" ON garbage_collection_schedule FOR SELECT USING (true);
CREATE POLICY "Allow insert garbage_collection_schedule" ON garbage_collection_schedule FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update garbage_collection_schedule" ON garbage_collection_schedule FOR UPDATE USING (true);
CREATE POLICY "Allow delete garbage_collection_schedule" ON garbage_collection_schedule FOR DELETE USING (true);
