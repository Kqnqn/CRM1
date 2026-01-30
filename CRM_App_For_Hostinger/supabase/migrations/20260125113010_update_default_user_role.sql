/*
  # Update Default User Role

  This migration updates the get_user_role function to return 'SALES_REP'
  by default instead of 'READ_ONLY'. This ensures that new users who don't
  have a profile yet can still perform basic operations.
  
  ## Changes
  - Update get_user_role function to default to SALES_REP
*/

-- Update the function to default to SALES_REP
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
  RETURN COALESCE(user_role, 'SALES_REP');
END;
$$;
