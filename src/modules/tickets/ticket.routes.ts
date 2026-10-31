import { Router } from "express";

import {
  createTicketSchema,
  listTicketsQuerySchema,
  ticketIdParamsSchema,
  updateTicketStatusSchema,
} from "./ticket.dto.js";
import { ticketService } from "./ticket.service.js";

export const ticketRouter = Router();

ticketRouter.get("/", async (req, res) => {
  const query = listTicketsQuerySchema.parse(req.query);
  res.json(await ticketService.list(query));
});

ticketRouter.get("/:id", async (req, res) => {
  const { id } = ticketIdParamsSchema.parse(req.params);
  res.json(await ticketService.getById(id));
});

ticketRouter.post("/", async (req, res) => {
  const input = createTicketSchema.parse(req.body);
  const ticket = await ticketService.create(input);
  res.status(201).json(ticket);
});

ticketRouter.patch("/:id/status", async (req, res) => {
  const { id } = ticketIdParamsSchema.parse(req.params);
  const { status } = updateTicketStatusSchema.parse(req.body);
  res.json(await ticketService.updateStatus(id, status));
});
