"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withClient = exports.pool = void 0;
const pg_1 = require("pg");
exports.pool = new pg_1.Pool({
    connectionString: process.env.SUPABASE_URL,
    // Use `DB_SSL=false` only for internal/non-TLS connections.
    ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
});
async function withClient(fn) {
    const client = await exports.pool.connect();
    try {
        return await fn(client);
    }
    finally {
        client.release();
    }
}
exports.withClient = withClient;
