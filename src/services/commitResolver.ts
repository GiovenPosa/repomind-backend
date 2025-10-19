// src/services/commitResolver.ts
import { S3Client } from "@aws-sdk/client-s3";
import { getJson, s3Prefix as prefix } from "../utils/s3Util";

export async function resolveLatestCommit(opts: {
  s3: S3Client;
  bucket: string;
  tenantId?: string;
  owner: string;
  repo: string;
  branch?: string; // optional: prefer a branch pointer
}): Promise<string> {
  const { s3, bucket, tenantId, owner, repo, branch } = opts;
  // Prefer branch pointer if given, otherwise use "refs/latest.json"
  const base = prefix({ tenantId, owner, repo });
  const key = branch
    ? `${base}refs/branches/${branch}.json`
    : `${base}refs/latest.json`;

  const ref = await getJson<{ commit: string }>(s3, bucket, key);
  if (!ref?.commit) {
    throw new Error(`Could not resolve latest commit (key: ${key})`);
  }
  return ref.commit;
}