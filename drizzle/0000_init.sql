CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" text NOT NULL,
	"image_url" text NOT NULL,
	"top_text" text,
	"bottom_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
