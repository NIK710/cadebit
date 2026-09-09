import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://cadebit:cadebit@127.0.0.1:5432/cadebit";

const globalDatabase = globalThis as typeof globalThis & {
  cadebitPool?: Pool;
};

export const pool =
  globalDatabase.cadebitPool ??
  new Pool({
    connectionString,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") globalDatabase.cadebitPool = pool;

export const db = drizzle(pool, { schema });
