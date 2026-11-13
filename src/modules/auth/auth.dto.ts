import { z } from "zod";

// Login relajado: la complejidad se valida al crear el usuario, no al entrar
export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "El usuario debe tener al menos 3 caracteres")
    .max(50, "El usuario es muy largo"),
  password: z
    .string()
    .min(1, "La contraseña es obligatoria")
    .max(200, "La contraseña es muy larga"),
});

export type LoginInput = z.infer<typeof loginSchema>;
