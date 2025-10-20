// --- type-only imports (safe in CJS) ---
import type { Octokit as OctokitType } from "@octokit/rest";
import type { S3Client as S3ClientType } from "@aws-sdk/client-s3";

import { readFileSync } from "fs";
import { createHash } from "crypto";

import {
  s3Prefix,
  putJsonUnderRepo,
  putJsonRaw,
  s3Head,
} from "../utils/s3Util";

import type {
  IncludeExclude,
  GitTreeResponse,
  GitTreeItem
} from "../types/github";
import type {
  ManifestJson,
  ManifestFileEntry,
  S3IngestLayout
} from "../types/s3";

import { guessLang } from "../utils/parserUtil";

/* ---------------- lazy ESM helpers ---------------- */

type MinimatchNS = typeof import("minimatch");
let _minimatchNS: MinimatchNS | null = null;
async function getMinimatch() {
  return (_minimatchNS ??= await import("minimatch"));
}

type S3NS = typeof import("@aws-sdk/client-s3");
let _s3ns: S3NS | null = null;
async function getS3NS() {
  return (_s3ns ??= await import("@aws-sdk/client-s3"));
}

/* ---------------- main ---------------- */

export async function ingestRepository(params: {
  owner: string;
  repo: string;
  commit: string;
  installationId?: number;
  cfg: IncludeExclude;
  s3?: S3ClientType;
  layout?: S3IngestLayout;
  dryRun?: boolean;
  saveTarball?: boolean;
  branch?: string;
}): Promise<ManifestJson> {
  const {
    owner, repo, commit, installationId, cfg,
    s3, layout,
    dryRun = true,
    saveTarball = false,
    branch
  } = params;

  const octokit = await getOctokit({ installationId });

  try {
    const { data: repoInfo } = await octokit.repos.get({ owner, repo });
    console.log("🔎 GitHub access OK", {
      owner: repoInfo.owner?.login,
      repo: repoInfo.name,
      private: repoInfo.private,
      using: installationId ? "installation-token" : (process.env.GITHUB_TOKEN ? "PAT" : "unauthenticated"),
    });
  } catch (e: any) {
    console.error("⛔ Cannot access repo with current credentials", {
      owner, repo,
      using: installationId ? "installation-token" : (process.env.GITHUB_TOKEN ? "PAT" : "unauthenticated"),
      status: e?.status, message: e?.message,
    });
    throw e;
  }

  const commitSha = await resolveToCommitSha(octokit, owner, repo, commit);
  const treeSha = await resolveTreeShaForCommit(octokit, owner, repo, commitSha);

  const treeResp = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: treeSha,
    recursive: "1" as any,
  });

  const tree = treeResp.data as unknown as GitTreeResponse & { truncated?: boolean };
  const truncated = (tree as any).truncated === true;

  const blobs = (tree.tree ?? [])
    .filter((i: any): i is GitTreeItem => i.type === "blob");

  // minimatch is ESM-only; load it lazily
  const { Minimatch } = await getMinimatch();

  const includeMatchers = cfg.include.map(p => new Minimatch(p, { dot: true }));
  const excludeMatchers = cfg.exclude.map(p => new Minimatch(p, { dot: true }));

  const keep: GitTreeItem[] = blobs.filter(({ path, size = 0 }) => {
    const inc = includeMatchers.length ? includeMatchers.some(m => m.match(path)) : true;
    const exc = excludeMatchers.some(m => m.match(path));
    const within = (size / 1024) <= cfg.maxFileKB;
    return inc && !exc && within;
  });

  const files: ManifestFileEntry[] = [];
  let bytesKept = 0;

  for (const f of keep) {
    const blob = await octokit.git.getBlob({ owner, repo, file_sha: f.sha });
    const base64Content = (blob.data as any).content as string | undefined;
    const encoding = (blob.data as any).encoding as string | undefined;

    let bytes =
      base64Content && encoding === "base64"
        ? Buffer.from(base64Content, "base64")
        : Buffer.from(JSON.stringify(blob.data));

    const looksBinary = bytes.includes(0);
    if (!looksBinary) {
      const normalized = bytes.toString("utf8").replace(/\r\n/g, "\n");
      bytes = Buffer.from(normalized, "utf8");
    } else {
      continue;
    }

    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const blobKey = toBlobKey(sha256);
    bytesKept += bytes.length;

    if (!dryRun) {
      if (!s3 || !layout) throw new Error("S3 client & layout required when dryRun=false");
      const key = s3Prefix(layout) + blobKey;

      const exists = await s3Head(s3, layout.bucket, key);
      if (!exists) {
        const { PutObjectCommand } = await getS3NS();
        await s3.send(new PutObjectCommand({
          Bucket: layout.bucket,
          Key: key,
          Body: bytes,
          ContentType: "text/plain; charset=utf-8",
        }));
      }
    }

    files.push({
      path: f.path,
      sha: f.sha,
      size: bytes.length,
      lang: guessLang(f.path),
      mime: "text/plain; charset=utf-8",
      binary: false,
      storedAt: dryRun ? undefined : blobKey,
      startLine: 1,
      endLine: countLines(bytes),
    });
  }

  const manifest: ManifestJson = {
    owner, repo, commit: commitSha,
    ingestedAt: new Date().toISOString(),
    config: cfg,
    stats: {
      filesTotal: blobs.length,
      filesKept: files.length,
      filesSkipped: blobs.length - files.length,
      bytesKept,
    },
    files,
  };

  if (!dryRun) {
    if (!s3 || !layout) throw new Error("S3 client & layout required when dryRun=false");

    await putJsonUnderRepo(s3, layout, `commits/${commitSha}/manifest.json`, manifest);
    await putJsonUnderRepo(s3, layout, `commits/${commitSha}/selection.json`, cfg);

    const base = s3Prefix(layout);

    await putJsonRaw(s3, layout.bucket, `${base}refs/latest.json`, {
      commit: commitSha,
      updatedAt: new Date().toISOString(),
    });

    const branchClean = sanitizeBranchName(branch);
    if (branchClean) {
      await putJsonRaw(s3, layout.bucket, `${base}refs/branches/${branchClean}.json`, {
        commit: commitSha,
        branch: branchClean,
        updatedAt: new Date().toISOString(),
      });
    }

    await putJsonRaw(s3, layout.bucket, `${base}commits/latest/manifest.json`, manifest);

    if (saveTarball) {
      const tarResp = await octokit.request("GET /repos/{owner}/{repo}/tarball/{ref}", {
        owner, repo, ref: commitSha,
        request: { responseType: "arraybuffer" },
      });
      const { PutObjectCommand } = await getS3NS();
      await s3.send(new PutObjectCommand({
        Bucket: layout.bucket,
        Key: `${base}commits/${commitSha}/repo.tar.gz`,
        Body: Buffer.from(tarResp.data as ArrayBuffer),
        ContentType: "application/gzip",
      }));
    }
  }

  if (truncated) {
    console.warn("⚠️ Git tree response was truncated. Consider using tarball mode for this repo.");
  }

  return manifest;
}

/* ---------------- helpers ---------------- */

async function resolveToCommitSha(octokit: OctokitType, owner: string, repo: string, ref: string) {
  if (/^[0-9a-f]{40}$/i.test(ref)) return ref;
  const { data } = await octokit.repos.getCommit({ owner, repo, ref });
  return data.sha;
}

async function resolveTreeShaForCommit(octokit: OctokitType, owner: string, repo: string, commitSha: string) {
  const { data } = await octokit.repos.getCommit({ owner, repo, ref: commitSha });
  return (data as any).commit?.tree?.sha;
}

function toBlobKey(sha256: string) {
  return `blobs/${sha256.slice(0, 2)}/${sha256.slice(2, 4)}/${sha256}`;
}

function countLines(buf: Buffer) {
  let n = 1;
  for (const b of buf) if (b === 0x0A) n++;
  return n;
}

function sanitizeBranchName(name?: string): string | undefined {
  if (!name) return undefined;
  return name.replace(/^refs\/heads\//, "");
}

async function getOctokit({ installationId }: { installationId?: number }): Promise<OctokitType> {
  const { Octokit } = await import("@octokit/rest");

  if (
    installationId &&
    process.env.GITHUB_APP_ID &&
    (process.env.GITHUB_PRIVATE_KEY || process.env.GITHUB_PRIVATE_KEY_PATH)
  ) {
    const { createAppAuth } = await import("@octokit/auth-app");
    const pkRaw =
      process.env.GITHUB_PRIVATE_KEY ??
      readFileSync(process.env.GITHUB_PRIVATE_KEY_PATH!, "utf8");
    const privateKey = pkRaw.includes("\\n") ? pkRaw.replace(/\\n/g, "\n") : pkRaw;

    return new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: process.env.GITHUB_APP_ID!,
        privateKey,
        installationId,
      },
    }) as unknown as OctokitType;
  }

  if (process.env.GITHUB_TOKEN) {
    const { Octokit } = await import("@octokit/rest");
    return new Octokit({ auth: process.env.GITHUB_TOKEN }) as unknown as OctokitType;
  }

  const { Octokit: OctokitNoAuth } = await import("@octokit/rest");
  return new OctokitNoAuth() as unknown as OctokitType;
}