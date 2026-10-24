-- CreateEnum
CREATE TYPE "NoResponseAction" AS ENUM ('APPROVE', 'REJECT');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "maxConsecutiveDays" INTEGER,
ADD COLUMN     "noResponseAction" "NoResponseAction" NOT NULL DEFAULT 'REJECT',
ADD COLUMN     "rentalDailyRate" INTEGER,
ADD COLUMN     "responseHours" INTEGER;

-- CreateTable
CREATE TABLE "AssetMemberSetting" (
    "assetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "percent" INTEGER,

    CONSTRAINT "AssetMemberSetting_pkey" PRIMARY KEY ("assetId","userId")
);

-- AddForeignKey
ALTER TABLE "AssetMemberSetting" ADD CONSTRAINT "AssetMemberSetting_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMemberSetting" ADD CONSTRAINT "AssetMemberSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

