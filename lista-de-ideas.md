# Roadmap de Desarrollo

> Fuente nativa de este checklist. El estado vivo y documentación detallada están en:
> - `docs/fases.md` (progreso con commits)
> - `docs/api.md` (endpoints)
> - `docs/decisiones.md` (ADRs)

> Estado de commits: Fases 1-2 **commiteadas**. Fase 3 **sin commit** (decisión puntual del usuario).

## 4. Lista de Tareas para el Desarrollo (Roadmap)

### Fase 1 ✅ Configuración Base e Infraestructura

- [x] Inicializar repositorio y entorno de desarrollo (Docker para Postgres y Redis). → Postgres 16 `:5433` + Redis 7 `:6379`, ambos con healthcheck.
- [x] Configurar ORM o Query Builder (ej. Prisma, TypeORM, Kysely o Drizzle) en el Backend. → Prisma 6.19.
- [x] Ejecutar scripts DDL de migraciones de PostgreSQL con las 9 tablas definidas. → Migración `init` (9 tablas + `dispatch_technicians` N:M).

### Fase 2 ✅ Backend - Módulo de Tickets y Despacho

- [x] Crear CRUD de Establecimientos (`establishments`). → + filtros por search/department/locality/orden.
- [x] Crear endpoints para carga y consulta de Órdenes de Despacho (`dispatch_orders`). → Alta transaccional: vincula técnicos N:M y asigna establecimientos de una sola pieza.
- [x] Crear API para listar Tickets con filtros por estado, establecimiento y técnico. → + búsqueda en título y paginación; alta y cambio de estado incluídos.
- [x] Crear endpoint de detalle de Ticket (`GET /api/tickets/:id`) que traiga todos los datos asociados. → establecimiento → orden → técnicos + facturas.

### Fase 3 ✅ Backend - Módulo de Inventario y Stock

- [x] Crear CRUD de Proveedores (`suppliers`) y Empleados (`employees`). → Empleados con baja lógica (`isActive`) y borrado físico bloqueado si tienen historial.
- [x] Crear CRUD de Ítems de Stock (`inventory_items`). → `availableQuantity` solo se mueve por transacciones/ajuste, updates no la tocan.
- [x] Implementar la transacción de asignación de stock a empleados (`POST /api/assignments`):
  - [x] Validar disponibilidad de stock en depósito. → Error `409` con detalle de disponible vs. solicitado.
  - [x] Registrar la entrega en `item_assignments` (con `delivery_date` obligatorio).
  - [x] Restar automáticamente de `available_quantity` de forma atómica. → `SELECT ... FOR UPDATE` + decrement en transacción; el CHECK de BD como 2ª barrera.
- [x] Endpoint para consultar el stock que tiene en custodia un empleado específico. → `GET /api/employees/:id/assignments` con `unitsInCustody` agregado.

**Extras de Fase 3** (no previstos en el roadmap):
- [x] Devolución total o parcial (`PUT /api/assignments/:id/return`) con re-stock atómico y trazabilidad de la devolución parcial.
- [x] Ajuste diferencial de stock (`PATCH /api/inventory-items/:id/stock`) para carga inicial, mermas y correcciones.
- [x] Listado global de asignaciones (`GET /api/assignments`) con filtro por estado (`ACTIVE`/`RETURNED`), empleado e ítem.

### Fase 4 ⬜ Frontend (Interfaz Web) — diferida por decisión de planificación

- [ ] Diseñar dashboard principal con navegación entre Tickets y Stock.
- [ ] Construir vista de lista de Tickets con buscador, filtros y tarjetas resumen.
- [ ] Implementar Modal / Vista detallada al seleccionar un Ticket.
- [ ] Diseñar panel de Control de Stock:
  - Tabla de ítems en depósito.
  - Formulario modal para asignar ítem a empleado.
  - Vista del "haber" del empleado (ítems bajo su responsabilidad).

### Fase 5 ⬜ Integración ARCA (ex-AFIP) — solo preparación por ahora (tabla `invoices` ya existe)

- [ ] Configurar servicio de cola (BullMQ/Redis) para el procesamiento asíncrono de comprobantes.
- [ ] Configurar cliente de integración con ARCA (vía biblioteca WebServices WSAA/WSFE o API wrapper).
- [ ] Crear Job Worker que tome comprobantes en estado `PENDING`, solicite CAE a ARCA y actualice `invoices`.
- [ ] Conectar la acción de facturar en el frontend con la cola de emisión.

## 5. Extras fuera del roadmap original

### Exportaciones a Excel
- [x] Exportación de tickets (`GET /api/tickets/export`) y asignaciones de inventario (`GET /api/assignments/export`). → `shared/excel.ts` con exceljs; protegidos por auth, sin paginación, con los filtros del listado.
- [x] Rango de fechas (`from` / `to`) en ambas exportaciones: tickets por `openingTimestamp`, asignaciones por `deliveryDate`. El cliente envía ISO de inicio/fin de día locales para que el rango sea inclusivo.

### Login por usuario y roles
- [x] Migración: `User` con `username` (unique) y `role` (GESTOR/ADMIN/REVISADOR); eliminar `email`. Backfill: admin existente → `gabriel.lillo_clic`, role `ADMIN`.
- [x] Login por username + contraseña (JWT/sesión con `username` y `role`).
- [x] Módulo `users/` CRUD (solo ADMIN): listar, crear, editar y eliminar; proteger el último ADMIN.
- [x] `seed.ts` con `ADMIN_USERNAME` y rol `ADMIN`. → Rama `future-login-usuario-roles`; suite 215/215 en verde.

### Configuración de empresa (en implementación)
> Decisiones: módulo independiente, **registro único (singleton)**, acceso **solo ADMIN** (`authenticate` + `requireRole("ADMIN")`), logo en **Supabase Storage** (no FS local), sin romper módulos existentes ni reglas de negocio de presupuestos. Presupuestos: creación solo ADMIN (se respeta).

- [x] **Etapa 1 — Backend base (completada)**
  - [x] **Modelo y persistencia (Prisma/PostgreSQL, migración no destructiva e idempotente)**
    - [x] Crear `CompanySettings` (`company_settings`): identidad (`commercialName`, `legalName`, `logoUrl`/`logoPath`), responsable (`responsibleName`, `responsiblePosition`), contacto (`address`, `locality`, `province`, `country`, `postalCode`, `email`, `phone`), fiscal (`taxId` CUIT, `grossIncomeNumber` IB, `rupeNumber` RUPE), auditoría (`createdAt`, `updatedAt`, `updatedBy? -> User SetNull`).
    - [x] Garantizar configuración única (id fijo/constraint + lógica en service). Evitar duplicados.
    - [x] Inicializar registro con datos provistos; dejar vacíos/NULL los no conocidos: Responsable `Ricardo Gabriel Lillo Morales` / `Socio Gerente`; Dirección `Martín Güemes 944`, `Rivadavia`, `San Juan`, `Argentina`; Email `sanjuanconexionsj@gmail.com`; Tel `264-6210237`; CUIT `20-29045449-3`; IB `20-29045449-3`; RUPE `80547`. No inferir nombre comercial/razón social.
    - [x] Migración creada: `prisma/migrations/20261113200000_add_company_settings/migration.sql` (aplicación en BD pendiente según entorno).
  - [x] **Módulo backend base** `src/modules/company-settings/` (patrón routes/service/dto, Zod)
    - [x] `company-settings.dto.ts`: validación/normalización (email, CUIT con dígito verificador, teléfono/fiscal), campos opcionales y actualización parcial segura.
    - [x] `company-settings.service.ts`: `getOrCreateSingleton`, `update`, helpers de logo y registro en `AuditLog`.
    - [x] `company-settings.routes.ts`: `GET/PUT` implementados; `POST/DELETE /logo` con respuesta `501` (pendiente Etapa 2).
  - [x] **Endpoints base** (protegidos: `authenticate` + `requireRole("ADMIN")`)
    - [x] `GET /api/company-settings`
    - [x] `PUT /api/company-settings`
  - [x] **Integración y configuración base**
    - [x] Registrar router en `src/app.ts`.
    - [x] Variables de entorno Supabase Storage agregadas en `.env.example` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `SUPABASE_STORAGE_COMPANY_LOGO_PREFIX`).
  - [x] Validación técnica base: `prisma generate` y `tsc --noEmit` en verde.

- [x] **Etapa 2 — Logo en Supabase Storage (completada)**
  - [x] `company-settings.storage.ts`: integración con **Supabase Storage** (bucket/prefijo, nombre aleatorio, `getPublicUrl`), validación de tipo/tamaño (PNG/JPG/JPEG/SVG con validación básica de seguridad), reemplazo y borrado del objeto anterior.
  - [x] `POST /api/company-settings/logo` y `DELETE /api/company-settings/logo` implementados (multipart `logo`, URL pública persistida en `logoUrl/logoPath`).
  - [x] Agregada dependencia `@supabase/supabase-js` y configuración por env (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `SUPABASE_STORAGE_COMPANY_LOGO_PREFIX`).
  - [x] Validación técnica: `tsc --noEmit` en verde. (Pruebas runtime con credenciales/bucket reales pendientes de entorno.)

- [x] **Etapa 4 — Integración preparada para presupuestos (completada, sin cambiar diseño PDF ni reglas)**
  - [x] Expuesta fuente única reutilizable: endpoint `GET /api/company-settings` (ADMIN) y servicio `getCompanySettings`/`getOrCreateSingleton` en `src/modules/company-settings/company-settings.service.ts`.
  - [x] Análisis de snapshot histórico (pendiente aditivo futuro, no automático): `Budget` no almacena datos del emisor; para consistencia histórica se recomienda agregar snapshot inmutable al emitir (ej. `companySnapshot Json?` o campos denormalizados) mediante migración aditiva y lógica solo en emisión/finalización, sin afectar reimpresiones ni el diseño PDF actual.

- [x] **Etapa 5 — Pruebas y validación (completada, con alcance documentado)**
  - [x] Ejecutado: `tsc --noEmit`, `npm run build` y tests pertinentes existentes (`vitest run src/modules/budgets`: 1 archivo, 16 tests en verde).
  - [ ] Pendiente recomendado (no bloqueante de esta entrega): tests automatizados específicos de `company-settings` (GET/PUT, CUIT/email, opcionales, autorización, logo con mock de Supabase, errores).
  - [ ] Operación en entorno: aplicar migración `20261113200000_add_company_settings` en la BD (Supabase/PostgreSQL) y configurar variables/bucket de Supabase Storage en Render antes de uso en producción.
