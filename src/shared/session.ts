import jwt from "jsonwebtoken";

export const COOKIE_NAME = "auth_token";

// Sesión larga: 7 días por defecto, configurable en segundos vía .env
const EXPIRES_IN_SECONDS = Number(process.env.JWT_EXPIRES_IN) || 7 * 24 * 60 * 60;

export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
}

export interface SessionUser {
  id: number;
  email: string;
  name: string;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET no está definido en .env");
  return secret;
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: EXPIRES_IN_SECONDS });
}

export function verifySession(token: string): SessionPayload {
  return jwt.verify(token, getSecret()) as SessionPayload;
}

export function toSessionUser(payload: SessionPayload): SessionUser {
  return { id: Number(payload.sub), email: payload.email, name: payload.name };
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: EXPIRES_IN_SECONDS * 1000,
};
