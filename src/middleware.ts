/**
 * Next.js Middleware for Authentication
 * 
 * Protects routes that require authentication and handles redirects.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'pf_session';

// Routes that require authentication
const PROTECTED_ROUTES = [
  '/dashboard',
  '/calculate',
  '/calculator',
  '/friends',
  '/agreements',
  '/payments',
  '/grouptabs',
  '/profile',
  '/settings',
];

// Routes that should redirect to dashboard if already logged in
const AUTH_ROUTES = [
  '/login',
];

// Admin routes
const ADMIN_ROUTES = [
  '/admin',
];

// Public routes (no auth required)
const PUBLIC_ROUTES = [
  '/',
  '/features',
  '/faq',
  '/review',
  '/grouptabs/guest',
  '/legal',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isAuthenticated = !!sessionId;

  // Check if the route is a protected route
  const isProtectedRoute = PROTECTED_ROUTES.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );

  // Check if the route is an auth route (login/signup)
  const isAuthRoute = AUTH_ROUTES.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );

  // Check if the route is an admin route
  const isAdminRoute = ADMIN_ROUTES.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );

  // API routes - let them handle their own auth
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Static files and Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/icons/') ||
    pathname.includes('.') // Files with extensions
  ) {
    return NextResponse.next();
  }

  // Protected routes - redirect to login if not authenticated
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Auth routes - redirect to dashboard if already authenticated
  if (isAuthRoute && isAuthenticated) {
    const redirectTo = request.nextUrl.searchParams.get('redirect') || '/dashboard';
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  // Admin routes - require authentication (admin check done in page/API)
  if (isAdminRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
