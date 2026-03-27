-- טבלת משימות למוקדנים
CREATE TABLE IF NOT EXISTS operator_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  priority TEXT CHECK (priority IN ('דחוף', 'גבוה', 'בינוני', 'נמוך')) DEFAULT 'בינוני',
  status TEXT CHECK (status IN ('ממתין', 'בטיפול', 'הושלם', 'בוטל')) DEFAULT 'ממתין',
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- אינדקסים למשימות
CREATE INDEX IF NOT EXISTS idx_operator_tasks_assigned_to ON operator_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_operator_tasks_status ON operator_tasks(status);
CREATE INDEX IF NOT EXISTS idx_operator_tasks_created_at ON operator_tasks(created_at DESC);

-- טבלת סשנים של מוקדנים (מי מחובר)
CREATE TABLE IF NOT EXISTS operator_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_start TIMESTAMPTZ DEFAULT now(),
  session_end TIMESTAMPTZ,
  last_activity TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- אינדקסים לסשנים
CREATE INDEX IF NOT EXISTS idx_operator_sessions_user_id ON operator_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_operator_sessions_is_active ON operator_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_operator_sessions_last_activity ON operator_sessions(last_activity DESC);

-- טבלת משמרות כוננים מכלול
CREATE TABLE IF NOT EXISTS on_call_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  shift_type TEXT CHECK (shift_type IN ('יום', 'לילה', '24 שעות')) DEFAULT 'יום',
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- אינדקסים למשמרות כוננים
CREATE INDEX IF NOT EXISTS idx_on_call_shifts_user_id ON on_call_shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_on_call_shifts_date ON on_call_shifts(shift_date);

-- טבלת הודעות למוקדנים
CREATE TABLE IF NOT EXISTS operator_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message_text TEXT NOT NULL,
  target_role TEXT, -- אם null = לכולם
  is_urgent BOOLEAN DEFAULT false,
  read_by UUID[], -- מערך של user_id שכבר קראו
  created_at TIMESTAMPTZ DEFAULT now()
);

-- אינדקס להודעות
CREATE INDEX IF NOT EXISTS idx_operator_messages_created_at ON operator_messages(created_at DESC);

-- פונקציה לעדכון updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- טריגרים לעדכון updated_at
DROP TRIGGER IF EXISTS update_operator_tasks_updated_at ON operator_tasks;
CREATE TRIGGER update_operator_tasks_updated_at
  BEFORE UPDATE ON operator_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_on_call_shifts_updated_at ON on_call_shifts;
CREATE TRIGGER update_on_call_shifts_updated_at
  BEFORE UPDATE ON on_call_shifts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE operator_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE on_call_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_messages ENABLE ROW LEVEL SECURITY;

-- משימות: מנהלת מוקד יכולה לראות ולערוך הכל, מוקדן רואה רק את שלו
DROP POLICY IF EXISTS "מנהלת מוקד רואה כל המשימות" ON operator_tasks;
CREATE POLICY "מנהלת מוקד רואה כל המשימות"
  ON operator_tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('call_center_manager', 'admin')
    )
  );

DROP POLICY IF EXISTS "מוקדן רואה משימות שהוקצו לו" ON operator_tasks;
CREATE POLICY "מוקדן רואה משימות שהוקצו לו"
  ON operator_tasks FOR SELECT
  USING (
    assigned_to = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'operator'
    )
  );

DROP POLICY IF EXISTS "מוקדן יכול לעדכן משימות שלו" ON operator_tasks;
CREATE POLICY "מוקדן יכול לעדכן משימות שלו"
  ON operator_tasks FOR UPDATE
  USING (
    assigned_to = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'operator'
    )
  );

-- סשנים: כולם יכולים לראות, רק המשתמש עצמו יכול ליצור ולעדכן
DROP POLICY IF EXISTS "כולם רואים סשנים" ON operator_sessions;
CREATE POLICY "כולם רואים סשנים"
  ON operator_sessions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "משתמש יכול ליצור סשן משלו" ON operator_sessions;
CREATE POLICY "משתמש יכול ליצור סשן משלו"
  ON operator_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "משתמש יכול לעדכן סשן משלו" ON operator_sessions;
CREATE POLICY "משתמש יכול לעדכן סשן משלו"
  ON operator_sessions FOR UPDATE
  USING (user_id = auth.uid());

-- משמרות כוננים: מנהלת מוקד ואדמין יכולים להוסיף ולערוך, כולם יכולים לראות
DROP POLICY IF EXISTS "כולם רואים משמרות כוננים" ON on_call_shifts;
CREATE POLICY "כולם רואים משמרות כוננים"
  ON on_call_shifts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "מנהלת מוקד ואדמין יכולים לנהל משמרות" ON on_call_shifts;
CREATE POLICY "מנהלת מוקד ואדמין יכולים לנהל משמרות"
  ON on_call_shifts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('call_center_manager', 'admin')
    )
  );

-- הודעות: מנהלת מוקד יכולה ליצור, כולם יכולים לראות
DROP POLICY IF EXISTS "כולם רואים הודעות" ON operator_messages;
CREATE POLICY "כולם רואים הודעות"
  ON operator_messages FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "מנהלת מוקד יכולה ליצור הודעות" ON operator_messages;
CREATE POLICY "מנהלת מוקד יכולה ליצור הודעות"
  ON operator_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('call_center_manager', 'admin')
    )
  );

COMMENT ON TABLE operator_tasks IS 'משימות למוקדנים - ניהול ע"י מנהלת מוקד';
COMMENT ON TABLE operator_sessions IS 'סשנים פעילים של מוקדנים - למעקב מי מחובר';
COMMENT ON TABLE on_call_shifts IS 'משמרות כוננים מכלול - ניהול משמרות';
COMMENT ON TABLE operator_messages IS 'הודעות למוקדנים מהמנהלת';
