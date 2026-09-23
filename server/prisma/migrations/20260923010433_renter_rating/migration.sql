-- CreateEnum
CREATE TYPE "RenterRating" AS ENUM ('RECOMMENDED', 'NOT_RECOMMENDED');

-- AlterTable
ALTER TABLE "Renter" ADD COLUMN     "rating" "RenterRating";

