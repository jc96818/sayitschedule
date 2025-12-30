-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "business_type_template_id" TEXT,
ADD COLUMN     "certification_label" VARCHAR(50) NOT NULL DEFAULT 'Certifications',
ADD COLUMN     "equipment_label" VARCHAR(50) NOT NULL DEFAULT 'Equipment',
ADD COLUMN     "patient_label" VARCHAR(50) NOT NULL DEFAULT 'Patients',
ADD COLUMN     "patient_label_singular" VARCHAR(50) NOT NULL DEFAULT 'Patient',
ADD COLUMN     "room_label" VARCHAR(50) NOT NULL DEFAULT 'Rooms',
ADD COLUMN     "room_label_singular" VARCHAR(50) NOT NULL DEFAULT 'Room',
ADD COLUMN     "staff_label" VARCHAR(50) NOT NULL DEFAULT 'Staff',
ADD COLUMN     "staff_label_singular" VARCHAR(50) NOT NULL DEFAULT 'Staff Member',
ADD COLUMN     "suggested_certifications" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "suggested_room_equipment" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "business_type_templates" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "staff_label" VARCHAR(50) NOT NULL DEFAULT 'Staff',
    "staff_label_singular" VARCHAR(50) NOT NULL DEFAULT 'Staff Member',
    "patient_label" VARCHAR(50) NOT NULL DEFAULT 'Patients',
    "patient_label_singular" VARCHAR(50) NOT NULL DEFAULT 'Patient',
    "room_label" VARCHAR(50) NOT NULL DEFAULT 'Rooms',
    "room_label_singular" VARCHAR(50) NOT NULL DEFAULT 'Room',
    "certification_label" VARCHAR(50) NOT NULL DEFAULT 'Certifications',
    "equipment_label" VARCHAR(50) NOT NULL DEFAULT 'Equipment',
    "suggested_certifications" JSONB NOT NULL DEFAULT '[]',
    "suggested_room_equipment" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_type_templates_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_business_type_template_id_fkey" FOREIGN KEY ("business_type_template_id") REFERENCES "business_type_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
