// db.ts (hardened)
import { Pool } from "pg";

const RAW = process.env.DATABASE_URL || process.env.SUPABASE_URL || "";
if (!RAW) {
  throw new Error("DATABASE_URL (or SUPABASE_URL) is not set");
}

// Parse the URL so we pass explicit fields (no implicit localhost fallbacks)
let host: string, port: number, database: string, user: string, password: string;
try {
  const u = new URL(RAW);
  // Support both postgres:// and postgresql://
  if (!/^postgres(ql)?:$/.test(u.protocol)) {
    throw new Error(`Invalid DB protocol in URL: ${u.protocol}`);
  }
  host = u.hostname;
  port = u.port ? Number(u.port) : 5432;
  database = (u.pathname || "/postgres").slice(1) || "postgres";
  user = decodeURIComponent(u.username || "");
  password = decodeURIComponent(u.password || "");
} catch (e) {
  throw new Error(`Invalid DATABASE_URL: ${(e as Error).message}`);
}

// SSL: "true" | "1" | "require" => ON; "false" | "0" => OFF; default OFF for internal Docker
const sslFlag = (process.env.DB_SSL || "").toLowerCase();
const sslOn = sslFlag === "true" || sslFlag === "1" || sslFlag === "require";
const ssl = sslOn ? { rejectUnauthorized: false } : undefined;

// 🔎 Log the *sanitized* connection once at startup
const redacted = `${user ? "***" : ""}:${password ? "***" : ""}@${host}:${port}/${database}`;
console.log(`[DB] Using connection → ${redacted} (ssl=${sslOn ? "on" : "off"})`);

// 🚫 Guard against accidental localhost
if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
  throw new Error(
    `[DB] Refusing to connect to localhost inside container. Got host="${host}". ` +
    `Use your Coolify service hostname instead.`
  );
}

// Explicit config (avoids any PG* env overrides)
export const pool = new Pool({
  host,
  port,
  database,
  user,
  password,
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