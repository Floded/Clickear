import ExcelJS from "exceljs";
import type { Response } from "express";
import { afterEach, afterAll, beforeEach, describe, expect, it } from "vitest";
import supertest from "supertest";

import {
  authCookie,
  cleanTables,
  createTestApp,
  createTestUser,
  prisma,
} from "../../test/setup.js";

let app: ReturnType<typeof createTestApp>;
let authHeader: string;

beforeEach(async () => {
  app = createTestApp();
  await cleanTables(["item_assignments", "inventory_items", "employees"]);
  const user = await createTestUser({
    email: "assignment-export@clickear.local",
    password: "ExportPass123!",
  });
  authHeader = authCookie(user);
});

afterEach(async () => {
  await cleanTables(["item_assignments", "inventory_items", "employees"]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const baseUrl = "/api/assignments/export";

async function getExport(url: string, cookie: string = authHeader) {
  const req = supertest(app).get(url);
  if (cookie) req.set("Cookie", cookie);
  return req
    .buffer(true)
    .parse((res: Response, callback) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => callback(null, Buffer.concat(chunks)));
    });
}

async function seedData() {
  const supplier = await prisma.supplier.create({ data: { name: "Proveedor Export" } });
  const item = await prisma.inventoryItem.create({
    data: { name: "Item Export", availableQuantity: 10, supplierId: supplier.id },
  });
  const employee = await prisma.employee.create({
    data: { fullName: "Empleado Export", dniOrFileNumber: "DNI-AEXP-1" },
  });
  return { supplier, item, employee };
}

async function readSheet(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Asignaciones");
  expect(sheet).toBeDefined();
  return sheet as ExcelJS.Worksheet;
}

describe("GET /api/assignments/export", () => {
  it("sin auth → 401", async () => {
    const res = await getExport(baseUrl, "");
    expect(res.status).toBe(401);
  });

  it("exporta asignaciones activas y devueltas con sus datos", async () => {
    const { item, employee } = await seedData();
    await prisma.itemAssignment.create({
      data: {
        inventoryItemId: item.id,
        employeeId: employee.id,
        quantityAssigned: 3,
        deliveryDate: new Date(),
      },
    });
    await prisma.itemAssignment.create({
      data: {
        inventoryItemId: item.id,
        employeeId: employee.id,
        quantityAssigned: 2,
        deliveryDate: new Date(Date.now() - 60_000),
        returnDate: new Date(),
      },
    });

    const res = await getExport(baseUrl);

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain(
      'attachment; filename="asignaciones-',
    );
    const sheet = await readSheet(res.body);
    expect(sheet.rowCount).toBe(3); // header + 2 asignaciones
    expect(sheet.getRow(1).getCell(1).value).toBe("Ítem");
    expect(sheet.getRow(2).getCell(1).value).toBe("Item Export");
    expect(sheet.getRow(2).getCell(2).value).toBe("Proveedor Export");
    expect(sheet.getRow(2).getCell(3).value).toBe("Empleado Export");
    expect(sheet.getRow(2).getCell(4).value).toBe(3);
    expect(sheet.getRow(2).getCell(7).value).toBe("ACTIVE");
    expect(sheet.getRow(3).getCell(7).value).toBe("RETURNED");
  });

  it("respeta el filtro status=ACTIVE", async () => {
    const { item, employee } = await seedData();
    await prisma.itemAssignment.create({
      data: {
        inventoryItemId: item.id,
        employeeId: employee.id,
        quantityAssigned: 3,
        deliveryDate: new Date(),
      },
    });
    await prisma.itemAssignment.create({
      data: {
        inventoryItemId: item.id,
        employeeId: employee.id,
        quantityAssigned: 2,
        deliveryDate: new Date(),
        returnDate: new Date(),
      },
    });

    const res = await getExport(`${baseUrl}?status=ACTIVE`);
    const sheet = await readSheet(res.body);

    expect(sheet.rowCount).toBe(2); // header + 1
    expect(sheet.getRow(2).getCell(7).value).toBe("ACTIVE");
  });

  it("sin asignaciones devuelve solo el header", async () => {
    await seedData();
    const res = await getExport(baseUrl);
    const sheet = await readSheet(res.body);

    expect(sheet.rowCount).toBe(1);
  });
});
