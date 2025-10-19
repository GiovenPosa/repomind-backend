import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { S3IngestLayout, ManifestJson, ManifestFileEntry } from "../types/s3";
import type { ChunkRecord } from "../types/parser";
import { Embedder } from "../ai/interfaces";

import {
  s3Prefix as prefix,
  getJson,
  getText,
  putJson,
} from "../utils/s3Util";
import {
  guessLang,
  shortId,
} from "../utils/parserUtil";

/** ----- Public API -----
 * Compute embeddings for parsed chunks of a commit.
 * Requires parserService to have produced per-file JSONL chunk text.
 */
export async function embedCommit(params: {
  s3: S3Client;
  layout: S3IngestLayout & { commit: string };
  embedder: Embedder;
  batchSize?: number;
  partSize?: number;
  onBatchVectors?: (rows: { id: string; vector: number[] }[]) => Promise<void>;
}) {
  const { s3, layout, embedder, batchSize = 64, partSize = 2000, onBatchVectors } = params;

  // 1) Load manifest (to know which files we expect chunks for)
  const manifestKey = prefix(layout) + `commits/${layout.commit}/manifest.json`;
  const manifest = await getJson<ManifestJson>(s3, layout.bucket, manifestKey);

  // Select code + markdown only (same rule as parser)
  const selected = manifest.files.filter(isCodeOrMarkdown).filter(f => !!f.storedAt);

  let total = 0;
  let part = 0;
  let currentLines: string[] = [];
  const providerDir = `${prefix(layout)}commits/${layout.commit}/parse/embeddings/${embedder.name}/`;

  for (const f of selected) {
    const fileId = shortId(f.path);
    const jsonlKey = `${prefix(layout)}commits/${layout.commit}/parse/chunks/${fileId}.jsonl`;

    let jsonl: string;
    try { jsonl = await getText(s3, layout.bucket, jsonlKey); }
    catch { continue; }

    const items = jsonl
      .split("\n")
      .filter(Boolean)
      .map(line => JSON.parse(line) as { id: string; text: string });

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const vectors = await embedder.embed(batch.map(b => b.text));

      // ✅ write JSONL to S3 and (optionally) push to DB
      const dbRows: { id: string; vector: number[] }[] = [];

      for (let j = 0; j < batch.length; j++) {
        const id = batch[j].id;
        const vec = vectors[j];
        if (!vec) continue;

        // S3 JSONL (base64 float32)
        const b64 = float32ToBase64(vec);
        currentLines.push(JSON.stringify({ id, dim: embedder.dim, vector_b64: b64 }));

        // DB row (float array)
        dbRows.push({ id, vector: vec });
        total++;

        if (currentLines.length >= partSize) {
          const partKey = `${providerDir}vectors_part-${String(part).padStart(5, "0")}.jsonl`;
          await putJsonl(s3, layout.bucket, partKey, currentLines);
          part++;
          currentLines = [];
        }
      }

      // 🔌 DB batch insert (if provided)
      if (dbRows.length && onBatchVectors) {
        await onBatchVectors(dbRows);
      }
    }
  }

  if (currentLines.length) {
    const partKey = `${providerDir}vectors_part-${String(part).padStart(5, "0")}.jsonl`;
    await putJsonl(s3, layout.bucket, partKey, currentLines);
  }

  await putJson(
    s3,
    layout.bucket,
    `${prefix(layout)}commits/${layout.commit}/parse/embeddings.index.json`,
    {
      commit: layout.commit,
      provider: embedder.name,
      dim: embedder.dim,
      totalVectors: total,
      parts: part + (currentLines.length ? 1 : 0),
      generatedAt: new Date().toISOString(),
      layoutVersion: 1,
    }
  );

  return { total, dim: embedder.dim, provider: embedder.name };
}

/* ---------------- helpers ---------------- */

function isCodeOrMarkdown(f: ManifestFileEntry): boolean {
  const lang = (f.lang || guessLang(f.path)).toLowerCase();
  if (f.binary) return false;
  if (lang === "markdown") return true;

  const codeLangs = new Set([
    "typescript","javascript","python","java","go","rust","c","cpp",
    "csharp","kotlin","swift","ruby","php","scala","haskell","lua",
    "shell","bash","powershell"
  ]);
  return codeLangs.has(lang);
}

function float32ToBase64(vec: number[]): string {
  const arr = new Float32Array(vec);
  const buf = Buffer.from(arr.buffer);
  return buf.toString("base64");
}

async function putJsonl(s3: S3Client, bucket: string, key: string, lines: string[]) {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: Buffer.from(lines.join("\n") + "\n", "utf8"),
    ContentType: "application/x-ndjson",
  }));
}