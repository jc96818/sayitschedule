-- CreateTable
CREATE TABLE "patient_session_specs" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "sessions_per_week" INTEGER NOT NULL DEFAULT 2,
    "duration_minutes" INTEGER,
    "preferred_times" JSONB,
    "required_certifications" JSONB NOT NULL DEFAULT '[]',
    "preferred_room_id" TEXT,
    "required_room_capabilities" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_session_specs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patient_session_specs_patient_id_idx" ON "patient_session_specs"("patient_id");

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "session_spec_id" TEXT;

-- CreateIndex
CREATE INDEX "sessions_session_spec_id_idx" ON "sessions"("session_spec_id");

-- AddForeignKey
ALTER TABLE "patient_session_specs" ADD CONSTRAINT "patient_session_specs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_session_specs" ADD CONSTRAINT "patient_session_specs_preferred_room_id_fkey" FOREIGN KEY ("preferred_room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_session_spec_id_fkey" FOREIGN KEY ("session_spec_id") REFERENCES "patient_session_specs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

