import { z } from "zod";

export const USER_ROLES = ["GESTOR", "ADMIN", "REVISADOR"] as const;

export const userRoleSchema = z.enum(USER_ROLES);

// Username técnico: letras, números, punto, guion y guion bajo (se normaliza a minúsculas)
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "El usuario debe tener al menos 3 caracteres")
  .max(50, "El usuario no puede superar 50 caracteres")
  .regex(
    /^[a-z0-9._-]+$/,
    "El usuario solo admite letras, números, punto, guion y guion bajo",
  );

// Misma política que exigía el login por email: complejidad fuerte
export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(200, "La contraseña es muy larga")
  .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
  .regex(/[a-z]/, "Debe contener al menos una minúscula")
  .regex(/[0-9]/, "Debe contener al menos un número")
  .regex(/[^A-Za-z0-9]/, "Debe contener al menos un carácter especial");

export const createUserSchema = z.object({
  username: usernameSchema,
  name: z.string().trim().min(2, "El nombre es obligatorio").max(255),
  password: passwordSchema,
  role: userRoleSchema,
});

// La contraseña es opcional al editar: solo se cambia si se envía
export const updateUserSchema = z.object({
  username: usernameSchema.optional(),
  name: z.string().trim().min(2).max(255).optional(),
  password: passwordSchema.optional(),
  role: userRoleSchema.optional(),
});

export const userIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
