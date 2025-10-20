// src/db.ts
import { Pool } from "pg";

const RAW = process.env.DATABASE_URL || process.env.SUPABASE_URL || "";
if (!RAW) throw new Error("DATABASE_URL (or SUPABASE_URL) is not set");

const u = new URL(RAW);
const host = u.hostname;
const port = u.port ? Number(u.port) : 5432;
const database = (u.pathname || "/postgres").slice(1) || "postgres";
const user = decodeURIComponent(u.username || "");
const password = decodeURIComponent(u.password || "");

const sslFlag = (process.env.DB_SSL || "").toLowerCase();
const sslOn = sslFlag === "true" || sslFlag === "1" || sslFlag === "require";
const ssl = sslOn ? { rejectUnauthorized: false } : undefined;

console.log(`[DB] Using connection → ***:***@${host}:${port}/${database} (ssl=${sslOn?'on':'off'})`);
if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
  throw new Error(`[DB] Refusing localhost inside container: host="${host}"`);
}

export const pool = new Pool({
  host, port, database, user, password, ssl,
  keepAlive: true,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});