# API — Catálogo de Endpoints

Base URL: `http://localhost:3000`

Todas las rutas (salvo `GET /` y `GET /api/health`) viven bajo `/api`.

---

## Convenciones generales

### Paginación

Todos los listados aceptan `page` (default `1`) y `limit` (default `20`, máx `100`) y responden:

```json
{
  "data": [ ... ],
  "page": 1,
  "limit": 20,
  "total": 2,
  "totalPages": 1
}
```

### Serialización

- `BigInt` (ej. `ticketId`) → se devuelve como **string**: `"125691"`
- `Decimal` (ej. `distanceKm`, `amount`) → se devuelve como **string**: `"31.3"`
- Fechas → ISO 8601: `"2026-10-05T11:52:03.000Z"`

### Códigos de error

| Código | Causa | Ejemplo |
|---|---|---|
| `400` | Body JSON malformado | `{"error":"JSON invalido en el cuerpo de la peticion"}` |
| `400` | Validación Zod | `{"error":"Datos invalidos","details":[{"field":"status","message":"Invalid enum value..."}]}` |
| `404` | Recurso inexistente | `{"error":"Ticket 999999 not found"}` |
| `409` | Clave única duplicada | `{"error":"Valor duplicado","field":["cue"]}` |
| `500` | Error no controlado | `{"error":"Error interno del servidor"}` |

### Catálogos de valores

- Estado de ticket: `ABIERTO` | `EN PROGRESO` | `TERMINADO`
- Estado de factura (Fase 5): `PENDING` | `APPROVED` | `REJECTED`

> `ticketId` es la PK externa de GLPI y **va explícito en la creación** (no es autoincremental).

---

## Sistema

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/` | Ping general |
| `GET` | `/api/health` | Health check |

```bash
curl http://localhost:3000/api/health
# {"status":"ok"}
```

---

## Establecimientos (`/api/establishments`)

### `GET /api/establishments` — listado paginado con filtros

Query params opcionales: `search` (CUE o nombre), `department`, `locality`, `dispatchOrderId`, `page`, `limit`.

```bash
curl "http://localhost:3000/api/establishments?search=25%20de&limit=10"
```

### `GET /api/establishments/:cue` — detalle con orden asociada

```bash
curl http://localhost:3000/api/establishments/700083300
```

Responde el establecimiento + `dispatchOrder` con técnicos de la orden (o `dispatchOrder: null`).

### `POST /api/establishments` — alta

```bash
curl -X POST http://localhost:3000/api/establishments \
  -H "Content-Type: application/json" \
  -d '{
    "cue": "700083300",
    "name": "EP 25 DE MAYO",
    "department": "25 DE MAYO",
    "locality": "LOCALIDAD A",
    "address": "LA PLATA ENTRE CALLE 5 Y 6",
    "distanceKm": 31.30
  }'
```

- `cue` y `name` obligatorios; resto opcional → `201 Created`
- CUE duplicado → `409`

### `PATCH /api/establishments/:cue` — modificación parcial

Solo campos enviados. Ejemplo:

```bash
curl -X PATCH http://localhost:3000/api/establishments/700083300 \
  -H "Content-Type: application/json" \
  -d '{"directorName": "María González"}'
```

### `DELETE /api/establishments/:cue` — baja

Elimina en cascada los tickets del establecimiento (definido en schema). Devuelve `204 No Content`.

---

## Órdenes de Despacho (`/api/dispatch-orders`)

### `GET /api/dispatch-orders` — listado

Filtros: `listStatus`, `dispatchCode` (parcial, insensible), `page`, `limit`.
Cada orden incluye establecimientos y técnicos vinculados.

```bash
curl "http://localhost:3000/api/dispatch-orders?listStatus=INICIADA"
```

### `GET /api/dispatch-orders/:id` — detalle

Incluye `establishments[]` y `technicians[]`. Inexistente → `404`.

### `POST /api/dispatch-orders` — alta (transacción atómica)

Crea la orden, vincula técnicos (tabla N:M) y asigna establecimientos **en una sola transacción**: si falla algo, no queda nada creado.

```bash
curl -X POST http://localhost:3000/api/dispatch-orders \
  -H "Content-Type: application/json" \
  -d '{
    "dispatchCode": "CC0271",
    "dispatchTimestamp": "2026-10-05T11:52:03Z",
    "listStatus": "INICIADA",
    "technicianIds": [1, 2],
    "establishmentCues": ["700083300"]
  }'
```

- `technicianIds` y `establishmentCues` opcionales (default `[]`)
- CUE o técnico inexistente → `404` sin parcialidades
- Un establecimiento ya asignado queda **re-asignado** a esta orden (FK singular)

---

## Técnicos (`/api/technicians`)

| Método | Descripción | Body |
|---|---|---|
| `GET` | Listado paginado, filtro `search` por nombre | — |
| `POST` | Alta | `{"fullName": "Juan Perez"}` → `201` |

---

## Tickets (`/api/tickets`)

### `GET /api/tickets` — listado con filtros

| Filtro | Descripción |
|---|---|
| `status` | `ABIERTO` \| `EN PROGRESO` \| `TERMINADO` |
| `establishment` | CUE exacto |
| `technicianId` | Tickets de establecimientos que pertenecen a órdenes donde participa ese técnico |
| `search` | Búsqueda parcial en `title` (case-insensitive) |

```bash
curl "http://localhost:3000/api/tickets?technicianId=1&search=impresora"
```

Cada ticket incluye un resumen del establecimiento (`cue`, `name`, `department`, `locality`, `isSecondaryBuilding`).

### `GET /api/tickets/:id` — detalle completo

Árbol de datos: ticket → establecimiento → orden de despacho → técnicos, más facturas asociadas (Fase 5):

```bash
curl http://localhost:3000/api/tickets/125691 | python3 -m json.tool
```

Nuevo `ticketId` inexistente en el listado → `404`.

### `POST /api/tickets` — alta

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "ticketId": 125691,
    "establishmentCue": "700083300",
    "title": "Detalle o requerimiento del ticket",
    "glpiClosedTicket": "REF-GLPI-001",
    "openingTimestamp": "2026-10-05T09:00:00Z"
  }'
```

- `ticketId` y `title` obligatorios (id viene del ticket en línea)
- `status` default `ABIERTO`; `establishmentCue` opcional (ticket genérico sin establecimiento)
- CUE inexistente → `404`

### `PATCH /api/tickets/:id/status` — cambio de estado

```bash
curl -X PATCH http://localhost:3000/api/tickets/125691/status \
  -H "Content-Type: application/json" \
  -d '{"status": "EN PROGRESO"}'
```

---

## Próximos módulos (en roadmap)

- **Fase 3 (Stock)**: `suppliers`, `employees`, `inventory_items`, `POST /api/assignments` con transacción atómica de resta de stock, y `GET /api/employees/:id/assignments` (custodia).
- **Fase 5 (ARCA)**: cola BullMQ + worker que emite comprobantes y actualiza `invoices`.
