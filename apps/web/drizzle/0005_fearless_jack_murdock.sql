CREATE TYPE "public"."course_ai_grounding_status" AS ENUM('grounded', 'insufficient');--> statement-breakpoint
CREATE TYPE "public"."course_ai_message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TABLE "course_ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_ai_conversations_revision_nonnegative" CHECK ("course_ai_conversations"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "course_ai_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"role" "course_ai_message_role" NOT NULL,
	"content" text NOT NULL,
	"grounding_status" "course_ai_grounding_status",
	"source_references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text,
	"prompt_version" text,
	"generation_request_id" text,
	"generation_response_id" text,
	"usage" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_ai_messages_position_nonnegative" CHECK ("course_ai_messages"."position" >= 0),
	CONSTRAINT "course_ai_messages_content_not_blank" CHECK (length(trim("course_ai_messages"."content")) > 0),
	CONSTRAINT "course_ai_messages_role_metadata" CHECK (("course_ai_messages"."role" = 'user' and "course_ai_messages"."grounding_status" is null) or ("course_ai_messages"."role" = 'assistant' and "course_ai_messages"."grounding_status" is not null))
);
--> statement-breakpoint
ALTER TABLE "course_ai_conversations" ADD CONSTRAINT "course_ai_conversations_membership_fk" FOREIGN KEY ("course_id","user_id") REFERENCES "public"."course_memberships"("course_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_ai_messages" ADD CONSTRAINT "course_ai_messages_conversation_id_course_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."course_ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_ai_conversations_user_course_idx" ON "course_ai_conversations" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "course_ai_messages_conversation_position_idx" ON "course_ai_messages" USING btree ("conversation_id","position");--> statement-breakpoint
CREATE INDEX "course_ai_messages_conversation_created_idx" ON "course_ai_messages" USING btree ("conversation_id","created_at");