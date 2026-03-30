-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'OPENED', 'UNDER_EVALUATION', 'SHORTLISTED', 'REJECTED', 'AWARD_RECOMMENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BidCriterion" AS ENUM ('PRICE', 'DELIVERY', 'COMPLIANCE', 'RISK');

-- AlterEnum
ALTER TYPE "SoDAction" ADD VALUE IF NOT EXISTS 'BID_EVALUATE';
ALTER TYPE "SoDAction" ADD VALUE IF NOT EXISTS 'BID_RECOMMEND';

-- AlterTable
ALTER TABLE "RFQAward" ADD COLUMN "bidId" TEXT;

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" "BidStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB,
    "documents" JSONB,
    "notes" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "totalBidValue" DECIMAL(18,2),
    "submittedAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "finalScore" DECIMAL(8,2),
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "recommendationReason" TEXT,
    "evaluationSummary" JSONB,
    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidScore" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bidId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "criterion" "BidCriterion" NOT NULL,
    "score" DECIMAL(6,2) NOT NULL,
    "weight" DECIMAL(6,2) NOT NULL,
    "notes" TEXT,
    CONSTRAINT "BidScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RFQAward_bidId_key" ON "RFQAward"("bidId");
CREATE UNIQUE INDEX "Bid_rfqId_supplierId_key" ON "Bid"("rfqId", "supplierId");
CREATE INDEX "Bid_tenantId_companyId_rfqId_status_idx" ON "Bid"("tenantId", "companyId", "rfqId", "status");
CREATE INDEX "Bid_supplierId_status_idx" ON "Bid"("supplierId", "status");
CREATE UNIQUE INDEX "BidScore_bidId_evaluatorId_criterion_key" ON "BidScore"("bidId", "evaluatorId", "criterion");
CREATE INDEX "BidScore_bidId_evaluatorId_idx" ON "BidScore"("bidId", "evaluatorId");

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "RFQ"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BidScore" ADD CONSTRAINT "BidScore_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RFQAward" ADD CONSTRAINT "RFQAward_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE SET NULL ON UPDATE CASCADE;
