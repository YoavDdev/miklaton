import { NextResponse } from 'next/server';
import { verifyTokenEdge } from './lib/auth-edge';

// הגדרת הרשאות לפי route - 7 תפקידים
const ROUTE_PERMISSIONS = {
  '/ceo': ['ceo', 'admin'],
  '/call-center-manager': ['call_center_manager', 'admin'],
  '/sector-manager': ['sector_manager', 'admin'],
  '/operator': ['operator', 'call_center_manager', 'admin'],
  '/inspector': ['inspector', 'admin'],
  '/shelter-manager': ['shelter_manager', 'admin'],
  '/admin': ['admin'],
  '/dashboard': ['ceo', 'call_center_manager', 'sector_manager', 'operator', 'inspector', 'shelter_manager', 'admin'],
  '/profile': ['ceo', 'call_center_manager', 'sector_manager', 'operator', 'inspector', 'shelter_manager', 'admin'],
  '/change-password': ['ceo', 'call_center_manager', 'sector_manager', 'operator', 'inspector', 'shelter_manager', 'admin'],
};

// redirect לפי role - 7 תפקידים
const ROLE_REDIRECTS = {
  ceo: '/ceo',
  call_center_manager: '/call-center-manager',
  sector_manager: '/sector-manager',
  operator: '/operator',
  inspector: '/inspector',
  shelter_manager: '/shelter-manager',
  admin: '/admin',
};

export async function middleware(request) {
  const { pathname } = request.nextUrl;

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
      const statusResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_profiles?id=eq.${decoded.userId}&select=status`,
        {
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
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
      return NextResponse.redirect(new URL('/change-password', request.url));
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
    '/dashboard/:path*',
    '/profile/:path*',
    '/change-password',
  ],
};
