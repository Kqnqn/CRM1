-- Add tags column to leads and accounts
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Create indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_leads_tags ON leads USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_accounts_tags ON accounts USING GIN (tags);
