-- CreateEnum
CREATE TYPE "VoteValue" AS ENUM ('YES', 'NO');

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coowner" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sharePct" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "Coowner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalRequest" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "tenantName" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalVote" (
    "id" TEXT NOT NULL,
    "rentalRequestId" TEXT NOT NULL,
    "coownerId" TEXT NOT NULL,
    "value" "VoteValue" NOT NULL,

    CONSTRAINT "RentalVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalRejection" (
    "id" TEXT NOT NULL,
    "rentalRequestId" TEXT NOT NULL,
    "coownerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "RentalRejection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coowner_phone_key" ON "Coowner"("phone");

-- CreateIndex
CREATE INDEX "Coowner_assetId_idx" ON "Coowner"("assetId");

-- CreateIndex
CREATE INDEX "RentalRequest_assetId_idx" ON "RentalRequest"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalVote_rentalRequestId_coownerId_key" ON "RentalVote"("rentalRequestId", "coownerId");

-- CreateIndex
CREATE INDEX "RentalRejection_rentalRequestId_idx" ON "RentalRejection"("rentalRequestId");

-- AddForeignKey
ALTER TABLE "Coowner" ADD CONSTRAINT "Coowner_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalRequest" ADD CONSTRAINT "RentalRequest_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalVote" ADD CONSTRAINT "RentalVote_rentalRequestId_fkey" FOREIGN KEY ("rentalRequestId") REFERENCES "RentalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalVote" ADD CONSTRAINT "RentalVote_coownerId_fkey" FOREIGN KEY ("coownerId") REFERENCES "Coowner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalRejection" ADD CONSTRAINT "RentalRejection_rentalRequestId_fkey" FOREIGN KEY ("rentalRequestId") REFERENCES "RentalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalRejection" ADD CONSTRAINT "RentalRejection_coownerId_fkey" FOREIGN KEY ("coownerId") REFERENCES "Coowner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


