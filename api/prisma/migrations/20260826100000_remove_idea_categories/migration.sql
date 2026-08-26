-- DropForeignKey
ALTER TABLE "ideas" DROP CONSTRAINT "ideas_category_id_fkey";

-- DropIndex
DROP INDEX "categories_slug_key";

-- AlterTable
ALTER TABLE "ideas" DROP COLUMN "category_id";

-- DropTable
DROP TABLE "categories";
