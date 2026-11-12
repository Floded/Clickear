import { z } from "zod";

import { paginationQuerySchema } from "../../shared/pagination.js";

export const createAssignmentSchema = z.object({
  inventoryItemId: z.number().int().positive(),
  employeeId: z.number().int().positive(),
  quantityAssigned: z.number().int().positive(),
  deliveryDate: z.coerce.date(),
  notes: z.string().trim().max(2000).optional(),
});

export const returnAssignmentSchema = z.object({
  quantity: z.number().int().positive().optional(),
  returnDate: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const listAssignmentsQuerySchema = paginationQuerySchema.extend({
  employeeId: z.coerce.number().int().positive().optional(),
  inventoryItemId: z.coerce.number().int().positive().optional(),
  // ACTIVE = en custodia (sin devolver), RETURNED = devuelto al depot
  status: z.enum(["ACTIVE", "RETURNED"]).optional(),
  // Rango por fecha de entrega; el cliente envía ISO con inicio/fin de día locales
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type ReturnAssignmentInput = z.infer<typeof returnAssignmentSchema>;
export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuerySchema>;
