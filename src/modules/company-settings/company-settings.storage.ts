import crypto from "node:crypto";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import multer from "multer";
import type { NextFunction, Request, Response } from "express";

import { BadRequestError } from "../../shared/http-error.js";

export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export const ALLOWED_LOGO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
] as const;

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/svg+xml": "svg",
};

function getStorageConfig() {
  const url = process.env.SUPABASE_URL?.trim();
  // Acepta la nueva clave secreta (sb_secret_...) y mantiene compatibilidad con service_role legacy
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim();
  const prefix = (process.env.SUPABASE_STORAGE_COMPANY_LOGO_PREFIX?.trim() || "company").replace(
    /^\/+|\/+$/g,
    "",
  );

  if (!url || !secretKey || !bucket) {
    throw new BadRequestError(
      "Configuración de Supabase Storage incompleta (SUPABASE_URL, SUPABASE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET)",
    );
  }

  return { url, secretKey, bucket, prefix };
}

function getSupabaseClient() {
  const { url, secretKey } = getStorageConfig();
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isSafeSvg(buffer: Buffer): boolean {
  const content = buffer.toString("utf8").toLowerCase();
  if (content.includes("<script")) return false;
  if (/\son\w+\s*=/.test(content)) return false;
  if (content.includes("javascript:")) return false;
  if (content.includes("<foreignobject")) return false;
  return true;
}

export const companyLogoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_LOGO_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if ((ALLOWED_LOGO_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(
      new BadRequestError(
        `Tipo de archivo no permitido '${file.mimetype}'. Solo PNG, JPG, JPEG o SVG`,
      ),
    );
  },
});

export function handleLogoUploadError(
  err: unknown,
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (err instanceof multer.MulterError) {
    next(new BadRequestError(`Error al subir logotipo: ${err.message}`));
    return;
  }
  next(err);
}

function buildLogoPath(file: Express.Multer.File): string {
  const { prefix } = getStorageConfig();
  const ext =
    EXTENSION_BY_MIME[file.mimetype] ??
    (path.extname(file.originalname).replace(/^\./, "") || "bin");
  const filename = `logo-${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
  return `${prefix}/${filename}`;
}

export async function uploadCompanyLogoToStorage(file: Express.Multer.File): Promise<{
  logoUrl: string;
  logoPath: string;
}> {
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

export async function removeCompanyLogoFromStorage(logoPath: string | null | undefined): Promise<void> {
  if (!logoPath) return;
  const supabase = getSupabaseClient();
  const { bucket } = getStorageConfig();
  const { error } = await supabase.storage.from(bucket).remove([logoPath]);
  if (error) {
    throw new BadRequestError(`No se pudo eliminar el logotipo anterior: ${error.message}`);
  }
}
