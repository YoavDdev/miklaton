-- Security Daily Orders - פקודת יום
CREATE TABLE IF NOT EXISTS security_daily_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  order_date DATE NOT NULL,
  general_notes TEXT, -- הערות כלליות לכל העובדים
  signoff_message TEXT DEFAULT 'יום טוב לכולם, סעו בזהירות, שמרו על עצמכם',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(department_id, order_date)
);

-- Daily Order Entries - שיבוצים יומיים עם משימות
CREATE TABLE IF NOT EXISTS security_daily_order_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES security_daily_orders(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES security_staff(id) ON DELETE SET NULL,
  staff_name TEXT, -- שם ידני (למקרה של עובד שלא ברשימה)
  category TEXT NOT NULL DEFAULT 'פיקוח', -- פיקוח / שיטור
  role_title TEXT DEFAULT 'פיקוח עירוני', -- פיקוח עירוני / שיטור עירוני
  vehicle TEXT, -- קשקאי / חלופי / אופנוע / ניסאן שיטור
  start_time TEXT NOT NULL, -- "06:30"
  end_time TEXT NOT NULL, -- "15:00"
  is_backup BOOLEAN DEFAULT false,
  tasks JSONB DEFAULT '[]', -- ["טיפול בפניות 106", "סיורי נוכחות בולטות", ...]
  special_notes TEXT, -- הערה מיוחדת לעובד (חפיפה, הצטרפות לפעילות...)
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_orders_dept_date ON security_daily_orders(department_id, order_date);
CREATE INDEX IF NOT EXISTS idx_daily_order_entries_order ON security_daily_order_entries(order_id);

-- RLS
ALTER TABLE security_daily_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_daily_order_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON security_daily_orders FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON security_daily_order_entries FOR ALL USING (true);
