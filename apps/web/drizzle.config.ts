import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

loadEnvConfig(process.cwd());

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://cadebit:cadebit@127.0.0.1:5432/cadebit",
  },
  migrations: {
    table: "migrations",
    schema: "drizzle",
  },
  strict: true,
  verbose: true,
});
