CREATE TABLE "micro_lesson_answers" (
	"micro_lesson_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"block_id" text NOT NULL,
	"selected_choice_id" text NOT NULL,
	"correct" boolean NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "micro_lesson_answers_micro_lesson_id_block_id_pk" PRIMARY KEY("micro_lesson_id","block_id"),
	CONSTRAINT "micro_lesson_answers_block_not_blank" CHECK (length(trim("micro_lesson_answers"."block_id")) > 0),
	CONSTRAINT "micro_lesson_answers_choice_not_blank" CHECK (length(trim("micro_lesson_answers"."selected_choice_id")) > 0)
);
--> statement-breakpoint
CREATE TABLE "micro_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_session_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"course_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"learning_objective" text NOT NULL,
	"estimated_minutes" integer NOT NULL,
	"target_difficulty" numeric(5, 4) NOT NULL,
	"blocks" jsonb NOT NULL,
	"source_references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"generation_request_id" text NOT NULL,
	"generation_response_id" text NOT NULL,
	"usage" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "micro_lessons_estimated_minutes_range" CHECK ("micro_lessons"."estimated_minutes" between 3 and 20),
	CONSTRAINT "micro_lessons_target_difficulty_range" CHECK ("micro_lessons"."target_difficulty" >= 0 and "micro_lessons"."target_difficulty" <= 1),
	CONSTRAINT "micro_lessons_objective_not_blank" CHECK (length(trim("micro_lessons"."learning_objective")) > 0)
);
--> statement-breakpoint
ALTER TABLE "micro_lesson_answers" ADD CONSTRAINT "micro_lesson_answers_micro_lesson_id_micro_lessons_id_fk" FOREIGN KEY ("micro_lesson_id") REFERENCES "public"."micro_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "micro_lesson_answers" ADD CONSTRAINT "micro_lesson_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "micro_lessons" ADD CONSTRAINT "micro_lessons_study_session_id_study_sessions_id_fk" FOREIGN KEY ("study_session_id") REFERENCES "public"."study_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "micro_lessons" ADD CONSTRAINT "micro_lessons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "micro_lessons" ADD CONSTRAINT "micro_lessons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "micro_lessons" ADD CONSTRAINT "micro_lessons_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "micro_lesson_answers_user_answered_idx" ON "micro_lesson_answers" USING btree ("user_id","answered_at");--> statement-breakpoint
CREATE UNIQUE INDEX "micro_lessons_study_session_idx" ON "micro_lessons" USING btree ("study_session_id");--> statement-breakpoint
CREATE INDEX "micro_lessons_user_course_idx" ON "micro_lessons" USING btree ("user_id","course_id");