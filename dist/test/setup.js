import "../env.js";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createApp } from "../app.js";
import { signSession, COOKIE_NAME } from "../shared/session.js";
export const prisma = new PrismaClient();
export function createTestApp() {
    return createApp();
}
export function authCookie(user) {
    const payload = {
        sub: String(user.id),
        email: user.email,
        name: user.name,
    };
    const token = signSession(payload);
    return `${COOKIE_NAME}=${token}`;
}
export async function createTestUser(overrides) {
    const email = overrides?.email ?? "test@clickear.local";
    const password = overrides?.password ?? "TestPass123!";
    const name = overrides?.name ?? "Test User";
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.upsert({
        where: { email },
        update: { passwordHash, name },
        create: { email, passwordHash, name },
    });
    return { id: user.id, email: user.email, name: user.name };
}
export async function cleanDb() {
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
    await prisma.$queryRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(", ")} CASCADE`);
}
export async function cleanTables(tableNames) {
    if (tableNames.length === 0)
        return;
    await prisma.$queryRawUnsafe(`TRUNCATE TABLE ${tableNames.map((t) => `"${t}"`).join(", ")} CASCADE`);
}
//# sourceMappingURL=setup.js.map