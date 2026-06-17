-- Migration: Call Categories System
-- Description: System for managing call categories and their associated contacts
-- Date: 2026-05-11

-- ============================================
-- Table: call_categories
-- Purpose: Define categories of calls (emergency, water, electricity, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS call_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality_id UUID NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  instructions TEXT, -- Instructions for operator
  warning TEXT, -- Warning message (e.g., "No on-call between 00:00-07:00")
  auto_message TEXT, -- Auto message to send to caller
  additional_info TEXT, -- Additional information
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_call_categories_municipality ON call_categories(municipality_id);
CREATE INDEX IF NOT EXISTS idx_call_categories_active ON call_categories(active);
CREATE INDEX IF NOT EXISTS idx_call_categories_order ON call_categories(display_order);

-- ============================================
-- Table: call_category_contacts
-- Purpose: Link contacts to categories with escalation order
-- ============================================
CREATE TABLE IF NOT EXISTS call_category_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_category_id UUID NOT NULL REFERENCES call_categories(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES on_call_contacts(id) ON DELETE CASCADE, -- Can be null for external contacts
  
  -- Contact details (for external contacts not in on_call_contacts)
  external_name TEXT,
  external_phone TEXT,
  external_role TEXT,
  
  escalation_order INTEGER NOT NULL DEFAULT 1, -- 1 = first, 2 = second, etc.
  note TEXT, -- Specific note for this category (e.g., "weekends only", "no answer after 3 times")
  hours TEXT, -- Available hours (e.g., "07:00-15:00", "weekends")
  is_primary BOOLEAN DEFAULT false, -- Is this the primary contact?
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique order per category
  UNIQUE(call_category_id, escalation_order)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_call_category_contacts_category ON call_category_contacts(call_category_id);
CREATE INDEX IF NOT EXISTS idx_call_category_contacts_contact ON call_category_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_call_category_contacts_order ON call_category_contacts(escalation_order);

-- ============================================
-- Table: call_category_rules
-- Purpose: Rules and guidelines for each category
-- ============================================
CREATE TABLE IF NOT EXISTS call_category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_category_id UUID NOT NULL REFERENCES call_categories(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL, -- 'rule', 'question', 'special_case'
  rule_text TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_call_category_rules_category ON call_category_rules(call_category_id);
CREATE INDEX IF NOT EXISTS idx_call_category_rules_type ON call_category_rules(rule_type);

-- ============================================
-- Table: call_category_subcategories
-- Purpose: Subcategories within a category (e.g., "Irrigation leak" vs "Tree fell" in Gardening)
-- ============================================
CREATE TABLE IF NOT EXISTS call_category_subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_category_id UUID NOT NULL REFERENCES call_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_call_category_subcategories_category ON call_category_subcategories(call_category_id);

-- ============================================
-- Table: call_category_subcategory_contacts
-- Purpose: Link contacts to subcategories
-- ============================================
CREATE TABLE IF NOT EXISTS call_category_subcategory_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcategory_id UUID NOT NULL REFERENCES call_category_subcategories(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES on_call_contacts(id) ON DELETE CASCADE,
  
  -- Contact details (for external contacts)
  external_name TEXT,
  external_phone TEXT,
  external_role TEXT,
  
  escalation_order INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  hours TEXT,
  is_primary BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(subcategory_id, escalation_order)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_call_category_subcategory_contacts_sub ON call_category_subcategory_contacts(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_call_category_subcategory_contacts_contact ON call_category_subcategory_contacts(contact_id);

-- ============================================
-- RLS Policies
-- ============================================

-- call_categories
ALTER TABLE call_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_categories_select" ON call_categories;
CREATE POLICY "call_categories_select" ON call_categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "call_categories_insert" ON call_categories;
CREATE POLICY "call_categories_insert" ON call_categories
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "call_categories_update" ON call_categories;
CREATE POLICY "call_categories_update" ON call_categories
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "call_categories_delete" ON call_categories;
CREATE POLICY "call_categories_delete" ON call_categories
  FOR DELETE USING (true);

-- call_category_contacts
ALTER TABLE call_category_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_category_contacts_select" ON call_category_contacts;
CREATE POLICY "call_category_contacts_select" ON call_category_contacts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "call_category_contacts_insert" ON call_category_contacts;
CREATE POLICY "call_category_contacts_insert" ON call_category_contacts
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "call_category_contacts_update" ON call_category_contacts;
CREATE POLICY "call_category_contacts_update" ON call_category_contacts
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "call_category_contacts_delete" ON call_category_contacts;
CREATE POLICY "call_category_contacts_delete" ON call_category_contacts
  FOR DELETE USING (true);

-- call_category_rules
ALTER TABLE call_category_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_category_rules_select" ON call_category_rules;
CREATE POLICY "call_category_rules_select" ON call_category_rules
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "call_category_rules_insert" ON call_category_rules;
CREATE POLICY "call_category_rules_insert" ON call_category_rules
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "call_category_rules_update" ON call_category_rules;
CREATE POLICY "call_category_rules_update" ON call_category_rules
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "call_category_rules_delete" ON call_category_rules;
CREATE POLICY "call_category_rules_delete" ON call_category_rules
  FOR DELETE USING (true);

-- call_category_subcategories
ALTER TABLE call_category_subcategories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_category_subcategories_select" ON call_category_subcategories;
CREATE POLICY "call_category_subcategories_select" ON call_category_subcategories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "call_category_subcategories_insert" ON call_category_subcategories;
CREATE POLICY "call_category_subcategories_insert" ON call_category_subcategories
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "call_category_subcategories_update" ON call_category_subcategories;
CREATE POLICY "call_category_subcategories_update" ON call_category_subcategories
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "call_category_subcategories_delete" ON call_category_subcategories;
CREATE POLICY "call_category_subcategories_delete" ON call_category_subcategories
  FOR DELETE USING (true);

-- call_category_subcategory_contacts
ALTER TABLE call_category_subcategory_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_category_subcategory_contacts_select" ON call_category_subcategory_contacts;
CREATE POLICY "call_category_subcategory_contacts_select" ON call_category_subcategory_contacts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "call_category_subcategory_contacts_insert" ON call_category_subcategory_contacts;
CREATE POLICY "call_category_subcategory_contacts_insert" ON call_category_subcategory_contacts
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "call_category_subcategory_contacts_update" ON call_category_subcategory_contacts;
CREATE POLICY "call_category_subcategory_contacts_update" ON call_category_subcategory_contacts
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "call_category_subcategory_contacts_delete" ON call_category_subcategory_contacts;
CREATE POLICY "call_category_subcategory_contacts_delete" ON call_category_subcategory_contacts
  FOR DELETE USING (true);

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE call_categories IS 'Categories of calls that operators handle (emergency, water, electricity, etc.)';
COMMENT ON TABLE call_category_contacts IS 'Contacts associated with each category, with escalation order';
COMMENT ON TABLE call_category_rules IS 'Rules and guidelines for each category';
COMMENT ON TABLE call_category_subcategories IS 'Subcategories within a main category';
COMMENT ON TABLE call_category_subcategory_contacts IS 'Contacts for subcategories';
