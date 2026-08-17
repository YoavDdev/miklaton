-- Add date range columns to general_notifications table
-- This allows messages to appear only between a start and end date

ALTER TABLE public.general_notifications 
ADD COLUMN IF NOT EXISTS start_date timestamptz,
ADD COLUMN IF NOT EXISTS end_date timestamptz,
ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_general_notifications_start_date 
ON public.general_notifications (start_date);

CREATE INDEX IF NOT EXISTS idx_general_notifications_end_date 
ON public.general_notifications (end_date);

CREATE INDEX IF NOT EXISTS idx_general_notifications_expires_at 
ON public.general_notifications (expires_at);
