/*
  # Add Orders, Activity Comments, Notifications, and Calendar Integration

  1. New Tables
    - `orders` - Track orders/invoices for accounts
    - `activity_comments` - Comments thread for activities
    - `notifications` - Store user notifications

  2. Modified Tables
    - `profiles` - Add Google Calendar OAuth fields and default currency
    - `activities` - Add assignee field, calendar sync flag, and completed status
    - `accounts` - Add default payment currency field

  3. Security
    - Enable RLS on all new tables
    - Add appropriate policies for authenticated users
*/

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES opportunities(id),
  order_number text NOT NULL,
  ordered_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  amount decimal(15, 2) NOT NULL DEFAULT 0,
  paid_amount decimal(15, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  due_date timestamptz,
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view orders" ON orders;
CREATE POLICY "Users can view orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('ADMIN', 'SALES_MANAGER') OR
    created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Users can create orders" ON orders;
CREATE POLICY "Users can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role(auth.uid()) IN ('ADMIN', 'SALES_MANAGER', 'SALES_REP') AND
    created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update orders" ON orders;
CREATE POLICY "Users can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    get_user_role(auth.uid()) IN ('ADMIN', 'SALES_MANAGER') OR
    created_by = auth.uid()
  )
  WITH CHECK (
    get_user_role(auth.uid()) IN ('ADMIN', 'SALES_MANAGER') OR
    created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can delete orders" ON orders;
CREATE POLICY "Admins can delete orders"
  ON orders FOR DELETE
  TO authenticated
  USING (get_user_role(auth.uid()) = 'ADMIN');

CREATE INDEX IF NOT EXISTS idx_orders_account ON orders(account_id);
CREATE INDEX IF NOT EXISTS idx_orders_due_date ON orders(due_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Activity Comments table
CREATE TABLE IF NOT EXISTS activity_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid REFERENCES activities(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE activity_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view activity comments" ON activity_comments;
CREATE POLICY "Users can view activity comments"
  ON activity_comments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create activity comments" ON activity_comments;
CREATE POLICY "Users can create activity comments"
  ON activity_comments FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update own comments" ON activity_comments;
CREATE POLICY "Users can update own comments"
  ON activity_comments FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete own comments" ON activity_comments;
CREATE POLICY "Users can delete own comments"
  ON activity_comments FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_activity_comments_activity ON activity_comments(activity_id);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  entity_type text,
  entity_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- Add Google Calendar fields to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'google_calendar_connected'
  ) THEN
    ALTER TABLE profiles ADD COLUMN google_calendar_connected boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'google_access_token'
  ) THEN
    ALTER TABLE profiles ADD COLUMN google_access_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'google_refresh_token'
  ) THEN
    ALTER TABLE profiles ADD COLUMN google_refresh_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'google_token_expiry'
  ) THEN
    ALTER TABLE profiles ADD COLUMN google_token_expiry timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'default_currency'
  ) THEN
    ALTER TABLE profiles ADD COLUMN default_currency text DEFAULT 'USD';
  END IF;
END $$;

-- Add assignee and calendar sync to activities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE activities ADD COLUMN assigned_to uuid REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'sync_to_calendar'
  ) THEN
    ALTER TABLE activities ADD COLUMN sync_to_calendar boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'google_calendar_event_id'
  ) THEN
    ALTER TABLE activities ADD COLUMN google_calendar_event_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'completed'
  ) THEN
    ALTER TABLE activities ADD COLUMN completed boolean DEFAULT false;
  END IF;
END $$;

-- Add default currency to accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'default_currency'
  ) THEN
    ALTER TABLE accounts ADD COLUMN default_currency text DEFAULT 'USD';
  END IF;
END $$;

-- Create indexes for new activity fields
CREATE INDEX IF NOT EXISTS idx_activities_assigned_to ON activities(assigned_to);
CREATE INDEX IF NOT EXISTS idx_activities_due_date ON activities(due_date);
CREATE INDEX IF NOT EXISTS idx_activities_completed ON activities(completed);
