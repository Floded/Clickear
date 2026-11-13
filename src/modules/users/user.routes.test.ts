import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { createTestApp, authCookie, createTestUser, cleanDb, prisma } from "../../test/setup.js";
import supertest from "supertest";

let app: ReturnType<typeof createTestApp>;
let adminCookie: string;
let gestorCookie: string;

beforeEach(async () => {
  app = createTestApp();
  await cleanDb();
  // cleanDb no trunca users: este módulo necesita un estado conocido de la tabla
  await prisma.user.deleteMany();
  const admin = await createTestUser({ username: "admin", role: "ADMIN" });
  const gestor = await createTestUser({ username: "gestor", role: "GESTOR" });
  adminCookie = authCookie(admin);
  gestorCookie = authCookie(gestor);
});

afterEach(async () => {
  await cleanDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const VALID_PASSWORD = "Fuerte123!";

describe("GET /api/users", () => {
  it("ADMIN → 200 con la lista de usuarios sin hash", async () => {
    const res = await supertest(app).get("/api/users").set("Cookie", adminCookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    for (const user of res.body) {
      expect(user).not.toHaveProperty("passwordHash");
      expect(user).toHaveProperty("username");
      expect(user).toHaveProperty("role");
    }
  });

  it("GESTOR → 403", async () => {
    const res = await supertest(app).get("/api/users").set("Cookie", gestorCookie);

    expect(res.status).toBe(403);
  });

  it("sin sesión → 401", async () => {
    const res = await supertest(app).get("/api/users");

    expect(res.status).toBe(401);
  });
});

describe("POST /api/users", () => {
  it("ADMIN → 201 con usuario creado", async () => {
    const res = await supertest(app)
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({
        username: "Revisor01",
        name: "Revisor Uno",
        password: VALID_PASSWORD,
        role: "REVISADOR",
      });

    expect(res.status).toBe(201);
    expect(res.body.username).toBe("revisor01");
    expect(res.body.role).toBe("REVISADOR");
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("username duplicado → 409", async () => {
    const res = await supertest(app)
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({
        username: "gestor",
        name: "Duplicado",
        password: VALID_PASSWORD,
        role: "GESTOR",
      });

    expect(res.status).toBe(409);
  });

  it("username con caracteres inválidos → 400", async () => {
    const res = await supertest(app)
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({
        username: "con espacio!",
        name: "Inválido",
        password: VALID_PASSWORD,
        role: "GESTOR",
      });

    expect(res.status).toBe(400);
  });

  it("contraseña débil → 400", async () => {
    const res = await supertest(app)
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({
        username: "debil",
        name: "Débil",
        password: "corta",
        role: "GESTOR",
      });

    expect(res.status).toBe(400);
  });

  it("GESTOR → 403", async () => {
    const res = await supertest(app)
      .post("/api/users")
      .set("Cookie", gestorCookie)
      .send({
        username: "otro",
        name: "Otro",
        password: VALID_PASSWORD,
        role: "GESTOR",
      });

    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/users/:id", () => {
  it("ADMIN → 200 al cambiar nombre y rol", async () => {
    const gestor = await prisma.user.findUnique({ where: { username: "gestor" } });

    const res = await supertest(app)
      .patch(`/api/users/${gestor!.id}`)
      .set("Cookie", adminCookie)
      .send({ name: "Gestor Renombrado", role: "REVISADOR" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Gestor Renombrado");
    expect(res.body.role).toBe("REVISADOR");
  });

  it("cambiar contraseña → login funciona con la nueva", async () => {
    const gestor = await prisma.user.findUnique({ where: { username: "gestor" } });

    const res = await supertest(app)
      .patch(`/api/users/${gestor!.id}`)
      .set("Cookie", adminCookie)
      .send({ password: "NuevaClave99!" });

    expect(res.status).toBe(200);

    const login = await supertest(app).post("/api/auth/login").send({
      username: "gestor",
      password: "NuevaClave99!",
    });
    expect(login.status).toBe(200);
  });

  it("quitar el rol al último ADMIN → 409", async () => {
    const admin = await prisma.user.findUnique({ where: { username: "admin" } });

    const res = await supertest(app)
      .patch(`/api/users/${admin!.id}`)
      .set("Cookie", adminCookie)
      .send({ role: "GESTOR" });

    expect(res.status).toBe(409);
  });

  it("usuario inexistente → 404", async () => {
    const res = await supertest(app)
      .patch("/api/users/99999")
      .set("Cookie", adminCookie)
      .send({ name: "Nadie" });

    expect(res.status).toBe(404);
  });

  it("GESTOR → 403", async () => {
    const gestor = await prisma.user.findUnique({ where: { username: "gestor" } });

    const res = await supertest(app)
      .patch(`/api/users/${gestor!.id}`)
      .set("Cookie", gestorCookie)
      .send({ name: "Hackeado" });

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/users/:id", () => {
  it("ADMIN → 204 al eliminar un usuario", async () => {
    const gestor = await prisma.user.findUnique({ where: { username: "gestor" } });

    const res = await supertest(app)
      .delete(`/api/users/${gestor!.id}`)
      .set("Cookie", adminCookie);

    expect(res.status).toBe(204);
  });

  it("eliminar al último ADMIN → 409", async () => {
    const admin = await prisma.user.findUnique({ where: { username: "admin" } });

    const res = await supertest(app)
      .delete(`/api/users/${admin!.id}`)
      .set("Cookie", adminCookie);

    expect(res.status).toBe(409);
  });

  it("usuario inexistente → 404", async () => {
    const res = await supertest(app)
      .delete("/api/users/99999")
      .set("Cookie", adminCookie);

    expect(res.status).toBe(404);
  });

  it("GESTOR → 403", async () => {
    const admin = await prisma.user.findUnique({ where: { username: "admin" } });

    const res = await supertest(app)
      .delete(`/api/users/${admin!.id}`)
      .set("Cookie", gestorCookie);

    expect(res.status).toBe(403);
  });
});
