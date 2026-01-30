/*
  # Fix RLS Policies - Remove Infinite Recursion

  This migration fixes the infinite recursion issue in RLS policies by:
  1. Creating a helper function that safely gets user role
  2. Updating all policies to use this function instead of querying profiles directly
  
  ## Changes
  - Create get_user_role() function
  - Drop and recreate all policies to use the new function
*/

-- Create a function to get user role safely
CREATE OR REPLACE FUNCTION get_user_role(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM profiles WHERE id = user_id;
  RETURN COALESCE(user_role, 'READ_ONLY');
END;
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own leads or all if manager/admin" ON leads;
DROP POLICY IF EXISTS "Users can create leads" ON leads;
DROP POLICY IF EXISTS "Users can update own leads or all if manager/admin" ON leads;
DROP POLICY IF EXISTS "Admins can delete leads" ON leads;
DROP POLICY IF EXISTS "Users can view own accounts or all if manager/admin" ON accounts;
DROP POLICY IF EXISTS "Users can create accounts" ON accounts;
DROP POLICY IF EXISTS "Users can update own accounts or all if manager/admin" ON accounts;
DROP POLICY IF EXISTS "Admins can delete accounts" ON accounts;
DROP POLICY IF EXISTS "Users can view contacts if they can view the account" ON contacts;
DROP POLICY IF EXISTS "Users can create contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts if they can update the account" ON contacts;
DROP POLICY IF EXISTS "Admins can delete contacts" ON contacts;
DROP POLICY IF EXISTS "Users can view opportunities if they can view the account" ON opportunities;
DROP POLICY IF EXISTS "Users can create opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can update opportunities if they can update the account" ON opportunities;
DROP POLICY IF EXISTS "Admins can delete opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can view own activities or all if manager/admin" ON activities;
DROP POLICY IF EXISTS "Users can create activities" ON activities;
DROP POLICY IF EXISTS "Users can update own activities or all if manager/admin" ON activities;
DROP POLICY IF EXISTS "Users can delete own activities or all if admin" ON activities;
DROP POLICY IF EXISTS "Users can view documents" ON documents;
DROP POLICY IF EXISTS "Users can upload documents" ON documents;
DROP POLICY IF EXISTS "Admins can delete documents" ON documents;
DROP POLICY IF EXISTS "Users can view document links" ON document_links;
DROP POLICY IF EXISTS "Users can create document links" ON document_links;
DROP POLICY IF EXISTS "Users can delete document links they created or admins" ON document_links;
DROP POLICY IF EXISTS "Users can view notes" ON notes;
DROP POLICY IF EXISTS "Users can create notes" ON notes;
DROP POLICY IF EXISTS "Users can update own notes or admins" ON notes;
DROP POLICY IF EXISTS "Users can delete own notes or admins" ON notes;

-- Recreate profiles policies
CREATE POLICY "Admins can manage all profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = 'ADMIN');

-- Recreate leads policies
CREATE POLICY "Users can view own leads or all if manager/admin"
  ON leads FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER')
  );

CREATE POLICY "Users can create leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER', 'SALES_REP'));

CREATE POLICY "Users can update own leads or all if manager/admin"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER')
  );

CREATE POLICY "Admins can delete leads"
  ON leads FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'ADMIN');

-- Recreate accounts policies
CREATE POLICY "Users can view own accounts or all if manager/admin"
  ON accounts FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER')
  );

CREATE POLICY "Users can create accounts"
  ON accounts FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER', 'SALES_REP'));

CREATE POLICY "Users can update own accounts or all if manager/admin"
  ON accounts FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER')
  );

CREATE POLICY "Admins can delete accounts"
  ON accounts FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'ADMIN');

-- Recreate contacts policies
CREATE POLICY "Users can view contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER')
  );

CREATE POLICY "Users can create contacts"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER', 'SALES_REP'));

CREATE POLICY "Users can update contacts"
  ON contacts FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER')
  );

CREATE POLICY "Admins can delete contacts"
  ON contacts FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'ADMIN');

-- Recreate opportunities policies
CREATE POLICY "Users can view opportunities"
  ON opportunities FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER')
  );

CREATE POLICY "Users can create opportunities"
  ON opportunities FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER', 'SALES_REP'));

CREATE POLICY "Users can update opportunities"
  ON opportunities FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER')
  );

CREATE POLICY "Admins can delete opportunities"
  ON opportunities FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'ADMIN');

-- Recreate activities policies
CREATE POLICY "Users can view own activities or all if manager/admin"
  ON activities FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER')
  );

CREATE POLICY "Users can create activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER', 'SALES_REP'));

CREATE POLICY "Users can update own activities or all if manager/admin"
  ON activities FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER')
  );

CREATE POLICY "Users can delete own activities or all if admin"
  ON activities FOR DELETE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR get_user_role(auth.uid()) = 'ADMIN'
  );

-- Recreate documents policies
CREATE POLICY "Users can view documents"
  ON documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can upload documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER', 'SALES_REP'));

CREATE POLICY "Admins can delete documents"
  ON documents FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'ADMIN');

-- Recreate document_links policies
CREATE POLICY "Users can view document links"
  ON document_links FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create document links"
  ON document_links FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER', 'SALES_REP'));

CREATE POLICY "Users can delete document links"
  ON document_links FOR DELETE
  TO authenticated
  USING (
    linked_by = auth.uid()
    OR get_user_role(auth.uid()) = 'ADMIN'
  );

-- Recreate notes policies
CREATE POLICY "Users can view notes"
  ON notes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create notes"
  ON notes FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role(auth.uid()) IN ('ADMIN', 'MANAGER', 'SALES_REP'));

CREATE POLICY "Users can update notes"
  ON notes FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR get_user_role(auth.uid()) = 'ADMIN'
  );

CREATE POLICY "Users can delete notes"
  ON notes FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR get_user_role(auth.uid()) = 'ADMIN'
  );
