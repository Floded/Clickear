import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { signSession, verifySession, toSessionUser, sessionCookieOptions, COOKIE_NAME, } from "./session.js";
describe("signSession / verifySession", () => {
    const payload = {
        sub: "42",
        username: "usuario",
        name: "Usuario Test",
        role: "GESTOR",
    };
    it("signSession produce un JWT verificable", () => {
        const token = signSession(payload);
        expect(typeof token).toBe("string");
        expect(token.split(".")).toHaveLength(3); // JWT: header.payload.signature
        const decoded = verifySession(token);
        expect(decoded.sub).toBe(payload.sub);
        expect(decoded.username).toBe(payload.username);
        expect(decoded.name).toBe(payload.name);
        expect(decoded.role).toBe(payload.role);
    });
    it("verifySession con token inválido lanza error", () => {
        expect(() => verifySession("token.invalido.aquí")).toThrow();
    });
    it("verifySession con token expirado lanza error", () => {
        const expiredToken = jwt.sign(payload, process.env.JWT_SECRET ?? "test-secret", {
            expiresIn: -1,
        });
        expect(() => verifySession(expiredToken)).toThrow();
    });
});
describe("toSessionUser", () => {
    it("extrae id, username, name, role y permisos del usuario autenticado", () => {
        const authUser = {
            id: 10,
            username: "usuario",
            name: "Nombre",
            role: "ADMIN",
            permissions: [{ feature: "tickets", access: "EDIT" }],
        };
        const user = toSessionUser(authUser);
        expect(user).toEqual({
            id: 10,
            username: "usuario",
            name: "Nombre",
            role: "ADMIN",
            permissions: [{ feature: "tickets", access: "EDIT" }],
        });
    });
});
describe("sessionCookieOptions", () => {
    it("tiene las opciones esperadas (httpOnly, sameSite, secure, path)", () => {
        expect(sessionCookieOptions.httpOnly).toBe(true);
        expect(sessionCookieOptions.sameSite).toBe("none");
        expect(sessionCookieOptions.secure).toBe(true);
        expect(sessionCookieOptions.path).toBe("/");
        expect(sessionCookieOptions.maxAge).toBeDefined();
    });
    it("COOKIE_NAME es auth_token", () => {
        expect(COOKIE_NAME).toBe("auth_token");
    });
});
//# sourceMappingURL=session.test.js.map