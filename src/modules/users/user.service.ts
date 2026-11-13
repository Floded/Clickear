import bcrypt from "bcryptjs";

import { prisma } from "../../prisma/client.js";
import { ConflictError, NotFoundError } from "../../shared/http-error.js";
import { resolvePermissions, type UserPermission } from "../../shared/permissions.js";
import type { CreateUserInput, PermissionInput, UpdateUserInput } from "./user.dto.js";

interface UserRow {
  id: number;
  username: string;
  name: string;
  role: string;
  createdAt: Date;
  permissions: { feature: string; access: string }[];
}

// Vista pública del usuario: nunca expone el hash, permisos resueltos
function toPublicUser(user: UserRow) {
  const assigned = user.permissions as UserPermission[];
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    permissions: resolvePermissions(user.role, assigned),
  };
}

const withPermissions = {
  permissions: { select: { feature: true, access: true } },
} as const;

function normalizePermissions(role: string, permissions: PermissionInput[]) {
  // El ADMIN tiene acceso total implícito; no persistimos permisos redundantes
  return role === "ADMIN" ? [] : permissions;
}

async function list() {
  const users = await prisma.user.findMany({
    orderBy: { username: "asc" },
    include: withPermissions,
  });
  return users.map((u) => toPublicUser(u as unknown as UserRow));
}

async function create(input: CreateUserInput) {
  const existing = await prisma.user.findUnique({
    where: { username: input.username },
  });
  if (existing) {
    throw new ConflictError(`El usuario '${input.username}' ya existe`);
  }

  const permissions = normalizePermissions(input.role, input.permissions ?? []);

  const user = await prisma.user.create({
    data: {
      username: input.username,
      name: input.name,
      role: input.role,
      passwordHash: await bcrypt.hash(input.password, 10),
      permissions: permissions.length
        ? { create: permissions.map((p) => ({ feature: p.feature, access: p.access })) }
        : undefined,
    },
    include: withPermissions,
  });
  return toPublicUser(user as unknown as UserRow);
}

// Regla de negocio: siempre debe existir al menos un ADMIN
async function isLastAdmin(id: number): Promise<boolean> {
  const admins = await prisma.user.count({ where: { role: "ADMIN" } });
  if (admins > 1) return false;
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  return user?.role === "ADMIN";
}

async function update(id: number, input: UpdateUserInput) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: withPermissions,
  });
  if (!user) throw new NotFoundError("Usuario no encontrado");

  const nextRole = input.role ?? user.role;
  if (input.role && input.role !== user.role && (await isLastAdmin(id))) {
    throw new ConflictError("No se puede quitar el último administrador");
  }

  if (
    input.username &&
    input.username !== user.username &&
    (await prisma.user.findUnique({ where: { username: input.username } }))
  ) {
    throw new ConflictError(`El usuario '${input.username}' ya existe`);
  }

  const replacePermissions = input.permissions !== undefined || (input.role && input.role !== user.role);
  const permissions = input.permissions !== undefined
    ? normalizePermissions(nextRole, input.permissions)
    : normalizePermissions(nextRole, (user.permissions as UserPermission[]));

  const updated = await prisma.$transaction(async (tx) => {
    if (replacePermissions) {
      await tx.userPermission.deleteMany({ where: { userId: id } });
      if (permissions.length) {
        await tx.userPermission.createMany({
          data: permissions.map((p) => ({
            userId: id,
            feature: p.feature,
            access: p.access,
          })),
        });
      }
    }

    return tx.user.update({
      where: { id },
      data: {
        ...(input.username && { username: input.username }),
        ...(input.name && { name: input.name }),
        ...(input.role && { role: input.role }),
        ...(input.password && { passwordHash: await bcrypt.hash(input.password, 10) }),
      },
      include: withPermissions,
    });
  });

  return toPublicUser(updated as unknown as UserRow);
}

async function remove(id: number) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError("Usuario no encontrado");

  if (await isLastAdmin(id)) {
    throw new ConflictError("No se puede eliminar el último administrador");
  }

  await prisma.user.delete({ where: { id } });
}

export const userService = { list, create, update, remove };
