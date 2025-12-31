-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'late_cancel', 'no_show');

-- CreateEnum
CREATE TYPE "CancellationReason" AS ENUM ('patient_request', 'caregiver_request', 'therapist_unavailable', 'weather', 'illness', 'scheduling_conflict', 'other');

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "actual_end_time" TIMESTAMP(3),
ADD COLUMN     "actual_start_time" TIMESTAMP(3),
ADD COLUMN     "cancellation_notes" TEXT,
ADD COLUMN     "cancellation_reason" "CancellationReason",
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "cancelled_by_id" TEXT,
ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "confirmed_by_id" TEXT,
ADD COLUMN     "status" "SessionStatus" NOT NULL DEFAULT 'scheduled',
ADD COLUMN     "status_updated_at" TIMESTAMP(3),
ADD COLUMN     "status_updated_by_id" TEXT;

-- CreateTable
CREATE TABLE "organization_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "business_hours" JSONB NOT NULL DEFAULT '{}',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'America/New_York',
    "default_session_duration" INTEGER NOT NULL DEFAULT 60,
    "slot_interval" INTEGER NOT NULL DEFAULT 30,
    "late_cancel_window_hours" INTEGER NOT NULL DEFAULT 24,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_features" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email_reminders_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sms_reminders_enabled" BOOLEAN NOT NULL DEFAULT false,
    "reminder_hours" JSONB NOT NULL DEFAULT '[24, 2]',
    "patient_portal_enabled" BOOLEAN NOT NULL DEFAULT false,
    "portal_allow_cancel" BOOLEAN NOT NULL DEFAULT true,
    "portal_allow_reschedule" BOOLEAN NOT NULL DEFAULT false,
    "portal_require_confirmation" BOOLEAN NOT NULL DEFAULT true,
    "advanced_reports_enabled" BOOLEAN NOT NULL DEFAULT false,
    "report_export_enabled" BOOLEAN NOT NULL DEFAULT true,
    "voice_commands_enabled" BOOLEAN NOT NULL DEFAULT true,
    "medical_transcribe_enabled" BOOLEAN NOT NULL DEFAULT false,
    "api_access_enabled" BOOLEAN NOT NULL DEFAULT false,
    "webhooks_enabled" BOOLEAN NOT NULL DEFAULT false,
    "max_staff" INTEGER,
    "max_patients" INTEGER,
    "max_reminders_per_month" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_features_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_settings_organization_id_key" ON "organization_settings"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_features_organization_id_key" ON "organization_features"("organization_id");

-- AddForeignKey
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_features" ADD CONSTRAINT "organization_features_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_status_updated_by_id_fkey" FOREIGN KEY ("status_updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
