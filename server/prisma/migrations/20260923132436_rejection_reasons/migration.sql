-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "Objection" ALTER COLUMN "reason" DROP NOT NULL;

