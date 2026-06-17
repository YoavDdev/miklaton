-- Seed file for on-call contacts based on actual municipality data
-- Municipality: Yehud-Monosson
-- Source: נוהל עבודה לילה + כוננים

-- First, ensure we have the municipality
DO $$
DECLARE
  v_municipality_id UUID := '00000000-0000-0000-0000-000000000001';
  v_dept_id UUID;
BEGIN

-- Get department IDs
-- Note: Run seed_yehud_simple.sql first to create departments

-- ============================================
-- מוקד עירוני (City Call Center)
-- ============================================
SELECT id INTO v_dept_id FROM departments WHERE municipality_id = v_municipality_id AND name = 'מוקד' LIMIT 1;
IF v_dept_id IS NOT NULL THEN
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default)
  VALUES (v_dept_id, 'מיירי צרפתי - מנהלת המוקד', '052-6336430', 'מנהלת מוקד עירוני', 1, true, true);
END IF;

-- ============================================
-- מים (Water)
-- ============================================
SELECT id INTO v_dept_id FROM departments WHERE municipality_id = v_municipality_id AND name = 'מים' LIMIT 1;
IF v_dept_id IS NOT NULL THEN
  -- רוין אייזיק - כונן ראשי
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default, available_hours)
  VALUES (v_dept_id, 'רוין אייזיק', '052-5555614', 'כונן מים', 1, true, true, 'לא זמין 00:00-07:00');
  
  -- Note: אין כוננות בלילות בין 00:00-07:00
END IF;

-- ============================================
-- ביוב (Sewage)
-- ============================================
SELECT id INTO v_dept_id FROM departments WHERE municipality_id = v_municipality_id AND name = 'ביוב' LIMIT 1;
IF v_dept_id IS NOT NULL THEN
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default)
  VALUES (v_dept_id, 'רוין אייזיק', '052-5555614', 'כונן ביוב', 1, true, true);
END IF;

-- ============================================
-- רווחה (Welfare)
-- ============================================
SELECT id INTO v_dept_id FROM departments WHERE municipality_id = v_municipality_id AND name = 'רווחה' LIMIT 1;
IF v_dept_id IS NOT NULL THEN
  -- כוננות קטינים
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default)
  VALUES (v_dept_id, 'כוננות רווחה קטינים', '052-5555632', 'כוננות רווחה - קטינים', 1, true, true);
  
  -- כוננות מבוגרים
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default)
  VALUES (v_dept_id, 'כוננות רווחה מבוגרים', '052-5555934', 'כוננות רווחה - מבוגרים', 2, true, false);
END IF;

-- ============================================
-- נוער/פריצה (Youth/Break-ins)
-- ============================================
-- Note: This might need a new department category
SELECT id INTO v_dept_id FROM departments WHERE municipality_id = v_municipality_id AND name = 'ביטחון' LIMIT 1;
IF v_dept_id IS NOT NULL THEN
  -- ד"ר זהר - לילות
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default, available_hours)
  VALUES (v_dept_id, 'ד"ר זהר', '050-5712936', 'נוער/פריצה - לילות', 1, true, true, 'לילות');
  
  -- אילת זהר - ימים
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default, available_hours)
  VALUES (v_dept_id, 'אילת זהר', '052-8523328', 'נוער/פריצה - ימים א', 2, true, false, 'ימים א 06:00-21:00');
END IF;

-- ============================================
-- גינון (Gardening)
-- ============================================
SELECT id INTO v_dept_id FROM departments WHERE municipality_id = v_municipality_id AND name = 'גינון' LIMIT 1;
IF v_dept_id IS NOT NULL THEN
  -- ג'אנג'ו - כולל לילות
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default, is_external, external_company)
  VALUES (v_dept_id, 'ג''אנג''ו', '0532820015', 'כונן גינון - כולל לילות', 1, true, true, true, 'חברה חיצונית');
  
  -- רמי - כונן יום
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default)
  VALUES (v_dept_id, 'רמי', '0532228282', 'כונן גינון - יום', 2, true, false);
  
  -- דידי
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default)
  VALUES (v_dept_id, 'דידי', '052-5555615', 'כונן גינון', 3, true, false);
END IF;

-- ============================================
-- פיקוח עוף (Poultry Inspection)
-- ============================================
-- Note: Might need custom department or use existing one
SELECT id INTO v_dept_id FROM departments WHERE municipality_id = v_municipality_id AND name = 'ביטחון' LIMIT 1;
IF v_dept_id IS NOT NULL THEN
  -- דוד ראובן - שישי שבת
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default, available_hours)
  VALUES (v_dept_id, 'דוד ראובן', '052-5555615', 'פיקוח עוף - שישי שבת', 1, true, false, 'שישי שבת');
  
  -- ליאור לוי
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default, available_hours)
  VALUES (v_dept_id, 'ליאור לוי', '052-5555079', 'פיקוח עוף - משק לד לפני ערב חג', 2, true, false, 'משק לד לפני ערב חג');
END IF;

-- ============================================
-- חשמל (Electricity)
-- ============================================
SELECT id INTO v_dept_id FROM departments WHERE municipality_id = v_municipality_id AND name = 'חשמל' LIMIT 1;
IF v_dept_id IS NOT NULL THEN
  -- כונן קבוע
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default)
  VALUES (v_dept_id, 'כונן חשמל קבוע', '053-7728451', 'כונן חשמל ראשי', 1, true, true);
  
  -- גיבוי 1
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default, escalation_instructions)
  VALUES (v_dept_id, 'כונן חשמל גיבוי', '054-4926910', 'כונן חשמל - במידה ולא עונה', 2, true, false, 'במידה ולא עונה הראשון');
  
  -- נמרוד סמט הכבלן
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default)
  VALUES (v_dept_id, 'נמרוד סמט הכבלן', '0542575697', 'כבלן', 3, true, false);
END IF;

-- ============================================
-- זבל (Garbage/Sanitation)
-- ============================================
SELECT id INTO v_dept_id FROM departments WHERE municipality_id = v_municipality_id AND name = 'זבל' LIMIT 1;
IF v_dept_id IS NOT NULL THEN
  -- נועם משעל
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default)
  VALUES (v_dept_id, 'נועם משעל', '050-8587559', 'כונן מפעל', 1, true, true);
  
  -- שרון לוי
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default)
  VALUES (v_dept_id, 'שרון לוי', '0545422221', 'כונן מפעל', 2, true, false);
END IF;

-- ============================================
-- הנדסה (Engineering)
-- ============================================
-- Note: Might need new department
SELECT id INTO v_dept_id FROM departments WHERE municipality_id = v_municipality_id AND name = 'כבישים' LIMIT 1;
IF v_dept_id IS NOT NULL THEN
  -- גילי ישק - מנהל מחלקת הנדסה
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default)
  VALUES (v_dept_id, 'גילי ישק', '0556691795', 'מנהל מחלקת הנדסה-תשתיות', 1, true, true);
  
  -- ברק
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default)
  VALUES (v_dept_id, 'ברק', '050-9864550', 'הנדסה תשתיות', 2, true, false);
END IF;

-- ============================================
-- תכנון ובניה (Planning and Construction)
-- ============================================
SELECT id INTO v_dept_id FROM departments WHERE municipality_id = v_municipality_id AND name = 'כבישים' LIMIT 1;
IF v_dept_id IS NOT NULL THEN
  -- דברי אריאל
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default)
  VALUES (v_dept_id, 'דברי אריאל (מפקח על הבניה)', '050-2399911', 'מפקח על הבניה', 1, true, true);
  
  -- אלכסנדר פרץ
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default)
  VALUES (v_dept_id, 'אלכסנדר פרץ', '054-5312875', 'מחלקת תכנון ובניה', 2, true, false);
  
  -- ליאור בוקר
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default)
  VALUES (v_dept_id, 'ליאור בוקר', '052-9278235', 'מחלקת תכנון ובניה', 3, true, false);
  
  -- גילי סימנדובי
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default)
  VALUES (v_dept_id, 'גילי סימנדובי', '052-3039955', 'מחלקת תכנון ובניה', 4, true, false);
END IF;

-- ============================================
-- חינוך (Education)
-- ============================================
SELECT id INTO v_dept_id FROM departments WHERE municipality_id = v_municipality_id AND name = 'חינוך' LIMIT 1;
IF v_dept_id IS NOT NULL THEN
  -- רועי (בשבת)
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default, available_hours)
  VALUES (v_dept_id, 'רועי', '0545654741', 'כונן חינוך - שבת', 1, true, false, 'שבת');
  
  -- בן בוואט (בשבת)
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default, available_hours, notes)
  VALUES (v_dept_id, 'בן בוואט', '0533316552', 'כונן חינוך - שבת', 2, true, false, 'שבת', 'נגדנה ולא זמין - להתקשר לנגיד של אשתו');
  
  -- אבי סמרה
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default)
  VALUES (v_dept_id, 'אבי סמרה', '050-3322354', 'כונן חינוך', 3, true, false);
  
  -- חי ראובן
  INSERT INTO on_call_contacts (department_id, name, phone, role_description, priority, active, is_default)
  VALUES (v_dept_id, 'חי ראובן', '050-7303338', 'כונן חינוך', 4, true, false);
END IF;

END $$;
