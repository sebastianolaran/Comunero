-- DropForeignKey
ALTER TABLE "RenterObservation" DROP CONSTRAINT "RenterObservation_reservationId_fkey";

-- AlterTable
ALTER TABLE "RenterObservation" ALTER COLUMN "reservationId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "RenterObservation" ADD CONSTRAINT "RenterObservation_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

