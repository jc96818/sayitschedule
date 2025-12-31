-- Allow audit logs to be written by non-staff actors (e.g. patient portal contacts)
-- by making user_id nullable while keeping the FK constraint (NULL is permitted).

ALTER TABLE "audit_logs" ALTER COLUMN "user_id" DROP NOT NULL;

