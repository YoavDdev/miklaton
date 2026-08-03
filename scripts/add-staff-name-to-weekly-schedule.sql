-- Add staff_name column to security_weekly_schedule to support manual entries (trainees, temporary workers)
-- This allows importing shifts for people not in the official staff list

ALTER TABLE security_weekly_schedule 
ADD COLUMN IF NOT EXISTS staff_name TEXT;

COMMENT ON COLUMN security_weekly_schedule.staff_name IS 'שם ידני לעובד שאינו ברשימה הרשמית (מתלמד, זמני וכו׳)';
