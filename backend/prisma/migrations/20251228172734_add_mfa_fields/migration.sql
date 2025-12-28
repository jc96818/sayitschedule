-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mfa_backup_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfa_secret" VARCHAR(255),
ADD COLUMN     "password_changed_at" TIMESTAMP(3);
