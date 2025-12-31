-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('admin', 'staff', 'portal', 'ai_voice', 'api');

-- CreateEnum
CREATE TYPE "ContactRelationship" AS ENUM ('self', 'parent', 'guardian', 'caregiver', 'spouse', 'other');

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "default_session_duration" INTEGER,
ADD COLUMN     "email" VARCHAR(255),
ADD COLUMN     "gender_preference" "Gender",
ADD COLUMN     "guardian_email" VARCHAR(255),
ADD COLUMN     "guardian_name" VARCHAR(255),
ADD COLUMN     "guardian_phone" VARCHAR(20),
ADD COLUMN     "guardian_relationship" VARCHAR(50),
ADD COLUMN     "phone" VARCHAR(20);

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "booked_by_contact_id" TEXT,
ADD COLUMN     "booked_via" "BookingSource" NOT NULL DEFAULT 'admin';

-- CreateTable
CREATE TABLE "patient_contacts" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "relationship" "ContactRelationship" NOT NULL DEFAULT 'self',
    "can_access_portal" BOOLEAN NOT NULL DEFAULT false,
    "is_primary_contact" BOOLEAN NOT NULL DEFAULT false,
    "email_opt_in" BOOLEAN NOT NULL DEFAULT true,
    "sms_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_login_tokens" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "channel" VARCHAR(10) NOT NULL DEFAULT 'email',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_login_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_sessions" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_activity_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_holds" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "staff_id" TEXT,
    "room_id" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "released_at" TIMESTAMP(3),
    "converted_to_session_id" TEXT,
    "created_by_contact_id" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_holds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patient_contacts_patient_id_idx" ON "patient_contacts"("patient_id");

-- CreateIndex
CREATE INDEX "patient_contacts_email_idx" ON "patient_contacts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "portal_login_tokens_token_key" ON "portal_login_tokens"("token");

-- CreateIndex
CREATE INDEX "portal_login_tokens_token_hash_idx" ON "portal_login_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "portal_login_tokens_contact_id_idx" ON "portal_login_tokens"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "portal_sessions_token_hash_key" ON "portal_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "portal_sessions_token_hash_idx" ON "portal_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "portal_sessions_contact_id_idx" ON "portal_sessions"("contact_id");

-- CreateIndex
CREATE INDEX "appointment_holds_organization_id_date_start_time_idx" ON "appointment_holds"("organization_id", "date", "start_time");

-- CreateIndex
CREATE INDEX "appointment_holds_expires_at_idx" ON "appointment_holds"("expires_at");

-- AddForeignKey
ALTER TABLE "patient_contacts" ADD CONSTRAINT "patient_contacts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_login_tokens" ADD CONSTRAINT "portal_login_tokens_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "patient_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "patient_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
