import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from './prisma';
import { SESSION_COOKIE, type SessionPayload, signSession, sessionMaxAgeSec, verifySession } from './session';

export type CurrentUser = SessionPayload & { id: string };

/** Ambil user dari cookie + verifikasi ke DB (aktif & sessionVersion cocok). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const payload = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const u = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { division: true },
  });
  if (!u || !u.active || u.sessionVersion !== payload.sv) return null;
  // Pakai data terbaru dari DB supaya perubahan divisi/role langsung berlaku.
  return {
    id: u.id,
    sub: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    divisionId: u.divisionId,
    divisionCode: u.division?.code ?? null,
    divisionName: u.division?.name ?? null,
    isGembaTeam: u.division?.isGembaTeam ?? false,
    mustChangePassword: u.mustChangePassword,
    sv: u.sessionVersion,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect('/login');
  return u;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const u = await requireUser();
  if (u.role !== 'ADMIN') redirect('/dashboard?denied=1');
  return u;
}

export async function buildSessionFor(userId: string): Promise<{ token: string; payload: SessionPayload }> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { division: true } });
  const payload: SessionPayload = {
    sub: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    divisionId: u.divisionId,
    divisionCode: u.division?.code ?? null,
    divisionName: u.division?.name ?? null,
    isGembaTeam: u.division?.isGembaTeam ?? false,
    mustChangePassword: u.mustChangePassword,
    sv: u.sessionVersion,
  };
  return { token: await signSession(payload), payload };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: sessionMaxAgeSec(),
  };
}

/** Helper untuk API route: kembalikan user atau Response 401. */
export async function apiUser(): Promise<CurrentUser | Response> {
  const u = await getCurrentUser();
  if (!u) return Response.json({ error: 'Belum login' }, { status: 401 });
  return u;
}

export function isResponse(x: unknown): x is Response {
  return x instanceof Response;
}

export function canManageFinding(u: CurrentUser, f: { reporterId: string; assignedDivisionId: string; assigneeId: string | null }) {
  if (u.role === 'ADMIN') return true;
  if (f.reporterId === u.id) return true;
  if (f.assigneeId === u.id) return true;
  if (u.divisionId && f.assignedDivisionId === u.divisionId) return true;
  return false;
}
