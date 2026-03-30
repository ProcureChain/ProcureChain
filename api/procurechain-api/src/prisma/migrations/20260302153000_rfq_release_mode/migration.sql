-- CreateEnum
CREATE TYPE "RFQReleaseMode" AS ENUM ('PRIVATE', 'PUBLIC');

-- AlterTable
ALTER TABLE "RFQ"
ADD COLUMN "releaseMode" "RFQReleaseMode" NOT NULL DEFAULT 'PRIVATE';
