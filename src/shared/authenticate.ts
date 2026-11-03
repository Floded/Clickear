import type { RequestHandler } from "express";

import { COOKIE_NAME, verifySession } from "./session.js";
import { UnauthorizedError } from "./http-error.js";

// Middleware global: exige sesión válida y deja el usuario en req.user
export const authenticate: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    next(new UnauthorizedError("Sesión no encontrada"));
    return;
  }

  try {
    req.user = verifySession(token);
    next();
  } catch {
    next(new UnauthorizedError("Sesión inválida o expirada"));
  }
};
