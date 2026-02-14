
-- 1. Create Document Folders Table
CREATE TABLE IF NOT EXISTS document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES document_folders(id) ON DELETE CASCADE,
  owner_id uuid REFERENCES profiles(id) DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);

-- 2. Add folder_id to Documents
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'folder_id') THEN
        ALTER TABLE documents ADD COLUMN folder_id uuid REFERENCES document_folders(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Enable RLS on Folders
ALTER TABLE document_folders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own folders" ON document_folders;
DROP POLICY IF EXISTS "Users can create own folders" ON document_folders;
DROP POLICY IF EXISTS "Users view own folders" ON document_folders;
DROP POLICY IF EXISTS "Users create own folders" ON document_folders;

CREATE POLICY "Users can view own folders" ON document_folders 
FOR SELECT TO authenticated 
USING (owner_id = auth.uid());

CREATE POLICY "Users can create own folders" ON document_folders 
FOR INSERT TO authenticated 
WITH CHECK (owner_id = auth.uid());

-- 4. Ensure Storage Bucket Exists and Policies (Safest Reset)
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
