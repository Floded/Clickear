import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { createTestApp, authCookie, createTestUser, cleanTables, prisma } from "../../test/setup.js";
import supertest from "supertest";

let app: ReturnType<typeof createTestApp>;
let authHeader: string;

beforeEach(async () => {
  app = createTestApp();
  await cleanTables(["tickets", "ticket_assignments", "establishments", "employees"]);
  const user = await createTestUser({
    email: "ticket@clickear.local",
    password: "TicketPass123!",
  });
  authHeader = authCookie(user);
});

afterEach(async () => {
  await cleanTables(["tickets", "ticket_assignments", "establishments", "employees"]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const baseUrl = "/api/tickets";

async function seedEstablishment(cue = "CUE-TICKET-01") {
  return prisma.establishment.create({
    data: {
      cue,
      name: "Establecimiento Ticket",
      department: "Capital",
      locality: "Centro",
    },
  });
}

async function seedEmployee(overrides?: { fullName?: string; isActive?: boolean }) {
  return prisma.employee.create({
    data: {
      fullName: overrides?.fullName ?? "Empleado Test",
      dniOrFileNumber: `DNI-${Math.floor(Math.random() * 1000000)}`,
      isActive: overrides?.isActive ?? true,
    },
  });
}

describe("Tickets CRUD", () => {
  it("GET / → 200 con paginación", async () => {
    await seedEstablishment();
    await prisma.ticket.create({
      data: {
        ticketId: 1001n,
        establishmentCue: "CUE-TICKET-01",
        title: "Ticket 1",
        status: "ABIERTO",
      },
    });
    await prisma.ticket.create({
      data: {
        ticketId: 1002n,
        establishmentCue: "CUE-TICKET-01",
        title: "Ticket 2",
        status: "TERMINADO",
      },
    });

    const res = await supertest(app).get(baseUrl).set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it("GET /:id existente → 200", async () => {
    await seedEstablishment();
    const ticket = await prisma.ticket.create({
      data: {
        ticketId: 2001n,
        establishmentCue: "CUE-TICKET-01",
        title: "Ticket detalle",
        status: "ABIERTO",
      },
    });

    const res = await supertest(app)
      .get(`${baseUrl}/${ticket.ticketId}`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.ticketId).toBe(ticket.ticketId.toString());
    expect(res.body.title).toBe("Ticket detalle");
  });

  it("GET /:id inexistente → 404", async () => {
    const res = await supertest(app)
      .get(`${baseUrl}/9999999999999`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(404);
  });

  it("POST / válido → 201", async () => {
    await seedEstablishment();

    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({
        ticketId: 3001,
        establishmentCue: "CUE-TICKET-01",
        title: "Nuevo ticket",
        status: "ABIERTO",
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Nuevo ticket");
    expect(res.body.status).toBe("ABIERTO");
  });

  it("POST / body inválido (Zod) → 400 con detalles", async () => {
    const res = await supertest(app)
      .post(baseUrl)
      .set("Cookie", authHeader)
      .send({ ticketId: -1, title: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Datos invalidos");
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it("POST / sin auth → 401", async () => {
    const res = await supertest(app)
      .post(baseUrl)
      .send({ ticketId: 3002, title: "Sin auth" });
    expect(res.status).toBe(401);
  });

  it("PATCH /:id/status ABIERTO → EN PROGRESO → 200", async () => {
    await seedEstablishment();
    const ticket = await prisma.ticket.create({
      data: {
        ticketId: 4001n,
        establishmentCue: "CUE-TICKET-01",
        title: "Cambio estado",
        status: "ABIERTO",
      },
    });

    const res = await supertest(app)
      .patch(`${baseUrl}/${ticket.ticketId}/status`)
      .set("Cookie", authHeader)
      .send({ status: "EN PROGRESO" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("EN PROGRESO");
  });

  it("PATCH /:id/status TERMINADO → 200 (con imagen de cierre)", async () => {
    await seedEstablishment();
    const ticket = await prisma.ticket.create({
      data: {
        ticketId: 4002n,
        establishmentCue: "CUE-TICKET-01",
        title: "Ticket terminado",
        status: "ABIERTO",
      },
    });
    await prisma.ticketImage.create({
      data: {
        ticketId: ticket.ticketId,
        fileName: "cierre.png",
        mimeType: "image/png",
        sizeBytes: 100,
      },
    });

    const res = await supertest(app)
      .patch(`${baseUrl}/${ticket.ticketId}/status`)
      .set("Cookie", authHeader)
      .send({ status: "TERMINADO" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("TERMINADO");
  });

  it("PATCH /:id/status inexistente → 404", async () => {
    const res = await supertest(app)
      .patch(`${baseUrl}/9999999999999/status`)
      .set("Cookie", authHeader)
      .send({ status: "TERMINADO" });

    expect(res.status).toBe(404);
  });

  it("PATCH /:id/status inválido → 400", async () => {
    await seedEstablishment();
    const ticket = await prisma.ticket.create({
      data: {
        ticketId: 4003n,
        establishmentCue: "CUE-TICKET-01",
        title: "Estado inválido",
        status: "ABIERTO",
      },
    });

    const res = await supertest(app)
      .patch(`${baseUrl}/${ticket.ticketId}/status`)
      .set("Cookie", authHeader)
      .send({ status: "INEXISTENTE" });

    expect(res.status).toBe(400);
  });
});

describe("Tickets transiciones de estado", () => {
  async function seedStatusTicket(ticketId: bigint, status: string) {
    await seedEstablishment();
    return prisma.ticket.create({
      data: {
        ticketId,
        establishmentCue: "CUE-TICKET-01",
        title: `Ticket ${ticketId}`,
        status,
      },
    });
  }

  async function seedClosingImage(ticketId: bigint) {
    return prisma.ticketImage.create({
      data: {
        ticketId,
        fileName: `cierre-${ticketId}.png`,
        mimeType: "image/png",
        sizeBytes: 100,
      },
    });
  }

  const patchStatus = (ticketId: bigint, status: string) =>
    supertest(app)
      .patch(`${baseUrl}/${ticketId}/status`)
      .set("Cookie", authHeader)
      .send({ status });

  it("ABIERTO → TERMINADO sin imagen → 400", async () => {
    const ticket = await seedStatusTicket(8001n, "ABIERTO");

    const res = await patchStatus(ticket.ticketId, "TERMINADO");

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("sin imagenes");
  });

  it("ABIERTO → TERMINADO con imagen → 200", async () => {
    const ticket = await seedStatusTicket(8002n, "ABIERTO");
    await seedClosingImage(ticket.ticketId);

    const res = await patchStatus(ticket.ticketId, "TERMINADO");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("TERMINADO");
  });

  it("ABIERTO → REABIERTO → 400 (transición inválida)", async () => {
    const ticket = await seedStatusTicket(8003n, "ABIERTO");

    const res = await patchStatus(ticket.ticketId, "REABIERTO");

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Transicion de estado invalida");
  });

  it("EN PROGRESO → ABIERTO → 400", async () => {
    const ticket = await seedStatusTicket(8004n, "EN PROGRESO");

    const res = await patchStatus(ticket.ticketId, "ABIERTO");

    expect(res.status).toBe(400);
  });

  it("TERMINADO → REABIERTO → 200 y conserva las imagenes", async () => {
    const ticket = await seedStatusTicket(8005n, "TERMINADO");
    await seedClosingImage(ticket.ticketId);

    const res = await patchStatus(ticket.ticketId, "REABIERTO");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("REABIERTO");
    expect(await prisma.ticketImage.count({ where: { ticketId: ticket.ticketId } })).toBe(1);
  });

  it("REABIERTO → TERMINADO con la imagen previa (sin nuevas) → 200", async () => {
    const ticket = await seedStatusTicket(8006n, "REABIERTO");
    await seedClosingImage(ticket.ticketId);

    const res = await patchStatus(ticket.ticketId, "TERMINADO");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("TERMINADO");
  });

  it("REABIERTO → EN PROGRESO → 200", async () => {
    const ticket = await seedStatusTicket(8007n, "REABIERTO");

    const res = await patchStatus(ticket.ticketId, "EN PROGRESO");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("EN PROGRESO");
  });

  it("mismo estado → 200 (idempotente)", async () => {
    const ticket = await seedStatusTicket(8008n, "ABIERTO");

    const res = await patchStatus(ticket.ticketId, "ABIERTO");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ABIERTO");
  });
});

describe("Tickets asignación", () => {
  it("PATCH /:id/assignment asignar empleado activo → 200", async () => {
    await seedEstablishment();
    const employee = await seedEmployee();
    const ticket = await prisma.ticket.create({
      data: {
        ticketId: 5001n,
        establishmentCue: "CUE-TICKET-01",
        title: "Asignar ticket",
        status: "ABIERTO",
      },
    });

    const res = await supertest(app)
      .patch(`${baseUrl}/${ticket.ticketId}/assignment`)
      .set("Cookie", authHeader)
      .send({ employeeId: employee.id });

    expect(res.status).toBe(200);
    expect(res.body.assignedEmployeeId).toBe(employee.id);
  });

  it("PATCH /:id/assignment liberar (employeeId null) → 200", async () => {
    await seedEstablishment();
    const employee = await seedEmployee();
    const ticket = await prisma.ticket.create({
      data: {
        ticketId: 5002n,
        establishmentCue: "CUE-TICKET-01",
        title: "Liberar ticket",
        status: "ABIERTO",
        assignedEmployeeId: employee.id,
      },
    });
    await prisma.ticketAssignment.create({
      data: { ticketId: ticket.ticketId, employeeId: employee.id },
    });

    const res = await supertest(app)
      .patch(`${baseUrl}/${ticket.ticketId}/assignment`)
      .set("Cookie", authHeader)
      .send({ employeeId: null });

    expect(res.status).toBe(200);
    expect(res.body.assignedEmployeeId).toBeNull();
  });

  it("PATCH /:id/assignment ticket sin asignar → 200 (no-op)", async () => {
    await seedEstablishment();
    const ticket = await prisma.ticket.create({
      data: {
        ticketId: 5003n,
        establishmentCue: "CUE-TICKET-01",
        title: "Ticket sin asignar",
        status: "ABIERTO",
      },
    });

    const res = await supertest(app)
      .patch(`${baseUrl}/${ticket.ticketId}/assignment`)
      .set("Cookie", authHeader)
      .send({ employeeId: null });

    expect(res.status).toBe(200);
    expect(res.body.assignedEmployeeId).toBeNull();
  });

  it("PATCH /:id/assignment empleado inexistente → 404", async () => {
    await seedEstablishment();
    const ticket = await prisma.ticket.create({
      data: {
        ticketId: 5004n,
        establishmentCue: "CUE-TICKET-01",
        title: "Empleado inexistente",
        status: "ABIERTO",
      },
    });

    const res = await supertest(app)
      .patch(`${baseUrl}/${ticket.ticketId}/assignment`)
      .set("Cookie", authHeader)
      .send({ employeeId: 99999 });

    expect(res.status).toBe(404);
  });

  it("PATCH /:id/assignment empleado inactivo → 409", async () => {
    await seedEstablishment();
    const employee = await seedEmployee({ isActive: false });
    const ticket = await prisma.ticket.create({
      data: {
        ticketId: 5005n,
        establishmentCue: "CUE-TICKET-01",
        title: "Empleado inactivo",
        status: "ABIERTO",
      },
    });

    const res = await supertest(app)
      .patch(`${baseUrl}/${ticket.ticketId}/assignment`)
      .set("Cookie", authHeader)
      .send({ employeeId: employee.id });

    expect(res.status).toBe(409);
  });

  it("GET / con employeeId=none → tickets sin asignar", async () => {
    await seedEstablishment();
    await prisma.ticket.create({
      data: {
        ticketId: 6001n,
        establishmentCue: "CUE-TICKET-01",
        title: "Sin asignar",
        status: "ABIERTO",
      },
    });

    const res = await supertest(app)
      .get(`${baseUrl}?employeeId=none`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.every((t: any) => t.assignedEmployeeId === null)).toBe(true);
  });
});
