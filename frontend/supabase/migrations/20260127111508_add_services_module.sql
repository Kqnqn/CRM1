/*
  # Add Services Module for Preventive Maintenance

  1. New Tables
    - `service_contracts`
      - `id` (uuid, primary key)
      - `account_id` (uuid, foreign key to accounts)
      - `device_type` (text) - e.g., dispenser model/type
      - `device_serial` (text, optional) - serial number
      - `location_address` (text) - where device is located
      - `contact_name` (text) - person at location
      - `contact_phone` (text, optional)
      - `contact_email` (text, optional)
      - `last_service_at` (timestamptz) - date of last performed service
      - `interval_value` (int) - 6, 12, etc.
      - `interval_unit` (text) - MONTHS or YEARS
      - `next_service_due_at` (timestamptz) - computed for fast queries
      - `service_price` (decimal, optional)
      - `currency` (text, default BAM)
      - `assigned_to_id` (uuid, optional, foreign key to profiles)
      - `status` (text) - ACTIVE, PAUSED, CLOSED
      - `notes` (text, optional)
      - `google_event_id` (text, optional) - Google Calendar event ID
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      
    - `service_logs`
      - `id` (uuid, primary key)
      - `service_id` (uuid, foreign key to service_contracts)
      - `performed_at` (timestamptz)
      - `performed_by_id` (uuid, optional, foreign key to profiles)
      - `note` (text, optional)
      - `price_charged` (decimal, optional)
      - `created_at` (timestamptz)

  2. Changes
    - Extend `document_links` linked_to_type to include SERVICE

  3. Security
    - Enable RLS on both tables
    - Admin/Manager can view all services
    - Sales reps can view assigned services
    - Service logs visible to authorized users
*/

-- Create service_contracts table
CREATE TABLE IF NOT EXISTS service_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  device_type text NOT NULL,
  device_serial text,
  location_address text NOT NULL,
  contact_name text NOT NULL,
  contact_phone text,
  contact_email text,
  last_service_at timestamptz NOT NULL,
  interval_value int NOT NULL,
  interval_unit text NOT NULL CHECK (interval_unit IN ('MONTHS', 'YEARS')),
  next_service_due_at timestamptz NOT NULL,
  service_price decimal(12,2),
  currency text DEFAULT 'BAM',
  assigned_to_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'CLOSED')),
  notes text,
  google_event_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create service_logs table
CREATE TABLE IF NOT EXISTS service_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES service_contracts(id) ON DELETE CASCADE,
  performed_at timestamptz DEFAULT now(),
  performed_by_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  note text,
  price_charged decimal(12,2),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_contracts_account ON service_contracts(account_id);
CREATE INDEX IF NOT EXISTS idx_service_contracts_assigned_to ON service_contracts(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_service_contracts_next_due ON service_contracts(next_service_due_at);
CREATE INDEX IF NOT EXISTS idx_service_contracts_status ON service_contracts(status);
CREATE INDEX IF NOT EXISTS idx_service_logs_service ON service_logs(service_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_service_contract_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS set_service_contract_updated_at ON service_contracts;
CREATE TRIGGER set_service_contract_updated_at
  BEFORE UPDATE ON service_contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_service_contract_updated_at();

-- Enable RLS
ALTER TABLE service_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service_contracts

-- Admin and Manager can view all services
CREATE POLICY "Admin and Manager can view all service contracts"
  ON service_contracts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
  );

-- Sales reps can view assigned services
CREATE POLICY "Sales reps can view assigned services"
  ON service_contracts FOR SELECT
  TO authenticated
  USING (
    assigned_to_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
  );

-- Admin and Manager can insert service contracts
CREATE POLICY "Admin and Manager can insert service contracts"
  ON service_contracts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
  );

-- Admin and Manager can update service contracts
CREATE POLICY "Admin and Manager can update service contracts"
  ON service_contracts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
  );

-- Admin can delete service contracts
CREATE POLICY "Admin can delete service contracts"
  ON service_contracts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );

-- RLS Policies for service_logs

-- Users can view service logs if they can view the service contract
CREATE POLICY "Users can view service logs"
  ON service_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_contracts
      WHERE service_contracts.id = service_logs.service_id
      AND (
        service_contracts.assigned_to_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('ADMIN', 'MANAGER')
        )
      )
    )
  );

-- Admin and Manager can insert service logs
CREATE POLICY "Admin and Manager can insert service logs"
  ON service_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
  );

-- Admin and Manager can update service logs
CREATE POLICY "Admin and Manager can update service logs"
  ON service_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
  );

-- Admin can delete service logs
CREATE POLICY "Admin can delete service logs"
  ON service_logs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ADMIN'
    )
  );

-- Extend document_links to support SERVICE entity type
-- First check if there's an existing constraint and get its current values
DO $$
DECLARE
  constraint_def TEXT;
BEGIN
  -- Get the current constraint definition
  SELECT pg_get_constraintdef(c.oid)
  INTO constraint_def
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'document_links'
  AND c.conname LIKE '%linked_to_type%';
  
  -- Only proceed if we found a constraint and it doesn't already include SERVICE
  IF constraint_def IS NOT NULL AND constraint_def NOT LIKE '%SERVICE%' THEN
    -- Drop the old constraint
    ALTER TABLE document_links DROP CONSTRAINT IF EXISTS document_links_linked_to_type_check;
    
    -- Add new constraint with SERVICE included
    ALTER TABLE document_links ADD CONSTRAINT document_links_linked_to_type_check
      CHECK (linked_to_type IN ('ACCOUNT', 'ORDER', 'CONTACT', 'LEAD', 'OPPORTUNITY', 'SERVICE'));
  ELSIF constraint_def IS NULL THEN
    -- If no constraint exists, create it
    ALTER TABLE document_links ADD CONSTRAINT document_links_linked_to_type_check
      CHECK (linked_to_type IN ('ACCOUNT', 'ORDER', 'CONTACT', 'LEAD', 'OPPORTUNITY', 'SERVICE'));
  END IF;
END $$;