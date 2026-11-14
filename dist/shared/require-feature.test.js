import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import supertest from "supertest";
import { authCookie, cleanDb, createTestApp, createTestUser, prisma } from "../test/setup.js";
let app;
beforeEach(async () => {
    app = createTestApp();
    await cleanDb();
    await prisma.user.deleteMany();
});
afterEach(async () => {
    await cleanDb();
});
afterAll(async () => {
    await prisma.$disconnect();
});
describe("requireFeature middleware", () => {
    it("permite lectura con permiso VIEW", async () => {
        const user = await createTestUser({
            username: "viewer",
            role: "GESTOR",
            permissions: [{ feature: "tickets", access: "VIEW" }],
        });
        const res = await supertest(app)
            .get("/api/tickets")
            .set("Cookie", authCookie(user));
        expect(res.status).toBe(200);
    });
    it("bloquea escritura con permiso VIEW", async () => {
        const user = await createTestUser({
            username: "viewer",
            role: "GESTOR",
            permissions: [{ feature: "tickets", access: "VIEW" }],
        });
        const res = await supertest(app)
            .post("/api/tickets")
            .set("Cookie", authCookie(user))
            .send({});
        expect(res.status).toBe(403);
        expect(res.body.error).toContain("permisos");
    });
    it("permite escritura con permiso EDIT", async () => {
        const user = await createTestUser({
            username: "editor",
            role: "GESTOR",
            permissions: [{ feature: "tickets", access: "EDIT" }],
        });
        // El body puede ser inválido, pero no debe ser 403 por permisos
        const res = await supertest(app)
            .post("/api/tickets")
            .set("Cookie", authCookie(user))
            .send({});
        expect(res.status).not.toBe(403);
    });
    it("bloquea acceso a una funcionalidad no asignada", async () => {
        const user = await createTestUser({
            username: "solo-tickets",
            role: "GESTOR",
            permissions: [{ feature: "tickets", access: "EDIT" }],
        });
        const res = await supertest(app)
            .get("/api/budgets")
            .set("Cookie", authCookie(user));
        expect(res.status).toBe(403);
    });
    it("ADMIN accede a todas las funcionalidades", async () => {
        const admin = await createTestUser({ username: "admin", role: "ADMIN" });
        const res = await supertest(app)
            .get("/api/budgets")
            .set("Cookie", authCookie(admin));
        expect(res.status).toBe(200);
    });
});
//# sourceMappingURL=require-feature.test.js.map