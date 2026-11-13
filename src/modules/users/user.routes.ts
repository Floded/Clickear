import { Router } from "express";

import { userIdParamsSchema, createUserSchema, updateUserSchema } from "./user.dto.js";
import { userService } from "./user.service.js";

export const userRouter = Router();

userRouter.get("/", async (_req, res) => {
  res.json(await userService.list());
});

userRouter.post("/", async (req, res) => {
  const input = createUserSchema.parse(req.body);
  res.status(201).json(await userService.create(input));
});

userRouter.patch("/:id", async (req, res) => {
  const { id } = userIdParamsSchema.parse(req.params);
  const input = updateUserSchema.parse(req.body);
  res.json(await userService.update(id, input));
});

userRouter.delete("/:id", async (req, res) => {
  const { id } = userIdParamsSchema.parse(req.params);
  await userService.remove(id);
  res.status(204).send();
});
