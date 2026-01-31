/*
  # Fix Documents Storage Policies

  1. Updates
    - Remove restrictive delete policy
    - Add permissive delete policy for all authenticated users
    - Ensure read/download policies work correctly
  
  2. Changes
    - Allow any authenticated user to delete documents (team collaboration)
    - Maintain read access for all authenticated users
    - Keep upload permissions as is

  3. Security
    - RLS still enabled on documents table for metadata access control
    - Storage policies aligned with CRM team collaboration needs
*/

-- Drop the restrictive delete policy
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;

-- Create permissive delete policy for authenticated users
CREATE POLICY "Authenticated users can delete documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'documents');
