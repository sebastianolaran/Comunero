-- AlterTable
ALTER TABLE "Reservation" DROP COLUMN "depositAmount",
DROP COLUMN "depositPaidAt",
ADD COLUMN     "paidAt" TIMESTAMP(3);

