-- ===================================================
-- שדרוג יומן אירועים v2 - Emergency Journal Upgrade
-- ===================================================

-- 1. הוספת שדות ליומן: הצמדה, משימות, מיקום
ALTER TABLE event_journal ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE event_journal ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE event_journal ADD COLUMN IF NOT EXISTS task_status VARCHAR(20) DEFAULT NULL CHECK (task_status IS NULL OR task_status IN ('pending', 'in_progress', 'done'));
ALTER TABLE event_journal ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION;
ALTER TABLE event_journal ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION;
ALTER TABLE event_journal ADD COLUMN IF NOT EXISTS location_address TEXT;

-- 2. הוספת סוג אירוע ולוח מצב
ALTER TABLE emergency_events ADD COLUMN IF NOT EXISTS event_type VARCHAR(50) DEFAULT 'general';
ALTER TABLE emergency_events ADD COLUMN IF NOT EXISTS dashboard_data JSONB DEFAULT '{}';
ALTER TABLE emergency_events ADD COLUMN IF NOT EXISTS summary TEXT;

-- 3. עדכון entry_types לתמוך בסוגים חדשים
ALTER TABLE event_journal DROP CONSTRAINT IF EXISTS event_journal_entry_type_check;
ALTER TABLE event_journal ADD CONSTRAINT event_journal_entry_type_check 
  CHECK (entry_type IN ('update', 'urgent', 'decision', 'task', 'system', 'location', 'quick'));
