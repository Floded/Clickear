-- CreateEnum
CREATE TYPE "FeatureKey" AS ENUM ('tickets', 'organization', 'inventory', 'budgets', 'invoices');

-- CreateEnum
CREATE TYPE "AccessMode" AS ENUM ('VIEW', 'EDIT');

-- CreateTable
CREATE TABLE "user_permissions" (
    "userId" INTEGER NOT NULL,
    "feature" "FeatureKey" NOT NULL,
    "access" "AccessMode" NOT NULL DEFAULT 'VIEW',

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("userId","feature")
);

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
