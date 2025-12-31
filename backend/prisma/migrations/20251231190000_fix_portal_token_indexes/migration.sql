-- Fix portal_login_tokens schema drift:
-- - Remove plaintext token column (should not exist; Prisma model stores hash only)
-- - Ensure token_hash is unique (Prisma model uses @unique)
-- - Remove redundant non-unique indexes created previously

-- Drop plaintext token unique index + column
DROP INDEX IF EXISTS "portal_login_tokens_token_key";
ALTER TABLE "portal_login_tokens" DROP COLUMN IF EXISTS "token";

-- Replace non-unique token_hash index with unique index
DROP INDEX IF EXISTS "portal_login_tokens_token_hash_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "portal_login_tokens_token_hash_key" ON "portal_login_tokens"("token_hash");

-- Portal sessions already enforce token_hash uniqueness; drop redundant index if present
DROP INDEX IF EXISTS "portal_sessions_token_hash_idx";

