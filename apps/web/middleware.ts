import { NextResponse, type NextRequest } from 'next/server';

const STACK_COOKIE_PREFIX = 'stack-';

function isAuthenticated(req: NextRequest): boolean {
  // Stack Auth stores its session via cookies prefixed with `stack-`.
  // Treat the presence of any such cookie as a candidate session;
  // server components verify the actual user before rendering.
  return req.cookies
    .getAll()
    .some((c) => c.name.startsWith(STACK_COOKIE_PREFIX));
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const authed = isAuthenticated(req);

  // The dynamic /[bizId]/* segment lives at the top level. Treat any first
  // path segment that isn't a known public route as a potential business id.
  const PUBLIC_TOP_LEVEL = new Set([
    '',
    'handler',
    'onboarding',
    'api',
    '_next',
    'favicon.ico',
  ]);
  const firstSeg = pathname.split('/')[1] ?? '';
  const looksLikeBizRoute =
    firstSeg.length > 0 && !PUBLIC_TOP_LEVEL.has(firstSeg);

  if (looksLikeBizRoute && !authed) {
    const url = req.nextUrl.clone();
    url.pathname = '/handler/sign-in';
    url.search = `?after_auth_return_to=${encodeURIComponent(
      pathname + search
    )}`;
    return NextResponse.redirect(url);
  }

  if (pathname === '/onboarding' && !authed) {
    const url = req.nextUrl.clone();
    url.pathname = '/handler/sign-in';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on all paths except static assets and Next.js internals.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
