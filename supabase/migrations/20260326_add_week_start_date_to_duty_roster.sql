-- Add week_start_date column to duty_roster table for weekly planning
-- First add with nullable so we can update existing records
ALTER TABLE duty_roster 
ADD COLUMN IF NOT EXISTS week_start_date DATE;

-- Update ALL existing records to have the current week's start date (Sunday)
-- EXTRACT(DOW) returns 0 for Sunday, 1 for Monday, etc.
UPDATE duty_roster 
SET week_start_date = CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER
WHERE week_start_date IS NULL;

-- Now make it NOT NULL with default for future inserts
ALTER TABLE duty_roster 
ALTER COLUMN week_start_date SET NOT NULL,
ALTER COLUMN week_start_date SET DEFAULT (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER);

-- Create index for efficient querying by week
CREATE INDEX IF NOT EXISTS idx_duty_roster_week ON duty_roster(week_start_date, department_id);
