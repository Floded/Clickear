import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { createTestApp, authCookie, createTestUser, cleanDb, prisma } from "../../test/setup.js";
import supertest from "supertest";

let app: ReturnType<typeof createTestApp>;

beforeEach(async () => {
  app = createTestApp();
  await cleanDb();
});

afterEach(async () => {
  await cleanDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/auth/login", () => {
  it("con credenciales válidas → 200, cookie seteada y usuario con rol en body", async () => {
    await createTestUser({ username: "admin", password: "Admin123!", role: "ADMIN" });

    const res = await supertest(app).post("/api/auth/login").send({
      username: "admin",
      password: "Admin123!",
    });

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe("admin");
    expect(res.body.user.role).toBe("ADMIN");
    expect(res.headers["set-cookie"]).toBeDefined();
    expect(res.headers["set-cookie"][0]).toContain("auth_token=");
  });

  it("normaliza el username a minúsculas", async () => {
    await createTestUser({ username: "admin", password: "Admin123!" });

    const res = await supertest(app).post("/api/auth/login").send({
      username: "Admin",
      password: "Admin123!",
    });

    expect(res.status).toBe(200);
  });

  it("con credenciales inválidas → 401", async () => {
    await createTestUser({ username: "admin", password: "Admin123!" });

    const res = await supertest(app).post("/api/auth/login").send({
      username: "admin",
      password: "WrongPass123!",
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Credenciales incorrectas");
  });

  it("con username inexistente → 401", async () => {
    const res = await supertest(app).post("/api/auth/login").send({
      username: "noexiste",
      password: "Admin123!",
    });

    expect(res.status).toBe(401);
  });

  it("con body inválido (Zod) → 400 con detalles de validación", async () => {
    const res = await supertest(app).post("/api/auth/login").send({
      username: "no",
      password: "",
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Datos invalidos");
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });
});

describe("POST /api/auth/logout", () => {
  it("→ 200 y cookie limpiada", async () => {
    const res = await supertest(app).post("/api/auth/logout");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.headers["set-cookie"]).toBeDefined();
    expect(res.headers["set-cookie"][0]).toContain("auth_token=");
    // La cookie se limpia expiándola en el pasado
    expect(res.headers["set-cookie"][0]).toContain("Expires=Thu, 01 Jan 1970");
  });
});

describe("GET /api/auth/me", () => {
  it("con cookie válida → 200 y usuario con rol y permisos", async () => {
    const user = await createTestUser({
      username: "meuser",
      password: "MePass123!",
      role: "REVISADOR",
      permissions: [{ feature: "tickets", access: "VIEW" }],
    });

    const res = await supertest(app)
      .get("/api/auth/me")
      .set("Cookie", authCookie(user));

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe(user.username);
    expect(res.body.user.name).toBe(user.name);
    expect(res.body.user.role).toBe("REVISADOR");
    expect(res.body.user.permissions).toEqual([{ feature: "tickets", access: "VIEW" }]);
  });

  it("usuario sin funcionalidades asignadas → login rechazado", async () => {
    await createTestUser({
      username: "sinpermisos",
      password: "SinPermisos123!",
      role: "GESTOR",
      permissions: [],
    });

    const res = await supertest(app).post("/api/auth/login").send({
      username: "sinpermisos",
      password: "SinPermisos123!",
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("funcionalidades");
  });

  it("sin cookie → 401", async () => {
    const res = await supertest(app).get("/api/auth/me");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Sesión no encontrada");
  });
});
