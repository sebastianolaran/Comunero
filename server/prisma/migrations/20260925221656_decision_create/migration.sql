-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "votesNeeded" INTEGER;

-- AlterTable
ALTER TABLE "Decision" ALTER COLUMN "description" DROP NOT NULL;

