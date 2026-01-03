-- Add additional logo variants for organizations (used in UI/print)
ALTER TABLE "organizations" ADD COLUMN "logo_url_small" TEXT;
ALTER TABLE "organizations" ADD COLUMN "logo_url_medium" TEXT;
ALTER TABLE "organizations" ADD COLUMN "logo_url_grayscale" TEXT;

