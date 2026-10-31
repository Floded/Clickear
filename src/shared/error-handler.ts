import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { HttpError } from "./http-error.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Datos invalidos",
      details: err.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  // JSON malformado en el body
  if ((err as { type?: string }).type === "entity.parse.failed") {
    res.status(400).json({ error: "JSON invalido en el cuerpo de la peticion" });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    res.status(409).json({ error: "Valor duplicado", field: err.meta?.target ?? null });
    return;
  }

  console.error("[error]", err);
  res.status(500).json({ error: "Error interno del servidor" });
};
