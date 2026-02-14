-- Link Leads and Contacts
-- 1. Make account_id nullable in contacts
ALTER TABLE contacts ALTER COLUMN account_id DROP NOT NULL;

-- 2. Add contact_id to leads to link specific leads to their contact records
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id);

-- 3. Update RLS policies for contacts to allow managers/admins to see all even if account_id is null
DROP POLICY IF EXISTS "Users can view contacts if they can view the account" ON contacts;
CREATE POLICY "Users can view contacts if they can view the account"
  ON contacts FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
    OR (
      account_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM accounts
        WHERE accounts.id = contacts.account_id
        AND accounts.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update contacts if they can update the account" ON contacts;
CREATE POLICY "Users can update contacts if they can update the account"
  ON contacts FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'MANAGER')
    )
    OR (
      account_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM accounts
        WHERE accounts.id = contacts.account_id
        AND accounts.owner_id = auth.uid()
      )
    )
  );

-- 4. Backfill existing leads: Create contacts for leads that don't have one and link them
DO $$
DECLARE
    r RECORD;
    new_contact_id uuid;
    first_n text;
    last_n text;
BEGIN
    FOR r IN (SELECT * FROM leads WHERE contact_id IS NULL) LOOP
        -- Split name into first and last
        first_n := split_part(r.contact_person_name, ' ', 1);
        last_n := substr(r.contact_person_name, length(split_part(r.contact_person_name, ' ', 1)) + 2);
        last_n := trim(last_n);
        
        IF last_n = '' THEN
            last_n := 'Unknown';
        END IF;

        -- Create contact
        INSERT INTO contacts (first_name, last_name, email, phone, owner_id)
        VALUES (first_n, last_n, r.email, r.phone, r.owner_id)
        RETURNING id INTO new_contact_id;

        -- Link lead back to contact
        UPDATE leads SET contact_id = new_contact_id WHERE id = r.id;
    END LOOP;
END $$;
