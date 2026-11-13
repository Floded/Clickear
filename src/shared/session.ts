import jwt from "jsonwebtoken";

import type { Request } from "express";
import { PrismaClient } from "@prisma/client";

import type { UserPermission } from "./permissions.js";

export const prisma = new PrismaClient();

export const COOKIE_NAME = "auth_token";

// Sesión larga: 7 días por defecto, configurable en segundos vía .env
const EXPIRES_IN_SECONDS = Number(process.env.JWT_EXPIRES_IN) || 7 * 24 * 60 * 60;

export interface SessionPayload {
  sub: string;
  username: string;
  name: string;
  role: string;
}

// Usuario autenticado disponible en req.user (permisos resueltos)
export interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: string;
  permissions: UserPermission[];
}

export interface SessionUser {
  id: number;
  username: string;
  name: string;
  role: string;
  permissions: UserPermission[];
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

export function toSessionUser(user: AuthUser): SessionUser {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    permissions: user.permissions,
  };
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "none" as const,
  secure: true,
  path: "/",
  maxAge: EXPIRES_IN_SECONDS * 1000,
};

// Logging de intentos de autenticación (SOC 2: auditoría)
export async function logAuthAttempt(
  req: Request,
  token?: string,
  success: boolean = false,
  errorCode?: string
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id ?? null,
        action: success ? "login_success" : "login_failure",
        resource: "auth",
        details: {
          ip: req.ip,
          userAgent: req.get("User-Agent"),
          ...(token && { token: token.substring(0, 10) + "..." }),
          errorCode,
        },
        timestamp: new Date(),
      },
    });
  } catch (e) {
    // No bloquear la operación si falla el logging
    console.warn("Failed to log auth attempt:", e);
  }
}
