import { withClient } from "../db";

export type SearchHit = {
  id: string;
  file_path: string;
  start_line: number;
  end_line: number;
  lang: string;
  distance: number;     // L2 distance
  text?: string;        // optional: load from S3 if you want
};

export async function semanticSearch(opts: {
  owner: string;
  repo: string;
  queryVector: number[];     // from your embedder
  topK?: number;
  provider?: string;         // "openai" etc.
}) {
  const { owner, repo, queryVector, topK = 8, provider = "openai" } = opts;

  const res = await withClient(c => c.query(
    `
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
    `,
    [owner, repo, topK, `[${queryVector.join(",")}]`, provider]
  ));

  return res.rows as SearchHit[];
}