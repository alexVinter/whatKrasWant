-- Add optional resident author link to ideas.
ALTER TABLE "ideas" ADD COLUMN "user_id" TEXT;

ALTER TABLE "ideas"
  ADD CONSTRAINT "ideas_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ideas_user_id_idx" ON "ideas"("user_id");
