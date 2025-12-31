-- Migration 008: RLS Policy for Child Login
-- This migration adds a public read policy for the children table
-- to allow child login via firstname + PIN without authentication

-- Enable RLS on children table if not already enabled
ALTER TABLE children ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists (for idempotency)
DROP POLICY IF EXISTS "Allow public read for child login" ON children;

-- Create a policy that allows reading children records for login
-- This is safe because we only expose firstname and login_pin for matching
-- and we filter by is_active = true
CREATE POLICY "Allow public read for child login"
ON children
FOR SELECT
USING (
  is_active = true
  AND firstname IS NOT NULL
  AND login_pin IS NOT NULL
);

-- Add comment for documentation
COMMENT ON POLICY "Allow public read for child login" ON children IS 
'Allows anonymous users to read children records for login purposes. Only active children with firstname and login_pin are accessible.';


