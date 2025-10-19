import { S3Client } from "@aws-sdk/client-s3";
import { getText, s3Prefix as prefix } from "../utils/s3Util";

export async function loadChunkTexts(params: {
  s3: S3Client;
  bucket: string;
  tenantId?: string;
  owner: string;
  repo: string;
  commit: string;
  chunkIds: string[];
}): Promise<Record<string, { text: string; filePath: string; startLine: number; endLine: number }>> {
  const { s3, bucket, tenantId, owner, repo, commit, chunkIds } = params;

  // Group by fileId prefix (first 12 chars before "-")
  const byFile: Record<string, string[]> = {};
  for (const id of chunkIds) {
    const fileId = id.split("-")[0]; // "3339a3abe4b6"
    (byFile[fileId] ||= []).push(id);
  }

  const results: Record<string, any> = {};
  for (const fileId of Object.keys(byFile)) {
    const key = `${prefix({ tenantId, owner, repo })}commits/${commit}/parse/chunks/${fileId}.jsonl`;
    let jsonl: string;
    try { jsonl = await getText(s3, bucket, key); } catch { continue; }

    const want = new Set(byFile[fileId]);
    for (const line of jsonl.split("\n")) {
      if (!line.trim()) continue;
      const row = JSON.parse(line);
      if (want.has(row.id)) {
        results[row.id] = {
          text: row.text,
          filePath: row.filePath,
          startLine: row.startLine,
          endLine: row.endLine,
        };
      }
    }
  }
  return results;
}