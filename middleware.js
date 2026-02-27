import { NextResponse } from 'next/server';
import { verifyTokenEdge } from './lib/auth-edge';

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/operator') || pathname.startsWith('/admin')) {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const decoded = await verifyTokenEdge(token);
    if (!decoded) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (pathname.startsWith('/admin') && !decoded.isAdmin) {
      return NextResponse.redirect(new URL('/operator', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/operator/:path*', '/admin/:path*'],
};
