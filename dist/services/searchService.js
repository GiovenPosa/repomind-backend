"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.semanticSearch = void 0;
const db_1 = require("../db");
async function semanticSearch(opts) {
    const { owner, repo, queryVector, topK = 8, provider = "openai" } = opts;
    const res = await (0, db_1.withClient)(c => c.query(`
    select
      ch.id,
      ch.file_path,
      ch.start_line,
      ch.end_line,
      ch.lang,
      (emb.embedding <-> $4::vector) as distance
    from repomind.chunks ch
    join repomind.embeddings emb
      on emb.chunk_id = ch.id
     and emb.provider = $5
    where ch.owner = $1 and ch.repo = $2
    order by emb.embedding <-> $4::vector
    limit $3
    `, [owner, repo, topK, `[${queryVector.join(",")}]`, provider]));
    return res.rows;
}
exports.semanticSearch = semanticSearch;
