import { ForbiddenError } from "./http-error.js";
// Factory: exige que el usuario autenticado tenga uno de los roles indicados
export function requireRole(...roles) {
    return (req, _res, next) => {
        if (!roles.includes(req.user?.role ?? "")) {
            next(new ForbiddenError());
            return;
        }
        next();
    };
}
//# sourceMappingURL=require-role.js.map