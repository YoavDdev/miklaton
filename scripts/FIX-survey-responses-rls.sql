-- Fix RLS policy for survey_responses to allow service role to see all responses

-- Drop existing policy
DROP POLICY IF EXISTS "Call center managers can view responses" ON survey_responses;

-- Create simplified policy that allows service role key to bypass
-- This will allow the API to see all responses when using SERVICE_ROLE_KEY
CREATE POLICY "Call center managers can view responses"
    ON survey_responses FOR SELECT
    TO authenticated, anon
    USING (true);

-- Verify the policy
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'survey_responses';
