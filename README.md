# Especificación del Proyecto: Sistema de Gestión de Tickets, Stock e Integración ARCA

Este documento sirve como contexto, especificación de arquitectura y prompt de instrucción para el desarrollo del sistema mediante agentes de código.

---

## 1. Visión General del Sistema

El sistema es una plataforma web para la gestión integral de operaciones en campo, que abarca:

1. **Gestión de Tickets y Hojas de Ruta:** Procesamiento y visualización de órdenes de trabajo/despacho, establecimientos educativos/institucionales y tickets de soporte técnico.
2. **Control de Inventario y Custodia:** Manejo de stock general en depósito, gestión de proveedores y control de materiales/herramientas asignadas a empleados con registro de entrega.
3. **Facturación e Integración Fiscal (ARCA / ex-AFIP):** Módulo preparado para emisión de comprobantes electrónicos de forma asíncrona mediante colas de trabajo.

---

## 2. Stack Tecnológico Recomendado

- **Frontend:** React / Next.js, Tailwind CSS (Interfaz ágil con modales y tablas interactivas).
- **Backend:** Node.js (NestJS o Express con TypeScript) / Python (FastAPI).
- **Base de Datos:** PostgreSQL (Transacciones estricta ACID para control de stock).
- **Colas de Trabajo (Asincronía ARCA):** Redis + BullMQ (para reintentos y resiliencia ante caídas del WebService fiscal).

---

## 3. Modelo de Datos Relacional (PostgreSQL)

```sql
-- ==========================================
-- MÓDULO 1: DESPACHO Y TICKETS DE SOPORTE
-- ==========================================

-- 1. Orden de Despacho (Cabecera)
CREATE TABLE dispatch_orders (
    id SERIAL PRIMARY KEY,
    dispatch_code VARCHAR(50) NOT NULL,       -- Ej: "CC0271"
    dispatch_timestamp TIMESTAMP NOT NULL,   -- Ej: "2026-10-05 11:52:03"
    list_status VARCHAR(50) NOT NULL,         -- Ej: "INICIADA"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Establecimientos (Escuelas / Sedes)
CREATE TABLE establishments (
    cue VARCHAR(20) PRIMARY KEY,              -- CUE único (Ej: "700083300")
    dispatch_order_id INT REFERENCES dispatch_orders(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,               -- Nombre de la institución
    department VARCHAR(100),                  -- Ej: "25 DE MAYO"
    locality VARCHAR(100),
    address TEXT,                             -- Ej: "LA PLATA ENTRE CALLE 5Y6"
    phone VARCHAR(50),
    distance_km DECIMAL(6, 2),                -- Ej: 31.30
    director_name VARCHAR(255),
    is_secondary_building BOOLEAN DEFAULT FALSE
);

-- 3. Técnicos / Personal Operativo
CREATE TABLE technicians (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL
);

-- Relación N:M entre Órdenes y Técnicos
CREATE TABLE dispatch_technicians (
    dispatch_order_id INT REFERENCES dispatch_orders(id) ON DELETE CASCADE,
    technician_id INT REFERENCES technicians(id) ON DELETE CASCADE,
    PRIMARY KEY (dispatch_order_id, technician_id)
);

-- 4. Tickets de Trabajo
CREATE TABLE tickets (
    ticket_id BIGINT PRIMARY KEY,             -- Identificador del ticket (Ej: 125691)
    establishment_cue VARCHAR(20) REFERENCES establishments(cue) ON DELETE CASCADE,
    title TEXT NOT NULL,                      -- Detalle o requerimiento del ticket
    glpi_closed_ticket VARCHAR(100),          -- Referencia externa GLPI
    opening_timestamp TIMESTAMP,             -- Fecha de apertura
    status VARCHAR(50) DEFAULT 'ABIERTO'      -- ABIERTO / TERMINADO / EN PROGRESO
);

-- ==========================================
-- MÓDULO 2: INVENTARIO Y STOCK GENERICO
-- ==========================================

-- 5. Proveedores
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    contact_email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Empleados (Custodios de material)
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    dni_or_file_number VARCHAR(50) UNIQUE,
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE
);

-- 7. Ítems en Depósito
CREATE TABLE inventory_items (
    id SERIAL PRIMARY KEY,
    supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    available_quantity INT NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Asignación de Stock a Empleados
CREATE TABLE item_assignments (
    id SERIAL PRIMARY KEY,
    inventory_item_id INT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    employee_id INT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    quantity_assigned INT NOT NULL CHECK (quantity_assigned > 0),
    delivery_date TIMESTAMP NOT NULL,         -- OBLIGATORIO
    return_date TIMESTAMP,                    -- Opcional para devoluciones
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- MÓDULO 3: FACTURACIÓN ARCA (PREPARACIÓN)
-- ==========================================

-- 9. Facturas / Comprobantes
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    ticket_id BIGINT REFERENCES tickets(ticket_id) ON DELETE SET NULL,
    voucher_type INT NOT NULL,                -- Ej: 1 (Factura A), 6 (Factura B), 11 (Factura C)
    doc_type INT NOT NULL,                    -- Ej: 80 (CUIT), 96 (DNI)
    doc_number VARCHAR(20) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    cae VARCHAR(50),                          -- Otorgado por ARCA
    cae_expiration_date DATE,
    status VARCHAR(50) DEFAULT 'PENDING',     -- PENDING, APPROVED, REJECTED
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Instrucción para el Agente OpenCode

> "Actúa como un desarrollador Senior Full-Stack. Utiliza la estructura SQL definida en este README para crear la arquitectura de la base de datos en PostgreSQL. Implementa la API REST aplicando transacciones atómicas para el módulo de inventario y construye una interfaz interactiva y responsive en React/Tailwind. Utilizando principios SOLID en todo el proyecto"
