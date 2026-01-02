-- CreateEnum
CREATE TYPE "HelpArticleStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateTable
CREATE TABLE "help_categories" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_articles" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "summary" TEXT,
    "status" "HelpArticleStatus" NOT NULL DEFAULT 'published',
    "category_id" TEXT NOT NULL,
    "body_markdown" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "audience_roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "prerequisites_features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "prerequisites_settings" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "prerequisites_org" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "search_vector" tsvector,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_articles_pkey" PRIMARY KEY ("id")
);

-- Create function to update search vector
CREATE OR REPLACE FUNCTION help_articles_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.body_text, '')), 'C') ||
    setweight(to_tsvector('english', array_to_string(NEW.tags, ' ')), 'D') ||
    setweight(to_tsvector('english', array_to_string(NEW.aliases, ' ')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search vector
CREATE TRIGGER help_articles_search_vector_trigger
  BEFORE INSERT OR UPDATE ON help_articles
  FOR EACH ROW EXECUTE FUNCTION help_articles_search_vector_update();

-- CreateIndex
CREATE UNIQUE INDEX "help_categories_slug_key" ON "help_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "help_articles_slug_key" ON "help_articles"("slug");

-- CreateIndex
CREATE INDEX "help_articles_category_id_idx" ON "help_articles"("category_id");

-- CreateIndex
CREATE INDEX "help_articles_search_vector_idx" ON "help_articles" USING GIN ("search_vector");

-- AddForeignKey
ALTER TABLE "help_articles" ADD CONSTRAINT "help_articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "help_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

