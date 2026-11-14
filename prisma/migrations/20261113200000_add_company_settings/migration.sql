-- CreateTable
CREATE TABLE "company_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "commercial_name" VARCHAR(255),
    "legal_name" VARCHAR(255),
    "logo_url" TEXT,
    "logo_path" TEXT,
    "responsible_name" VARCHAR(255),
    "responsible_position" VARCHAR(255),
    "address" TEXT,
    "locality" VARCHAR(100),
    "province" VARCHAR(100),
    "country" VARCHAR(100),
    "postal_code" VARCHAR(20),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "tax_id" VARCHAR(20),
    "gross_income_number" VARCHAR(50),
    "rupe_number" VARCHAR(50),
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" INTEGER,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "company_settings_singleton_check" CHECK ("id" = 1)
);

-- AddForeignKey
ALTER TABLE "company_settings"
ADD CONSTRAINT "company_settings_updated_by_fkey"
FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed inicial (idempotente): registro único con datos provistos
INSERT INTO "company_settings" (
    "id",
    "commercial_name",
    "legal_name",
    "logo_url",
    "logo_path",
    "responsible_name",
    "responsible_position",
    "address",
    "locality",
    "province",
    "country",
    "postal_code",
    "email",
    "phone",
    "tax_id",
    "gross_income_number",
    "rupe_number"
) VALUES (
    1,
    NULL,
    NULL,
    NULL,
    NULL,
    'Ricardo Gabriel Lillo Morales',
    'Socio Gerente',
    'Martín Güemes 944',
    'Rivadavia',
    'San Juan',
    'Argentina',
    NULL,
    'sanjuanconexionsj@gmail.com',
    '264-6210237',
    '20-29045449-3',
    '20-29045449-3',
    '80547'
)
ON CONFLICT ("id") DO NOTHING;
