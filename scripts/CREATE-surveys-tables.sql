-- Surveys table - for tracking all surveys created by call center manager
CREATE TABLE IF NOT EXISTS surveys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    title TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    closed_at TIMESTAMP WITH TIME ZONE
);

-- Survey responses table - all responses to surveys
CREATE TABLE IF NOT EXISTS survey_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    respondent_name TEXT, -- nullable for anonymous responses
    respondent_ip TEXT, -- to prevent spam
    q1_courtesy INTEGER CHECK (q1_courtesy >= 1 AND q1_courtesy <= 4 OR q1_courtesy IS NULL),
    q2_professional INTEGER CHECK (q2_professional >= 1 AND q2_professional <= 4 OR q2_professional IS NULL),
    q3_helpful INTEGER CHECK (q3_helpful >= 1 AND q3_helpful <= 4 OR q3_helpful IS NULL),
    q4_problem_solving INTEGER CHECK (q4_problem_solving >= 1 AND q4_problem_solving <= 4 OR q4_problem_solving IS NULL),
    improvements_text TEXT
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_surveys_token ON surveys(token);
CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys(status);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_id ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_submitted_at ON survey_responses(submitted_at);

-- Row Level Security (RLS) policies
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

-- Surveys policies
-- Call center managers can view and create surveys
DROP POLICY IF EXISTS "Call center managers can view surveys" ON surveys;
CREATE POLICY "Call center managers can view surveys"
    ON surveys FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'call_center_manager'
        )
    );

DROP POLICY IF EXISTS "Call center managers can create surveys" ON surveys;
CREATE POLICY "Call center managers can create surveys"
    ON surveys FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'call_center_manager'
        )
    );

DROP POLICY IF EXISTS "Call center managers can update surveys" ON surveys;
CREATE POLICY "Call center managers can update surveys"
    ON surveys FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'call_center_manager'
        )
    );

-- Survey responses policies
-- Public can insert responses (no auth required for survey filling)
DROP POLICY IF EXISTS "Anyone can submit survey responses" ON survey_responses;
CREATE POLICY "Anyone can submit survey responses"
    ON survey_responses FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Only call center managers can view responses
-- NOTE: Using service_role key bypasses RLS, so this policy is mainly for direct database access
DROP POLICY IF EXISTS "Call center managers can view responses" ON survey_responses;
CREATE POLICY "Call center managers can view responses"
    ON survey_responses FOR SELECT
    TO authenticated
    USING (true); -- Service role key bypasses this anyway

-- Function to generate unique survey token
CREATE OR REPLACE FUNCTION generate_survey_token()
RETURNS TEXT AS $$
DECLARE
    token TEXT;
    exists BOOLEAN;
BEGIN
    LOOP
        -- Generate 8-character random token
        token := encode(gen_random_bytes(6), 'base64');
        token := REPLACE(token, '/', '_');
        token := REPLACE(token, '+', '-');
        token := SUBSTRING(token FROM 1 FOR 8);
        
        -- Check if token exists
        SELECT EXISTS(SELECT 1 FROM surveys WHERE surveys.token = token) INTO exists;
        EXIT WHEN NOT exists;
    END LOOP;
    
    RETURN token;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE surveys IS 'Survey satisfaction surveys created by call center managers';
COMMENT ON TABLE survey_responses IS 'Responses to satisfaction surveys - can be anonymous or named';
