CREATE TABLE "practice_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"study_session_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"course_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"question" text NOT NULL,
	"reference_answer" text NOT NULL,
	"grading_rubric" text NOT NULL,
	"difficulty" numeric(5, 4) NOT NULL,
	"source_references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_questions_difficulty_range" CHECK ("practice_questions"."difficulty" >= 0 and "practice_questions"."difficulty" <= 1),
	CONSTRAINT "practice_questions_question_not_blank" CHECK (length(trim("practice_questions"."question")) > 0),
	CONSTRAINT "practice_questions_reference_not_blank" CHECK (length(trim("practice_questions"."reference_answer")) > 0),
	CONSTRAINT "practice_questions_rubric_not_blank" CHECK (length(trim("practice_questions"."grading_rubric")) > 0)
);
--> statement-breakpoint
CREATE TABLE "user_topic_mastery" (
	"user_id" text NOT NULL,
	"course_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"score" numeric(5, 4) NOT NULL,
	"evidence_count" integer NOT NULL,
	"formula_version" text NOT NULL,
	"last_assessed_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_topic_mastery_user_id_topic_id_pk" PRIMARY KEY("user_id","topic_id"),
	CONSTRAINT "user_topic_mastery_score_range" CHECK ("user_topic_mastery"."score" >= 0 and "user_topic_mastery"."score" <= 1),
	CONSTRAINT "user_topic_mastery_evidence_count_positive" CHECK ("user_topic_mastery"."evidence_count" > 0),
	CONSTRAINT "user_topic_mastery_formula_not_blank" CHECK (length(trim("user_topic_mastery"."formula_version")) > 0)
);
--> statement-breakpoint
ALTER TABLE "practice_questions" ADD CONSTRAINT "practice_questions_study_session_id_study_sessions_id_fk" FOREIGN KEY ("study_session_id") REFERENCES "public"."study_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_questions" ADD CONSTRAINT "practice_questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_questions" ADD CONSTRAINT "practice_questions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_questions" ADD CONSTRAINT "practice_questions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_topic_mastery" ADD CONSTRAINT "user_topic_mastery_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_topic_mastery" ADD CONSTRAINT "user_topic_mastery_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_topic_mastery" ADD CONSTRAINT "user_topic_mastery_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "practice_questions_session_created_idx" ON "practice_questions" USING btree ("study_session_id","created_at");--> statement-breakpoint
CREATE INDEX "practice_questions_user_course_idx" ON "practice_questions" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE INDEX "user_topic_mastery_user_course_idx" ON "user_topic_mastery" USING btree ("user_id","course_id");