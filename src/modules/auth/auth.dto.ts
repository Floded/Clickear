import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(1, "Contraseña requerida").max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;
