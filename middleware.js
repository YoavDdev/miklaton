import { NextResponse } from 'next/server';
import { verifyTokenEdge } from './lib/auth-edge';

// הגדרת הרשאות לפי route - 8 תפקידים
const ROUTE_PERMISSIONS = {
  '/ceo': ['ceo', 'admin'],
  '/call-center-manager': ['call_center_manager', 'admin'],
  '/sector-manager': ['sector_manager', 'admin'],
  '/operator': ['operator', 'shift_supervisor', 'call_center_manager', 'admin'],
  '/shift': ['shift_supervisor', 'call_center_manager', 'admin'],
  // דוח הסיכום היומי (YOA-42) - סמכות משמרת, כמו /shift
  '/daily-report': ['shift_supervisor', 'call_center_manager', 'admin'],
  '/inspector': ['inspector', 'admin'],
  '/shelter-manager': ['shelter_manager', 'admin'],
  '/admin': ['admin'],
  '/events': ['ceo', 'call_center_manager', 'shift_supervisor', 'sector_manager', 'operator', 'inspector', 'shelter_manager', 'admin'],
  '/dashboard': ['ceo', 'call_center_manager', 'shift_supervisor', 'sector_manager', 'operator', 'inspector', 'shelter_manager', 'admin'],
  '/profile': ['ceo', 'call_center_manager', 'shift_supervisor', 'sector_manager', 'operator', 'inspector', 'shelter_manager', 'admin'],
  '/change-password': ['ceo', 'call_center_manager', 'shift_supervisor', 'sector_manager', 'operator', 'inspector', 'shelter_manager', 'admin'],
  '/on-call': ['ceo', 'call_center_manager', 'shift_supervisor', 'sector_manager', 'operator', 'inspector', 'shelter_manager', 'admin'],
  // סיור פיקוח. היה מחוץ ל-matcher ולכן נגיש לכל אחד ברשת בלי התחברות (YOA-23).
  '/inspection': ['inspector', 'sector_manager', 'call_center_manager', 'operator', 'admin'],
  // היה מכוסה רק במקרה, דרך התאמת הקידומת ל-'/on-call'. מפורש עדיף.
  '/on-call-query': ['ceo', 'call_center_manager', 'shift_supervisor', 'sector_manager', 'operator', 'inspector', 'shelter_manager', 'admin'],
};

// redirect לפי role - 8 תפקידים
const ROLE_REDIRECTS = {
  ceo: '/ceo',
  call_center_manager: '/call-center-manager',
  sector_manager: '/sector-manager',
  operator: '/operator',
  inspector: '/inspector',
  shelter_manager: '/shelter-manager',
  shift_supervisor: '/shift',
  admin: '/admin',
};

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // מסך המוקד: גישה עם טוקן מסך קבוע (?key=... פעם אחת => עוגייה) או משתמש מחובר
  if (pathname.startsWith('/screen')) {
    const screenToken = process.env.SCREEN_TOKEN;
    const keyParam = request.nextUrl.searchParams.get('key');

    // הגיע עם ?key= תקין - מציגים את המסך ישירות (בלי redirect) וגם קובעים
    // עוגייה. הצגה ישירה חשובה למערכות signage/kiosk שטוענות את אותה כתובת
    // שוב ושוב ולא שומרות עוגיות או לא עוקבות אחרי redirect — הקישור-עם-המפתח
    // עובד בכל טעינה. דפדפן רגיל מקבל בנוסף עוגייה לשנה ל-/screen בלי key.
    if (screenToken && keyParam === screenToken) {
      const response = NextResponse.next();
      response.cookies.set('screen-key', keyParam, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 365, // שנה - מסך תצוגה קבוע
        path: '/',
      });
      return response;
    }

    // עוגיית מסך קיימת ותקינה
    const cookieKey = request.cookies.get('screen-key')?.value;
    if (screenToken && cookieKey === screenToken) {
      return NextResponse.next();
    }

    // אחרת - גם משתמש מחובר רשאי לצפות במסך
    const authToken = request.cookies.get('auth-token')?.value;
    if (authToken && (await verifyTokenEdge(authToken))) {
      return NextResponse.next();
    }

    return NextResponse.redirect(new URL('/login', request.url));
  }

  // בדיקה אם הנתיב מוגן
  const protectedRoute = Object.keys(ROUTE_PERMISSIONS).find(route =>
    pathname.startsWith(route)
  );

  if (protectedRoute) {
    const token = request.cookies.get('auth-token')?.value;

    // אין טוקן - redirect ל-login
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // בדיקת תקינות הטוקן
    const decoded = await verifyTokenEdge(token);
    if (!decoded || !decoded.role) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('auth-token');
      return response;
    }

    // בדיקת סטטוס בזמן אמת מה-DB (השעיה מיידית)
    try {
      // service role (עוקף RLS) עם fallback ל-anon - הקריאה רצה בצד השרת בלבד
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const statusResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_profiles?id=eq.${decoded.userId}&select=status`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        }
      );
      
      if (statusResponse.ok) {
        const profiles = await statusResponse.json();
        if (profiles.length > 0 && profiles[0].status === 'suspended') {
          // משתמש מושעה - logout מיידי
          const response = NextResponse.redirect(new URL('/login?suspended=true', request.url));
          response.cookies.delete('auth-token');
          return response;
        }
      }
    } catch (error) {
      console.error('Status check error:', error);
      // אם יש שגיאה, נמשיך רגיל (fail-open)
    }

    // בדיקת הרשאות
    const allowedRoles = ROUTE_PERMISSIONS[protectedRoute];
    if (!allowedRoles.includes(decoded.role)) {
      // אין הרשאה - redirect לדף המתאים לתפקיד
      const userRedirect = ROLE_REDIRECTS[decoded.role] || '/operator';
      return NextResponse.redirect(new URL(userRedirect, request.url));
    }

    // בדיקה אם צריך להחליף סיסמה
    // אם כן ולא בדף change-password, redirect לשם
    if (decoded.mustChangePassword && pathname !== '/change-password') {
      return NextResponse.redirect(new URL('/change-password?forced=true', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/ceo/:path*',
    '/call-center-manager/:path*',
    '/sector-manager/:path*',
    '/operator/:path*',
    '/inspector/:path*',
    '/shelter-manager/:path*',
    '/admin/:path*',
    '/events/:path*',
    '/dashboard/:path*',
    '/profile/:path*',
    '/change-password',
    '/screen/:path*',
    '/screen',
    '/on-call',
    '/on-call-query',
    '/shift/:path*',
    '/shift',
    '/daily-report/:path*',
    '/daily-report',
    '/inspection/:path*',
    '/inspection',
  ],
};
