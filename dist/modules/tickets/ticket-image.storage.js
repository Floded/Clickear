import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { BadRequestError } from "../../shared/http-error.js";
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_IMAGES_PER_TICKET = 10;
export const ALLOWED_IMAGE_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
];
const EXTENSION_BY_MIME = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
};
// Storage local: <raíz del proyecto>/public/uploads
// `uploadsStaticDir` se sirve en /uploads; las imágenes de tickets viven en su
// subcarpeta "tickets" para poder montar el estático sin duplicar prefijos.
export const uploadsStaticDir = path.resolve(process.cwd(), "public", "uploads");
export const ticketImagesDir = path.join(uploadsStaticDir, "tickets");
export function ensureUploadsDir() {
    fs.mkdirSync(ticketImagesDir, { recursive: true });
}
ensureUploadsDir();
// Nombres aleatorios: evita colisiones y no exponer nombres de archivo originales
export const ticketImageUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, ticketImagesDir),
        filename: (_req, file, cb) => {
            const ext = EXTENSION_BY_MIME[file.mimetype] ??
                (path.extname(file.originalname).replace(/^\./, "") || "bin");
            cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext}`);
        },
    }),
    limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: MAX_IMAGES_PER_TICKET },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
            return;
        }
        cb(new BadRequestError(`Tipo de archivo no permitido '${file.mimetype}'. Solo imagenes jpeg, png o webp`));
    },
});
// Traduce errores de multer (límite de tamaño/cantidad) a 400 legible
export function handleUploadError(err, _req, _res, next) {
    if (err instanceof multer.MulterError) {
        next(new BadRequestError(`Error al subir imagenes: ${err.message}`));
        return;
    }
    next(err);
}
//# sourceMappingURL=ticket-image.storage.js.map