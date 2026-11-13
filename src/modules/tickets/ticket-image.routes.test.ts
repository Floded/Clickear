import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

import supertest from "supertest";

import {
  createTestApp,
  authCookie,
  createTestUser,
  cleanTables,
  prisma,
} from "../../test/setup.js";
import { ticketImagesDir } from "./ticket-image.storage.js";

let app: ReturnType<typeof createTestApp>;
let authHeader: string;

// PNG 1x1 de un pixel, valido para subir en los tests
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

beforeEach(async () => {
  app = createTestApp();
  await cleanTables(["tickets", "ticket_images", "ticket_assignments", "establishments", "employees"]);
  const user = await createTestUser({
    username: "ticket-image",
    password: "TicketImagePass123!",
  });
  authHeader = authCookie(user);
});

afterEach(async () => {
  await cleanTables(["tickets", "ticket_images", "ticket_assignments", "establishments", "employees"]);
  // Limpia los archivos que quedaron del test
  const files = await fs.readdir(ticketImagesDir).catch(() => []);
  await Promise.all(files.map((f) => fs.unlink(path.join(ticketImagesDir, f)).catch(() => undefined)));
});

afterAll(async () => {
  await prisma.$disconnect();
});

const baseUrl = "/api/tickets";

async function seedTicket(status = "ABIERTO", ticketId = 7001n) {
  await prisma.establishment.create({
    data: { cue: `CUE-IMG-${ticketId}`, name: "Establecimiento Imagenes" },
  });
  return prisma.ticket.create({
    data: {
      ticketId,
      establishmentCue: `CUE-IMG-${ticketId}`,
      title: "Ticket con imagenes",
      status,
    },
  });
}

describe("POST /:id/images", () => {
  it("sube una imagen valida → 201, guarda registro y archivo en disco", async () => {
    const ticket = await seedTicket();

    const res = await supertest(app)
      .post(`${baseUrl}/${ticket.ticketId}/images`)
      .set("Cookie", authHeader)
      .attach("images", PNG_1PX, { filename: "foto.png", contentType: "image/png" });

    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].mimeType).toBe("image/png");
    expect(res.body[0].sizeBytes).toBe(PNG_1PX.length);
    expect(res.body[0].fileName).toMatch(/\.png$/);

    const stored = await prisma.ticketImage.findFirst({ where: { ticketId: ticket.ticketId } });
    expect(stored?.fileName).toBe(res.body[0].fileName);

    const onDisk = await fs
      .access(path.join(ticketImagesDir, res.body[0].fileName))
      .then(() => true)
      .catch(() => false);
    expect(onDisk).toBe(true);
  });

  it("sirve la imagen subida via /uploads → 200", async () => {
    const ticket = await seedTicket();
    const res = await supertest(app)
      .post(`${baseUrl}/${ticket.ticketId}/images`)
      .set("Cookie", authHeader)
      .attach("images", PNG_1PX, { filename: "foto.png", contentType: "image/png" });

    const served = await supertest(app).get(`/uploads/tickets/${res.body[0].fileName}`);
    expect(served.status).toBe(200);
    expect(served.headers["content-type"]).toContain("image/png");
  });

  it("sin auth → 401", async () => {
    const res = await supertest(app)
      .post(`${baseUrl}/7002/images`)
      .attach("images", PNG_1PX, { filename: "foto.png", contentType: "image/png" });
    expect(res.status).toBe(401);
  });

  it("sin archivos → 400", async () => {
    const ticket = await seedTicket();
    const res = await supertest(app)
      .post(`${baseUrl}/${ticket.ticketId}/images`)
      .set("Cookie", authHeader);
    expect(res.status).toBe(400);
  });

  it("mime no permitido (texto) → 400", async () => {
    const ticket = await seedTicket();
    const res = await supertest(app)
      .post(`${baseUrl}/${ticket.ticketId}/images`)
      .set("Cookie", authHeader)
      .attach("images", Buffer.from("no es imagen"), {
        filename: "nota.txt",
        contentType: "text/plain",
      });
    expect(res.status).toBe(400);
  });

  it("archivo mayor a 5 MB → 400", async () => {
    const ticket = await seedTicket();
    const res = await supertest(app)
      .post(`${baseUrl}/${ticket.ticketId}/images`)
      .set("Cookie", authHeader)
      .attach("images", Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: "grande.png",
        contentType: "image/png",
      });
    expect(res.status).toBe(400);
  });

  it("ticket TERMINADO → 409", async () => {
    const ticket = await seedTicket("TERMINADO");
    const res = await supertest(app)
      .post(`${baseUrl}/${ticket.ticketId}/images`)
      .set("Cookie", authHeader)
      .attach("images", PNG_1PX, { filename: "foto.png", contentType: "image/png" });
    expect(res.status).toBe(409);
  });

  it("ticket inexistente → 404", async () => {
    const res = await supertest(app)
      .post(`${baseUrl}/9999999999999/images`)
      .set("Cookie", authHeader)
      .attach("images", PNG_1PX, { filename: "foto.png", contentType: "image/png" });
    expect(res.status).toBe(404);
  });

  it("supera el maximo de 10 imagenes por ticket → 409", async () => {
    const ticket = await seedTicket();
    await prisma.ticketImage.createMany({
      data: Array.from({ length: 10 }, (_, i) => ({
        ticketId: ticket.ticketId,
        fileName: `preexistente-${i}.png`,
        mimeType: "image/png",
        sizeBytes: 1,
      })),
    });

    const res = await supertest(app)
      .post(`${baseUrl}/${ticket.ticketId}/images`)
      .set("Cookie", authHeader)
      .attach("images", PNG_1PX, { filename: "foto.png", contentType: "image/png" });
    expect(res.status).toBe(409);
  });

  it("mas de 10 archivos en una peticion → 400", async () => {
    const ticket = await seedTicket();
    let req = supertest(app)
      .post(`${baseUrl}/${ticket.ticketId}/images`)
      .set("Cookie", authHeader);
    for (let i = 0; i < 11; i++) {
      req = req.attach("images", PNG_1PX, { filename: `f${i}.png`, contentType: "image/png" });
    }
    const res = await req;
    expect(res.status).toBe(400);
  });
});

describe("GET /:id/images", () => {
  it("lista las imagenes del ticket → 200", async () => {
    const ticket = await seedTicket();
    await supertest(app)
      .post(`${baseUrl}/${ticket.ticketId}/images`)
      .set("Cookie", authHeader)
      .attach("images", PNG_1PX, { filename: "a.png", contentType: "image/png" })
      .attach("images", PNG_1PX, { filename: "b.png", contentType: "image/png" });

    const res = await supertest(app)
      .get(`${baseUrl}/${ticket.ticketId}/images`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("ticket inexistente → 404", async () => {
    const res = await supertest(app)
      .get(`${baseUrl}/9999999999999/images`)
      .set("Cookie", authHeader);
    expect(res.status).toBe(404);
  });

  it("sin auth → 401", async () => {
    const res = await supertest(app).get(`${baseUrl}/7002/images`);
    expect(res.status).toBe(401);
  });
});

describe("DELETE /:id/images/:imageId", () => {
  it("borra el registro y el archivo fisico → 204", async () => {
    const ticket = await seedTicket();
    const upload = await supertest(app)
      .post(`${baseUrl}/${ticket.ticketId}/images`)
      .set("Cookie", authHeader)
      .attach("images", PNG_1PX, { filename: "foto.png", contentType: "image/png" });
    const imageId = upload.body[0].id as number;
    const fileName = upload.body[0].fileName as string;

    const res = await supertest(app)
      .delete(`${baseUrl}/${ticket.ticketId}/images/${imageId}`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(204);
    expect(await prisma.ticketImage.findUnique({ where: { id: imageId } })).toBeNull();
    const onDisk = await fs
      .access(path.join(ticketImagesDir, fileName))
      .then(() => true)
      .catch(() => false);
    expect(onDisk).toBe(false);
  });

  it("imagen de otro ticket → 404", async () => {
    const ticket = await seedTicket("ABIERTO", 7001n);
    const other = await seedTicket("ABIERTO", 7002n);
    const upload = await supertest(app)
      .post(`${baseUrl}/${other.ticketId}/images`)
      .set("Cookie", authHeader)
      .attach("images", PNG_1PX, { filename: "foto.png", contentType: "image/png" });

    const res = await supertest(app)
      .delete(`${baseUrl}/${ticket.ticketId}/images/${upload.body[0].id}`)
      .set("Cookie", authHeader);

    expect(res.status).toBe(404);
  });

  it("sin auth → 401", async () => {
    const res = await supertest(app).delete(`${baseUrl}/7001/images/1`);
    expect(res.status).toBe(401);
  });
});
