-- CreateEnum
CREATE TYPE "BaaStatus" AS ENUM ('not_started', 'awaiting_org_signature', 'awaiting_vendor_signature', 'executed', 'voided', 'superseded');

-- CreateTable
CREATE TABLE "baa_agreements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "status" "BaaStatus" NOT NULL DEFAULT 'not_started',
    "template_name" VARCHAR(100) NOT NULL,
    "template_version" VARCHAR(20) NOT NULL,
    "template_sha256" VARCHAR(64) NOT NULL,
    "executed_pdf_sha256" VARCHAR(64),
    "executed_pdf_path" VARCHAR(500),
    "org_signed_at" TIMESTAMP(3),
    "org_signer_user_id" TEXT,
    "org_signer_name" VARCHAR(255),
    "org_signer_title" VARCHAR(255),
    "org_signer_email" VARCHAR(255),
    "org_signer_ip" VARCHAR(45),
    "org_signer_user_agent" VARCHAR(500),
    "vendor_signed_at" TIMESTAMP(3),
    "vendor_signer_user_id" TEXT,
    "vendor_signer_name" VARCHAR(255),
    "vendor_signer_title" VARCHAR(255),
    "esign_provider" VARCHAR(50),
    "esign_envelope_id" VARCHAR(100),
    "esign_status" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baa_agreements_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "baa_agreements" ADD CONSTRAINT "baa_agreements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
