
/*
  COMPLETE MIGRATION SCRIPT (2026-02-08)
  Includes:
  1. Contacts Soft Delete
  2. Data Imports Table
  3. Login History Table
  4. Task Participants Table
  5. Document Folders & Policies (Fixed)
  6. Document Storage & Policies (Fixed)
*/

-- 1. Contacts Soft Delete
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 1b. Leads Unique Email
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_email ON leads(email);

-- 2. Task Participants
CREATE TABLE IF NOT EXISTS task_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES activities(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'INVITED' CHECK (status IN ('INVITED', 'ACCEPTED', 'DECLINED')),
  invited_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(task_id, user_id)
);

ALTER TABLE task_participants ENABLE ROW LEVEL SECURITY;

-- Task Participants Policies (Drop if exists to avoid errors on re-run)
DROP POLICY IF EXISTS "Users can view task participants for tasks they can see" ON task_participants;
CREATE POLICY "Users can view task participants for tasks they can see"
  ON task_participants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM activities
      WHERE activities.id = task_participants.task_id
      AND (
        activities.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'MANAGER'))
        OR EXISTS (SELECT 1 FROM task_participants tp WHERE tp.task_id = activities.id AND tp.user_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Users can invite participants to own tasks" ON task_participants;
CREATE POLICY "Users can invite participants to own tasks"
  ON task_participants FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM activities
      WHERE activities.id = task_participants.task_id
      AND activities.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own participation status" ON task_participants;
CREATE POLICY "Users can update their own participation status"
  ON task_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3. Data Imports (Temporary storage for CSV import)
CREATE TABLE IF NOT EXISTS data_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  data jsonb NOT NULL,
  total_rows integer,
  valid_rows integer,
  error_rows integer,
  status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  created_by uuid REFERENCES profiles(id) DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE data_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own imports" ON data_imports;
CREATE POLICY "Users view own imports" ON data_imports FOR SELECT TO authenticated USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users create own imports" ON data_imports;
CREATE POLICY "Users create own imports" ON data_imports FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users update own imports" ON data_imports;
CREATE POLICY "Users update own imports" ON data_imports FOR UPDATE TO authenticated USING (created_by = auth.uid());

-- 4. Login History
CREATE TABLE IF NOT EXISTS login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ip_address text,
  user_agent text,
  status text NOT NULL CHECK (status IN ('SUCCESS', 'FAILURE')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view all login history" ON login_history;
CREATE POLICY "Admins view all login history" ON login_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'ADMIN'));

DROP POLICY IF EXISTS "Users view own login history" ON login_history;
CREATE POLICY "Users view own login history" ON login_history FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can insert login history" ON login_history;
CREATE POLICY "Authenticated users can insert login history" ON login_history FOR INSERT TO authenticated WITH CHECK (true);

-- 5. Document Folders (CRITICAL FIXES INCLUDED HERE)
CREATE TABLE IF NOT EXISTS document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES document_folders(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES profiles(id) DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);

-- Add folder_id to Documents if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'folder_id') THEN
        ALTER TABLE documents ADD COLUMN folder_id uuid REFERENCES document_folders(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Document Links Update
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'document_links' AND column_name = 'folder_id') THEN
        ALTER TABLE document_links ADD COLUMN folder_id uuid REFERENCES document_folders(id) ON DELETE SET NULL;
    END IF;
END $$;

ALTER TABLE document_folders ENABLE ROW LEVEL SECURITY;

-- Reset Folder Policies
DROP POLICY IF EXISTS "Users view own folders" ON document_folders;
DROP POLICY IF EXISTS "Users create own folders" ON document_folders;
DROP POLICY IF EXISTS "Users update own folders" ON document_folders;
DROP POLICY IF EXISTS "Users delete own folders" ON document_folders;
DROP POLICY IF EXISTS "Users view own folders or all if admin/manager" ON document_folders;
DROP POLICY IF EXISTS "Users create their own folders" ON document_folders;
DROP POLICY IF EXISTS "Users update their own folders" ON document_folders;
DROP POLICY IF EXISTS "Users delete their own folders" ON document_folders;

CREATE POLICY "Users view own folders or all if admin/manager"
  ON document_folders FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('ADMIN', 'MANAGER'))
  );

CREATE POLICY "Users create their own folders"
  ON document_folders FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users update their own folders"
  ON document_folders FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users delete their own folders"
  ON document_folders FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- 6. Storage Bucket & Policies (Reset)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents', 'documents', false, 52428800,
  ARRAY['application/pdf', 'application/msword', 'image/jpeg', 'image/png']
) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');

DROP POLICY IF EXISTS "Authenticated users can read documents" ON storage.objects;
CREATE POLICY "Authenticated users can read documents" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "Authenticated users can delete documents" ON storage.objects;
CREATE POLICY "Authenticated users can delete documents" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents');

-- 7. Document Table Policies (Sanity Check)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
-- Ensure permissive policies exist if not already
