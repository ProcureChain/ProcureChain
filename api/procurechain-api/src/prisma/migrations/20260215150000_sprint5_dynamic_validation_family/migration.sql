-- CreateEnum
CREATE TYPE "ServiceFamily" AS ENUM ('MEASURABLE', 'LABOUR', 'PROFESSIONAL', 'MAINTENANCE', 'PROJECT', 'HYBRID');

-- CreateEnum
CREATE TYPE "ValidationEntityType" AS ENUM ('PR', 'RFQ', 'BID');

-- AlterTable
ALTER TABLE "SubcategoryRuleFormConfig" ADD COLUMN "serviceFamily" "ServiceFamily" NOT NULL DEFAULT 'PROJECT';

-- CreateTable
CREATE TABLE "RulePackFieldRequirement" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rulePackKey" TEXT NOT NULL,
    "entityType" "ValidationEntityType" NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "message" TEXT,
    "condition" JSONB,

    CONSTRAINT "RulePackFieldRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RulePackFieldRequirement_rulePackKey_entityType_fieldPath_key" ON "RulePackFieldRequirement"("rulePackKey", "entityType", "fieldPath");

-- CreateIndex
CREATE INDEX "RulePackFieldRequirement_rulePackKey_entityType_required_idx" ON "RulePackFieldRequirement"("rulePackKey", "entityType", "required");
