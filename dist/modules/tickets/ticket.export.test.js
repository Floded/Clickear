import ExcelJS from "exceljs";
import { afterEach, afterAll, beforeEach, describe, expect, it } from "vitest";
import supertest from "supertest";
import { authCookie, cleanTables, createTestApp, createTestUser, prisma, } from "../../test/setup.js";
let app;
let authHeader;
beforeEach(async () => {
    app = createTestApp();
    await cleanTables(["tickets", "establishments", "employees"]);
    const user = await createTestUser({
        email: "ticket-export@clickear.local",
        password: "ExportPass123!",
    });
    authHeader = authCookie(user);
});
afterEach(async () => {
    await cleanTables(["tickets", "establishments", "employees"]);
});
afterAll(async () => {
    await prisma.$disconnect();
});
const baseUrl = "/api/tickets/export";
// Superagent no parsea binarios por defecto: acumula los chunks a mano
async function getExport(url, cookie = authHeader) {
    const req = supertest(app).get(url);
    if (cookie)
        req.set("Cookie", cookie);
    return req
        .buffer(true)
        .parse((res, callback) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
    });
}
async function seedTicket(input) {
    return prisma.ticket.create({
        data: {
            ticketId: input.ticketId,
            title: input.title,
            status: input.status,
            establishmentCue: input.establishmentCue,
            assignedEmployeeId: input.employeeId,
            openingTimestamp: input.opening,
        },
    });
}
async function readSheet(buffer) {
    const workbook = new ExcelJS.Workbook();
    // exceljs declara su propio Buffer global; tipamos al parámetro de load
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet("Tickets");
    expect(sheet).toBeDefined();
    return sheet;
}
describe("GET /api/tickets/export", () => {
    it("sin auth → 401", async () => {
        const res = await getExport(baseUrl, "");
        expect(res.status).toBe(401);
    });
    it("exporta todos los tickets sin paginar", async () => {
        await seedTicket({ ticketId: BigInt(100), title: "Falla A" });
        await seedTicket({
            ticketId: BigInt(101),
            title: "Falla B",
            status: "TERMINADO",
        });
        await seedTicket({ ticketId: BigInt(102), title: "Falla C" });
        const res = await getExport(baseUrl);
        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toContain("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        expect(res.headers["content-disposition"]).toContain('attachment; filename="tickets-');
        const sheet = await readSheet(res.body);
        expect(sheet.rowCount).toBe(4); // header + 3 tickets
        expect(sheet.getRow(1).getCell(1).value).toBe("# Ticket");
        expect(sheet.getRow(2).getCell(1).value).toBe("100");
        expect(sheet.getRow(2).getCell(3).value).toBe("ABIERTO");
    });
    it("incluye establecimiento y empleado asignado", async () => {
        await prisma.establishment.create({
            data: {
                cue: "700001",
                name: "Escuela Export",
                department: "La Plata",
                locality: "La Plata",
            },
        });
        const employee = await prisma.employee.create({
            data: { fullName: "Empleado Export", dniOrFileNumber: "DNI-EXP-1" },
        });
        await seedTicket({
            ticketId: BigInt(200),
            title: "Con establecimiento",
            establishmentCue: "700001",
            employeeId: employee.id,
        });
        const res = await getExport(baseUrl);
        const sheet = await readSheet(res.body);
        const row = sheet.getRow(2);
        expect(row.getCell(5).value).toBe("700001");
        expect(row.getCell(6).value).toBe("Escuela Export");
        expect(row.getCell(9).value).toBe("Empleado Export");
        expect(row.getCell(10).value).toBe("Sí");
    });
    it("respeta el filtro de estado", async () => {
        await seedTicket({ ticketId: BigInt(300), title: "Abierto" });
        await seedTicket({
            ticketId: BigInt(301),
            title: "Cerrado",
            status: "TERMINADO",
        });
        const res = await getExport(`${baseUrl}?status=TERMINADO`);
        const sheet = await readSheet(res.body);
        expect(sheet.rowCount).toBe(2); // header + 1
        expect(sheet.getRow(2).getCell(1).value).toBe("301");
    });
    it("devuelve hoja vacía (solo header) sin tickets", async () => {
        const res = await getExport(baseUrl);
        const sheet = await readSheet(res.body);
        expect(sheet.rowCount).toBe(1);
        expect(sheet.getRow(1).getCell(2).value).toBe("Título");
    });
    it("respeta el rango de fechas de apertura", async () => {
        await seedTicket({
            ticketId: BigInt(400),
            title: "En rango",
            opening: new Date("2026-06-15T10:00:00Z"),
        });
        await seedTicket({
            ticketId: BigInt(401),
            title: "Fuera de rango",
            opening: new Date("2026-01-05T10:00:00Z"),
        });
        const res = await getExport(`${baseUrl}?from=${encodeURIComponent("2026-06-01T00:00:00.000Z")}` +
            `&to=${encodeURIComponent("2026-06-30T23:59:59.999Z")}`);
        const sheet = await readSheet(res.body);
        expect(sheet.rowCount).toBe(2); // header + 1
        expect(sheet.getRow(2).getCell(1).value).toBe("400");
    });
    it("sin rango exporta tickets con y sin fecha de apertura", async () => {
        await seedTicket({ ticketId: BigInt(500), title: "Con fecha", opening: new Date() });
        await seedTicket({ ticketId: BigInt(501), title: "Sin fecha" });
        const res = await getExport(baseUrl);
        const sheet = await readSheet(res.body);
        expect(sheet.rowCount).toBe(3);
    });
});
//# sourceMappingURL=ticket.export.test.js.map