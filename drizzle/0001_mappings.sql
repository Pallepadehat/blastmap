CREATE TABLE "mapping" (
	"id" text PRIMARY KEY NOT NULL,
	"host" text NOT NULL,
	"repo_path" text NOT NULL,
	"commit" text NOT NULL,
	"branch" text NOT NULL,
	"status" text NOT NULL,
	"progress" jsonb,
	"error" text,
	"result" jsonb,
	"started_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	CONSTRAINT "mapping_repository_commit" UNIQUE("host","repo_path","commit")
);
--> statement-breakpoint
ALTER TABLE "mapping" ADD CONSTRAINT "mapping_started_by_user_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mapping_repository_created_idx" ON "mapping" USING btree ("host","repo_path","created_at");