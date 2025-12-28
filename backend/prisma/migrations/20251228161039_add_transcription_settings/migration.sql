-- CreateEnum
CREATE TYPE "TranscriptionProvider" AS ENUM ('aws_medical', 'aws_standard');

-- CreateEnum
CREATE TYPE "MedicalSpecialty" AS ENUM ('PRIMARYCARE', 'CARDIOLOGY', 'NEUROLOGY', 'ONCOLOGY', 'RADIOLOGY', 'UROLOGY');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "medical_specialty" "MedicalSpecialty" NOT NULL DEFAULT 'PRIMARYCARE',
ADD COLUMN     "transcription_provider" "TranscriptionProvider" NOT NULL DEFAULT 'aws_medical';
