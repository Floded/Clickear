import type { RequestHandler } from "express";

import { prisma } from "../prisma/client.js";
import { UnauthorizedError } from "./http-error.js";
import {
  COOKIE_NAME,
  logAuthAttempt,
  verifySession,
  type AuthUser,
} from "./session.js";
import { resolvePermissions, type UserPermission } from "./permissions.js";

// Middleware global: exige sesión válida, carga permisos actuales y registra intento
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    await logAuthAttempt(req, undefined, false, "missing_token");
    next(new UnauthorizedError("Sesión no encontrada"));
    return;
  }

  try {
    const payload = verifySession(token);
    const user = await prisma.user.findUnique({
      where: { id: Number(payload.sub) },
      include: { permissions: { select: { feature: true, access: true } } },
    });

    if (!user) {
      await logAuthAttempt(req, token, false, "user_not_found");
      next(new UnauthorizedError("Sesión inválida o expirada"));
      return;
    }

    const permissions = resolvePermissions(
      user.role,
      user.permissions as UserPermission[],
    );
    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      permissions,
    };

    req.user = authUser;
    await logAuthAttempt(req, token, true);
    next();
  } catch {
    await logAuthAttempt(req, token, false, "invalid_token");
    next(new UnauthorizedError("Sesión inválida o expirada"));
  }
};
