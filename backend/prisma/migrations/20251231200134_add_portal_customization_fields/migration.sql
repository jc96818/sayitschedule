-- AlterTable
ALTER TABLE "organization_features" ADD COLUMN     "portal_background_url" VARCHAR(500),
ADD COLUMN     "portal_contact_email" VARCHAR(255),
ADD COLUMN     "portal_contact_phone" VARCHAR(20),
ADD COLUMN     "portal_footer_text" VARCHAR(500),
ADD COLUMN     "portal_logo_url" VARCHAR(500),
ADD COLUMN     "portal_primary_color" VARCHAR(7),
ADD COLUMN     "portal_privacy_url" VARCHAR(500),
ADD COLUMN     "portal_secondary_color" VARCHAR(7),
ADD COLUMN     "portal_show_org_name" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "portal_terms_url" VARCHAR(500),
ADD COLUMN     "portal_welcome_message" VARCHAR(500) NOT NULL DEFAULT 'Sign in to view your appointments and manage your schedule.',
ADD COLUMN     "portal_welcome_title" VARCHAR(100) NOT NULL DEFAULT 'Welcome to Your Patient Portal';
