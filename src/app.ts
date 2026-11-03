import "./shared/json-bigint.js";

import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";

import { authRouter } from "./modules/auth/auth.routes.js";
import { dispatchOrderRouter, technicianRouter } from "./modules/dispatch/dispatch.routes.js";
import { assignmentRouter } from "./modules/assignments/assignment.routes.js";
import { employeeRouter } from "./modules/employees/employee.routes.js";
import { establishmentRouter } from "./modules/establishments/establishment.routes.js";
import { inventoryItemRouter } from "./modules/inventory/inventory-item.routes.js";
import { supplierRouter } from "./modules/suppliers/supplier.routes.js";
import { ticketRouter } from "./modules/tickets/ticket.routes.js";
import { authenticate } from "./shared/authenticate.js";
import { errorHandler } from "./shared/error-handler.js";
import { healthRouter } from "./routes/health.routes.js";
import { budgetRouter } from "./modules/budgets/budget.routes.js";

// Orígenes permitidos para CORS (las cookies requieren un origen explícito)
const allowedOrigins = (process.env.ALLOWED_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.json({ name: "clickear-backend", status: "ok" });
  });

  app.use("/api", healthRouter);
  app.use("/api/auth", authRouter);

  app.use("/api/establishments", authenticate, establishmentRouter);
  app.use("/api/dispatch-orders", authenticate, dispatchOrderRouter);
  app.use("/api/technicians", authenticate, technicianRouter);
  app.use("/api/tickets", authenticate, ticketRouter);
  app.use("/api/suppliers", authenticate, supplierRouter);
  app.use("/api/employees", authenticate, employeeRouter);
  app.use("/api/inventory-items", authenticate, inventoryItemRouter);
  app.use("/api/assignments", authenticate, assignmentRouter);
  app.use("/api/budgets", authenticate, budgetRouter);

  app.use(errorHandler);

  return app;
}
