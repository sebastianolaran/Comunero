-- CreateEnum
CREATE TYPE "SwapStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ReservationSwap" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "offeredReservationId" TEXT NOT NULL,
    "requestedReservationId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" "SwapStatus" NOT NULL DEFAULT 'PENDING',
    "closedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReservationSwap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReservationSwap_assetId_createdAt_idx" ON "ReservationSwap"("assetId", "createdAt");

-- CreateIndex
CREATE INDEX "ReservationSwap_offeredReservationId_idx" ON "ReservationSwap"("offeredReservationId");

-- CreateIndex
CREATE INDEX "ReservationSwap_requestedReservationId_idx" ON "ReservationSwap"("requestedReservationId");

-- AddForeignKey
ALTER TABLE "ReservationSwap" ADD CONSTRAINT "ReservationSwap_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationSwap" ADD CONSTRAINT "ReservationSwap_offeredReservationId_fkey" FOREIGN KEY ("offeredReservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationSwap" ADD CONSTRAINT "ReservationSwap_requestedReservationId_fkey" FOREIGN KEY ("requestedReservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationSwap" ADD CONSTRAINT "ReservationSwap_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationSwap" ADD CONSTRAINT "ReservationSwap_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

