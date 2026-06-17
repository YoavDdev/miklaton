-- Seed file for call categories
-- Municipality: Yehud-Monosson
-- Based on actual operational procedures

DO $$
DECLARE
  v_municipality_id UUID;
  v_category_id UUID;
  v_subcategory_id UUID;
BEGIN
  -- Get Yehud municipality ID
  SELECT id INTO v_municipality_id FROM municipalities WHERE code = 'yehud' LIMIT 1;
  
  IF v_municipality_id IS NULL THEN
    RAISE EXCEPTION 'Municipality yehud not found. Please run seed_municipality.sql first.';
  END IF;

  -- Delete existing call categories for this municipality to avoid duplicates
  -- This will cascade delete all related contacts, rules, and subcategories
  DELETE FROM call_categories WHERE municipality_id = v_municipality_id;

-- ============================================
-- 1. חירום חריג (Critical Emergency)
-- ============================================
INSERT INTO call_categories (municipality_id, name, icon, description, display_order, active)
VALUES (v_municipality_id, 'חירום חריג', '🚨', 
  'שריפה, חשש לחיי אדם, הצפה, הפסקת חשמל נרחבת, הפסקת מים נרחבת, קריסת מבנה, תאונה קשה, נפילת טיל, רעידת אדמה וכדומה',
  1, true)
RETURNING id INTO v_category_id;

-- Contacts for critical emergency
INSERT INTO call_category_contacts (call_category_id, external_name, external_phone, external_role, escalation_order, is_primary)
VALUES 
  (v_category_id, 'שיטור עירוני', NULL, 'גורם מטפל ראשון', 1, true),
  (v_category_id, 'מיירי צרפתי', '052-6336430', 'מנהלת המוקד', 2, false),
  (v_category_id, 'ליאור בוקר', '052-9278235', 'מנהל אגף השירות', 3, false),
  (v_category_id, 'ענבל אילן', '054-4342299', NULL, 4, false),
  (v_category_id, 'גיל מנכ"ל', '052-3039955', NULL, 5, false),
  (v_category_id, 'אריאל ג''רג''י', '052-3861184', 'מנהל אגף בטחון', 6, false);

-- ============================================
-- 2. שיטור עירוני (Municipal Patrol)
-- ============================================
INSERT INTO call_categories (municipality_id, name, icon, description, instructions, additional_info, display_order, active)
VALUES (v_municipality_id, 'שיטור עירוני', '👮', 
  'רעש, חנייה במקום אסור, כלב משוטט, חשד לחיי אדם, אדם חשוד וכו''. מפגעים כמו בור בכביש, הסרת סכנה, גידור',
  'בכל נושא יש להתקשר לכונן שמופיע בשדה ''גורם מטפל''',
  'משטרה - 100',
  2, true)
RETURNING id INTO v_category_id;

INSERT INTO call_category_contacts (call_category_id, external_name, external_phone, escalation_order, note, is_primary)
VALUES 
  (v_category_id, 'כונן שיטור/פיקוח עירוני', NULL, 1, 'לפי משמרות (נפתח בהמשך)', true),
  (v_category_id, 'ענבל אילן', '054-4342299', 2, 'אם אין מענה 3 פעמים', false),
  (v_category_id, 'אריאל ג''רג''י', '052-3861184', 3, 'אם אין מענה 3 פעמים', false);

-- ============================================
-- 3. מים/ביוב (Water/Sewage)
-- ============================================
INSERT INTO call_categories (municipality_id, name, icon, description, instructions, display_order, active)
VALUES (v_municipality_id, 'מים/ביוב', '💧', 
  'סתימת ביוב, ריח ביוב, נזילת מים (לא ממערכת השקייה)',
  'דיווח טלפוני לתאגיד המים, מי אונו',
  3, true)
RETURNING id INTO v_category_id;

INSERT INTO call_category_contacts (call_category_id, external_name, external_phone, escalation_order, is_primary, note)
VALUES 
  (v_category_id, 'תאגיד מי אונו', '*8284', 1, true, NULL),
  (v_category_id, 'רוני אטיה', '052-5555614', 2, false, 'באין מענה');

-- ============================================
-- 4. רווחה (Welfare)
-- ============================================
INSERT INTO call_categories (municipality_id, name, icon, description, warning, display_order, active)
VALUES (v_municipality_id, 'רווחה', '🤝', 
  'טיפול דחוף בקטינים עד גיל 18 ומבוגרים מעל גיל 18',
  '⚠️ אין כוננות רווחה בלילות בין השעות 00:00-07:00',
  4, true)
RETURNING id INTO v_category_id;

INSERT INTO call_category_contacts (call_category_id, external_name, external_phone, external_role, escalation_order, is_primary)
VALUES 
  (v_category_id, 'כוננית רווחה קטינים', '052-5555632', 'קטינים עד גיל 18', 1, true),
  (v_category_id, 'כוננית רווחה מבוגרים', '052-5555934', 'מבוגרים מעל גיל 18', 2, true);

-- ============================================
-- 5. וטרינריה (Veterinary)
-- ============================================
INSERT INTO call_categories (municipality_id, name, icon, description, instructions, auto_message, display_order, active)
VALUES (v_municipality_id, 'וטרינריה', '🐕', 
  'בקריאה בנושא חיות בית ומשק (כלבים, חתולים, סוסים, חמורים, כבשים, עזים, ארנבונים) בע"ח פצוע/גוסס, בע"ח לכוד, תקיפת בעל חיים, וחשד לצער בעלי חיים',
  'לבקש מהפונה להישאר במקום ולשלוח תמונה או סרטון',
  'בכדי לשמור על האיזון העדין ביננו לבין אוכלוסיית חיות הבר בטבע העירוני שלנו חשוב מאוד לשמור על כמה כללים:

• אין להאכיל חיות בר. הזנת חיות בר הופכת אותם תלותיים בנו, משנה את המאזן האקולוגי וגורמת להן לאבד את החשש הטבעי שלהן מכניסה ללב השטח המיושב.

• בהאכלת חתולי קהילה חשוב לאסוף שאריות מזון בתום האכלה בכדי שאלו לא יהוו גורם משיכה לתנים, שועלים וחיות בר אחרות.

• חשוב לשמור על סניטציה ופחי אשפה סגורים במרחב הציבורי והפרטי, שכן גם הם יכולים להוות מקור משיכה לחיות הבר התרות אחר מזון.

• תנים ושועלים לא נוהגים להתקרב לבני אדם. הם אינם מתקיפים ואינם נושכים אלא במידה וחשו מותקפים. במידה ונתקלתם בתן או שועל שאינו חושש/פצוע/חולה אין להתקרב אליו ויש לדווח על כך למוקד העירוני 106 ולמוקד רשות הטבע והגנים *3639

• המחלקה הווטרינרית מפזרת בהיקף העיר פיתיונות אוראליים (דרך הפה) המכילים חיסונים נגד כלבת לשועלים ותנים. הפעילות מתבצעת בשיתוף רט"ג ומשרד החקלאות במטרה לצמצם סבירות לנגיעות בכלבת.

• חשוב להדגיש כי התנים והשועלים הינם חיות בר מוגנות והפגיעה בהם אסורה עפ"י החוק!

אני מזמינה אתכם להצטרף לקבוצת אוהבי החיות שלנו בווטסאפ בקישור https://bit.ly/2RJjUnn',
  5, true)
RETURNING id INTO v_category_id;

-- Main veterinary contacts
INSERT INTO call_category_contacts (call_category_id, external_name, external_phone, hours, escalation_order, is_primary)
VALUES 
  (v_category_id, 'ד"ר זהר', '050-5712936', 'לילות וסופ"ש', 1, true),
  (v_category_id, 'איילת רז', '052-8523328', 'ימים א''-ה'' 06:00-21:00', 2, true);

-- Questions for veterinary
INSERT INTO call_category_rules (call_category_id, rule_type, rule_text, display_order)
VALUES 
  (v_category_id, 'question', 'האם יש אפשרות לקבל תמונה?', 1),
  (v_category_id, 'question', 'האם יש צורך בטיפול מידי?', 2),
  (v_category_id, 'question', 'האם בעל החיים נראה במצוקה?', 3),
  (v_category_id, 'question', 'האם קיימת פגיעה/פציעה פיזית נראית לעין?', 4),
  (v_category_id, 'question', 'האם בעל החיים יונק? (יונק = גור, לא ניזון בעצמו)', 5);

-- Special cases
INSERT INTO call_category_rules (call_category_id, rule_type, rule_text, display_order)
VALUES 
  (v_category_id, 'special_case', 'כל קריאה על כלבים משוטטים, מטרד רעש של בע"ח, תנאי החזקה וכדומה - יש להקפיץ שיטור למקום (אין צורך להקפיץ וטרינריה - השיטור יודע ליצור קשר עימה במידת הצורך)', 1),
  (v_category_id, 'special_case', 'שיטור עירוני - ע"פ משמרות, אם אין שיטור - יש להעביר לפיקוח העירוני', 2),
  (v_category_id, 'special_case', '**רק אם אין שיטור בעיר ואין פיקוח לפתוח את הקריאה במערכת לשיטור העירוני ולא לדווח לאף אחד', 3);

-- Wild animals subcategory
INSERT INTO call_category_subcategories (call_category_id, name, description, display_order)
VALUES (v_category_id, 'חיות בר, בעלי כנף, קיפודים ודורבנים', 'באחריות רשות הטבע והגנים', 1)
RETURNING id INTO v_subcategory_id;

INSERT INTO call_category_subcategory_contacts (subcategory_id, external_name, external_phone, escalation_order, is_primary)
VALUES 
  (v_subcategory_id, 'רשות הטבע והגנים', '*3639', 1, true),
  (v_subcategory_id, 'העמותה ''למען חיות הבר''', '054-520-3071', 2, false);

-- Snake capture subcategory
INSERT INTO call_category_subcategories (call_category_id, name, description, display_order)
VALUES (v_category_id, 'לכידת נחש', 'שטח ציבורי ופרטי', 2)
RETURNING id INTO v_subcategory_id;

INSERT INTO call_category_subcategory_contacts (subcategory_id, external_name, external_phone, note, escalation_order, is_primary)
VALUES 
  (v_subcategory_id, 'אמיר אלי', '0525555621', 'ללא סופ"ש - בסופשים דר זהר הלוי', 1, true),
  (v_subcategory_id, 'ד"ר זהר', '050-5712936', 'אם אין מענה 3 פעמים', 2, false),
  (v_subcategory_id, 'שרון לוי', '0545422221', 'אם אין מענה 3 פעמים', 3, false);

-- ============================================
-- 6. גינון (Gardening)
-- ============================================
INSERT INTO call_categories (municipality_id, name, icon, description, display_order, active)
VALUES (v_municipality_id, 'גינון', '🌳', 'נזילה ממערכת השקייה, עץ/ענף נפל', 6, true)
RETURNING id INTO v_category_id;

-- Irrigation leak subcategory
INSERT INTO call_category_subcategories (call_category_id, name, description, display_order)
VALUES (v_category_id, 'נזילה ממערכת השקייה', NULL, 1)
RETURNING id INTO v_subcategory_id;

INSERT INTO call_category_subcategory_contacts (subcategory_id, external_name, external_phone, external_role, note, escalation_order, is_primary)
VALUES 
  (v_subcategory_id, 'ג''ינג''י', '0532820015', 'כונן לילה', NULL, 1, true),
  (v_subcategory_id, 'רמי', '0532228282', 'כונן יום', 'אם אין מענה 3 פעמים', 2, false),
  (v_subcategory_id, 'דידו', '052-5555615', NULL, 'אם אין מענה 3 פעמים', 3, false);

-- Tree fell subcategory
INSERT INTO call_category_subcategories (call_category_id, name, description, display_order)
VALUES (v_category_id, 'עץ/ענף נפל או עומד ליפול', 'שטח ציבורי בלבד', 2)
RETURNING id INTO v_subcategory_id;

INSERT INTO call_category_subcategory_contacts (subcategory_id, external_name, external_phone, hours, note, escalation_order, is_primary)
VALUES 
  (v_subcategory_id, 'גבריאל לוי', '0525555619', 'ימים א-ה 15:30-22:30', 'לא בשבת', 1, true),
  (v_subcategory_id, 'דידו', '052-5555615', NULL, 'אם אין מענה 3 פעמים', 2, false),
  (v_subcategory_id, 'דוד ראובן', '052-5555615', 'שישי שבת', NULL, 3, true),
  (v_subcategory_id, 'ליאור לוי', '052-5555079', NULL, 'אם אין מענה 3 פעמים', 4, false);

-- ============================================
-- 7. פינוי פגר (Carcass Removal)
-- ============================================
INSERT INTO call_categories (municipality_id, name, icon, description, instructions, display_order, active)
VALUES (v_municipality_id, 'פינוי פגר', '🗑️', 
  'דיווח טלפוני למשה לוי/ליאור לוי ושמעון. בהתאם למשמרות',
  'את הפנייה במערכת יש לפתוח על פינוי פגר - למטפל: ליאור לוי. *במקרים של קבלת קריאה על פגר כאשר אין כונן בעיר, יש לפתוח על ליאור לוי ללא דיווח טלפוני לכונן',
  7, true)
RETURNING id INTO v_category_id;

INSERT INTO call_category_contacts (call_category_id, external_name, hours, escalation_order, is_primary)
VALUES 
  (v_category_id, 'משה לוי', '15:00-23:00', 1, true),
  (v_category_id, 'ליאור לוי / שמעון עמר', '07:00-15:00', 2, true);

-- ============================================
-- 8. חשמל (Electricity)
-- ============================================
INSERT INTO call_categories (municipality_id, name, icon, description, warning, display_order, active)
VALUES (v_municipality_id, 'חשמל', '⚡', 
  'תקלות חשמל, פנסים לא דולקים',
  '⚠️ במקרה של סכנה/חשש לסכנה, יש להקפיץ שיטור למקום לבדיקת מסוכנות מידית ותיחום המפגע בעת הצורך במקביל לפתיחת הפנייה והקפצת מטפל החשמל',
  8, true)
RETURNING id INTO v_category_id;

-- Rules for electricity
INSERT INTO call_category_rules (call_category_id, rule_type, rule_text, display_order)
VALUES 
  (v_category_id, 'rule', 'יותר מ-3 פנסים לא דולקים ברחוב → להקפיץ כונן חשמל', 1),
  (v_category_id, 'rule', 'פנס אחד כבוי → רק לפתוח קריאה ללא הקפצת כונן', 2);

-- Contacts with availability schedules and priority
INSERT INTO call_category_contacts (
  call_category_id, external_name, external_phone, hours, escalation_order, is_primary,
  available_days, available_hours_start, available_hours_end,
  priority_order, contact_type, notes_for_operator
)
VALUES 
  -- מאור עייש - זמין א'-ה' 08:00-16:00 (שומר שבת) - PRIORITY 1
  (v_category_id, 'מאור עייש', '0524720577', 'א''-ה'' 08:00-16:00', 1, true,
   ARRAY[0,1,2,3,4], '08:00'::TIME, '16:00'::TIME,
   1, 'escalation', 'להקפיץ במקרה של יותר מ-3 פנסים'),
  
  -- כונן קבלן - זמין שישי-שבת - PRIORITY 1 בסופ"ש
  (v_category_id, 'כונן קבלן', '053-7728451', 'שישי-שבת', 2, true,
   ARRAY[5,6], NULL, NULL,
   1, 'escalation', 'ראשון בתור בשישי-שבת'),
  
  -- אחראי כוננים יהודה - זמין שישי-שבת - PRIORITY 2 בסופ"ש
  (v_category_id, 'אחראי כוננים יהודה', '054-4926910', 'שישי-שבת', 3, false,
   ARRAY[5,6], NULL, NULL,
   2, 'escalation', 'שני בתור בשישי-שבת (אם קבלן לא זמין)'),
  
  -- נמרוד - זמין סופ"ש - PRIORITY 3 בסופ"ש
  (v_category_id, 'נמרוד מטעם הקבלן', '0542575697', 'שישי-שבת', 4, false,
   ARRAY[5,6], NULL, NULL,
   3, 'escalation', 'שלישי בתור בשישי-שבת (אם יהודה לא זמין)');

-- ============================================
-- 9. תחזוקה (Maintenance)
-- ============================================
INSERT INTO call_categories (municipality_id, name, icon, description, display_order, active)
VALUES (v_municipality_id, 'תחזוקה', '🔧', 
  'בור בכביש, הסרת סכנה, גידור, עמוד שיצא מהמקום המאווה סכנה',
  9, true)
RETURNING id INTO v_category_id;

INSERT INTO call_category_contacts (call_category_id, external_name, external_phone, note, escalation_order, is_primary)
VALUES 
  (v_category_id, 'נועם משעל', '050-8587559', NULL, 1, true),
  (v_category_id, 'שרון לוי', '0545422221', 'במידה ואין מענה שלוש פעמים', 2, false);

-- ============================================
-- 10. תכנון ובניה (Planning & Construction)
-- ============================================
INSERT INTO call_categories (municipality_id, name, icon, description, instructions, display_order, active)
VALUES (v_municipality_id, 'תכנון ובניה', '🏗️', 
  'חשד למבנה מסוכן',
  'במידה ומדובר בשינויים במבנה מהימים האחרונים - יש להקפיץ את המפקח על הבניה ולעדכן את יתר המנהלים. במידה ומדובר במבנה ישן ללא שינויים מהימים האחרונים - יש להפנות את התושב למהנדס פרטי',
  10, true)
RETURNING id INTO v_category_id;

INSERT INTO call_category_contacts (call_category_id, external_name, external_phone, hours, note, escalation_order, is_primary)
VALUES 
  (v_category_id, 'דביר אירכא', '0502399911', 'ימים א-ה', 'לא בשבת', 1, true),
  (v_category_id, 'סמיר', '052-2606530', 'שבת', NULL, 2, true);

-- ============================================
-- 11. חינוך (Education)
-- ============================================
INSERT INTO call_categories (municipality_id, name, icon, description, warning, display_order, active)
VALUES (v_municipality_id, 'חינוך', '🏫', 
  'תקלה בתוך מוסדות החינוך',
  '⚠️ אין להתקשר ישירות לאב הבית',
  11, true)
RETURNING id INTO v_category_id;

INSERT INTO call_category_contacts (call_category_id, external_name, external_phone, hours, note, escalation_order, is_primary)
VALUES 
  (v_category_id, 'רענן פלג', '0545654741', 'לא בשבת', 'במוסדות חינוך', 1, true),
  (v_category_id, 'בן בויאגי', '0533316552', 'שבת', 'במידה ולא זמין יש להתקשר לנייד של אשתו', 2, true),
  (v_category_id, 'אבי סמרה', '050-3322354', NULL, NULL, 3, false),
  (v_category_id, 'חי ראובן', '050-7303338', NULL, NULL, 4, false);

-- ============================================
-- 12. לחצני מצוקה בגינות (Panic Buttons in Parks)
-- ============================================
INSERT INTO call_categories (municipality_id, name, icon, description, instructions, display_order, active)
VALUES (v_municipality_id, 'לחצני מצוקה בגינות', '🆘', 
  'התראות מלחצני המצוקה בגינות הציבוריות',
  'בעת קבלת התראה ראשית יש לסרוק את המצלמות ולוודא כי לא מדובר בילדים שלוחצים סתם. במידה ונראה כי יש חשש לאירוע חירום אמיתי או שאין נגישות במצלמות יש להקפיץ את השיטור העירוני בהקדם האפשרי. במידה ואין שיטור ניתן להקפיץ פיקוח',
  12, true)
RETURNING id INTO v_category_id;

INSERT INTO call_category_contacts (call_category_id, external_name, note, escalation_order, is_primary)
VALUES 
  (v_category_id, 'שיטור עירוני', NULL, 1, true),
  (v_category_id, 'פיקוח עירוני', 'במידה ואין שיטור', 2, false);

END $$;
