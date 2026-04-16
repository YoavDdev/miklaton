-- הוספת שדות למיקומים וחסימות במפה לטבלת emergency_events

-- 1. הוספת שדה למיקומי אירוע (מערך של אובייקטים)
ALTER TABLE emergency_events 
ADD COLUMN IF NOT EXISTS event_locations JSONB DEFAULT '[]';

-- 2. הוספת שדה לחסימות כבישים (מערך של אובייקטים)
ALTER TABLE emergency_events 
ADD COLUMN IF NOT EXISTS road_blocks JSONB DEFAULT '[]';

-- 3. הוספת אינדקסים ל-JSONB לביצועים טובים יותר
CREATE INDEX IF NOT EXISTS idx_emergency_events_event_locations 
ON emergency_events USING GIN (event_locations);

CREATE INDEX IF NOT EXISTS idx_emergency_events_road_blocks 
ON emergency_events USING GIN (road_blocks);

-- הערה: 
-- event_locations מבנה: [{ id, lat, lng, address }, ...]
-- road_blocks מבנה: [{ id, points: [[lat, lng], ...], note }, ...]
