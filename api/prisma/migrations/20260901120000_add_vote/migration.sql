-- CreateTable
CREATE TABLE "votes" (
    "id" TEXT NOT NULL,
    "idea_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ip_hash" TEXT,
    "user_agent_hash" TEXT,
    "is_excluded" BOOLEAN NOT NULL DEFAULT false,
    "excluded_at" TIMESTAMP(3),
    "exclusion_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "votes_idea_id_user_id_key" ON "votes"("idea_id", "user_id");

-- CreateIndex
CREATE INDEX "votes_idea_id_idx" ON "votes"("idea_id");

-- CreateIndex
CREATE INDEX "votes_user_id_idx" ON "votes"("user_id");

-- CreateIndex
CREATE INDEX "votes_ip_hash_idx" ON "votes"("ip_hash");

-- CreateIndex
CREATE INDEX "votes_is_excluded_idx" ON "votes"("is_excluded");

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_idea_id_fkey" FOREIGN KEY ("idea_id") REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
