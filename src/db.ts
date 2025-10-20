// db.ts
import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_URL || // fallback
  "";

if (!connectionString) {
  throw new Error("DATABASE_URL (or SUPABASE_URL) is not set");
}

// DB_SSL: "true" | "1" | "require" => SSL ON
//         "false" | "0"              => SSL OFF
// default OFF (good for internal docker/coolify postgres)
const sslFlag = (process.env.DB_SSL || "").toLowerCase();
const sslOn = sslFlag === "true" || sslFlag === "1" || sslFlag === "require";
const ssl = sslOn ? { rejectUnauthorized: false } : undefined; // use undefined, not `false`

export const pool = new Pool({
  connectionString,
  ssl,
  keepAlive: true,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

export type SQLClient = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
};

export async function withClient<T>(fn: (c: SQLClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}