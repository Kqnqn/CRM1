-- Fix RLS policies for service_contracts to allow SALES_REP to create services

-- Drop existing insert policy
DROP POLICY IF EXISTS "Admin and Manager can insert service contracts" ON service_contracts;

-- Create new insert policy that allows SALES_REP to create service contracts
CREATE POLICY "Users can insert service contracts"
  ON service_contracts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER', 'SALES_REP')
    )
  );

-- Also fix update policy to allow SALES_REP to update services they are assigned to
DROP POLICY IF EXISTS "Admin and Manager can update service contracts" ON service_contracts;

CREATE POLICY "Users can update service contracts"
  ON service_contracts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
    OR (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'SALES_REP'
      )
      AND assigned_to_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
    OR (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'SALES_REP'
      )
      AND assigned_to_id = auth.uid()
    )
  );
