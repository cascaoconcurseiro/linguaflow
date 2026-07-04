import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const protectedPaths = [
    '/',
    '/study',
    '/library',
    '/decks',
    '/stats',
    '/chunks',
    '/lab',
    '/catalogue',
  ];
  const isProtected = protectedPaths.some(
    (p) => request.nextUrl.pathname === p || (p !== '/' && request.nextUrl.pathname.startsWith(p)),
  );

  if (isProtected) {
    // Check for Supabase auth cookies (sb-xxx-auth-token)
    const hasAuthCookie = request.cookies
      .getAll()
      .some((c) => c.name.includes('sb-') && c.name.includes('auth-token'));
    if (!hasAuthCookie) {
      return NextResponse.redirect(new URL('/auth', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
