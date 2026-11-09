-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('FACTORY', 'SMITH', 'SUPPLIER', 'INTERNAL');

-- AlterTable
ALTER TABLE "partner_sources" ADD COLUMN "type" "PartnerType" NOT NULL DEFAULT 'INTERNAL';

