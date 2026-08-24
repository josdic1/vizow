import { createHash } from "node:crypto";

import { env } from "../env.js";

export const DEMO_SESSION_COOKIE = "vizow_demo_session";

function encodeCookieValue(value: string): string {
  return encodeURIComponent(value);
}

export function readDemoSessionToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const name = item.slice(0, separator).trim();

    if (name !== DEMO_SESSION_COOKIE) {
      continue;
    }

    const value = item.slice(separator + 1).trim();

    try {
      return decodeURIComponent(value) || null;
    } catch {
      return value || null;
    }
  }

  return null;
}

export function hashDemoSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createDemoSessionCookie(token: string): string {
  const maxAgeSeconds = env.DEMO_SESSION_HOURS * 60 * 60;
  const secure = env.FRONTEND_ORIGIN.startsWith("https://");

  return [
    `${DEMO_SESSION_COOKIE}=${encodeCookieValue(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export function createExpiredDemoSessionCookie(): string {
  const secure = env.FRONTEND_ORIGIN.startsWith("https://");

  return [
    `${DEMO_SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}
