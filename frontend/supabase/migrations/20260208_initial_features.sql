/*
  # 2026-02-08 Initial Features Migration
  
  1. New Tables
    - `task_participants` (for inviting users to tasks)
    - `login_history` (audit trail for logins)
    - `document_folders` (for organizing files)
  
  2. Changes
    - `contacts`: Add `deleted_at` for soft delete
    - `document_links`: Add `folder_id` reference
  
  3. Security
    - Enable RLS on new tables
    - Add policies
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

CREATE POLICY "Users can view task participants for tasks they can see"
  ON task_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM activities
      WHERE activities.id = task_participants.task_id
      AND (
        activities.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('ADMIN', 'MANAGER')
        )
        OR EXISTS (
           SELECT 1 FROM task_participants tp
           WHERE tp.task_id = activities.id
           AND tp.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can invite participants to own tasks"
  ON task_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM activities
      WHERE activities.id = task_participants.task_id
      AND activities.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own participation status"
  ON task_participants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2b. Data Imports (Temporary storage for CSV import)
CREATE TABLE IF NOT EXISTS data_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  data jsonb NOT NULL, -- The parsed valid rows
  total_rows integer,
  valid_rows integer,
  error_rows integer,
  status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  created_by uuid REFERENCES profiles(id) DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE data_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own imports"
  ON data_imports FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users create own imports"
  ON data_imports FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users update own imports"
  ON data_imports FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

-- 3. Login History
CREATE TABLE IF NOT EXISTS login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ip_address text,
  user_agent text,
  status text NOT NULL CHECK (status IN ('SUCCESS', 'FAILURE')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;

-- Admins can view all, Users can view their own
CREATE POLICY "Admins view all login history"
  ON login_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );

CREATE POLICY "Users view own login history"
  ON login_history FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- System inserts (policy for insert usually requires service role or open permissions, allowing authenticated insert for now purely for logging from server actions)
CREATE POLICY "Authenticated users can insert login history"
  ON login_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 4. Document Folders
CREATE TABLE IF NOT EXISTS document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES document_folders(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES profiles(id) DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own folders or all if admin/manager"
  ON document_folders FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
  );

CREATE POLICY "Users create their own folders"
  ON document_folders FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users update their own folders"
  ON document_folders FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users delete their own folders"
  ON document_folders FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- 5. Link Documents to Folders
ALTER TABLE document_links ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES document_folders(id) ON DELETE SET NULL;
