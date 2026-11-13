import type { RequestHandler } from "express";

import { ForbiddenError } from "./http-error.js";
import { canEdit, canView, type FeatureKey } from "./permissions.js";

// Exige permiso sobre una funcionalidad: GET/HEAD/OPTIONS → VIEW, el resto → EDIT
export function requireFeature(feature: FeatureKey): RequestHandler {
  return (req, _res, next) => {
    const user = req.user;
    if (!user) {
      next(new ForbiddenError());
      return;
    }

    const readOnly = req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS";
    const allowed = readOnly
      ? canView(user.role, user.permissions ?? [], feature)
      : canEdit(user.role, user.permissions ?? [], feature);

    if (!allowed) {
      next(new ForbiddenError("No tenés permisos para esta funcionalidad"));
      return;
    }

    next();
  };
}
