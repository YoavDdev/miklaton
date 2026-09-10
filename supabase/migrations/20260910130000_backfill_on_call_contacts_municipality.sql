-- ארבע שורות ב-on_call_contacts נשמרו בלי municipality_id, ולכן כל שאילתה
-- שמסננת לפי רשות מסתירה אותן. דוד דרזי - האחראי על פינוי גזם, פיזור חול
-- ופינוי מכשולים בטרקטור - הוא אחת מהן, ולכן לא ניתן היה לבחור בו בבורר
-- אנשי הקשר של לוח החג, ולמעשה הוא היה בלתי נראה בכל מקום שמסנן לפי רשות.
--
-- במערכת קיימת רשות אחת בלבד (יהוד-מונוסון), ולכן הייחוס חד-משמעי.
-- העדכון מותנה בכך שאכן קיימת רשות אחת, כדי שלא יסתום שורות של רשות אחרת
-- אם המיגרציה תרוץ מאוחר יותר על מסד רב-רשותי.

update public.on_call_contacts
set municipality_id = (select id from public.municipalities limit 1),
    updated_at = now()
where municipality_id is null
  and (select count(*) from public.municipalities) = 1;
