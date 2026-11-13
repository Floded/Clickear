import bcrypt from "bcryptjs";

import { prisma } from "../../prisma/client.js";
import { HttpError } from "../../shared/http-error.js";
import { signSession, type SessionUser } from "../../shared/session.js";
import { resolvePermissions, type UserPermission } from "../../shared/permissions.js";
import type { LoginInput } from "./auth.dto.js";

// Hash de relleno para que un username inexistente tarde lo mismo que uno válido
let dummyHash: string | null = null;
async function getDummyHash(): Promise<string> {
  dummyHash ??= await bcrypt.hash("timing-equalizer", 10);
  return dummyHash;
}

export interface LoginResult {
  token: string;
  user: SessionUser;
}

async function login(input: LoginInput): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { username: input.username.toLowerCase() },
    include: { permissions: { select: { feature: true, access: true } } },
  });

  const isValid = await bcrypt.compare(
    input.password,
    user?.passwordHash ?? (await getDummyHash()),
  );
  if (!user || !isValid) {
    throw new HttpError(401, "Credenciales incorrectas");
  }

  const permissions = resolvePermissions(
    user.role,
    user.permissions as UserPermission[],
  );

  if (user.role !== "ADMIN" && permissions.length === 0) {
    throw new HttpError(403, "No tenés funcionalidades asignadas. Contactá al administrador.");
  }

  const sessionUser: SessionUser = {
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
