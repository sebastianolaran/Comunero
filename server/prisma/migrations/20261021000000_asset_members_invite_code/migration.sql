-- CreateTable
CREATE TABLE "_AssetToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AssetToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_AssetToUser_B_index" ON "_AssetToUser"("B");

-- AddForeignKey
ALTER TABLE "_AssetToUser" ADD CONSTRAINT "_AssetToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AssetToUser" ADD CONSTRAINT "_AssetToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cada usuario queda en el bien en el que ya estaba.
INSERT INTO "_AssetToUser" ("A", "B") SELECT "assetId", "id" FROM "User";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_assetId_fkey";

-- DropIndex
DROP INDEX "User_assetId_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "assetId";

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "inviteCode" TEXT;

-- Código para los bienes que ya existen (mismo formato que asset.rules.js).
DO $$
DECLARE
  letras CONSTANT TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ';
  todos  CONSTANT TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bien RECORD;
  codigo TEXT;
BEGIN
  FOR bien IN SELECT "id" FROM "Asset" WHERE "inviteCode" IS NULL LOOP
    LOOP
      codigo := '';
      FOR i IN 1..3 LOOP
        codigo := codigo || substr(letras, 1 + floor(random() * length(letras))::int, 1);
      END LOOP;
      codigo := codigo || '-';
      FOR i IN 1..4 LOOP
        codigo := codigo || substr(todos, 1 + floor(random() * length(todos))::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "Asset" WHERE "inviteCode" = codigo);
    END LOOP;
    UPDATE "Asset" SET "inviteCode" = codigo WHERE "id" = bien."id";
  END LOOP;
END $$;

ALTER TABLE "Asset" ALTER COLUMN "inviteCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Asset_inviteCode_key" ON "Asset"("inviteCode");
