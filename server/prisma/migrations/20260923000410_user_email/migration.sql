-- Agrega el mail con el que se entra a la app.
--
-- En tres pasos y no con un ADD COLUMN NOT NULL directo: los usuarios que ya
-- existen no tienen mail, y sin relleno previo la migracion falla contra
-- cualquier base con datos. El relleno sale del id (unico), asi el indice
-- unico se puede crear despues; el seed los pisa con los mails de verdad.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "email" TEXT;

UPDATE "User" SET "email" = "id" || '@comunero.test' WHERE "email" IS NULL;

ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
