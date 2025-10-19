import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.SUPABASE_URL,
  // Use `DB_SSL=false` only for internal/non-TLS connections.
  ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
});

export type SQLClient = {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
};

export async function withClient<T>(fn: (c: SQLClient) => Promise<T>) {
  const client = await pool.connect();
  try { return await fn(client); }
  finally { client.release(); }
}