-- Add shabbat_observer flag to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS shabbat_observer BOOLEAN DEFAULT false;

-- Index for faster filtering
CREATE INDEX IF NOT EXISTS idx_contacts_shabbat_observer ON contacts(shabbat_observer);

COMMENT ON COLUMN contacts.shabbat_observer IS 'If true, contact is not available during Shabbat: 2 hours before candle lighting until 2 hours after havdalah';
