ALTER TABLE "time_entries" ADD COLUMN "client_id" text;
--> statement-breakpoint
CREATE INDEX "time_entries_client_idx" ON "time_entries" USING btree ("client_id");
