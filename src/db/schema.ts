import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  handle: text("handle").notNull(),
  imageUrl: text("image_url").notNull(),
  topText: text("top_text"),
  bottomText: text("bottom_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
