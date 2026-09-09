import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { auth } from "../lib/auth";
import { db, pool } from "../lib/db";
import { accounts, sessions, users } from "../lib/db/schema";

const email = `phase2-${crypto.randomUUID()}@cadebit.test`;
const password = "phase2-password";

afterAll(async () => {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  if (user) {
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    await db.delete(accounts).where(eq(accounts.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));
  }
  await pool.end();
});

describe("database-backed authentication", () => {
  it("creates an account and signs in with its password", async () => {
    const signup = await auth.api.signUpEmail({
      body: {
        name: "Phase 2 Student",
        email,
        password,
      },
    });

    expect(signup.user.email).toBe(email);

    const signin = await auth.api.signInEmail({
      body: { email, password },
    });

    expect(signin.user.email).toBe(email);
    expect(signin.token).toBeTruthy();
  });
});
