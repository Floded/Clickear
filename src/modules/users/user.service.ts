import bcrypt from "bcryptjs";

import { prisma } from "../../prisma/client.js";
import { ConflictError, NotFoundError } from "../../shared/http-error.js";
import type { CreateUserInput, UpdateUserInput } from "./user.dto.js";

// Vista pública del usuario: nunca expone el hash
function toPublicUser(user: {
  id: number;
  username: string;
  name: string;
  role: string;
  createdAt: Date;
}) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}

async function list() {
  const users = await prisma.user.findMany({
    orderBy: { username: "asc" },
  });
  return users.map(toPublicUser);
}

async function create(input: CreateUserInput) {
  const existing = await prisma.user.findUnique({
    where: { username: input.username },
  });
  if (existing) {
    throw new ConflictError(`El usuario '${input.username}' ya existe`);
  }

  const user = await prisma.user.create({
    data: {
      username: input.username,
      name: input.name,
      role: input.role,
      passwordHash: await bcrypt.hash(input.password, 10),
    },
  });
  return toPublicUser(user);
}

// Regla de negocio: siempre debe existir al menos un ADMIN
async function isLastAdmin(id: number): Promise<boolean> {
  const admins = await prisma.user.count({ where: { role: "ADMIN" } });
  if (admins > 1) return false;
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  return user?.role === "ADMIN";
}

async function update(id: number, input: UpdateUserInput) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError("Usuario no encontrado");

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

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(input.username && { username: input.username }),
      ...(input.name && { name: input.name }),
      ...(input.role && { role: input.role }),
      ...(input.password && { passwordHash: await bcrypt.hash(input.password, 10) }),
    },
  });
  return toPublicUser(updated);
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
