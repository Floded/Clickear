import { Prisma, type Ticket } from "@prisma/client";

import { prisma } from "../../prisma/client.js";
import { NotFoundError } from "../../shared/http-error.js";
import {
  toPaginatedResult,
  type PaginatedResult,
} from "../../shared/pagination.js";
import { assertEstablishmentExists } from "../establishments/establishment.service.js";
import type {
  CreateTicketInput,
  ListTicketsQuery,
  TicketStatus,
} from "./ticket.dto.js";

export interface TicketListFilters {
  status?: TicketStatus;
  establishmentCue?: string;
  technicianId?: number;
  search?: string;
}

export const ticketService = {
  async list(query: ListTicketsQuery): Promise<PaginatedResult<Ticket>> {
    const where: Prisma.TicketWhereInput = {
      status: query.status,
      establishmentCue: query.establishment || undefined,
      title: query.search
        ? { contains: query.search, mode: "insensitive" }
        : undefined,
      establishment: query.technicianId
        ? {
            dispatchOrder: {
              technicians: { some: { technicianId: query.technicianId } },
            },
          }
        : undefined,
    };

    const [items, total] = await prisma.$transaction([
      prisma.ticket.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { openingTimestamp: { sort: "desc", nulls: "last" } },
        include: {
          establishment: {
            select: {
              cue: true,
              name: true,
              department: true,
              locality: true,
              isSecondaryBuilding: true,
            },
          },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    return toPaginatedResult(items, total, query);
  },

  // Detalle completo: establecimiento, orden de despacho asociada y facturas
  async getById(ticketId: bigint): Promise<Ticket> {
    const ticket = await prisma.ticket.findUnique({
      where: { ticketId },
      include: {
        establishment: {
          include: {
            dispatchOrder: {
              include: {
                technicians: {
                  select: { technician: { select: { id: true, fullName: true } } },
                },
              },
            },
          },
        },
        invoices: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            voucherType: true,
            amount: true,
            status: true,
            cae: true,
            errorMessage: true,
            createdAt: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundError(`Ticket ${ticketId} not found`);
    }
    return ticket;
  },

  async create(input: CreateTicketInput): Promise<Ticket> {
    if (input.establishmentCue !== undefined) {
      await assertEstablishmentExists(input.establishmentCue);
    }

    return prisma.ticket.create({
      data: {
        ticketId: input.ticketId,
        establishmentCue: input.establishmentCue,
        title: input.title,
        glpiClosedTicket: input.glpiClosedTicket,
        openingTimestamp: input.openingTimestamp,
        status: input.status,
      },
    });
  },

  async updateStatus(ticketId: bigint, status: TicketStatus): Promise<Ticket> {
    await assertTicketExists(ticketId);
    return prisma.ticket.update({ where: { ticketId }, data: { status } });
  },
};

async function assertTicketExists(ticketId: bigint): Promise<void> {
  const found = await prisma.ticket.count({ where: { ticketId } });
  if (found === 0) {
    throw new NotFoundError(`Ticket ${ticketId} not found`);
  }
}
