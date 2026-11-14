import crypto from "node:crypto";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import multer from "multer";
import type { NextFunction, Request, Response } from "express";

import { BadRequestError } from "../../shared/http-error.js";

export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_SIGNATURE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export const ALLOWED_LOGO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
] as const;

export const ALLOWED_SIGNATURE_MIME_TYPES = ALLOWED_LOGO_MIME_TYPES;

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/svg+xml": "svg",
};

type AssetKind = "logo" | "signature";

type StorageConfig = {
  url: string;
  secretKey: string;
  bucket: string;
  logoPrefix: string;
  signaturePrefix: string;
};

type UploadAssetResult = {
  url: string;
  path: string;
};

function getStorageConfig(): StorageConfig {
  const url = process.env.SUPABASE_URL?.trim();
  // Acepta la nueva clave secreta (sb_secret_...) y mantiene compatibilidad con service_role legacy
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim();
  const logoPrefix = (process.env.SUPABASE_STORAGE_COMPANY_LOGO_PREFIX?.trim() || "company").replace(
    /^\/+|\/+$/g,
    "",
  );
  const signaturePrefix = (
    process.env.SUPABASE_STORAGE_COMPANY_SIGNATURE_PREFIX?.trim() || `${logoPrefix}/signatures`
  ).replace(/^\/+|\/+$/g, "");

  if (!url || !secretKey || !bucket) {
    throw new BadRequestError(
      "Configuración de Supabase Storage incompleta (SUPABASE_URL, SUPABASE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET)",
    );
  }

  return { url, secretKey, bucket, logoPrefix, signaturePrefix };
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

function getAssetLabels(kind: AssetKind) {
  return kind === "logo"
    ? { item: "logotipo", previous: "logotipo anterior" }
    : { item: "firma", previous: "firma anterior" };
}

function buildAssetPath(kind: AssetKind, file: Express.Multer.File): string {
  const config = getStorageConfig();
  const prefix = kind === "logo" ? config.logoPrefix : config.signaturePrefix;
  const ext =
    EXTENSION_BY_MIME[file.mimetype] ??
    (path.extname(file.originalname).replace(/^\./, "") || "bin");
  const filename = `${kind}-${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
  return `${prefix}/${filename}`;
}

async function uploadAssetToStorage(
  kind: AssetKind,
  file: Express.Multer.File,
): Promise<UploadAssetResult> {
  const labels = getAssetLabels(kind);
  if (file.mimetype === "image/svg+xml" && !isSafeSvg(file.buffer)) {
    throw new BadRequestError("El archivo SVG contiene contenido no permitido");
  }

  const supabase = getSupabaseClient();
  const { bucket } = getStorageConfig();
  const assetPath = buildAssetPath(kind, file);

  const { error } = await supabase.storage.from(bucket).upload(assetPath, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
    cacheControl: "3600",
  });

  if (error) {
    throw new BadRequestError(`No se pudo subir ${labels.item === "firma" ? "la firma" : "el logotipo"}: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(assetPath);
  if (!data?.publicUrl) {
    throw new BadRequestError(
      `No se pudo obtener la URL pública ${labels.item === "firma" ? "de la firma" : "del logotipo"}`,
    );
  }

  return { url: data.publicUrl, path: assetPath };
}

async function removeAssetFromStorage(kind: AssetKind, assetPath: string | null | undefined): Promise<void> {
  if (!assetPath) return;
  const labels = getAssetLabels(kind);
  const supabase = getSupabaseClient();
  const { bucket } = getStorageConfig();
  const { error } = await supabase.storage.from(bucket).remove([assetPath]);
  if (error) {
    throw new BadRequestError(`No se pudo eliminar ${labels.previous}: ${error.message}`);
  }
}

function createUploadErrorHandler(kind: AssetKind) {
  return (err: unknown, _req: Request, _res: Response, next: NextFunction): void => {
    if (err instanceof multer.MulterError) {
      const label = kind === "logo" ? "logotipo" : "firma";
      next(new BadRequestError(`Error al subir ${label}: ${err.message}`));
      return;
    }
    next(err);
  };
}

function createUploadMiddleware(maxSize: number, allowedMimeTypes: readonly string[], itemLabel: string) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSize, files: 1 },
    fileFilter: (_req, file, cb) => {
      if ((allowedMimeTypes as readonly string[]).includes(file.mimetype)) {
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
}

export const companyLogoUpload = createUploadMiddleware(MAX_LOGO_SIZE_BYTES, ALLOWED_LOGO_MIME_TYPES, "logotipo");
export const companySignatureUpload = createUploadMiddleware(
  MAX_SIGNATURE_SIZE_BYTES,
  ALLOWED_SIGNATURE_MIME_TYPES,
  "firma",
);

export const handleLogoUploadError = createUploadErrorHandler("logo");
export const handleSignatureUploadError = createUploadErrorHandler("signature");

export async function uploadCompanyLogoToStorage(file: Express.Multer.File): Promise<{
  logoUrl: string;
  logoPath: string;
}> {
  const result = await uploadAssetToStorage("logo", file);
  return { logoUrl: result.url, logoPath: result.path };
}

export async function removeCompanyLogoFromStorage(logoPath: string | null | undefined): Promise<void> {
  await removeAssetFromStorage("logo", logoPath);
}

export async function uploadCompanySignatureToStorage(file: Express.Multer.File): Promise<{
  signatureUrl: string;
  signaturePath: string;
}> {
  const result = await uploadAssetToStorage("signature", file);
  return { signatureUrl: result.url, signaturePath: result.path };
}

export async function removeCompanySignatureFromStorage(signaturePath: string | null | undefined): Promise<void> {
  await removeAssetFromStorage("signature", signaturePath);
}
