import cors from "cors";
import express, { type Express } from "express";

import { healthRouter } from "./routes/health.routes.js";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.json({ name: "clickear-backend", status: "ok" });
  });
  app.use("/api", healthRouter);

  return app;
}
