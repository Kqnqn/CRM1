/*
  # Fix Documents Delete Permissions

  1. Updates
    - Allow all authenticated users to delete documents from the table
    - This aligns with team collaboration where any user can manage shared documents
  
  2. Changes
    - Drop restrictive ADMIN-only delete policy
    - Add permissive delete policy for all authenticated users

  3. Security
    - All authenticated team members can manage documents
    - Maintains audit trail through created_by field
*/

-- Drop the restrictive delete policy
DROP POLICY IF EXISTS "Admins can delete documents" ON documents;

-- Create permissive delete policy for authenticated users
CREATE POLICY "Authenticated users can delete documents"
  ON documents
  FOR DELETE
  TO authenticated
  USING (true);
