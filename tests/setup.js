// ערכי env מזויפים לבדיקות - שום בדיקה לא נוגעת בסביבה אמיתית.
process.env.JWT_SECRET = 'test-jwt-secret-for-vitest-only';
process.env.SCREEN_TOKEN = 'test-screen-token';
process.env.DUTY_FORM_SECRET = 'test-duty-form-secret';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
