import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const SESSION_COOKIE = "cadebit_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export type SessionUser = {
  userId: string;
  name: string;
  email: string;
};

function getSessionKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }

  return new TextEncoder().encode(secret);
}

function shouldUseSecureCookie(): boolean {
  const configuredValue =
    process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase();

  if (configuredValue === "true") return true;
  if (configuredValue === "false") return false;

  return process.env.NODE_ENV === "production";
}

export async function createSession(user: SessionUser): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);
  const session = await new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getSessionKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: shouldUseSecureCookie(),
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) return null;

  try {
    const { payload } = await jwtVerify(session, getSessionKey(), {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.userId !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.email !== "string"
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      name: payload.name,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function deleteSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
