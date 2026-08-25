-- AlterTable
ALTER TABLE "ideas" ADD COLUMN     "topic_id" TEXT;

-- CreateTable
CREATE TABLE "idea_topics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idea_topics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idea_topics_slug_key" ON "idea_topics"("slug");

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "idea_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
