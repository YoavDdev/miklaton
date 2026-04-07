-- Add image_url column to event_journal for photo attachments
ALTER TABLE event_journal ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create storage bucket for event images
INSERT INTO storage.buckets (id, name, public) VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to event images
CREATE POLICY "Public read event images" ON storage.objects
  FOR SELECT USING (bucket_id = 'event-images');

-- Allow anyone to upload event images  
CREATE POLICY "Allow upload event images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'event-images');
