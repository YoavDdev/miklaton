-- Knowledge Base for Call Center (Wikipedia-style AI chat)
-- Stores articles/entries that are used as context for AI-powered answers

CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'כללי',
  tags TEXT[] DEFAULT '{}',
  contacts JSONB DEFAULT '[]', -- [{name, phone, role}]
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Index for full text search in Hebrew
CREATE INDEX IF NOT EXISTS idx_knowledge_base_search 
  ON knowledge_base USING gin(to_tsvector('simple', title || ' ' || content));

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category);

-- Index for active entries
CREATE INDEX IF NOT EXISTS idx_knowledge_base_active ON knowledge_base(is_active);

-- Chat history for operators
CREATE TABLE IF NOT EXISTS knowledge_chat_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name TEXT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sources UUID[] DEFAULT '{}', -- references to knowledge_base entries used
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Keep chat history for 30 days only (cleanup can be done via cron)
CREATE INDEX IF NOT EXISTS idx_chat_history_date ON knowledge_chat_history(created_at);

-- Enable RLS
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_chat_history ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated access (our app handles auth via JWT)
CREATE POLICY "Allow all access to knowledge_base" ON knowledge_base FOR ALL USING (true);
CREATE POLICY "Allow all access to knowledge_chat_history" ON knowledge_chat_history FOR ALL USING (true);
