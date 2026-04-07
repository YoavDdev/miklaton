-- ===================================================
-- יומן אירועי חירום - Emergency Events Journal
-- ===================================================

-- 1. טבלת אירועים
CREATE TABLE IF NOT EXISTS emergency_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  invite_token VARCHAR(20) NOT NULL UNIQUE,
  created_by UUID REFERENCES user_profiles(id),
  created_by_name VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  closed_by UUID REFERENCES user_profiles(id),
  closed_by_name VARCHAR(100)
);

CREATE INDEX idx_emergency_events_status ON emergency_events(status);
CREATE INDEX idx_emergency_events_invite_token ON emergency_events(invite_token);
CREATE INDEX idx_emergency_events_created_at ON emergency_events(created_at DESC);

ALTER TABLE emergency_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on emergency_events" ON emergency_events FOR ALL USING (true) WITH CHECK (true);

-- 2. טבלת משתתפים
CREATE TABLE IF NOT EXISTS event_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES emergency_events(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id),
  user_id UUID REFERENCES user_profiles(id),
  guest_name VARCHAR(100),
  guest_phone VARCHAR(20),
  display_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(100),
  department VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'declined')),
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_event_participants_event ON event_participants(event_id);
CREATE INDEX idx_event_participants_phone ON event_participants(phone);
CREATE UNIQUE INDEX idx_event_participants_unique_phone ON event_participants(event_id, phone);

ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on event_participants" ON event_participants FOR ALL USING (true) WITH CHECK (true);

-- 3. טבלת יומן אירוע
CREATE TABLE IF NOT EXISTS event_journal (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES emergency_events(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES event_participants(id),
  author_name VARCHAR(100) NOT NULL,
  author_role VARCHAR(100),
  entry_type VARCHAR(20) NOT NULL DEFAULT 'update' CHECK (entry_type IN ('update', 'urgent', 'decision', 'task', 'system')),
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_event_journal_event ON event_journal(event_id);
CREATE INDEX idx_event_journal_created_at ON event_journal(event_id, created_at DESC);

ALTER TABLE event_journal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on event_journal" ON event_journal FOR ALL USING (true) WITH CHECK (true);

-- 4. Enable realtime for journal and participants
ALTER PUBLICATION supabase_realtime ADD TABLE event_journal;
ALTER PUBLICATION supabase_realtime ADD TABLE event_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE emergency_events;
