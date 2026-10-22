import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Role, User } from "@prisma/client";

export const SESSION_COOKIE = "panglima_session";
const SESSION_TTL_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/** Cek apakah login harus dibatasi (5 gagal dalam 10 menit). */
export async function checkLoginThrottle(username: string): Promise<{ throttled: boolean; waitMinutes?: number }> {
  const since = new Date(Date.now() - 10 * 60_000);
  const fails = await prisma.loginAttempt.count({
    where: { username, success: false, createdAt: { gte: since } },
  });
  if (fails >= 5) {
    const last = await prisma.loginAttempt.findFirst({
      where: { username, success: false },
      orderBy: { createdAt: "desc" },
    });
    if (last) {
      const waitUntil = new Date(+last.createdAt + 5 * 60_000);
      if (waitUntil > new Date()) {
        return { throttled: true, waitMinutes: Math.ceil((+waitUntil - Date.now()) / 60_000) };
      }
    }
  }
  return { throttled: false };
}

export async function recordLoginAttempt(username: string, userId: bigint | null, success: boolean, ip?: string | null): Promise<void> {
  await prisma.loginAttempt.create({
    data: { username, userId, success, ip: ip ?? "unknown" },
  }).catch(() => {});
}

export async function verifyCredentials(username: string, password: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { username },
  });
  if (!user || !user.isActive || user.deletedAt) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}

export async function startSession(userId: bigint, ip?: string | null): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date(), lastLoginIp: ip ?? null },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 86_400,
  });
}

export async function getSessionUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { token } }).catch(() => {});
    return null;
  }
  const u = session.user;
  if (!u.isActive || u.deletedAt) return null;
  return u;
}

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePin) redirect("/change-pin");
  return user;
}

export async function requireRole(roles: Role[]): Promise<User> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/dashboard");
  return user;
}

/**
 * Gerbang permukaan ADMIN — satu pintu untuk SELURUH route /admin/*.
 * Beda dari requireRole(["ADMIN"]): non-admin DITOLAK TEGAS (403, bukan
 * redirect diam-diam ke dashboard) + tercatat di audit. Dipakai di setiap
 * page & action admin agar tidak ada jalur yang lolos karena lupa guard.
 */
export async function requireAdminSurface(area: string): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePin) redirect("/change-pin");
  if (user.role !== "ADMIN") {
    await logAudit({
      userId: user.id,
      action: "ADMIN_DITOLAK",
      entity: "admin",
      entityId: area,
      detail: { role: user.role },
    }).catch(() => {});
    throw new Error(`Akses admin ditolak (${area})`);
  }
  return user;
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.delete({ where: { token } }).catch(() => {});
    jar.delete(SESSION_COOKIE);
  }
}

export async function logAudit(params: {
  userId?: bigint | null;
  action: string;
  entity: string;
  entityId?: string;
  detail?: unknown;
  ip?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        detail: (params.detail ?? undefined) as object | undefined,
        ip: params.ip ?? null,
      },
    });
  } catch (e) {
    console.error("audit log gagal:", e);
  }
}
