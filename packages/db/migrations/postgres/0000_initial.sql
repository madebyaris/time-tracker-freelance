-- Tickr — initial Postgres schema (matches @ttf/db/src/postgres/schema.ts)

CREATE TYPE "entry_source" AS ENUM('manual', 'timer', 'pomodoro', 'calendar');
--> statement-breakpoint
CREATE TYPE "invoice_status" AS ENUM('draft', 'sent', 'paid', 'overdue', 'void');
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"password_hash" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"device_label" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"notes" text,
	"archived_at" bigint,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"device_id" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text,
	"name" text NOT NULL,
	"color" text DEFAULT '#3b82f6' NOT NULL,
	"hourly_rate" integer,
	"currency" text DEFAULT 'USD' NOT NULL,
	"billable" boolean DEFAULT true NOT NULL,
	"archived_at" bigint,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"device_id" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#64748b' NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"device_id" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"started_at" bigint NOT NULL,
	"ended_at" bigint,
	"description" text,
	"billable" boolean DEFAULT true NOT NULL,
	"source" "entry_source" DEFAULT 'timer' NOT NULL,
	"idle_discarded_seconds" integer DEFAULT 0 NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"device_id" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entry_tags" (
	"entry_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"device_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "entry_tags_entry_id_tag_id_pk" PRIMARY KEY("entry_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text,
	"number" text NOT NULL,
	"issued_at" bigint NOT NULL,
	"due_at" bigint,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"tax_rate" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"pdf_path" text,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"device_id" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"project_id" text,
	"description" text NOT NULL,
	"hours" integer NOT NULL,
	"rate" integer NOT NULL,
	"amount" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"device_id" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text,
	"schedule_cron" text NOT NULL,
	"template_json" text NOT NULL,
	"next_run_at" bigint,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" bigint NOT NULL,
	"deleted_at" bigint,
	"device_id" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash");
--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "clients_updated_idx" ON "clients" USING btree ("updated_at");
--> statement-breakpoint
CREATE INDEX "clients_user_idx" ON "clients" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "projects_client_idx" ON "projects" USING btree ("client_id");
--> statement-breakpoint
CREATE INDEX "projects_updated_idx" ON "projects" USING btree ("updated_at");
--> statement-breakpoint
CREATE INDEX "projects_user_idx" ON "projects" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "time_entries_project_idx" ON "time_entries" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "time_entries_started_idx" ON "time_entries" USING btree ("started_at");
--> statement-breakpoint
CREATE INDEX "time_entries_updated_user_idx" ON "time_entries" USING btree ("user_id","updated_at");
--> statement-breakpoint
ALTER TABLE "entry_tags" ADD CONSTRAINT "entry_tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "invoices_client_idx" ON "invoices" USING btree ("client_id");
--> statement-breakpoint
CREATE INDEX "invoices_issued_idx" ON "invoices" USING btree ("issued_at");
--> statement-breakpoint
CREATE INDEX "invoices_user_idx" ON "invoices" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurring_invoices" ADD CONSTRAINT "recurring_invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
