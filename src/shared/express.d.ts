import type { AuthUser } from "./session.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
