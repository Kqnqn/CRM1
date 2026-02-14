-- Make account_id nullable in service_contracts
ALTER TABLE service_contracts ALTER COLUMN account_id DROP NOT NULL;

-- Update the Google Calendar event summary logic in case it's used elsewhere, 
-- but primarily we'll handle this in the code.
