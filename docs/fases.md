# Roadmap de Fases — Estado del Proyecto

Fuente original: `lista-de-ideas.md`. Este documento refleja el estado real,
se actualiza al cierre de cada fase.

---

## Fase 0 — Configuración Base e Infraestructura ✅

- [x] Repositorio, TypeScript, estructura de proyecto, Prettier.
- [x] `docker-compose.yml` con **Postgres 16** (`:5433` — ver DEC-002) y **Redis 7** (`:6379`), healthy checks.
- [x] Prisma 6.19: schema con las 10 tablas (9 módulos + tabla N:M), migración `init` aplicada.
- [x] Server Express con health check, manejo centralizado de errores, serialización BigInt/Decimal.
- [x] Documentación: `docs/api.md`, `docs/decisiones.md`, este archivo.

**Commit:** `cc33a70`

---

## Fase 1+2 — Backend Módulo Tickets y Despacho ✅

- [x] CRUD de Establecimientos (listado con filtros, detalle, alta, update parcial, baja en cascada).
- [x] Órdenes de despacho: alta transaccional (vincula técnicos N:M + asigna establecimientos) y
      listado con filtros (`listStatus`, `dispatchCode`) + detalle.
- [x] CRUD mínimo de Técnicos (listado con búsqueda + alta).
- [x] Listado de Tickets con filtros: `status`, `establishment` (CUE), `technicianId`, `search` + paginación.
- [x] Detalle de ticket (`GET /api/tickets/:id`): establecimiento → orden → técnicos + facturas asociadas.
- [x] Extras: alta de ticket (`POST` con `ticketId` externo de GLPI) y cambio de
      estado (`PATCH /:id/status`: `ABIERTO` → `EN PROGRESO` → `TERMINADO`).

**Decisiones durante la fase:** DEC-003 (`ticketId` explícito, sin autoincrement), DEC-004 (BigInt), DEC-005 (error handler).

**Commits:** `4570f8e`

---

## Fase 3 — Backend Módulo Inventario y Stock ⬜ (próxima)

- [ ] CRUD de Proveedores (`suppliers`) y Empleados (`employees`).
- [ ] CRUD de Ítems de Stock (`inventory_items`) con proveedor (set null en baja).
- [ ] Transacción de asignación `POST /api/assignments`:
  - Validar disponibilidad (`available_quantity` sin quedar negativo).
  - `delivery_date` obligatorio, `return_date` opcional.
  - Resta atómica de `available_quantity`.
- [ ] `GET /api/employees/:id/assignments` — stock en custodia por empleado.
- [ ] Devolución (`PUT /api/assignments/:id/return`) — re-suma al depósito.

---

## Fase 4 — Frontend (Interfaz Web) ⬜ (diferida — decidido en sesión de plan)

- [ ] Dashboard principal con navegación Tickets / Stock.
- [ ] Lista de Tickets con buscador, filtros y tarjetas resumen.
- [ ] Modal/detalle de Ticket.
- [ ] Panel de Stock: tabla depósito, modal de asignación y vista "haber" del empleado.

---

## Fase 5 — Integración ARCA (ex-AFIP) ⬜ (solo esquema preparado — DEC-006)

- [ ] Cola BullMQ + Redis para comprobantes asíncronos.
- [ ] Cliente WSAA/WSFE (requiere credenciales reales del negocio).
- [ ] Worker: `PENDING` → solicitud de CAE → update `invoices`.
- [ ] Frontend: acción "facturar" → encolar.
