-- DropForeignKey
ALTER TABLE "MovementShare" DROP CONSTRAINT "MovementShare_movementId_fkey";

-- AlterTable
ALTER TABLE "Movement" ADD COLUMN     "generatedNext" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recurring" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
-- Nada escribe MovementShare antes de esta migracion, asi que la tabla deberia
-- estar vacia. El DEFAULT temporal evita que el deploy falle si no lo esta.
ALTER TABLE "MovementShare" ADD COLUMN     "amount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MovementShare" ALTER COLUMN "amount" DROP DEFAULT;

-- CreateTable
CREATE TABLE "MovementItem" (
    "id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "MovementItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovementItemShare" (
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "MovementItemShare_pkey" PRIMARY KEY ("itemId","userId")
);

-- CreateIndex
CREATE INDEX "MovementItem_movementId_idx" ON "MovementItem"("movementId");

-- AddForeignKey
ALTER TABLE "MovementShare" ADD CONSTRAINT "MovementShare_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "Movement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementItem" ADD CONSTRAINT "MovementItem_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "Movement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementItemShare" ADD CONSTRAINT "MovementItemShare_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MovementItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementItemShare" ADD CONSTRAINT "MovementItemShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

