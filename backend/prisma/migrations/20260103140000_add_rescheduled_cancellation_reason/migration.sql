-- Add missing 'rescheduled' value to CancellationReason enum
-- This value was added to the Prisma schema but the migration was missing

ALTER TYPE "CancellationReason" ADD VALUE IF NOT EXISTS 'rescheduled' BEFORE 'other';
