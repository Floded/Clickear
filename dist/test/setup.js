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
        username: user.username,
        name: user.name,
        role: user.role,
    };
    const token = signSession(payload);
    return `${COOKIE_NAME}=${token}`;
}
const ALL_FEATURES = ["tickets", "organization", "inventory", "budgets", "invoices"];
export async function createTestUser(overrides) {
    const username = overrides?.username ?? "testuser";
    const password = overrides?.password ?? "TestPass123!";
    const name = overrides?.name ?? "Test User";
    const role = overrides?.role ?? "GESTOR";
    // Por defecto, usuarios de prueba no-admin tienen acceso total para no romper tests existentes
    const permissions = overrides?.permissions ??
        (role === "ADMIN"
            ? []
            : ALL_FEATURES.map((feature) => ({ feature, access: "EDIT" })));
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.upsert({
        where: { username },
        update: { passwordHash, name, role },
        create: { username, passwordHash, name, role },
    });
    await prisma.userPermission.deleteMany({ where: { userId: user.id } });
    if (permissions.length) {
        await prisma.userPermission.createMany({
            data: permissions.map((p) => ({ userId: user.id, feature: p.feature, access: p.access })),
        });
    }
    return { id: user.id, username: user.username, name: user.name, role: user.role };
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