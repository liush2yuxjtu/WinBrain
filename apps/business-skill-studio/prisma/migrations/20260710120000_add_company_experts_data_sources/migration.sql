-- Add organization-scoped experts and read-only customer data source settings.
CREATE TYPE "DataSourceKind" AS ENUM ('MYSQL', 'OCEANBASE_MYSQL');
CREATE TYPE "DataSourceSslMode" AS ENUM ('DISABLED', 'REQUIRED');
CREATE TYPE "DataSourceHealth" AS ENUM ('UNTESTED', 'HEALTHY', 'WARNING', 'FAILED');

CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "experts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT NOT NULL,
    "department" TEXT,
    "expertise" TEXT,
    "business_context" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "experts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "data_sources" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "expert_id" TEXT,
    "name" TEXT NOT NULL,
    "kind" "DataSourceKind" NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "password_encrypted" TEXT NOT NULL,
    "database_name" TEXT NOT NULL,
    "charset" TEXT NOT NULL DEFAULT 'utf8mb4',
    "ssl_mode" "DataSourceSslMode" NOT NULL DEFAULT 'DISABLED',
    "last_status" "DataSourceHealth" NOT NULL DEFAULT 'UNTESTED',
    "last_tested_at" TIMESTAMP(3),
    "last_latency_ms" INTEGER,
    "last_table_count" INTEGER,
    "last_server_version" TEXT,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "skills"
    ADD COLUMN "scope_key" TEXT NOT NULL DEFAULT 'global',
    ADD COLUMN "organization_id" TEXT,
    ADD COLUMN "expert_id" TEXT;

DROP INDEX IF EXISTS "skills_slug_key";

CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE UNIQUE INDEX "experts_organization_id_email_key" ON "experts"("organization_id", "email");
CREATE INDEX "experts_organization_id_is_active_idx" ON "experts"("organization_id", "is_active");
CREATE UNIQUE INDEX "data_sources_organization_id_name_key" ON "data_sources"("organization_id", "name");
CREATE INDEX "data_sources_organization_id_last_status_idx" ON "data_sources"("organization_id", "last_status");
CREATE UNIQUE INDEX "skills_scope_key_slug_key" ON "skills"("scope_key", "slug");
CREATE INDEX "skills_organization_id_updated_at_idx" ON "skills"("organization_id", "updated_at");

ALTER TABLE "experts"
    ADD CONSTRAINT "experts_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "data_sources"
    ADD CONSTRAINT "data_sources_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "data_sources"
    ADD CONSTRAINT "data_sources_expert_id_fkey"
    FOREIGN KEY ("expert_id") REFERENCES "experts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "skills"
    ADD CONSTRAINT "skills_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "skills"
    ADD CONSTRAINT "skills_expert_id_fkey"
    FOREIGN KEY ("expert_id") REFERENCES "experts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
