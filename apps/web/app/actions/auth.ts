"use server";

import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";

import { createSession, deleteSession } from "@/lib/session";

export type LoginState = {
  error?: string;
};

function valuesMatch(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const configuredEmail = process.env.DEV_AUTH_EMAIL;
  const configuredPassword = process.env.DEV_AUTH_PASSWORD;

  if (!configuredEmail || !configuredPassword) {
    return { error: "Local authentication is not configured." };
  }

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !valuesMatch(email.trim().toLowerCase(), configuredEmail.toLowerCase()) ||
    !valuesMatch(password, configuredPassword)
  ) {
    return { error: "Invalid email or password." };
  }

  await createSession({
    userId: `development:${configuredEmail.toLowerCase()}`,
    name: process.env.DEV_AUTH_NAME?.trim() || "CadeBit Student",
    email: configuredEmail,
  });

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
