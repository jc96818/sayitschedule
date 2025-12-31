-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_user_id_fkey";

-- AlterTable
ALTER TABLE "organization_features" ADD COLUMN     "self_booking_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "self_booking_lead_time_hours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "self_booking_max_future_days" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "self_booking_requires_approval" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
