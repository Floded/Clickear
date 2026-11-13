import "../env.js";

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createApp } from "../app.js";
import { signSession, COOKIE_NAME } from "../shared/session.js";
import type { Express } from "express";
import type { SessionPayload } from "../shared/session.js";

export const prisma = new PrismaClient();

export interface TestUser {
  id: number;
  username: string;
  name: string;
  role: string;
}

export function createTestApp(): Express {
  return createApp();
}

export function authCookie(user: TestUser): string {
  const payload: SessionPayload = {
    sub: String(user.id),
    username: user.username,
    name: user.name,
    role: user.role,
  };
  const token = signSession(payload);
  return `${COOKIE_NAME}=${token}`;
}

export async function createTestUser(overrides?: {
  username?: string;
  password?: string;
  name?: string;
  role?: string;
}): Promise<TestUser> {
  const username = overrides?.username ?? "testuser";
  const password = overrides?.password ?? "TestPass123!";
  const name = overrides?.name ?? "Test User";
  const role = overrides?.role ?? "GESTOR";

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { username },
    update: { passwordHash, name, role },
    create: { username, passwordHash, name, role },
  });

  return { id: user.id, username: user.username, name: user.name, role: user.role };
}

export async function cleanDb(): Promise<void> {
  // No truncar 'users': se necesita para tests de auth que corren en paralelo
  const tables = [
    "audit_logs",
    "item_assignments",
    "ticket_assignments",
    "budget_lines",
    "invoices",
    "tickets",
    "establishments",
    "budgets",
    "inventory_items",
    "dispatch_technicians",
    "dispatch_orders",
    "technicians",
    "suppliers",
    "employees",
  ];

  await prisma.$queryRawUnsafe(
    `TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(", ")} CASCADE`,
  );
}

export async function cleanTables(tableNames: string[]): Promise<void> {
  if (tableNames.length === 0) return;
  await prisma.$queryRawUnsafe(
    `TRUNCATE TABLE ${tableNames.map((t) => `"${t}"`).join(", ")} CASCADE`,
  );
}
