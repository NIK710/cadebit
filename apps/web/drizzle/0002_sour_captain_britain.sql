CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."material_ingestion_status" AS ENUM('pending', 'processing', 'retry', 'complete', 'failed');--> statement-breakpoint
CREATE TABLE "material_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"content" text NOT NULL,
	"content_hash" char(64) NOT NULL,
	"page_number" integer,
	"section" text,
	"source_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pipeline_version" text NOT NULL,
	"embedding_model" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_chunks_position_nonnegative" CHECK ("material_chunks"."position" >= 0),
	CONSTRAINT "material_chunks_page_number_positive" CHECK ("material_chunks"."page_number" is null or "material_chunks"."page_number" > 0),
	CONSTRAINT "material_chunks_content_not_blank" CHECK (length(trim("material_chunks"."content")) > 0)
);
--> statement-breakpoint
CREATE TABLE "material_ingestion_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"material_id" uuid NOT NULL,
	"pipeline_version" text NOT NULL,
	"status" "material_ingestion_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"last_error" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_ingestion_jobs_attempts_nonnegative" CHECK ("material_ingestion_jobs"."attempts" >= 0),
	CONSTRAINT "material_ingestion_jobs_max_attempts_positive" CHECK ("material_ingestion_jobs"."max_attempts" > 0),
	CONSTRAINT "material_ingestion_jobs_attempts_bounded" CHECK ("material_ingestion_jobs"."attempts" <= "material_ingestion_jobs"."max_attempts")
);
--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "content_hash" char(64);--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "pipeline_version" text;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "processed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "material_chunks" ADD CONSTRAINT "material_chunks_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_ingestion_jobs" ADD CONSTRAINT "material_ingestion_jobs_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "material_chunks_material_pipeline_position_idx" ON "material_chunks" USING btree ("material_id","pipeline_version","position");--> statement-breakpoint
CREATE INDEX "material_chunks_material_id_idx" ON "material_chunks" USING btree ("material_id");--> statement-breakpoint
CREATE INDEX "material_chunks_embedding_hnsw_idx" ON "material_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "material_ingestion_jobs_material_pipeline_idx" ON "material_ingestion_jobs" USING btree ("material_id","pipeline_version");--> statement-breakpoint
CREATE INDEX "material_ingestion_jobs_claim_idx" ON "material_ingestion_jobs" USING btree ("status","available_at");
