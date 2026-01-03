-- Add rule review metadata (used to block schedule generation when rules are ambiguous)
ALTER TABLE "rules" ADD COLUMN "review_status" TEXT NOT NULL DEFAULT 'ok';
ALTER TABLE "rules" ADD COLUMN "review_issues" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "rules" ADD COLUMN "reviewed_at" TIMESTAMP(3);

