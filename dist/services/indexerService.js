"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertEmbeddings = exports.upsertChunks = exports.saveCommitRow = void 0;
const db_1 = require("../db");
async function saveCommitRow(manifest) {
    const { owner, repo, commit } = manifest;
    await (0, db_1.withClient)(c => c.query(`insert into repomind.commits (owner, repo, commit_sha, ingested_at)
     values ($1,$2,$3, now())
     on conflict (owner, repo, commit_sha) do nothing`, [owner, repo, commit]));
}
exports.saveCommitRow = saveCommitRow;
// src/services/indexerService.ts
async function upsertChunks(owner, repo, commitSha, chunks) {
    if (!chunks.length)
        return;
    const values = [];
    const rows = [];
    let i = 1;
    for (const ch of chunks) {
        // NOTE: now 9 placeholders (added hash)
        rows.push(`($${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++})`);
        values.push(ch.id, owner, repo, commitSha, ch.filePath, ch.startLine, ch.endLine, ch.lang ?? "Text", ch.hash // <-- include the chunk hash computed by parserService
        );
    }
    await (0, db_1.withClient)(c => c.query(`
      insert into repomind.chunks
        (id, owner, repo, commit_sha, file_path, start_line, end_line, lang, hash)
      values ${rows.join(",")}
      on conflict (id) do update
        set commit_sha = excluded.commit_sha,
            file_path  = excluded.file_path,
            start_line = excluded.start_line,
            end_line   = excluded.end_line,
            lang       = excluded.lang,
            hash       = excluded.hash,
            created_at = now()
      `, values));
}
exports.upsertChunks = upsertChunks;
async function insertEmbeddings(provider, dim, rows) {
    if (!rows.length)
        return;
    const values = [];
    const lines = [];
    let i = 1;
    for (const r of rows) {
        lines.push(`($${i++}, $${i++}, $${i++}, $${i++}::vector)`);
        values.push(r.id, provider, dim, `[${r.vector.join(",")}]`);
    }
    await (0, db_1.withClient)(c => c.query(`insert into repomind.embeddings (chunk_id, provider, dim, embedding)
     values ${lines.join(",")}
     on conflict (chunk_id, provider) do update
       set dim = excluded.dim,
           embedding = excluded.embedding,
           created_at = now()`, values));
}
exports.insertEmbeddings = insertEmbeddings;
