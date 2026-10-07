import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

// Halaman publik (tanpa login)
const PUBLIC = ['/login', '/api/auth/login', '/api/health'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    // Sudah login → lempar ke dashboard
    if (pathname === '/login') {
      const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
      if (s) return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  }

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Belum login' }, { status: 401 });
    }
    const url = new URL('/login', req.url);
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Wajib ganti password dulu
  if (session.mustChangePassword && !pathname.startsWith('/akun') && !pathname.startsWith('/api/')) {
    return NextResponse.redirect(new URL('/akun?first=1', req.url));
  }

  if (pathname === '/') return NextResponse.redirect(new URL('/dashboard', req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)'],
};
