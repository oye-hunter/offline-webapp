import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL_UNPOOLED;

if (!databaseUrl) {
  throw new Error("DATABASE_URL_UNPOOLED is required for Drizzle config.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/schema/notes.ts",
  out: "./drizzle",
  dbCredentials: {
    url: databaseUrl,
  },
});
