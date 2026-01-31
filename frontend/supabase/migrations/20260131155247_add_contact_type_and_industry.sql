-- Add contact_type and industry columns to contacts table

-- Add contact_type column
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS contact_type text;

-- Add industry column
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS industry text;

-- Add comment to describe the columns
COMMENT ON COLUMN contacts.contact_type IS 'Type of contact: LEGAL_ENTITY or INDIVIDUAL';
COMMENT ON COLUMN contacts.industry IS 'Industry type: HORECA, RETAIL, WHOLESALE, MANUFACTURING, or OTHER';
