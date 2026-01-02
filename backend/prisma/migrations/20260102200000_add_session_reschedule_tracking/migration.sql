-- Add reschedule tracking to sessions
-- This column was added to the schema in commit 09222a6 but migration was missing

ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "rescheduled_from_id" TEXT;

-- Add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_rescheduled_from_id_key" ON "sessions"("rescheduled_from_id");

-- Add foreign key constraint (self-referencing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sessions_rescheduled_from_id_fkey'
    ) THEN
        ALTER TABLE "sessions" ADD CONSTRAINT "sessions_rescheduled_from_id_fkey"
            FOREIGN KEY ("rescheduled_from_id") REFERENCES "sessions"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
