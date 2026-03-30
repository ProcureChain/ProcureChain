-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "externalRef" TEXT,
ADD COLUMN     "isPreferred" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leadTimeDays" INTEGER,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "preferredCurrency" TEXT DEFAULT 'ZAR';
