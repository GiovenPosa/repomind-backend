import { withClient } from "../db";
import type { ManifestJson } from "../types/s3";
import type { ChunkRecord } from "../types/parser";

export async function saveCommitRow(manifest: ManifestJson) {
  const { owner, repo, commit } = manifest;
  await withClient(c => c.query(
    `insert into repomind.commits (owner, repo, commit_sha, ingested_at)
     values ($1,$2,$3, now())
     on conflict (owner, repo, commit_sha) do nothing`,
    [owner, repo, commit]
  ));
}

export async function upsertChunks(
  owner: string, repo: string, commitSha: string, chunks: ChunkRecord[]
) {
  if (!chunks.length) return;
  const values: any[] = [];
  const rows: string[] = [];
  let i = 1;

  for (const ch of chunks) {
    rows.push(`($${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++},$${i++})`);
    values.push(
      ch.id, owner, repo, commitSha, ch.filePath, ch.startLine, ch.endLine, ch.lang ?? "Text"
    );
  }

  await withClient(c => c.query(
    `insert into repomind.chunks
      (id, owner, repo, commit_sha, file_path, start_line, end_line, lang)
     values ${rows.join(",")}
     on conflict (id) do nothing`,
    values
  ));
}

export async function insertEmbeddings(
  provider: string,
  dim: number,
  rows: { id: string; vector: number[] }[]
) {
  if (!rows.length) return;
  const values: any[] = [];
  const lines: string[] = [];
  let i = 1;

  for (const r of rows) {
    lines.push(`($${i++}, $${i++}, $${i++}, $${i++}::vector)`);
    values.push(r.id, provider, dim, `[${r.vector.join(",")}]`);
  }

  await withClient(c => c.query(
    `insert into repomind.embeddings (chunk_id, provider, dim, embedding)
     values ${lines.join(",")}
     on conflict (chunk_id, provider) do update
       set dim = excluded.dim,
           embedding = excluded.embedding,
           created_at = now()`,
    values
  ));
}