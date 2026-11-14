import crypto from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import multer from "multer";
import { BadRequestError } from "../../shared/http-error.js";
export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const ALLOWED_LOGO_MIME_TYPES = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/svg+xml",
];
const EXTENSION_BY_MIME = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/svg+xml": "svg",
};
function getStorageConfig() {
    const url = process.env.SUPABASE_URL?.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim();
    const prefix = (process.env.SUPABASE_STORAGE_COMPANY_LOGO_PREFIX?.trim() || "company").replace(/^\/+|\/+$/g, "");
    if (!url || !serviceRoleKey || !bucket) {
        throw new BadRequestError("Configuración de Supabase Storage incompleta (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET)");
    }
    return { url, serviceRoleKey, bucket, prefix };
}
function getSupabaseClient() {
    const { url, serviceRoleKey } = getStorageConfig();
    return createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}
function isSafeSvg(buffer) {
    const content = buffer.toString("utf8").toLowerCase();
    if (content.includes("<script"))
        return false;
    if (/\son\w+\s*=/.test(content))
        return false;
    if (content.includes("javascript:"))
        return false;
    if (content.includes("<foreignobject"))
        return false;
    return true;
}
export const companyLogoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_LOGO_SIZE_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_LOGO_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
            return;
        }
        cb(new BadRequestError(`Tipo de archivo no permitido '${file.mimetype}'. Solo PNG, JPG, JPEG o SVG`));
    },
});
export function handleLogoUploadError(err, _req, _res, next) {
    if (err instanceof multer.MulterError) {
        next(new BadRequestError(`Error al subir logotipo: ${err.message}`));
        return;
    }
    next(err);
}
function buildLogoPath(file) {
    const { prefix } = getStorageConfig();
    const ext = EXTENSION_BY_MIME[file.mimetype] ??
        (path.extname(file.originalname).replace(/^\./, "") || "bin");
    const filename = `logo-${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
    return `${prefix}/${filename}`;
}
export async function uploadCompanyLogoToStorage(file) {
    if (file.mimetype === "image/svg+xml" && !isSafeSvg(file.buffer)) {
        throw new BadRequestError("El archivo SVG contiene contenido no permitido");
    }
    const supabase = getSupabaseClient();
    const { bucket } = getStorageConfig();
    const logoPath = buildLogoPath(file);
    const { error } = await supabase.storage.from(bucket).upload(logoPath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
        cacheControl: "3600",
    });
    if (error) {
        throw new BadRequestError(`No se pudo subir el logotipo: ${error.message}`);
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(logoPath);
    if (!data?.publicUrl) {
        throw new BadRequestError("No se pudo obtener la URL pública del logotipo");
    }
    return { logoUrl: data.publicUrl, logoPath };
}
export async function removeCompanyLogoFromStorage(logoPath) {
    if (!logoPath)
        return;
    const supabase = getSupabaseClient();
    const { bucket } = getStorageConfig();
    const { error } = await supabase.storage.from(bucket).remove([logoPath]);
    if (error) {
        throw new BadRequestError(`No se pudo eliminar el logotipo anterior: ${error.message}`);
    }
}
//# sourceMappingURL=company-settings.storage.js.map