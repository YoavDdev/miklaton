


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."add_user_to_department"("user_uuid" "uuid", "dept_uuid" "uuid", "make_primary" boolean DEFAULT false) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- הוסף את המשתמש למחלקה
  INSERT INTO user_departments (user_id, department_id, is_primary)
  VALUES (user_uuid, dept_uuid, make_primary)
  ON CONFLICT (user_id, department_id) DO NOTHING;
  
  -- אם צריך להפוך ל-primary, קרא לפונקציה המתאימה
  IF make_primary THEN
    PERFORM set_primary_department(user_uuid, dept_uuid);
  END IF;
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."add_user_to_department"("user_uuid" "uuid", "dept_uuid" "uuid", "make_primary" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_edit_duty_roster"("user_uuid" "uuid", "dept_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  user_role VARCHAR;
  user_dept UUID;
BEGIN
  SELECT role, department_id INTO user_role, user_dept
  FROM user_profiles
  WHERE id = user_uuid AND status = 'active';
  
  -- Admin או CEO יכולים לערוך הכל
  IF user_role IN ('admin', 'ceo') THEN
    RETURN true;
  END IF;
  
  -- Sector Manager יכול לערוך רק את המכלול שלו
  IF user_role = 'sector_manager' AND user_dept = dept_id THEN
    RETURN true;
  END IF;
  
  -- Call Center Manager יכולה לערוך כוננות של מוקדנים
  IF user_role = 'call_center_manager' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;


ALTER FUNCTION "public"."can_edit_duty_roster"("user_uuid" "uuid", "dept_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_survey_token"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."generate_survey_token"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_daily_updates"("muni_id" "uuid", "check_time" timestamp with time zone DEFAULT "now"()) RETURNS TABLE("id" "uuid", "title" character varying, "description" "text", "type" character varying, "address" "text", "lat" numeric, "lng" numeric, "start_time" timestamp with time zone, "end_time" timestamp with time zone, "time_remaining" interval)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    du.id,
    du.title,
    du.description,
    du.type,
    du.address,
    du.lat,
    du.lng,
    du.start_time,
    du.end_time,
    (du.end_time - check_time) AS time_remaining
  FROM daily_updates du
  WHERE du.municipality_id = muni_id
    AND du.start_time <= check_time
    AND du.end_time > check_time
  ORDER BY du.start_time ASC;
END;
$$;


ALTER FUNCTION "public"."get_active_daily_updates"("muni_id" "uuid", "check_time" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_on_call"("dept_id" "uuid", "check_time" timestamp with time zone DEFAULT "now"()) RETURNS TABLE("contact_id" "uuid", "contact_name" character varying, "contact_phone" character varying, "is_external" boolean, "external_company" character varying)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oc.id,
    oc.name,
    oc.phone,
    oc.is_external,
    oc.external_company
  FROM on_call_contacts oc
  INNER JOIN on_call_shifts os ON os.contact_id = oc.id
  WHERE os.department_id = dept_id
    AND oc.active = true
    AND os.start_date <= check_time::DATE
    AND (os.end_date IS NULL OR os.end_date >= check_time::DATE)
  ORDER BY 
    CASE WHEN os.shift_type = 'temporary' THEN 1 ELSE 2 END,
    os.created_at DESC
  LIMIT 1;
  
  -- If no active shift, return default contact
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      oc.id,
      oc.name,
      oc.phone,
      oc.is_external,
      oc.external_company
    FROM on_call_contacts oc
    WHERE oc.department_id = dept_id
      AND oc.active = true
      AND oc.is_default = true
    LIMIT 1;
  END IF;
END;
$$;


ALTER FUNCTION "public"."get_current_on_call"("dept_id" "uuid", "check_time" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_current_on_call_v2"("p_department_id" "uuid", "p_check_time" timestamp with time zone DEFAULT "now"()) RETURNS TABLE("contact_id" "uuid", "contact_name" character varying, "contact_phone" character varying, "contact_email" character varying, "role_description" "text", "priority" integer, "escalation_instructions" "text", "fallback_contact_id" "uuid", "fallback_name" character varying, "fallback_phone" character varying, "notes" "text", "available_hours" character varying, "is_external" boolean, "external_company" character varying, "shift_description" "text", "shift_type" character varying)
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  v_day_of_week INTEGER;
  v_time_of_day TIME;
BEGIN
  -- Get current day of week (0=Sunday, 6=Saturday)
  v_day_of_week := EXTRACT(DOW FROM p_check_time);
  
  -- Get current time
  v_time_of_day := p_check_time::TIME;
  
  RETURN QUERY
  SELECT 
    oc.id,
    oc.name,
    oc.phone,
    oc.email,
    oc.role_description,
    oc.priority,
    oc.escalation_instructions,
    oc.fallback_contact_id,
    fb.name AS fallback_name,
    fb.phone AS fallback_phone,
    oc.notes,
    oc.available_hours,
    oc.is_external,
    oc.external_company,
    os.description AS shift_description,
    os.shift_type
  FROM on_call_contacts oc
  INNER JOIN on_call_shifts os ON os.contact_id = oc.id
  LEFT JOIN on_call_contacts fb ON fb.id = oc.fallback_contact_id
  WHERE oc.department_id = p_department_id
    AND oc.active = true
    -- Check date range
    AND (os.start_date IS NULL OR os.start_date <= p_check_time::DATE)
    AND (os.end_date IS NULL OR os.end_date >= p_check_time::DATE)
    -- Check day of week
    AND os.days_of_week @> to_jsonb(v_day_of_week)
    -- Check time range (NULL = all day)
    AND (
      (os.time_start IS NULL AND os.time_end IS NULL) -- All day
      OR (
        os.time_start IS NOT NULL 
        AND os.time_end IS NOT NULL
        AND (
          -- Normal time range (e.g., 08:00-20:00)
          (os.time_start < os.time_end AND v_time_of_day >= os.time_start AND v_time_of_day < os.time_end)
          OR
          -- Overnight range (e.g., 20:00-08:00)
          (os.time_start > os.time_end AND (v_time_of_day >= os.time_start OR v_time_of_day < os.time_end))
        )
      )
    )
  ORDER BY 
    -- Temporary shifts have priority
    CASE WHEN os.shift_type = 'temporary' THEN 0 ELSE 1 END,
    -- Then by contact priority
    oc.priority ASC,
    -- Then by creation date
    oc.created_at ASC
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_current_on_call_v2"("p_department_id" "uuid", "p_check_time" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_current_on_call_v2"("p_department_id" "uuid", "p_check_time" timestamp with time zone) IS 'מחזיר את הכונן הפעיל כרגע - תומך בימים, שעות, ומשמרות זמניות';



CREATE OR REPLACE FUNCTION "public"."get_on_call_with_fallback"("p_department_id" "uuid", "p_check_time" timestamp with time zone DEFAULT "now"()) RETURNS TABLE("contact_id" "uuid", "contact_name" character varying, "contact_phone" character varying, "contact_email" character varying, "role_description" "text", "priority" integer, "escalation_instructions" "text", "fallback_contact_id" "uuid", "fallback_name" character varying, "fallback_phone" character varying, "notes" "text", "available_hours" character varying, "is_external" boolean, "external_company" character varying)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    oc.id,
    oc.name,
    oc.phone,
    oc.email,
    oc.role_description,
    oc.priority,
    oc.escalation_instructions,
    oc.fallback_contact_id,
    fb.name AS fallback_name,
    fb.phone AS fallback_phone,
    oc.notes,
    oc.available_hours,
    oc.is_external,
    oc.external_company
  FROM on_call_contacts oc
  LEFT JOIN on_call_contacts fb ON fb.id = oc.fallback_contact_id
  WHERE oc.department_id = p_department_id
    AND oc.active = true
    AND EXISTS (
      SELECT 1 FROM on_call_shifts os
      WHERE os.contact_id = oc.id
        AND os.department_id = p_department_id
        AND (os.start_date IS NULL OR os.start_date <= p_check_time::DATE)
        AND (os.end_date IS NULL OR os.end_date >= p_check_time::DATE)
    )
  ORDER BY oc.priority ASC, oc.created_at ASC
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_on_call_with_fallback"("p_department_id" "uuid", "p_check_time" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_on_call_with_fallback"("p_department_id" "uuid", "p_check_time" timestamp with time zone) IS 'מחזיר את הכונן הפעיל כרגע למחלקה, כולל פרטי גיבוי';



CREATE OR REPLACE FUNCTION "public"."get_user_departments"("user_uuid" "uuid") RETURNS TABLE("department_id" "uuid", "department_name" character varying, "is_primary" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ud.department_id,
    d.name,
    ud.is_primary
  FROM user_departments ud
  JOIN departments d ON d.id = ud.department_id
  WHERE ud.user_id = user_uuid
  ORDER BY ud.is_primary DESC, d.name;
END;
$$;


ALTER FUNCTION "public"."get_user_departments"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"("user_uuid" "uuid") RETURNS character varying
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN (SELECT role FROM user_profiles WHERE id = user_uuid AND status = 'active');
END;
$$;


ALTER FUNCTION "public"."get_user_role"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO user_profiles (id, full_name, phone, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'operator'),
    'pending'
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"("user_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_uuid AND role = 'admin' AND status = 'active'
  );
END;
$$;


ALTER FUNCTION "public"."is_admin"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_call_center_manager"("user_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_uuid AND role = 'call_center_manager' AND status = 'active'
  );
END;
$$;


ALTER FUNCTION "public"."is_call_center_manager"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_ceo"("user_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_uuid AND role = 'ceo' AND status = 'active'
  );
END;
$$;


ALTER FUNCTION "public"."is_ceo"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_contact_available"("p_available_days" integer[], "p_available_hours_start" time without time zone, "p_available_hours_end" time without time zone, "p_on_vacation" boolean, "p_vacation_start" "date", "p_vacation_end" "date", "p_currently_unavailable" boolean, "p_unavailable_until" timestamp with time zone, "p_check_time" timestamp with time zone DEFAULT "now"()) RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  v_day_of_week INTEGER;
  v_current_time TIME;
  v_current_date DATE;
BEGIN
  -- Extract day of week (0=Sunday, 6=Saturday)
  v_day_of_week := EXTRACT(DOW FROM p_check_time);
  v_current_time := p_check_time::TIME;
  v_current_date := p_check_time::DATE;
  
  -- Check if currently marked as unavailable
  IF p_currently_unavailable THEN
    IF p_unavailable_until IS NULL OR p_unavailable_until > p_check_time THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  -- Check if on vacation
  IF p_on_vacation THEN
    IF p_vacation_start IS NOT NULL AND p_vacation_end IS NOT NULL THEN
      IF v_current_date BETWEEN p_vacation_start AND p_vacation_end THEN
        RETURN FALSE;
      END IF;
    ELSE
      RETURN FALSE; -- If on_vacation is true but no dates, assume unavailable
    END IF;
  END IF;
  
  -- Check day of week
  IF p_available_days IS NOT NULL AND array_length(p_available_days, 1) > 0 THEN
    IF NOT (v_day_of_week = ANY(p_available_days)) THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  -- Check time range
  IF p_available_hours_start IS NOT NULL AND p_available_hours_end IS NOT NULL THEN
    -- Handle cases where end time is before start time (overnight shift)
    IF p_available_hours_end < p_available_hours_start THEN
      IF NOT (v_current_time >= p_available_hours_start OR v_current_time <= p_available_hours_end) THEN
        RETURN FALSE;
      END IF;
    ELSE
      IF NOT (v_current_time BETWEEN p_available_hours_start AND p_available_hours_end) THEN
        RETURN FALSE;
      END IF;
    END IF;
  END IF;
  
  -- If all checks passed, contact is available
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."is_contact_available"("p_available_days" integer[], "p_available_hours_start" time without time zone, "p_available_hours_end" time without time zone, "p_on_vacation" boolean, "p_vacation_start" "date", "p_vacation_end" "date", "p_currently_unavailable" boolean, "p_unavailable_until" timestamp with time zone, "p_check_time" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_contact_available"("p_available_days" integer[], "p_available_hours_start" time without time zone, "p_available_hours_end" time without time zone, "p_on_vacation" boolean, "p_vacation_start" "date", "p_vacation_end" "date", "p_currently_unavailable" boolean, "p_unavailable_until" timestamp with time zone, "p_check_time" timestamp with time zone) IS 'Check if a contact is available at a specific time based on schedule, vacation, and unavailability status';



CREATE OR REPLACE FUNCTION "public"."is_sector_manager"("user_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_uuid AND role = 'sector_manager' AND status = 'active'
  );
END;
$$;


ALTER FUNCTION "public"."is_sector_manager"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_primary_department"("user_uuid" "uuid", "dept_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- ודא שהמשתמש משוייך למחלקה הזו
  IF NOT EXISTS (
    SELECT 1 FROM user_departments 
    WHERE user_id = user_uuid AND department_id = dept_uuid
  ) THEN
    RETURN false;
  END IF;
  
  -- הסר primary מכל המחלקות של המשתמש
  UPDATE user_departments
  SET is_primary = false
  WHERE user_id = user_uuid;
  
  -- קבע את המחלקה החדשה כ-primary
  UPDATE user_departments
  SET is_primary = true
  WHERE user_id = user_uuid AND department_id = dept_uuid;
  
  -- עדכן גם ב-user_profiles לשמירת backward compatibility
  UPDATE user_profiles
  SET department_id = dept_uuid
  WHERE id = user_uuid;
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."set_primary_department"("user_uuid" "uuid", "dept_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_general_notifications_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_general_notifications_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_oncall_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_oncall_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_panic_buttons_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_panic_buttons_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_shelter_status_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_shelter_status_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_system_settings_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_system_settings_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_profiles_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_profiles_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_war_mode_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_war_mode_timestamp"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "action" character varying(50) NOT NULL,
    "resource_type" character varying(50),
    "resource_id" "uuid",
    "details" "jsonb",
    "ip_address" character varying(50),
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."call_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "municipality_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "icon" "text",
    "description" "text",
    "instructions" "text",
    "warning" "text",
    "auto_message" "text",
    "additional_info" "text",
    "display_order" integer DEFAULT 0,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "escalation_type" "text" DEFAULT 'sequential'::"text" NOT NULL,
    CONSTRAINT "call_categories_escalation_type_check" CHECK (("escalation_type" = ANY (ARRAY['sequential'::"text", 'parallel'::"text"])))
);


ALTER TABLE "public"."call_categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."call_categories" IS 'Categories of calls that operators handle (emergency, water, electricity, etc.)';



CREATE TABLE IF NOT EXISTS "public"."call_category_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "call_category_id" "uuid" NOT NULL,
    "contact_id" "uuid",
    "external_name" "text",
    "external_phone" "text",
    "external_role" "text",
    "escalation_order" integer DEFAULT 1 NOT NULL,
    "note" "text",
    "hours" "text",
    "is_primary" boolean DEFAULT false,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "available_days" integer[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6],
    "available_hours_start" time without time zone,
    "available_hours_end" time without time zone,
    "on_vacation" boolean DEFAULT false,
    "vacation_start" "date",
    "vacation_end" "date",
    "vacation_reason" "text",
    "currently_unavailable" boolean DEFAULT false,
    "unavailable_until" timestamp with time zone,
    "unavailable_reason" "text",
    "contact_type" "text" DEFAULT 'escalation'::"text",
    "priority_order" integer DEFAULT 1,
    "notes_for_operator" "text",
    "shabbat_observer" boolean DEFAULT false NOT NULL,
    "replacement_contact_id" "uuid",
    "replacement_note" "text",
    CONSTRAINT "call_category_contacts_contact_type_check" CHECK (("contact_type" = ANY (ARRAY['escalation'::"text", 'notification'::"text"])))
);


ALTER TABLE "public"."call_category_contacts" OWNER TO "postgres";


COMMENT ON TABLE "public"."call_category_contacts" IS 'Contacts associated with each category, with escalation order';



COMMENT ON COLUMN "public"."call_category_contacts"."available_days" IS 'Days of week when contact is available (0=Sunday, 6=Saturday)';



COMMENT ON COLUMN "public"."call_category_contacts"."available_hours_start" IS 'Start time of availability (NULL = available all day)';



COMMENT ON COLUMN "public"."call_category_contacts"."available_hours_end" IS 'End time of availability (NULL = available all day)';



COMMENT ON COLUMN "public"."call_category_contacts"."on_vacation" IS 'Is contact currently on vacation/leave';



COMMENT ON COLUMN "public"."call_category_contacts"."vacation_start" IS 'Vacation start date';



COMMENT ON COLUMN "public"."call_category_contacts"."vacation_end" IS 'Vacation end date';



COMMENT ON COLUMN "public"."call_category_contacts"."currently_unavailable" IS 'Temporarily marked as unavailable by operator';



COMMENT ON COLUMN "public"."call_category_contacts"."unavailable_until" IS 'Unavailable until this timestamp (NULL = indefinite)';



COMMENT ON COLUMN "public"."call_category_contacts"."contact_type" IS 'escalation = להקפצה, notification = לעדכון בלבד';



COMMENT ON COLUMN "public"."call_category_contacts"."priority_order" IS 'Priority within the same time slot (1 = first, 2 = second, etc.)';



COMMENT ON COLUMN "public"."call_category_contacts"."notes_for_operator" IS 'Special notes for the operator (e.g., "Only for 3+ lights", "In case of danger")';



CREATE TABLE IF NOT EXISTS "public"."call_category_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "call_category_id" "uuid" NOT NULL,
    "rule_type" "text" NOT NULL,
    "rule_text" "text" NOT NULL,
    "display_order" integer DEFAULT 0,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."call_category_rules" OWNER TO "postgres";


COMMENT ON TABLE "public"."call_category_rules" IS 'Rules and guidelines for each category';



CREATE TABLE IF NOT EXISTS "public"."call_category_subcategories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "call_category_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "display_order" integer DEFAULT 0,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."call_category_subcategories" OWNER TO "postgres";


COMMENT ON TABLE "public"."call_category_subcategories" IS 'Subcategories within a main category';



CREATE TABLE IF NOT EXISTS "public"."call_category_subcategory_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subcategory_id" "uuid" NOT NULL,
    "contact_id" "uuid",
    "external_name" "text",
    "external_phone" "text",
    "external_role" "text",
    "escalation_order" integer DEFAULT 1 NOT NULL,
    "note" "text",
    "hours" "text",
    "is_primary" boolean DEFAULT false,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "available_days" integer[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6],
    "available_hours_start" time without time zone,
    "available_hours_end" time without time zone,
    "on_vacation" boolean DEFAULT false,
    "vacation_start" "date",
    "vacation_end" "date",
    "vacation_reason" "text",
    "currently_unavailable" boolean DEFAULT false,
    "unavailable_until" timestamp with time zone,
    "unavailable_reason" "text"
);


ALTER TABLE "public"."call_category_subcategory_contacts" OWNER TO "postgres";


COMMENT ON TABLE "public"."call_category_subcategory_contacts" IS 'Contacts for subcategories';



CREATE TABLE IF NOT EXISTS "public"."call_center_schedule" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_id" "uuid",
    "shift_id" "uuid",
    "staff_id" "uuid",
    "staff_name" "text",
    "week_start" "date" NOT NULL,
    "day_of_week" integer NOT NULL,
    "position" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "call_center_schedule_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."call_center_schedule" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."call_center_shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_id" "uuid",
    "name" "text" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."call_center_shifts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."call_center_staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_id" "uuid",
    "full_name" "text" NOT NULL,
    "role" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "is_active" boolean DEFAULT true,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."call_center_staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_id" "uuid",
    "full_name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "role" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "shabbat_observer" boolean DEFAULT false
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_updates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "municipality_id" "uuid",
    "title" character varying(200) NOT NULL,
    "description" "text",
    "type" character varying(50) NOT NULL,
    "address" "text",
    "lat" numeric(10,8),
    "lng" numeric(11,8),
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."daily_updates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "display_order" integer DEFAULT 0,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "manager_name" "text",
    "manager_phone" "text",
    "municipality_id" "uuid"
);


ALTER TABLE "public"."departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."duty_roster" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid",
    "department_id" "uuid",
    "day_of_week" integer NOT NULL,
    "start_hour" integer NOT NULL,
    "end_hour" integer NOT NULL,
    "notes" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "week_start_date" "date" DEFAULT (CURRENT_DATE - (EXTRACT(dow FROM CURRENT_DATE))::integer),
    CONSTRAINT "valid_day" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6))),
    CONSTRAINT "valid_hours" CHECK ((("start_hour" >= 0) AND ("start_hour" <= 23) AND ("end_hour" >= 0) AND ("end_hour" <= 23)))
);


ALTER TABLE "public"."duty_roster" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emergency_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" character varying(200) NOT NULL,
    "description" "text",
    "severity" character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    "status" character varying(20) DEFAULT 'active'::character varying NOT NULL,
    "invite_token" character varying(20) NOT NULL,
    "created_by" "uuid",
    "created_by_name" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "closed_at" timestamp with time zone,
    "closed_by" "uuid",
    "closed_by_name" character varying(100),
    "event_type" character varying(50) DEFAULT 'general'::character varying,
    "dashboard_data" "jsonb" DEFAULT '{}'::"jsonb",
    "summary" "text",
    "stats_cache" "jsonb" DEFAULT '{}'::"jsonb",
    "event_locations" "jsonb" DEFAULT '[]'::"jsonb",
    "road_blocks" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "emergency_events_severity_check" CHECK ((("severity")::"text" = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::"text"[]))),
    CONSTRAINT "emergency_events_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['active'::character varying, 'closed'::character varying])::"text"[])))
);


ALTER TABLE "public"."emergency_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_journal" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "participant_id" "uuid",
    "author_name" character varying(100) NOT NULL,
    "author_role" character varying(100),
    "entry_type" character varying(20) DEFAULT 'update'::character varying NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "image_url" "text",
    "is_pinned" boolean DEFAULT false,
    "assigned_to" "text",
    "task_status" character varying(20) DEFAULT NULL::character varying,
    "location_lat" double precision,
    "location_lng" double precision,
    "location_address" "text",
    "marker_category" character varying(30) DEFAULT 'info'::character varying,
    "author_field_status" character varying(20),
    CONSTRAINT "event_journal_author_field_status_check" CHECK ((("author_field_status" IS NULL) OR (("author_field_status")::"text" = ANY ((ARRAY['ready'::character varying, 'on_way'::character varying, 'arrived'::character varying, 'working'::character varying, 'done'::character varying, 'returned'::character varying])::"text"[])))),
    CONSTRAINT "event_journal_entry_type_check" CHECK ((("entry_type")::"text" = ANY ((ARRAY['update'::character varying, 'urgent'::character varying, 'decision'::character varying, 'task'::character varying, 'system'::character varying, 'location'::character varying, 'quick'::character varying, 'map_marker'::character varying])::"text"[]))),
    CONSTRAINT "event_journal_marker_category_check" CHECK ((("marker_category" IS NULL) OR (("marker_category")::"text" = ANY ((ARRAY['road_block'::character varying, 'danger'::character varying, 'shrapnel'::character varying, 'person'::character varying, 'medical'::character varying, 'info'::character varying])::"text"[])))),
    CONSTRAINT "event_journal_task_status_check" CHECK ((("task_status" IS NULL) OR (("task_status")::"text" = ANY ((ARRAY['pending'::character varying, 'in_progress'::character varying, 'done'::character varying])::"text"[]))))
);


ALTER TABLE "public"."event_journal" OWNER TO "postgres";


COMMENT ON COLUMN "public"."event_journal"."marker_category" IS 'קטגוריית סימון מפה: road_block=חסימה, danger=סכנה, shrapnel=רסיס, person=אדם, medical=רפואי, info=מידע';



CREATE TABLE IF NOT EXISTS "public"."event_participants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "contact_id" "uuid",
    "user_id" "uuid",
    "guest_name" character varying(100),
    "guest_phone" character varying(20),
    "display_name" character varying(100) NOT NULL,
    "phone" character varying(20),
    "role" character varying(100),
    "department" character varying(100),
    "status" character varying(20) DEFAULT 'confirmed'::character varying NOT NULL,
    "is_online" boolean DEFAULT false,
    "last_seen" timestamp with time zone DEFAULT "now"(),
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "field_status" character varying(30) DEFAULT NULL::character varying,
    "field_status_updated_at" timestamp with time zone DEFAULT "now"(),
    "current_location_lat" double precision,
    "current_location_lng" double precision,
    CONSTRAINT "event_participants_field_status_check" CHECK ((("field_status")::"text" = ANY ((ARRAY['ready'::character varying, 'on_way'::character varying, 'arrived'::character varying, 'working'::character varying, 'done'::character varying, 'returned'::character varying, NULL::character varying])::"text"[]))),
    CONSTRAINT "event_participants_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'declined'::character varying])::"text"[])))
);


ALTER TABLE "public"."event_participants" OWNER TO "postgres";


COMMENT ON COLUMN "public"."event_participants"."field_status" IS 'סטטוס שטח: confirmed=אישר, on_way=בדרך, arrived=הגיע, working=עובד, completed=סיים, returned=חזר';



CREATE TABLE IF NOT EXISTS "public"."garbage_collection_schedule" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "street_name" "text" NOT NULL,
    "street_name_alt" "text",
    "collection_day" "text" NOT NULL,
    "collection_day_hebrew" "text" NOT NULL,
    "collection_time" "text" DEFAULT '06:00-14:00'::"text",
    "collection_type" "text" DEFAULT 'גזם'::"text",
    "zone" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "takeout_day_hebrew" "text"
);


ALTER TABLE "public"."garbage_collection_schedule" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."general_notifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" character varying(200) NOT NULL,
    "message" "text" NOT NULL,
    "type" character varying(20) DEFAULT 'info'::character varying NOT NULL,
    "author" character varying(100) DEFAULT 'מוקדן'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "expires_at" timestamp with time zone
);


ALTER TABLE "public"."general_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inspection_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "inspector_name" character varying(120) NOT NULL,
    "zone" character varying(20) NOT NULL,
    "location_type" character varying(50) NOT NULL,
    "location_name" character varying(200) NOT NULL,
    "location_address" character varying(300),
    "description" "text" NOT NULL,
    "status" character varying(20) DEFAULT 'open'::character varying NOT NULL,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inspection_reports_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['open'::character varying, 'resolved'::character varying])::"text"[])))
);


ALTER TABLE "public"."inspection_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_base" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "category" "text" DEFAULT 'כללי'::"text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "contacts" "jsonb" DEFAULT '[]'::"jsonb",
    "created_by" "text",
    "updated_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."knowledge_base" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_chat_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_name" "text",
    "question" "text" NOT NULL,
    "answer" "text" NOT NULL,
    "sources" "uuid"[] DEFAULT '{}'::"uuid"[],
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."knowledge_chat_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."municipalities" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "code" character varying(50) NOT NULL,
    "logo_url" "text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."municipalities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."on_call_contacts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "municipality_id" "uuid",
    "department_id" "uuid",
    "name" character varying(100) NOT NULL,
    "phone" character varying(20) NOT NULL,
    "email" character varying(100),
    "is_external" boolean DEFAULT false,
    "external_company" character varying(100),
    "is_default" boolean DEFAULT false,
    "notes" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "role_description" "text",
    "priority" integer DEFAULT 1,
    "escalation_instructions" "text",
    "fallback_contact_id" "uuid",
    "available_hours" character varying(50) DEFAULT '24/7'::character varying,
    "on_vacation" boolean DEFAULT false,
    "vacation_start" "date",
    "vacation_end" "date",
    "vacation_reason" "text",
    "replacement_contact_id" "uuid",
    "replacement_note" "text"
);


ALTER TABLE "public"."on_call_contacts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."on_call_contacts"."role_description" IS 'תיאור תפקיד הכונן - למשל "כונן ראשון לטיפול בתקלות"';



COMMENT ON COLUMN "public"."on_call_contacts"."priority" IS 'סדר עדיפות - 1 = ראשון, 2 = שני, וכו';



COMMENT ON COLUMN "public"."on_call_contacts"."escalation_instructions" IS 'הוראות הקפצה - מה לעשות אם הכונן לא זמין';



COMMENT ON COLUMN "public"."on_call_contacts"."fallback_contact_id" IS 'כונן גיבוי - אליו להתקשר אם הכונן הראשי לא זמין';



COMMENT ON COLUMN "public"."on_call_contacts"."available_hours" IS 'שעות זמינות - למשל "24/7" או "08:00-17:00"';



CREATE TABLE IF NOT EXISTS "public"."on_call_shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "shift_date" "date" NOT NULL,
    "shift_type" "text" DEFAULT 'יום'::"text",
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "contact_id" "uuid",
    "reason" character varying(200),
    "start_date" "date",
    "end_date" "date",
    "days_of_week" "jsonb" DEFAULT '[0, 1, 2, 3, 4, 5, 6]'::"jsonb",
    "time_start" time without time zone,
    "time_end" time without time zone,
    "description" "text",
    CONSTRAINT "on_call_shifts_shift_type_check" CHECK (("shift_type" = ANY (ARRAY['יום'::"text", 'לילה'::"text", '24 שעות'::"text"])))
);


ALTER TABLE "public"."on_call_shifts" OWNER TO "postgres";


COMMENT ON TABLE "public"."on_call_shifts" IS 'משמרות כוננים מכלול - ניהול משמרות';



COMMENT ON COLUMN "public"."on_call_shifts"."start_date" IS 'תאריך התחלה - NULL = מיד';



COMMENT ON COLUMN "public"."on_call_shifts"."end_date" IS 'תאריך סיום - NULL = ללא הגבלה';



COMMENT ON COLUMN "public"."on_call_shifts"."days_of_week" IS 'ימים בשבוע - מערך של מספרים: 0=ראשון, 6=שבת. דוגמה: [0,1,2,3,4] = א-ה';



COMMENT ON COLUMN "public"."on_call_shifts"."time_start" IS 'שעת התחלה - NULL = כל היום. דוגמה: 08:00';



COMMENT ON COLUMN "public"."on_call_shifts"."time_end" IS 'שעת סיום - NULL = כל היום. דוגמה: 20:00';



COMMENT ON COLUMN "public"."on_call_shifts"."description" IS 'תיאור המשמרת - למשל "משמרת יום" או "כוננות שבת"';



CREATE TABLE IF NOT EXISTS "public"."operator_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid",
    "message_text" "text" NOT NULL,
    "target_role" "text",
    "is_urgent" boolean DEFAULT false,
    "read_by" "uuid"[],
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."operator_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."operator_messages" IS 'הודעות למוקדנים מהמנהלת';



CREATE TABLE IF NOT EXISTS "public"."operator_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "session_start" timestamp with time zone DEFAULT "now"(),
    "session_end" timestamp with time zone,
    "last_activity" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."operator_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."operator_sessions" IS 'סשנים פעילים של מוקדנים - למעקב מי מחובר';



CREATE TABLE IF NOT EXISTS "public"."operator_shifts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "municipality_id" "uuid",
    "operator_id" "uuid",
    "shift_date" "date" NOT NULL,
    "shift_type" character varying(20) NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."operator_shifts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."operator_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "assigned_to" "uuid",
    "created_by" "uuid",
    "priority" "text" DEFAULT 'בינוני'::"text",
    "status" "text" DEFAULT 'ממתין'::"text",
    "due_date" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "municipality_id" "uuid",
    CONSTRAINT "operator_tasks_priority_check" CHECK (("priority" = ANY (ARRAY['דחוף'::"text", 'גבוה'::"text", 'בינוני'::"text", 'נמוך'::"text"]))),
    CONSTRAINT "operator_tasks_status_check" CHECK (("status" = ANY (ARRAY['ממתין'::"text", 'בטיפול'::"text", 'הושלם'::"text", 'בוטל'::"text"])))
);


ALTER TABLE "public"."operator_tasks" OWNER TO "postgres";


COMMENT ON TABLE "public"."operator_tasks" IS 'משימות למוקדנים - ניהול ע"י מנהלת מוקד';



CREATE TABLE IF NOT EXISTS "public"."panic_buttons" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(200) NOT NULL,
    "category" character varying(50) DEFAULT 'other'::character varying NOT NULL,
    "address" "text" NOT NULL,
    "directions" "text",
    "contacts" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "operator_instructions" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "municipality_id" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."panic_buttons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."password_resets" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "must_change_password" boolean DEFAULT true NOT NULL,
    "reset_by" "uuid" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."password_resets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sector_daily_tasks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "task_date" "date" NOT NULL,
    "staff_id" "uuid",
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "vehicle" "text",
    "tasks" "text"[],
    "notes" "text",
    "is_backup" boolean DEFAULT false,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."sector_daily_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sector_staff" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "full_name" "text" NOT NULL,
    "role" "text" NOT NULL,
    "phone" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "sector_staff_role_check" CHECK (("role" = ANY (ARRAY['פיקוח עירוני'::"text", 'שיטור עירוני'::"text"])))
);


ALTER TABLE "public"."sector_staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sector_weekly_schedule" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "week_start_date" "date" NOT NULL,
    "day_of_week" integer NOT NULL,
    "staff_id" "uuid",
    "shift_type" "text",
    "start_time" time without time zone,
    "end_time" time without time zone,
    "vehicle" "text",
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "sector_weekly_schedule_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."sector_weekly_schedule" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_daily_order_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "staff_id" "uuid",
    "staff_name" "text",
    "category" "text" DEFAULT 'פיקוח'::"text" NOT NULL,
    "role_title" "text" DEFAULT 'פיקוח עירוני'::"text",
    "vehicle" "text",
    "start_time" "text" NOT NULL,
    "end_time" "text" NOT NULL,
    "is_backup" boolean DEFAULT false,
    "tasks" "jsonb" DEFAULT '[]'::"jsonb",
    "special_notes" "text",
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_removed" boolean DEFAULT false,
    "is_modified" boolean DEFAULT false,
    "original_start_time" character varying(10),
    "original_end_time" character varying(10),
    "modification_note" "text",
    "original_staff_name" "text",
    "original_staff_id" "uuid"
);


ALTER TABLE "public"."security_daily_order_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_daily_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_id" "uuid",
    "order_date" "date" NOT NULL,
    "general_notes" "text",
    "signoff_message" "text" DEFAULT 'יום טוב לכולם, סעו בזהירות, שמרו על עצמכם'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."security_daily_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_id" "uuid",
    "setting_key" "text" NOT NULL,
    "setting_value" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."security_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_shift_changes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "entry_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "staff_id" "uuid",
    "staff_name" character varying(100),
    "change_type" character varying(50) NOT NULL,
    "original_start_time" character varying(10),
    "original_end_time" character varying(10),
    "new_start_time" character varying(10),
    "new_end_time" character varying(10),
    "reason" "text",
    "requested_by" character varying(100) DEFAULT 'מחלקת ביטחון'::character varying,
    "changed_by" character varying(100) DEFAULT 'מוקד עירוני'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."security_shift_changes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_id" "uuid",
    "category" "text" DEFAULT 'פיקוח'::"text" NOT NULL,
    "name" "text" NOT NULL,
    "start_time" "text" NOT NULL,
    "end_time" "text" NOT NULL,
    "display_order" integer DEFAULT 0,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."security_shifts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_id" "uuid",
    "full_name" "text" NOT NULL,
    "phone" "text",
    "role" "text" DEFAULT 'פיקוח'::"text" NOT NULL,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."security_staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_staff_leave" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_id" "uuid",
    "staff_id" "uuid",
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "reason" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."security_staff_leave" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_weekly_schedule" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "department_id" "uuid",
    "shift_id" "uuid",
    "staff_id" "uuid",
    "week_start" "date" NOT NULL,
    "day_of_week" integer NOT NULL,
    "is_backup" boolean DEFAULT false,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "staff_name" "text",
    CONSTRAINT "security_weekly_schedule_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."security_weekly_schedule" OWNER TO "postgres";


COMMENT ON COLUMN "public"."security_weekly_schedule"."staff_name" IS 'שם ידני לעובד שאינו ברשימה הרשמית (מתלמד, זמני וכו׳)';



CREATE TABLE IF NOT EXISTS "public"."shelter_status" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "shelter_number" character varying(20) NOT NULL,
    "is_open" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" character varying(100) DEFAULT 'מוקדן'::character varying
);


ALTER TABLE "public"."shelter_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shift_messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "municipality_id" "uuid",
    "from_user" "uuid",
    "to_user" "uuid",
    "message" "text" NOT NULL,
    "related_task_id" "uuid",
    "read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shift_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."survey_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "survey_id" "uuid",
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "respondent_name" "text",
    "respondent_ip" "text",
    "q1_courtesy" integer,
    "q2_professional" integer,
    "q3_helpful" integer,
    "q4_problem_solving" integer,
    "improvements_text" "text",
    CONSTRAINT "survey_responses_q1_courtesy_check" CHECK (((("q1_courtesy" >= 1) AND ("q1_courtesy" <= 4)) OR ("q1_courtesy" IS NULL))),
    CONSTRAINT "survey_responses_q2_professional_check" CHECK (((("q2_professional" >= 1) AND ("q2_professional" <= 4)) OR ("q2_professional" IS NULL))),
    CONSTRAINT "survey_responses_q3_helpful_check" CHECK (((("q3_helpful" >= 1) AND ("q3_helpful" <= 4)) OR ("q3_helpful" IS NULL))),
    CONSTRAINT "survey_responses_q4_problem_solving_check" CHECK (((("q4_problem_solving" >= 1) AND ("q4_problem_solving" <= 4)) OR ("q4_problem_solving" IS NULL)))
);


ALTER TABLE "public"."survey_responses" OWNER TO "postgres";


COMMENT ON TABLE "public"."survey_responses" IS 'Responses to satisfaction surveys - can be anonymous or named';



CREATE TABLE IF NOT EXISTS "public"."surveys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "title" "text" NOT NULL,
    "token" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "closed_at" timestamp with time zone,
    CONSTRAINT "surveys_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."surveys" OWNER TO "postgres";


COMMENT ON TABLE "public"."surveys" IS 'Survey satisfaction surveys created by call center managers';



CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "key" character varying(50) NOT NULL,
    "value" "jsonb" NOT NULL,
    "description" "text",
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_departments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "department_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "full_name" character varying(100) NOT NULL,
    "phone" character varying(20),
    "avatar_url" character varying(500),
    "role" character varying(20) DEFAULT 'operator'::character varying NOT NULL,
    "department_id" "uuid",
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "must_change_password" boolean DEFAULT false,
    "municipality_id" "uuid",
    CONSTRAINT "valid_role" CHECK ((("role")::"text" = ANY ((ARRAY['ceo'::character varying, 'call_center_manager'::character varying, 'sector_manager'::character varying, 'operator'::character varying, 'admin'::character varying, 'inspector'::character varying, 'shelter_manager'::character varying])::"text"[]))),
    CONSTRAINT "valid_status" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'active'::character varying, 'suspended'::character varying])::"text"[])))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_profiles"."must_change_password" IS 'האם המשתמש חייב לשנות את הסיסמה בהתחברות הבאה';



CREATE TABLE IF NOT EXISTS "public"."war_mode" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "activated_at" timestamp with time zone,
    "activated_by" "text",
    "deactivated_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."war_mode" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."call_categories"
    ADD CONSTRAINT "call_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."call_category_contacts"
    ADD CONSTRAINT "call_category_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."call_category_rules"
    ADD CONSTRAINT "call_category_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."call_category_subcategories"
    ADD CONSTRAINT "call_category_subcategories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."call_category_subcategory_contacts"
    ADD CONSTRAINT "call_category_subcategory_con_subcategory_id_escalation_ord_key" UNIQUE ("subcategory_id", "escalation_order");



ALTER TABLE ONLY "public"."call_category_subcategory_contacts"
    ADD CONSTRAINT "call_category_subcategory_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."call_center_schedule"
    ADD CONSTRAINT "call_center_schedule_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."call_center_shifts"
    ADD CONSTRAINT "call_center_shifts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."call_center_staff"
    ADD CONSTRAINT "call_center_staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_updates"
    ADD CONSTRAINT "daily_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."duty_roster"
    ADD CONSTRAINT "duty_roster_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emergency_events"
    ADD CONSTRAINT "emergency_events_invite_token_key" UNIQUE ("invite_token");



ALTER TABLE ONLY "public"."emergency_events"
    ADD CONSTRAINT "emergency_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_journal"
    ADD CONSTRAINT "event_journal_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_participants"
    ADD CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."garbage_collection_schedule"
    ADD CONSTRAINT "garbage_collection_schedule_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."general_notifications"
    ADD CONSTRAINT "general_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inspection_reports"
    ADD CONSTRAINT "inspection_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_base"
    ADD CONSTRAINT "knowledge_base_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_chat_history"
    ADD CONSTRAINT "knowledge_chat_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."municipalities"
    ADD CONSTRAINT "municipalities_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."municipalities"
    ADD CONSTRAINT "municipalities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."on_call_contacts"
    ADD CONSTRAINT "on_call_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."on_call_shifts"
    ADD CONSTRAINT "on_call_shifts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operator_messages"
    ADD CONSTRAINT "operator_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operator_sessions"
    ADD CONSTRAINT "operator_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operator_shifts"
    ADD CONSTRAINT "operator_shifts_operator_id_shift_date_shift_type_key" UNIQUE ("operator_id", "shift_date", "shift_type");



ALTER TABLE ONLY "public"."operator_shifts"
    ADD CONSTRAINT "operator_shifts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operator_tasks"
    ADD CONSTRAINT "operator_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."panic_buttons"
    ADD CONSTRAINT "panic_buttons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_resets"
    ADD CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sector_daily_tasks"
    ADD CONSTRAINT "sector_daily_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sector_staff"
    ADD CONSTRAINT "sector_staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sector_weekly_schedule"
    ADD CONSTRAINT "sector_weekly_schedule_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sector_weekly_schedule"
    ADD CONSTRAINT "sector_weekly_schedule_week_start_date_day_of_week_staff_id_key" UNIQUE ("week_start_date", "day_of_week", "staff_id", "start_time");



ALTER TABLE ONLY "public"."security_daily_order_entries"
    ADD CONSTRAINT "security_daily_order_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_daily_orders"
    ADD CONSTRAINT "security_daily_orders_department_id_order_date_key" UNIQUE ("department_id", "order_date");



ALTER TABLE ONLY "public"."security_daily_orders"
    ADD CONSTRAINT "security_daily_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_settings"
    ADD CONSTRAINT "security_settings_department_id_setting_key_key" UNIQUE ("department_id", "setting_key");



ALTER TABLE ONLY "public"."security_settings"
    ADD CONSTRAINT "security_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_shift_changes"
    ADD CONSTRAINT "security_shift_changes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_shifts"
    ADD CONSTRAINT "security_shifts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_staff_leave"
    ADD CONSTRAINT "security_staff_leave_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_staff"
    ADD CONSTRAINT "security_staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_weekly_schedule"
    ADD CONSTRAINT "security_weekly_schedule_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shelter_status"
    ADD CONSTRAINT "shelter_number_unique" UNIQUE ("shelter_number");



ALTER TABLE ONLY "public"."shelter_status"
    ADD CONSTRAINT "shelter_status_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shift_messages"
    ADD CONSTRAINT "shift_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."survey_responses"
    ADD CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."surveys"
    ADD CONSTRAINT "surveys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."surveys"
    ADD CONSTRAINT "surveys_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."user_departments"
    ADD CONSTRAINT "user_departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_departments"
    ADD CONSTRAINT "user_departments_user_id_department_id_key" UNIQUE ("user_id", "department_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."war_mode"
    ADD CONSTRAINT "war_mode_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_audit_log_action" ON "public"."audit_log" USING "btree" ("action");



CREATE INDEX "idx_audit_log_created" ON "public"."audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_audit_log_resource" ON "public"."audit_log" USING "btree" ("resource_type", "resource_id");



CREATE INDEX "idx_audit_log_user" ON "public"."audit_log" USING "btree" ("user_id");



CREATE INDEX "idx_call_categories_active" ON "public"."call_categories" USING "btree" ("active");



CREATE INDEX "idx_call_categories_municipality" ON "public"."call_categories" USING "btree" ("municipality_id");



CREATE INDEX "idx_call_categories_order" ON "public"."call_categories" USING "btree" ("display_order");



CREATE INDEX "idx_call_category_contacts_category" ON "public"."call_category_contacts" USING "btree" ("call_category_id");



CREATE INDEX "idx_call_category_contacts_contact" ON "public"."call_category_contacts" USING "btree" ("contact_id");



CREATE INDEX "idx_call_category_contacts_order" ON "public"."call_category_contacts" USING "btree" ("escalation_order");



CREATE INDEX "idx_call_category_contacts_priority" ON "public"."call_category_contacts" USING "btree" ("priority_order");



CREATE INDEX "idx_call_category_contacts_type" ON "public"."call_category_contacts" USING "btree" ("contact_type");



CREATE INDEX "idx_call_category_contacts_unavailable" ON "public"."call_category_contacts" USING "btree" ("currently_unavailable") WHERE ("currently_unavailable" = true);



CREATE INDEX "idx_call_category_contacts_vacation" ON "public"."call_category_contacts" USING "btree" ("on_vacation") WHERE ("on_vacation" = true);



CREATE INDEX "idx_call_category_rules_category" ON "public"."call_category_rules" USING "btree" ("call_category_id");



CREATE INDEX "idx_call_category_rules_type" ON "public"."call_category_rules" USING "btree" ("rule_type");



CREATE INDEX "idx_call_category_subcategories_category" ON "public"."call_category_subcategories" USING "btree" ("call_category_id");



CREATE INDEX "idx_call_category_subcategory_contacts_contact" ON "public"."call_category_subcategory_contacts" USING "btree" ("contact_id");



CREATE INDEX "idx_call_category_subcategory_contacts_sub" ON "public"."call_category_subcategory_contacts" USING "btree" ("subcategory_id");



CREATE INDEX "idx_call_center_schedule_day" ON "public"."call_center_schedule" USING "btree" ("shift_id", "week_start", "day_of_week");



CREATE INDEX "idx_call_center_schedule_week" ON "public"."call_center_schedule" USING "btree" ("department_id", "week_start");



CREATE INDEX "idx_call_center_shifts_dept" ON "public"."call_center_shifts" USING "btree" ("department_id");



CREATE INDEX "idx_call_center_staff_dept" ON "public"."call_center_staff" USING "btree" ("department_id");



CREATE INDEX "idx_chat_history_date" ON "public"."knowledge_chat_history" USING "btree" ("created_at");



CREATE INDEX "idx_contacts_department" ON "public"."contacts" USING "btree" ("department_id");



CREATE INDEX "idx_daily_order_entries_order" ON "public"."security_daily_order_entries" USING "btree" ("order_id");



CREATE INDEX "idx_daily_orders_dept_date" ON "public"."security_daily_orders" USING "btree" ("department_id", "order_date");



CREATE INDEX "idx_daily_tasks_date" ON "public"."sector_daily_tasks" USING "btree" ("task_date");



CREATE INDEX "idx_daily_updates_active" ON "public"."daily_updates" USING "btree" ("municipality_id", "start_time", "end_time");



CREATE INDEX "idx_daily_updates_history" ON "public"."daily_updates" USING "btree" ("municipality_id", "created_at" DESC);



CREATE INDEX "idx_daily_updates_location" ON "public"."daily_updates" USING "btree" ("municipality_id", "lat", "lng") WHERE (("lat" IS NOT NULL) AND ("lng" IS NOT NULL));



CREATE INDEX "idx_duty_roster_contact" ON "public"."duty_roster" USING "btree" ("contact_id");



CREATE INDEX "idx_duty_roster_day_hour" ON "public"."duty_roster" USING "btree" ("day_of_week", "start_hour", "end_hour");



CREATE INDEX "idx_duty_roster_department" ON "public"."duty_roster" USING "btree" ("department_id");



CREATE INDEX "idx_duty_roster_week" ON "public"."duty_roster" USING "btree" ("week_start_date", "department_id");



CREATE INDEX "idx_emergency_events_created_at" ON "public"."emergency_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_emergency_events_event_locations" ON "public"."emergency_events" USING "gin" ("event_locations");



CREATE INDEX "idx_emergency_events_invite_token" ON "public"."emergency_events" USING "btree" ("invite_token");



CREATE INDEX "idx_emergency_events_road_blocks" ON "public"."emergency_events" USING "gin" ("road_blocks");



CREATE INDEX "idx_emergency_events_status" ON "public"."emergency_events" USING "btree" ("status");



CREATE INDEX "idx_event_journal_author_status" ON "public"."event_journal" USING "btree" ("event_id", "author_field_status") WHERE ("author_field_status" IS NOT NULL);



CREATE INDEX "idx_event_journal_created_at" ON "public"."event_journal" USING "btree" ("event_id", "created_at" DESC);



CREATE INDEX "idx_event_journal_event" ON "public"."event_journal" USING "btree" ("event_id");



CREATE INDEX "idx_event_participants_event" ON "public"."event_participants" USING "btree" ("event_id");



CREATE INDEX "idx_event_participants_field_status" ON "public"."event_participants" USING "btree" ("event_id", "field_status");



CREATE INDEX "idx_event_participants_phone" ON "public"."event_participants" USING "btree" ("phone");



CREATE UNIQUE INDEX "idx_event_participants_unique_phone" ON "public"."event_participants" USING "btree" ("event_id", "phone");



CREATE INDEX "idx_garbage_active" ON "public"."garbage_collection_schedule" USING "btree" ("is_active");



CREATE INDEX "idx_garbage_day" ON "public"."garbage_collection_schedule" USING "btree" ("collection_day");



CREATE INDEX "idx_garbage_street" ON "public"."garbage_collection_schedule" USING "btree" ("street_name");



CREATE INDEX "idx_garbage_type" ON "public"."garbage_collection_schedule" USING "btree" ("collection_type");



CREATE INDEX "idx_garbage_zone" ON "public"."garbage_collection_schedule" USING "btree" ("zone");



CREATE INDEX "idx_general_notifications_created_at" ON "public"."general_notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_general_notifications_end_date" ON "public"."general_notifications" USING "btree" ("end_date");



CREATE INDEX "idx_general_notifications_expires_at" ON "public"."general_notifications" USING "btree" ("expires_at");



CREATE INDEX "idx_general_notifications_start_date" ON "public"."general_notifications" USING "btree" ("start_date");



CREATE INDEX "idx_general_notifications_type" ON "public"."general_notifications" USING "btree" ("type");



CREATE INDEX "idx_inspection_reports_status" ON "public"."inspection_reports" USING "btree" ("status");



CREATE INDEX "idx_inspection_reports_zone" ON "public"."inspection_reports" USING "btree" ("zone");



CREATE INDEX "idx_knowledge_base_active" ON "public"."knowledge_base" USING "btree" ("is_active");



CREATE INDEX "idx_knowledge_base_category" ON "public"."knowledge_base" USING "btree" ("category");



CREATE INDEX "idx_knowledge_base_search" ON "public"."knowledge_base" USING "gin" ("to_tsvector"('"simple"'::"regconfig", (("title" || ' '::"text") || "content")));



CREATE INDEX "idx_on_call_contacts_active" ON "public"."on_call_contacts" USING "btree" ("municipality_id", "active");



CREATE INDEX "idx_on_call_contacts_default" ON "public"."on_call_contacts" USING "btree" ("department_id", "is_default") WHERE ("is_default" = true);



CREATE INDEX "idx_on_call_contacts_dept" ON "public"."on_call_contacts" USING "btree" ("department_id");



CREATE INDEX "idx_on_call_contacts_priority" ON "public"."on_call_contacts" USING "btree" ("department_id", "priority", "active");



CREATE INDEX "idx_on_call_shifts_date" ON "public"."on_call_shifts" USING "btree" ("shift_date");



CREATE INDEX "idx_on_call_shifts_dates" ON "public"."on_call_shifts" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_on_call_shifts_days" ON "public"."on_call_shifts" USING "gin" ("days_of_week");



CREATE INDEX "idx_on_call_shifts_user_id" ON "public"."on_call_shifts" USING "btree" ("user_id");



CREATE INDEX "idx_operator_messages_created_at" ON "public"."operator_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_operator_sessions_is_active" ON "public"."operator_sessions" USING "btree" ("is_active");



CREATE INDEX "idx_operator_sessions_last_activity" ON "public"."operator_sessions" USING "btree" ("last_activity" DESC);



CREATE INDEX "idx_operator_sessions_user_id" ON "public"."operator_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_operator_shifts_date" ON "public"."operator_shifts" USING "btree" ("municipality_id", "shift_date", "shift_type");



CREATE INDEX "idx_operator_shifts_operator" ON "public"."operator_shifts" USING "btree" ("operator_id", "shift_date");



CREATE INDEX "idx_operator_tasks_assigned_to" ON "public"."operator_tasks" USING "btree" ("assigned_to");



CREATE INDEX "idx_operator_tasks_created_at" ON "public"."operator_tasks" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_operator_tasks_status" ON "public"."operator_tasks" USING "btree" ("status");



CREATE INDEX "idx_panic_buttons_category" ON "public"."panic_buttons" USING "btree" ("category");



CREATE INDEX "idx_panic_buttons_is_active" ON "public"."panic_buttons" USING "btree" ("is_active");



CREATE INDEX "idx_panic_buttons_municipality" ON "public"."panic_buttons" USING "btree" ("municipality_id");



CREATE INDEX "idx_panic_buttons_name" ON "public"."panic_buttons" USING "btree" ("name");



CREATE INDEX "idx_password_resets_expires" ON "public"."password_resets" USING "btree" ("expires_at");



CREATE INDEX "idx_password_resets_user" ON "public"."password_resets" USING "btree" ("user_id");



CREATE INDEX "idx_replacement_contact" ON "public"."call_category_contacts" USING "btree" ("replacement_contact_id") WHERE ("replacement_contact_id" IS NOT NULL);



CREATE INDEX "idx_security_leave_dates" ON "public"."security_staff_leave" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_security_leave_dept" ON "public"."security_staff_leave" USING "btree" ("department_id");



CREATE INDEX "idx_security_leave_staff" ON "public"."security_staff_leave" USING "btree" ("staff_id", "start_date", "end_date");



CREATE INDEX "idx_security_schedule_shift" ON "public"."security_weekly_schedule" USING "btree" ("shift_id", "week_start", "day_of_week");



CREATE INDEX "idx_security_schedule_week" ON "public"."security_weekly_schedule" USING "btree" ("department_id", "week_start");



CREATE INDEX "idx_security_settings_dept" ON "public"."security_settings" USING "btree" ("department_id", "setting_key");



CREATE INDEX "idx_security_shifts_dept" ON "public"."security_shifts" USING "btree" ("department_id");



CREATE INDEX "idx_security_staff_dept" ON "public"."security_staff" USING "btree" ("department_id");



CREATE INDEX "idx_shelter_status_number" ON "public"."shelter_status" USING "btree" ("shelter_number");



CREATE INDEX "idx_shelter_status_updated_at" ON "public"."shelter_status" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_shift_changes_created_at" ON "public"."security_shift_changes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_shift_changes_entry_id" ON "public"."security_shift_changes" USING "btree" ("entry_id");



CREATE INDEX "idx_shift_changes_order_id" ON "public"."security_shift_changes" USING "btree" ("order_id");



CREATE INDEX "idx_shift_messages_to_user" ON "public"."shift_messages" USING "btree" ("to_user", "read", "created_at" DESC);



CREATE INDEX "idx_shift_messages_unread" ON "public"."shift_messages" USING "btree" ("to_user") WHERE ("read" = false);



CREATE INDEX "idx_survey_responses_submitted_at" ON "public"."survey_responses" USING "btree" ("submitted_at");



CREATE INDEX "idx_survey_responses_survey_id" ON "public"."survey_responses" USING "btree" ("survey_id");



CREATE INDEX "idx_surveys_status" ON "public"."surveys" USING "btree" ("status");



CREATE INDEX "idx_surveys_token" ON "public"."surveys" USING "btree" ("token");



CREATE INDEX "idx_user_departments_dept" ON "public"."user_departments" USING "btree" ("department_id");



CREATE INDEX "idx_user_departments_primary" ON "public"."user_departments" USING "btree" ("is_primary") WHERE ("is_primary" = true);



CREATE INDEX "idx_user_departments_user" ON "public"."user_departments" USING "btree" ("user_id");



CREATE INDEX "idx_user_profiles_department" ON "public"."user_profiles" USING "btree" ("department_id");



CREATE INDEX "idx_user_profiles_must_change_password" ON "public"."user_profiles" USING "btree" ("must_change_password") WHERE ("must_change_password" = true);



CREATE INDEX "idx_user_profiles_role" ON "public"."user_profiles" USING "btree" ("role");



CREATE INDEX "idx_user_profiles_status" ON "public"."user_profiles" USING "btree" ("status");



CREATE INDEX "idx_weekly_schedule_week" ON "public"."sector_weekly_schedule" USING "btree" ("week_start_date");



CREATE UNIQUE INDEX "uniq_garbage_schedule_entry" ON "public"."garbage_collection_schedule" USING "btree" ("street_name", "collection_day", "zone");



CREATE OR REPLACE TRIGGER "set_daily_updates_updated_at" BEFORE UPDATE ON "public"."daily_updates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_general_notifications_timestamp" BEFORE UPDATE ON "public"."general_notifications" FOR EACH ROW EXECUTE FUNCTION "public"."update_general_notifications_timestamp"();



CREATE OR REPLACE TRIGGER "set_municipalities_updated_at" BEFORE UPDATE ON "public"."municipalities" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_on_call_contacts_updated_at" BEFORE UPDATE ON "public"."on_call_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_operator_shifts_updated_at" BEFORE UPDATE ON "public"."operator_shifts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_panic_buttons_timestamp" BEFORE UPDATE ON "public"."panic_buttons" FOR EACH ROW EXECUTE FUNCTION "public"."update_panic_buttons_timestamp"();



CREATE OR REPLACE TRIGGER "set_shelter_status_timestamp" BEFORE UPDATE ON "public"."shelter_status" FOR EACH ROW EXECUTE FUNCTION "public"."update_shelter_status_timestamp"();



CREATE OR REPLACE TRIGGER "set_system_settings_timestamp" BEFORE UPDATE ON "public"."system_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_system_settings_timestamp"();



CREATE OR REPLACE TRIGGER "set_user_profiles_timestamp" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_profiles_timestamp"();



CREATE OR REPLACE TRIGGER "update_contacts_timestamp" BEFORE UPDATE ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_oncall_timestamp"();



CREATE OR REPLACE TRIGGER "update_departments_timestamp" BEFORE UPDATE ON "public"."departments" FOR EACH ROW EXECUTE FUNCTION "public"."update_oncall_timestamp"();



CREATE OR REPLACE TRIGGER "update_duty_roster_timestamp" BEFORE UPDATE ON "public"."duty_roster" FOR EACH ROW EXECUTE FUNCTION "public"."update_oncall_timestamp"();



CREATE OR REPLACE TRIGGER "update_on_call_shifts_updated_at" BEFORE UPDATE ON "public"."on_call_shifts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_operator_tasks_updated_at" BEFORE UPDATE ON "public"."operator_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_war_mode_timestamp" BEFORE UPDATE ON "public"."war_mode" FOR EACH ROW EXECUTE FUNCTION "public"."update_war_mode_timestamp"();



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."call_categories"
    ADD CONSTRAINT "call_categories_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_category_contacts"
    ADD CONSTRAINT "call_category_contacts_call_category_id_fkey" FOREIGN KEY ("call_category_id") REFERENCES "public"."call_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_category_contacts"
    ADD CONSTRAINT "call_category_contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."on_call_contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_category_rules"
    ADD CONSTRAINT "call_category_rules_call_category_id_fkey" FOREIGN KEY ("call_category_id") REFERENCES "public"."call_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_category_subcategories"
    ADD CONSTRAINT "call_category_subcategories_call_category_id_fkey" FOREIGN KEY ("call_category_id") REFERENCES "public"."call_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_category_subcategory_contacts"
    ADD CONSTRAINT "call_category_subcategory_contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."on_call_contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_category_subcategory_contacts"
    ADD CONSTRAINT "call_category_subcategory_contacts_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "public"."call_category_subcategories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_center_schedule"
    ADD CONSTRAINT "call_center_schedule_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_center_schedule"
    ADD CONSTRAINT "call_center_schedule_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."call_center_shifts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_center_schedule"
    ADD CONSTRAINT "call_center_schedule_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."call_center_staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."call_center_shifts"
    ADD CONSTRAINT "call_center_shifts_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_center_staff"
    ADD CONSTRAINT "call_center_staff_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_updates"
    ADD CONSTRAINT "daily_updates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."daily_updates"
    ADD CONSTRAINT "daily_updates_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_updates"
    ADD CONSTRAINT "daily_updates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."duty_roster"
    ADD CONSTRAINT "duty_roster_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."duty_roster"
    ADD CONSTRAINT "duty_roster_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emergency_events"
    ADD CONSTRAINT "emergency_events_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."emergency_events"
    ADD CONSTRAINT "emergency_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."event_journal"
    ADD CONSTRAINT "event_journal_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."emergency_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_journal"
    ADD CONSTRAINT "event_journal_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."event_participants"("id");



ALTER TABLE ONLY "public"."event_participants"
    ADD CONSTRAINT "event_participants_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id");



ALTER TABLE ONLY "public"."event_participants"
    ADD CONSTRAINT "event_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."emergency_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_participants"
    ADD CONSTRAINT "event_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "fk_departments_municipality" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operator_tasks"
    ADD CONSTRAINT "fk_operator_tasks_municipality" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_category_contacts"
    ADD CONSTRAINT "fk_replacement_contact" FOREIGN KEY ("replacement_contact_id") REFERENCES "public"."on_call_contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "fk_user_profiles_municipality" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."on_call_contacts"
    ADD CONSTRAINT "on_call_contacts_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."on_call_contacts"
    ADD CONSTRAINT "on_call_contacts_fallback_contact_id_fkey" FOREIGN KEY ("fallback_contact_id") REFERENCES "public"."on_call_contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."on_call_contacts"
    ADD CONSTRAINT "on_call_contacts_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."on_call_contacts"
    ADD CONSTRAINT "on_call_contacts_replacement_contact_id_fkey" FOREIGN KEY ("replacement_contact_id") REFERENCES "public"."on_call_contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."on_call_shifts"
    ADD CONSTRAINT "on_call_shifts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."on_call_contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."on_call_shifts"
    ADD CONSTRAINT "on_call_shifts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."on_call_shifts"
    ADD CONSTRAINT "on_call_shifts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operator_messages"
    ADD CONSTRAINT "operator_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."operator_sessions"
    ADD CONSTRAINT "operator_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operator_shifts"
    ADD CONSTRAINT "operator_shifts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."operator_shifts"
    ADD CONSTRAINT "operator_shifts_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operator_shifts"
    ADD CONSTRAINT "operator_shifts_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operator_tasks"
    ADD CONSTRAINT "operator_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."operator_tasks"
    ADD CONSTRAINT "operator_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."password_resets"
    ADD CONSTRAINT "password_resets_reset_by_fkey" FOREIGN KEY ("reset_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."password_resets"
    ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sector_daily_tasks"
    ADD CONSTRAINT "sector_daily_tasks_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."sector_staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sector_weekly_schedule"
    ADD CONSTRAINT "sector_weekly_schedule_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."sector_staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_daily_order_entries"
    ADD CONSTRAINT "security_daily_order_entries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."security_daily_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_daily_order_entries"
    ADD CONSTRAINT "security_daily_order_entries_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."security_staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."security_daily_orders"
    ADD CONSTRAINT "security_daily_orders_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_settings"
    ADD CONSTRAINT "security_settings_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_shifts"
    ADD CONSTRAINT "security_shifts_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_staff"
    ADD CONSTRAINT "security_staff_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_staff_leave"
    ADD CONSTRAINT "security_staff_leave_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_staff_leave"
    ADD CONSTRAINT "security_staff_leave_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."security_staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_weekly_schedule"
    ADD CONSTRAINT "security_weekly_schedule_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_weekly_schedule"
    ADD CONSTRAINT "security_weekly_schedule_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."security_shifts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_weekly_schedule"
    ADD CONSTRAINT "security_weekly_schedule_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."security_staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shift_messages"
    ADD CONSTRAINT "shift_messages_from_user_fkey" FOREIGN KEY ("from_user") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shift_messages"
    ADD CONSTRAINT "shift_messages_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shift_messages"
    ADD CONSTRAINT "shift_messages_related_task_id_fkey" FOREIGN KEY ("related_task_id") REFERENCES "public"."operator_tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shift_messages"
    ADD CONSTRAINT "shift_messages_to_user_fkey" FOREIGN KEY ("to_user") REFERENCES "public"."user_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."survey_responses"
    ADD CONSTRAINT "survey_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."surveys"
    ADD CONSTRAINT "surveys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_departments"
    ADD CONSTRAINT "user_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_departments"
    ADD CONSTRAINT "user_departments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "anon_read_only" ON "public"."contacts" FOR SELECT USING (true);



CREATE POLICY "anon_read_only" ON "public"."departments" FOR SELECT USING (true);



CREATE POLICY "anon_read_only" ON "public"."duty_roster" FOR SELECT USING (true);



CREATE POLICY "anon_read_only" ON "public"."user_profiles" FOR SELECT USING (true);



CREATE POLICY "anon_read_only" ON "public"."war_mode" FOR SELECT USING (true);



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."call_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."call_category_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."call_category_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."call_category_subcategories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."call_category_subcategory_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."call_center_schedule" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."call_center_shifts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."call_center_staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_updates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."duty_roster" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."emergency_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_journal" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."garbage_collection_schedule" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."general_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inspection_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_base" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_chat_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."municipalities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."on_call_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."on_call_shifts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."operator_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."operator_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."operator_shifts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."operator_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."panic_buttons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."password_resets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sector_daily_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sector_staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sector_weekly_schedule" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_daily_order_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_daily_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_shift_changes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_shifts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_staff_leave" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_weekly_schedule" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shelter_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shift_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."survey_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."surveys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."war_mode" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."contacts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."departments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."duty_roster";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."war_mode";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."add_user_to_department"("user_uuid" "uuid", "dept_uuid" "uuid", "make_primary" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."add_user_to_department"("user_uuid" "uuid", "dept_uuid" "uuid", "make_primary" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_user_to_department"("user_uuid" "uuid", "dept_uuid" "uuid", "make_primary" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."can_edit_duty_roster"("user_uuid" "uuid", "dept_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_edit_duty_roster"("user_uuid" "uuid", "dept_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_edit_duty_roster"("user_uuid" "uuid", "dept_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_survey_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_survey_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_survey_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_daily_updates"("muni_id" "uuid", "check_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_daily_updates"("muni_id" "uuid", "check_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_daily_updates"("muni_id" "uuid", "check_time" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_on_call"("dept_id" "uuid", "check_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_on_call"("dept_id" "uuid", "check_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_on_call"("dept_id" "uuid", "check_time" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_on_call_v2"("p_department_id" "uuid", "p_check_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_on_call_v2"("p_department_id" "uuid", "p_check_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_on_call_v2"("p_department_id" "uuid", "p_check_time" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_on_call_with_fallback"("p_department_id" "uuid", "p_check_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_on_call_with_fallback"("p_department_id" "uuid", "p_check_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_on_call_with_fallback"("p_department_id" "uuid", "p_check_time" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_departments"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_departments"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_departments"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_call_center_manager"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_call_center_manager"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_call_center_manager"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_ceo"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_ceo"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_ceo"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_contact_available"("p_available_days" integer[], "p_available_hours_start" time without time zone, "p_available_hours_end" time without time zone, "p_on_vacation" boolean, "p_vacation_start" "date", "p_vacation_end" "date", "p_currently_unavailable" boolean, "p_unavailable_until" timestamp with time zone, "p_check_time" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."is_contact_available"("p_available_days" integer[], "p_available_hours_start" time without time zone, "p_available_hours_end" time without time zone, "p_on_vacation" boolean, "p_vacation_start" "date", "p_vacation_end" "date", "p_currently_unavailable" boolean, "p_unavailable_until" timestamp with time zone, "p_check_time" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_contact_available"("p_available_days" integer[], "p_available_hours_start" time without time zone, "p_available_hours_end" time without time zone, "p_on_vacation" boolean, "p_vacation_start" "date", "p_vacation_end" "date", "p_currently_unavailable" boolean, "p_unavailable_until" timestamp with time zone, "p_check_time" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_sector_manager"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_sector_manager"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_sector_manager"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_primary_department"("user_uuid" "uuid", "dept_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."set_primary_department"("user_uuid" "uuid", "dept_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_primary_department"("user_uuid" "uuid", "dept_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_general_notifications_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_general_notifications_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_general_notifications_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_oncall_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_oncall_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_oncall_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_panic_buttons_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_panic_buttons_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_panic_buttons_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_shelter_status_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_shelter_status_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_shelter_status_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_system_settings_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_system_settings_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_system_settings_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_profiles_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_profiles_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_profiles_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_war_mode_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_war_mode_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_war_mode_timestamp"() TO "service_role";


















GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."call_categories" TO "anon";
GRANT ALL ON TABLE "public"."call_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."call_categories" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."call_category_contacts" TO "anon";
GRANT ALL ON TABLE "public"."call_category_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."call_category_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."call_category_rules" TO "anon";
GRANT ALL ON TABLE "public"."call_category_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."call_category_rules" TO "service_role";



GRANT ALL ON TABLE "public"."call_category_subcategories" TO "anon";
GRANT ALL ON TABLE "public"."call_category_subcategories" TO "authenticated";
GRANT ALL ON TABLE "public"."call_category_subcategories" TO "service_role";



GRANT ALL ON TABLE "public"."call_category_subcategory_contacts" TO "anon";
GRANT ALL ON TABLE "public"."call_category_subcategory_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."call_category_subcategory_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."call_center_schedule" TO "anon";
GRANT ALL ON TABLE "public"."call_center_schedule" TO "authenticated";
GRANT ALL ON TABLE "public"."call_center_schedule" TO "service_role";



GRANT ALL ON TABLE "public"."call_center_shifts" TO "anon";
GRANT ALL ON TABLE "public"."call_center_shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."call_center_shifts" TO "service_role";



GRANT ALL ON TABLE "public"."call_center_staff" TO "anon";
GRANT ALL ON TABLE "public"."call_center_staff" TO "authenticated";
GRANT ALL ON TABLE "public"."call_center_staff" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."daily_updates" TO "anon";
GRANT ALL ON TABLE "public"."daily_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_updates" TO "service_role";



GRANT ALL ON TABLE "public"."departments" TO "anon";
GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT ALL ON TABLE "public"."departments" TO "service_role";



GRANT ALL ON TABLE "public"."duty_roster" TO "anon";
GRANT ALL ON TABLE "public"."duty_roster" TO "authenticated";
GRANT ALL ON TABLE "public"."duty_roster" TO "service_role";



GRANT ALL ON TABLE "public"."emergency_events" TO "anon";
GRANT ALL ON TABLE "public"."emergency_events" TO "authenticated";
GRANT ALL ON TABLE "public"."emergency_events" TO "service_role";



GRANT ALL ON TABLE "public"."event_journal" TO "anon";
GRANT ALL ON TABLE "public"."event_journal" TO "authenticated";
GRANT ALL ON TABLE "public"."event_journal" TO "service_role";



GRANT ALL ON TABLE "public"."event_participants" TO "anon";
GRANT ALL ON TABLE "public"."event_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."event_participants" TO "service_role";



GRANT ALL ON TABLE "public"."garbage_collection_schedule" TO "anon";
GRANT ALL ON TABLE "public"."garbage_collection_schedule" TO "authenticated";
GRANT ALL ON TABLE "public"."garbage_collection_schedule" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."general_notifications" TO "anon";
GRANT ALL ON TABLE "public"."general_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."general_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."inspection_reports" TO "anon";
GRANT ALL ON TABLE "public"."inspection_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."inspection_reports" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_base" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_base" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_base" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_chat_history" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_chat_history" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_chat_history" TO "service_role";



GRANT ALL ON TABLE "public"."municipalities" TO "anon";
GRANT ALL ON TABLE "public"."municipalities" TO "authenticated";
GRANT ALL ON TABLE "public"."municipalities" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."on_call_contacts" TO "anon";
GRANT ALL ON TABLE "public"."on_call_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."on_call_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."on_call_shifts" TO "anon";
GRANT ALL ON TABLE "public"."on_call_shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."on_call_shifts" TO "service_role";



GRANT ALL ON TABLE "public"."operator_messages" TO "anon";
GRANT ALL ON TABLE "public"."operator_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."operator_messages" TO "service_role";



GRANT ALL ON TABLE "public"."operator_sessions" TO "anon";
GRANT ALL ON TABLE "public"."operator_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."operator_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."operator_shifts" TO "anon";
GRANT ALL ON TABLE "public"."operator_shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."operator_shifts" TO "service_role";



GRANT ALL ON TABLE "public"."operator_tasks" TO "anon";
GRANT ALL ON TABLE "public"."operator_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."operator_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."panic_buttons" TO "anon";
GRANT ALL ON TABLE "public"."panic_buttons" TO "authenticated";
GRANT ALL ON TABLE "public"."panic_buttons" TO "service_role";



GRANT ALL ON TABLE "public"."password_resets" TO "anon";
GRANT ALL ON TABLE "public"."password_resets" TO "authenticated";
GRANT ALL ON TABLE "public"."password_resets" TO "service_role";



GRANT ALL ON TABLE "public"."sector_daily_tasks" TO "anon";
GRANT ALL ON TABLE "public"."sector_daily_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."sector_daily_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."sector_staff" TO "anon";
GRANT ALL ON TABLE "public"."sector_staff" TO "authenticated";
GRANT ALL ON TABLE "public"."sector_staff" TO "service_role";



GRANT ALL ON TABLE "public"."sector_weekly_schedule" TO "anon";
GRANT ALL ON TABLE "public"."sector_weekly_schedule" TO "authenticated";
GRANT ALL ON TABLE "public"."sector_weekly_schedule" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."security_daily_order_entries" TO "anon";
GRANT ALL ON TABLE "public"."security_daily_order_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."security_daily_order_entries" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."security_daily_orders" TO "anon";
GRANT ALL ON TABLE "public"."security_daily_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."security_daily_orders" TO "service_role";



GRANT ALL ON TABLE "public"."security_settings" TO "anon";
GRANT ALL ON TABLE "public"."security_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."security_settings" TO "service_role";



GRANT ALL ON TABLE "public"."security_shift_changes" TO "anon";
GRANT ALL ON TABLE "public"."security_shift_changes" TO "authenticated";
GRANT ALL ON TABLE "public"."security_shift_changes" TO "service_role";



GRANT ALL ON TABLE "public"."security_shifts" TO "anon";
GRANT ALL ON TABLE "public"."security_shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."security_shifts" TO "service_role";



GRANT ALL ON TABLE "public"."security_staff" TO "anon";
GRANT ALL ON TABLE "public"."security_staff" TO "authenticated";
GRANT ALL ON TABLE "public"."security_staff" TO "service_role";



GRANT ALL ON TABLE "public"."security_staff_leave" TO "anon";
GRANT ALL ON TABLE "public"."security_staff_leave" TO "authenticated";
GRANT ALL ON TABLE "public"."security_staff_leave" TO "service_role";



GRANT ALL ON TABLE "public"."security_weekly_schedule" TO "anon";
GRANT ALL ON TABLE "public"."security_weekly_schedule" TO "authenticated";
GRANT ALL ON TABLE "public"."security_weekly_schedule" TO "service_role";



GRANT ALL ON TABLE "public"."shelter_status" TO "anon";
GRANT ALL ON TABLE "public"."shelter_status" TO "authenticated";
GRANT ALL ON TABLE "public"."shelter_status" TO "service_role";



GRANT ALL ON TABLE "public"."shift_messages" TO "anon";
GRANT ALL ON TABLE "public"."shift_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."shift_messages" TO "service_role";



GRANT ALL ON TABLE "public"."survey_responses" TO "anon";
GRANT ALL ON TABLE "public"."survey_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."survey_responses" TO "service_role";



GRANT ALL ON TABLE "public"."surveys" TO "anon";
GRANT ALL ON TABLE "public"."surveys" TO "authenticated";
GRANT ALL ON TABLE "public"."surveys" TO "service_role";



GRANT ALL ON TABLE "public"."system_settings" TO "anon";
GRANT ALL ON TABLE "public"."system_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."system_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_departments" TO "anon";
GRANT ALL ON TABLE "public"."user_departments" TO "authenticated";
GRANT ALL ON TABLE "public"."user_departments" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_profiles" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."user_profiles" TO "anon";
GRANT SELECT("id") ON TABLE "public"."user_profiles" TO "authenticated";



GRANT SELECT("full_name") ON TABLE "public"."user_profiles" TO "anon";
GRANT SELECT("full_name") ON TABLE "public"."user_profiles" TO "authenticated";



GRANT SELECT("role") ON TABLE "public"."user_profiles" TO "anon";
GRANT SELECT("role") ON TABLE "public"."user_profiles" TO "authenticated";



GRANT SELECT("status") ON TABLE "public"."user_profiles" TO "anon";
GRANT SELECT("status") ON TABLE "public"."user_profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."war_mode" TO "anon";
GRANT ALL ON TABLE "public"."war_mode" TO "authenticated";
GRANT ALL ON TABLE "public"."war_mode" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































