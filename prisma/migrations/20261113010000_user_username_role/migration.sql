-- User: login por username + roles (GESTOR/ADMIN/REVISADOR); se elimina email.
-- Backfill: username = parte local del email (con sufijo si colisiona) y
-- los usuarios existentes pasan a ADMIN (eran los seeded por el administrador inicial).
ALTER TABLE "users" ADD COLUMN "username" VARCHAR(50);
ALTER TABLE "users" ADD COLUMN "role" VARCHAR(20) NOT NULL DEFAULT 'GESTOR';

UPDATE "users" SET "username" = split_part("email", '@', 1);

UPDATE "users" u SET "username" = split_part(u."email", '@', 1) || '_' || u."id"::text
WHERE EXISTS (
  SELECT 1 FROM "users" o
  WHERE o."id" <> u."id" AND split_part(o."email", '@', 1) = split_part(u."email", '@', 1)
);

ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

UPDATE "users" SET "role" = 'ADMIN';

ALTER TABLE "users" DROP COLUMN "email";
