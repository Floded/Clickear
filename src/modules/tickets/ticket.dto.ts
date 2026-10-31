import { z } from "zod";

import { paginationQuerySchema } from "../../shared/pagination.js";

export const TICKET_STATUSES = ["ABIERTO", "EN PROGRESO", "TERMINADO"] as const;

export const ticketStatusSchema = z.enum(TICKET_STATUSES);

export const createTicketSchema = z.object({
  ticketId: z.coerce.bigint().positive(),
  establishmentCue: z.string().trim().max(20).optional(),
  title: z.string().trim().min(1),
  glpiClosedTicket: z.string().trim().max(100).optional(),
  openingTimestamp: z.coerce.date().optional(),
  status: ticketStatusSchema.optional(),
});

export const listTicketsQuerySchema = paginationQuerySchema.extend({
  status: ticketStatusSchema.optional(),
  establishment: z.string().trim().max(20).optional(),
  technicianId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
});

export const updateTicketStatusSchema = z.object({
  status: ticketStatusSchema,
});

export const ticketIdParamsSchema = z.object({
  id: z.coerce.bigint(),
});

export type TicketStatus = z.infer<typeof ticketStatusSchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
