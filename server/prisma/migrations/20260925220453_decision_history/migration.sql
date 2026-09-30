-- AlterTable
ALTER TABLE "Decision" ADD COLUMN     "estimatedAmount" INTEGER,
ADD COLUMN     "estimatedType" "MovementType",
ADD COLUMN     "votesNeededAtClose" INTEGER;

-- CreateIndex
CREATE INDEX "Decision_assetId_status_closedAt_idx" ON "Decision"("assetId", "status", "closedAt");

