## 4. Lista de Tareas para el Desarrollo (Roadmap)

### Fase 1: Configuración Base e Infraestructura

- [ ] Inicializar repositorio y entorno de desarrollo (Docker para Postgres y Redis).
- [ ] Configurar ORM o Query Builder (ej. Prisma, TypeORM, Kysely o Drizzle) en el Backend.
- [ ] Ejecutar scripts DDL de migraciones de PostgreSQL con las 9 tablas definidas.

### Fase 2: Backend - Módulo de Tickets y Despacho

- [ ] Crear CRUD de Establecimientos (`establishments`).
- [ ] Crear endpoints para carga y consulta de Órdenes de Despacho (`dispatch_orders`).
- [ ] Crear API para listar Tickets con filtros por estado, establecimiento y técnico.
- [ ] Crear endpoint de detalle de Ticket (`GET /api/tickets/:id`) que traiga todos los datos asociados.

### Fase 3: Backend - Módulo de Inventario y Stock

- [ ] Crear CRUD de Proveedores (`suppliers`) y Empleados (`employees`).
- [ ] Crear CRUD de Ítems de Stock (`inventory_items`).
- [ ] Implementar la transacción de asignación de stock a empleados (`POST /api/assignments`):
  - Validar disponibilidad de stock en depósito.
  - Registrar la entrega en `item_assignments` (con `delivery_date` obligatorio).
  - Restar automáticamente de `available_quantity` de forma atómica.
- [ ] Endpoint para consultar el stock que tiene en custodia un empleado específico.

### Fase 4: Frontend (Interfaz Web)

- [ ] Diseñar dashboard principal con navegación entre Tickets y Stock.
- [ ] Construir vista de lista de Tickets con buscador, filtros y tarjetas resumen.
- [ ] Implementar Modal / Vista detallada al seleccionar un Ticket.
- [ ] Diseñar panel de Control de Stock:
  - Tabla de ítems en depósito.
  - Formulario modal para asignar ítem a empleado.
  - Vista del "haber" del empleado (ítems bajo su responsabilidad).

### Fase 5: Integración ARCA (ex-AFIP)

- [ ] Configurar servicio de cola (BullMQ/Redis) para el procesamiento asíncrono de comprobantes.
- [ ] Configurar cliente de integración con ARCA (vía biblioteca WebServices WSAA/WSFE o API wrapper).
- [ ] Crear Job Worker que tome comprobantes en estado `PENDING`, solicite CAE a ARCA y actualice `invoices`.
- [ ] Conectar la acción de facturar en el frontend con la cola de emisión.
