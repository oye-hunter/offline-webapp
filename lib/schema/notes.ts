import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const notes = pgTable(
  "notes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    userIdIdx: index("notes_user_id_idx").on(table.userId),
    updatedAtIdx: index("notes_updated_at_idx").on(table.updatedAt),
  }),
);

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
