/*
  # CRM Database Schema - Core Tables

  ## 1. New Tables
  
  ### profiles
  - `id` (uuid, references auth.users)
  - `email` (text)
  - `full_name` (text)
  - `role` (text) - ADMIN, MANAGER, SALES_REP, READ_ONLY
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### leads
  - `id` (uuid, primary key)
  - `company_name` (text, required)
  - `contact_person_name` (text, required)
  - `email` (text, required)
  - `phone` (text)
  - `source` (text)
  - `status` (text) - NEW, CONTACTED, QUALIFIED, CONVERTED, ARCHIVED
  - `owner_id` (uuid, references profiles)
  - `converted_account_id` (uuid, references accounts)
  - `converted_at` (timestamptz)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### accounts
  - `id` (uuid, primary key)
  - `name` (text, required)
  - `industry` (text)
  - `address` (text)
  - `city` (text)
  - `state` (text)
  - `postal_code` (text)
  - `country` (text)
  - `phone` (text)
  - `website` (text)
  - `stage` (text) - OPEN, CLOSED_WON, CLOSED_LOST
  - `closed_at` (timestamptz)
  - `lost_reason` (text)
  - `owner_id` (uuid, references profiles)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### contacts
  - `id` (uuid, primary key)
  - `account_id` (uuid, references accounts)
  - `first_name` (text, required)
  - `last_name` (text, required)
  - `email` (text)
  - `phone` (text)
  - `mobile` (text)
  - `title` (text)
  - `department` (text)
  - `owner_id` (uuid, references profiles)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### opportunities
  - `id` (uuid, primary key)
  - `account_id` (uuid, references accounts)
  - `contact_id` (uuid, references contacts, optional)
  - `name` (text, required)
  - `stage` (text) - PROSPECTING, QUALIFIED, PROPOSAL, NEGOTIATION, CLOSED_WON, CLOSED_LOST
  - `amount` (numeric)
  - `close_date` (date)
  - `probability` (integer, 0-100)
  - `description` (text)
  - `owner_id` (uuid, references profiles)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### activities
  - `id` (uuid, primary key)
  - `type` (text) - TASK, EVENT
  - `subject` (text, required)
  - `description` (text)
  - `status` (text) - NOT_STARTED, IN_PROGRESS, COMPLETED, CANCELLED
  - `priority` (text) - LOW, MEDIUM, HIGH
  - `due_date` (timestamptz)
  - `start_time` (timestamptz)
  - `end_time` (timestamptz)
  - `location` (text)
  - `related_to_type` (text) - LEAD, ACCOUNT, CONTACT, OPPORTUNITY
  - `related_to_id` (uuid)
  - `owner_id` (uuid, references profiles)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### documents
  - `id` (uuid, primary key)
  - `title` (text, required)
  - `file_name` (text, required)
  - `file_size` (bigint)
  - `mime_type` (text)
  - `storage_key` (text, required)
  - `uploaded_by` (uuid, references profiles)
  - `created_at` (timestamptz)

  ### document_links
  - `id` (uuid, primary key)
  - `document_id` (uuid, references documents)
  - `linked_to_type` (text) - LEAD, ACCOUNT, CONTACT, OPPORTUNITY
  - `linked_to_id` (uuid)
  - `linked_by` (uuid, references profiles)
  - `created_at` (timestamptz)

  ### notes
  - `id` (uuid, primary key)
  - `title` (text)
  - `content` (text)
  - `related_to_type` (text) - LEAD, ACCOUNT, CONTACT, OPPORTUNITY
  - `related_to_id` (uuid)
  - `created_by` (uuid, references profiles)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### audit_log
  - `id` (uuid, primary key)
  - `entity_type` (text)
  - `entity_id` (uuid)
  - `action` (text) - CREATE, UPDATE, DELETE, CONVERT, STAGE_CHANGE
  - `field_name` (text)
  - `old_value` (text)
  - `new_value` (text)
  - `user_id` (uuid, references profiles)
  - `created_at` (timestamptz)

  ## 2. Security
  - Enable RLS on all tables
  - Add policies based on user roles and ownership
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'SALES_REP',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_person_name text NOT NULL,
  email text NOT NULL,
  phone text,
  source text,
  status text NOT NULL DEFAULT 'NEW',
  owner_id uuid REFERENCES profiles(id) NOT NULL,
  converted_account_id uuid,
  converted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own leads or all if manager/admin"
  ON leads FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
  );

CREATE POLICY "Users can create leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER', 'SALES_REP')
    )
  );

CREATE POLICY "Users can update own leads or all if manager/admin"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
  );

CREATE POLICY "Admins can delete leads"
  ON leads FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );

-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry text,
  address text,
  city text,
  state text,
  postal_code text,
  country text,
  phone text,
  website text,
  stage text NOT NULL DEFAULT 'OPEN',
  closed_at timestamptz,
  lost_reason text,
  owner_id uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounts or all if manager/admin"
  ON accounts FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
  );

CREATE POLICY "Users can create accounts"
  ON accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER', 'SALES_REP')
    )
  );

CREATE POLICY "Users can update own accounts or all if manager/admin"
  ON accounts FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
  );

CREATE POLICY "Admins can delete accounts"
  ON accounts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );

-- Add foreign key for converted accounts in leads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'leads_converted_account_id_fkey'
  ) THEN
    ALTER TABLE leads ADD CONSTRAINT leads_converted_account_id_fkey
      FOREIGN KEY (converted_account_id) REFERENCES accounts(id);
  END IF;
END $$;

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  mobile text,
  title text,
  department text,
  owner_id uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contacts if they can view the account"
  ON contacts FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = contacts.account_id
      AND (
        accounts.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('ADMIN', 'MANAGER')
        )
      )
    )
  );

CREATE POLICY "Users can create contacts"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER', 'SALES_REP')
    )
  );

CREATE POLICY "Users can update contacts if they can update the account"
  ON contacts FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = contacts.account_id
      AND (
        accounts.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('ADMIN', 'MANAGER')
        )
      )
    )
  );

CREATE POLICY "Admins can delete contacts"
  ON contacts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );

-- Create opportunities table
CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE NOT NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  name text NOT NULL,
  stage text NOT NULL DEFAULT 'PROSPECTING',
  amount numeric DEFAULT 0,
  close_date date,
  probability integer DEFAULT 0,
  description text,
  owner_id uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view opportunities if they can view the account"
  ON opportunities FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = opportunities.account_id
      AND (
        accounts.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('ADMIN', 'MANAGER')
        )
      )
    )
  );

CREATE POLICY "Users can create opportunities"
  ON opportunities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER', 'SALES_REP')
    )
  );

CREATE POLICY "Users can update opportunities if they can update the account"
  ON opportunities FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = opportunities.account_id
      AND (
        accounts.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('ADMIN', 'MANAGER')
        )
      )
    )
  );

CREATE POLICY "Admins can delete opportunities"
  ON opportunities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );

-- Create activities table
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  subject text NOT NULL,
  description text,
  status text DEFAULT 'NOT_STARTED',
  priority text DEFAULT 'MEDIUM',
  due_date timestamptz,
  start_time timestamptz,
  end_time timestamptz,
  location text,
  related_to_type text,
  related_to_id uuid,
  owner_id uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activities or all if manager/admin"
  ON activities FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
  );

CREATE POLICY "Users can create activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER', 'SALES_REP')
    )
  );

CREATE POLICY "Users can update own activities or all if manager/admin"
  ON activities FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
  );

CREATE POLICY "Users can delete own activities or all if admin"
  ON activities FOR DELETE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  file_name text NOT NULL,
  file_size bigint DEFAULT 0,
  mime_type text,
  storage_key text NOT NULL,
  uploaded_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view documents"
  ON documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can upload documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER', 'SALES_REP')
    )
  );

CREATE POLICY "Admins can delete documents"
  ON documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );

-- Create document_links table
CREATE TABLE IF NOT EXISTS document_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  linked_to_type text NOT NULL,
  linked_to_id uuid NOT NULL,
  linked_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE document_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view document links"
  ON document_links FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create document links"
  ON document_links FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER', 'SALES_REP')
    )
  );

CREATE POLICY "Users can delete document links they created or admins"
  ON document_links FOR DELETE
  TO authenticated
  USING (
    linked_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  content text NOT NULL,
  related_to_type text NOT NULL,
  related_to_id uuid NOT NULL,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notes"
  ON notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create notes"
  ON notes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER', 'SALES_REP')
    )
  );

CREATE POLICY "Users can update own notes or admins"
  ON notes FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );

CREATE POLICY "Users can delete own notes or admins"
  ON notes FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );

-- Create audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  field_name text,
  old_value text,
  new_value text,
  user_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers and admins can view audit logs"
  ON audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
  );

CREATE POLICY "System can insert audit logs"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_accounts_owner ON accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_accounts_stage ON accounts(stage);
CREATE INDEX IF NOT EXISTS idx_contacts_account ON contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_account ON opportunities(account_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_activities_owner ON activities(owner_id);
CREATE INDEX IF NOT EXISTS idx_activities_related ON activities(related_to_type, related_to_id);
CREATE INDEX IF NOT EXISTS idx_document_links_linked ON document_links(linked_to_type, linked_to_id);
CREATE INDEX IF NOT EXISTS idx_notes_related ON notes(related_to_type, related_to_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
