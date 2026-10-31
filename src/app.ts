import "./shared/json-bigint.js";

import cors from "cors";
import express, { type Express } from "express";

import { dispatchOrderRouter, technicianRouter } from "./modules/dispatch/dispatch.routes.js";
import { establishmentRouter } from "./modules/establishments/establishment.routes.js";
import { ticketRouter } from "./modules/tickets/ticket.routes.js";
import { errorHandler } from "./shared/error-handler.js";
import { healthRouter } from "./routes/health.routes.js";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.json({ name: "clickear-backend", status: "ok" });
  });

  app.use("/api", healthRouter);
  app.use("/api/establishments", establishmentRouter);
  app.use("/api/dispatch-orders", dispatchOrderRouter);
  app.use("/api/technicians", technicianRouter);
  app.use("/api/tickets", ticketRouter);

  app.use(errorHandler);

  return app;
}
