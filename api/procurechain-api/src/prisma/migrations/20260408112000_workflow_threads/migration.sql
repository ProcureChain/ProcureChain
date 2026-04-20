CREATE TYPE "WorkflowMessageType" AS ENUM ('USER');

CREATE TABLE "WorkflowThread" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "prId" TEXT NOT NULL,
  CONSTRAINT "WorkflowThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowMessage" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "tenantId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "prId" TEXT NOT NULL,
  "authorId" TEXT,
  "authorLabel" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "messageType" "WorkflowMessageType" NOT NULL DEFAULT 'USER',
  CONSTRAINT "WorkflowMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowThread_prId_key" ON "WorkflowThread"("prId");
CREATE INDEX "WorkflowThread_tenantId_companyId_createdAt_idx" ON "WorkflowThread"("tenantId", "companyId", "createdAt");
CREATE INDEX "WorkflowThread_prId_idx" ON "WorkflowThread"("prId");
CREATE INDEX "WorkflowMessage_tenantId_companyId_prId_createdAt_idx" ON "WorkflowMessage"("tenantId", "companyId", "prId", "createdAt");
CREATE INDEX "WorkflowMessage_threadId_createdAt_idx" ON "WorkflowMessage"("threadId", "createdAt");

ALTER TABLE "WorkflowThread"
  ADD CONSTRAINT "WorkflowThread_prId_fkey"
  FOREIGN KEY ("prId") REFERENCES "PurchaseRequisition"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkflowMessage"
  ADD CONSTRAINT "WorkflowMessage_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "WorkflowThread"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
