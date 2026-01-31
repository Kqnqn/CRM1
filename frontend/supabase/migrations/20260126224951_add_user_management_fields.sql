/*
  # Add User Management Fields and Tables

  1. Profile Updates
    - Add `password_change_required` flag for forcing password changes on first login
    - Add `phone` field for user profile management
    
  2. New Tables
    - `user_invitations` table to track user creation by admins
    
  3. Security
    - RLS policies for user_invitations table
    - Admin-only access to manage invitations
*/

-- Add phone field to profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone text;
  END IF;
END $$;

-- Add password_change_required field to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'password_change_required'
  ) THEN
    ALTER TABLE profiles ADD COLUMN password_change_required boolean DEFAULT false;
  END IF;
END $$;

-- Update role constraint to include READ_ONLY
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'profiles' AND constraint_name = 'profiles_role_check'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
  END IF;
  
  ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('ADMIN', 'MANAGER', 'SALES_REP', 'READ_ONLY'));
END $$;

-- Create user_invitations table to track admin user creation
CREATE TABLE IF NOT EXISTS user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'SALES_REP', 'READ_ONLY')),
  invited_by uuid REFERENCES profiles(id) NOT NULL,
  invited_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED')),
  temp_password text
);

ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all invitations
CREATE POLICY "Admins can view all invitations"
  ON user_invitations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );

-- Policy: Admins can create invitations
CREATE POLICY "Admins can create invitations"
  ON user_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );

-- Policy: Admins can update invitations
CREATE POLICY "Admins can update invitations"
  ON user_invitations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );