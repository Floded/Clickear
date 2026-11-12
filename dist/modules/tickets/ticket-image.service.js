import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../../prisma/client.js";
import { ConflictError, NotFoundError } from "../../shared/http-error.js";
import { MAX_IMAGES_PER_TICKET, ticketImagesDir, } from "./ticket-image.storage.js";
export const ticketImageService = {
    async list(ticketId) {
        await assertTicketExists(ticketId);
        return prisma.ticketImage.findMany({
            where: { ticketId },
            orderBy: { createdAt: "asc" },
        });
    },
    /**
     * Registra archivos ya guardados en disco por multer.
     * Reglas: el ticket existe, no esta TERMINADO (las fotos son del cierre de un
     * ticket aun abierto) y no supera el maximo de imagenes por ticket.
     */
    async add(ticketId, files) {
        await assertTicketExists(ticketId);
        const ticket = await prisma.ticket.findUnique({
            where: { ticketId },
            select: { status: true },
        });
        if (ticket?.status === "TERMINADO") {
            throw new ConflictError("No se pueden agregar imagenes a un ticket TERMINADO; reabra el ticket primero");
        }
        const currentCount = await prisma.ticketImage.count({ where: { ticketId } });
        if (currentCount + files.length > MAX_IMAGES_PER_TICKET) {
            throw new ConflictError(`El ticket admite hasta ${MAX_IMAGES_PER_TICKET} imagenes (tiene ${currentCount})`);
        }
        return prisma.$transaction(files.map((file) => prisma.ticketImage.create({
            data: {
                ticketId,
                fileName: file.fileName,
                mimeType: file.mimeType,
                sizeBytes: file.sizeBytes,
            },
        })));
    },
    /** Borra el registro y el archivo fisico (si falla el unlink no rompe). */
    async remove(ticketId, imageId) {
        const image = await prisma.ticketImage.findFirst({
            where: { id: imageId, ticketId },
        });
        if (!image) {
            throw new NotFoundError(`Imagen ${imageId} del ticket ${ticketId} no encontrada`);
        }
        await prisma.ticketImage.delete({ where: { id: image.id } });
        await fs
            .unlink(path.join(ticketImagesDir, image.fileName))
            .catch(() => undefined);
    },
};
async function assertTicketExists(ticketId) {
    const found = await prisma.ticket.count({ where: { ticketId } });
    if (found === 0) {
        throw new NotFoundError(`Ticket ${ticketId} not found`);
    }
}
//# sourceMappingURL=ticket-image.service.js.map