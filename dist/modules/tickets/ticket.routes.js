import { Router } from "express";
import { assignTicketSchema, createTicketSchema, listTicketsQuerySchema, ticketIdParamsSchema, ticketImageParamsSchema, updateTicketStatusSchema, } from "./ticket.dto.js";
import { ticketImageService } from "./ticket-image.service.js";
import { handleUploadError, MAX_IMAGES_PER_TICKET, ticketImageUpload, } from "./ticket-image.storage.js";
import { BadRequestError } from "../../shared/http-error.js";
import { fileDateSuffix, sendExcel, } from "../../shared/excel.js";
import { ticketService } from "./ticket.service.js";
export const ticketRouter = Router();
ticketRouter.get("/", async (req, res) => {
    const query = listTicketsQuerySchema.parse(req.query);
    res.json(await ticketService.list(query));
});
// Exportación a Excel de todos los tickets que cumplan los filtros (sin paginar)
ticketRouter.get("/export", async (req, res) => {
    const query = listTicketsQuerySchema.parse(req.query);
    const rows = await ticketService.exportRows(query);
    const sheet = {
        name: "Tickets",
        columns: [
            { header: "# Ticket", width: 14 },
            { header: "Título", width: 40 },
            { header: "Estado", width: 14 },
            { header: "GLPI (cerrado)", width: 16 },
            { header: "CUE", width: 14 },
            { header: "Establecimiento", width: 30 },
            { header: "Departamento", width: 18 },
            { header: "Localidad", width: 18 },
            { header: "Asignado a", width: 28 },
            { header: "Empleado activo", width: 14 },
            { header: "Apertura", width: 18 },
        ],
        rows,
    };
    await sendExcel(res, `tickets-${fileDateSuffix()}.xlsx`, [sheet]);
});
ticketRouter.get("/:id", async (req, res) => {
    const { id } = ticketIdParamsSchema.parse(req.params);
    res.json(await ticketService.getById(id));
});
ticketRouter.post("/", async (req, res) => {
    const input = createTicketSchema.parse(req.body);
    const ticket = await ticketService.create(input);
    res.status(201).json(ticket);
});
ticketRouter.patch("/:id/status", async (req, res) => {
    const { id } = ticketIdParamsSchema.parse(req.params);
    const { status } = updateTicketStatusSchema.parse(req.body);
    res.json(await ticketService.updateStatus(id, status));
});
// Asigna (employeeId > 0), reasigna o libera (employeeId null) el ticket
ticketRouter.patch("/:id/assignment", async (req, res) => {
    const { id } = ticketIdParamsSchema.parse(req.params);
    const input = assignTicketSchema.parse(req.body);
    res.json(await ticketService.assign(id, input));
});
// Imágenes de cierre del ticket (multipart, campo "images")
ticketRouter.post("/:id/images", ticketImageUpload.array("images", MAX_IMAGES_PER_TICKET), handleUploadError, async (req, res) => {
    const { id } = ticketIdParamsSchema.parse(req.params);
    const files = req.files ?? [];
    if (files.length === 0) {
        throw new BadRequestError("Envie al menos una imagen en el campo 'images'");
    }
    res.status(201).json(await ticketImageService.add(id, files.map((file) => ({
        fileName: file.filename,
        mimeType: file.mimetype,
        sizeBytes: file.size,
    }))));
});
ticketRouter.get("/:id/images", async (req, res) => {
    const { id } = ticketIdParamsSchema.parse(req.params);
    res.json(await ticketImageService.list(id));
});
ticketRouter.delete("/:id/images/:imageId", async (req, res) => {
    const { id, imageId } = ticketImageParamsSchema.parse(req.params);
    await ticketImageService.remove(id, imageId);
    res.status(204).end();
});
//# sourceMappingURL=ticket.routes.js.map