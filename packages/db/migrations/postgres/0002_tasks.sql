CREATE TABLE IF NOT EXISTS "tasks" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "notes" text,
  "project_id" text,
  "client_id" text,
  "due_at" bigint,
  "completed_at" bigint,
  "position" integer DEFAULT 0 NOT NULL,
  "updated_at" bigint NOT NULL,
  "deleted_at" bigint,
  "device_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_project_idx" ON "tasks" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_client_idx" ON "tasks" USING btree ("client_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_due_idx" ON "tasks" USING btree ("due_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_user_updated_idx" ON "tasks" USING btree ("user_id","updated_at");
