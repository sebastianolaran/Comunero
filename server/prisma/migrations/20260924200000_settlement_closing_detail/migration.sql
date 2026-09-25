-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN     "closedById" TEXT,
ADD COLUMN     "detail" JSONB;

-- CreateTable
CREATE TABLE "SettlementMovement" (
    "settlementId" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,

    CONSTRAINT "SettlementMovement_pkey" PRIMARY KEY ("settlementId","movementId")
);

-- CreateIndex
CREATE INDEX "SettlementMovement_movementId_idx" ON "SettlementMovement"("movementId");

-- CreateIndex
CREATE INDEX "Settlement_closedById_idx" ON "Settlement"("closedById");

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementMovement" ADD CONSTRAINT "SettlementMovement_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementMovement" ADD CONSTRAINT "SettlementMovement_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "Movement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

