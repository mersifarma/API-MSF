CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_type" varchar(30) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"s3_key" varchar(500) NOT NULL,
	"url" varchar(1000) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" bigint,
	"title" varchar(255),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer
);
--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_created_by_data_pegawai_rowid_fk" FOREIGN KEY ("created_by") REFERENCES "public"."data_pegawai"("rowid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_deleted_by_data_pegawai_rowid_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."data_pegawai"("rowid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_assets_created_by_idx" ON "media_assets" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "media_assets_status_idx" ON "media_assets" USING btree ("status","is_deleted");--> statement-breakpoint
CREATE INDEX "media_assets_type_idx" ON "media_assets" USING btree ("asset_type","is_deleted");