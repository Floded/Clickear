import bcrypt from "bcryptjs";
import { prisma } from "../../prisma/client.js";
import { HttpError } from "../../shared/http-error.js";
import { signSession } from "../../shared/session.js";
import { resolvePermissions } from "../../shared/permissions.js";
// Hash de relleno para que un username inexistente tarde lo mismo que uno válido
let dummyHash = null;
async function getDummyHash() {
    dummyHash ??= await bcrypt.hash("timing-equalizer", 10);
    return dummyHash;
}
async function login(input) {
    const user = await prisma.user.findUnique({
        where: { username: input.username.toLowerCase() },
        include: { permissions: { select: { feature: true, access: true } } },
    });
    const isValid = await bcrypt.compare(input.password, user?.passwordHash ?? (await getDummyHash()));
    if (!user || !isValid) {
        throw new HttpError(401, "Credenciales incorrectas");
    }
    const permissions = resolvePermissions(user.role, user.permissions);
    if (user.role !== "ADMIN" && permissions.length === 0) {
        throw new HttpError(403, "No tenés funcionalidades asignadas. Contactá al administrador.");
    }
    const sessionUser = {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        permissions,
    };
    return {
        token: signSession({
            sub: String(user.id),
            username: user.username,
            name: user.name,
            role: user.role,
        }),
        user: sessionUser,
    };
}
export const authService = { login };
//# sourceMappingURL=auth.service.js.map