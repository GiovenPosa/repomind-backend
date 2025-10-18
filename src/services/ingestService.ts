import { Octokit } from '@octokit/rest';
import { Minimatch } from 'minimatch';
import { createHash } from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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
} from '../types/github';
import type {
  ManifestJson,
  ManifestFileEntry,
  S3IngestLayout
} from '../types/s3';

export async function ingestRepository(params: {
  owner: string;
  repo: string;
  commit: string;            // commit SHA or branch (resolved to SHA)
  installationId?: number;   // optional for App auth (PAT used by default)
  cfg: IncludeExclude;
  s3?: S3Client;             // required when dryRun=false
  layout?: S3IngestLayout;   // required when dryRun=false
  dryRun?: boolean;          // default true
  saveTarball?: boolean;     // optional: also store repo tarball
  branch?: string;           // optional: e.g., "refs/heads/main" or "main"
}): Promise<ManifestJson> {
  const {
    owner, repo, commit, installationId, cfg,
    s3, layout,
    dryRun = true,
    saveTarball = false,
    branch
  } = params;

  const octokit = await getOctokit({ installationId });
  const commitSha = await resolveToCommitSha(octokit, owner, repo, commit);

  // 1) list tree (recursive)
  const treeResp = await octokit.git.getTree({
    owner, repo, tree_sha: commitSha, recursive: '1'
  });
  const tree = treeResp.data as unknown as GitTreeResponse;
  const truncated = (tree as any).truncated === true;

  const blobs = (tree.tree ?? []).filter(i => i.type === 'blob') as GitTreeItem[];

  // 2) precompile matchers
  const includeMatchers = cfg.include.map(p => new Minimatch(p, { dot: true }));
  const excludeMatchers = cfg.exclude.map(p => new Minimatch(p, { dot: true }));

  // 3) filter list
  const keep: GitTreeItem[] = blobs.filter(({ path, size = 0 }) => {
    const inc = includeMatchers.length ? includeMatchers.some(m => m.match(path)) : true;
    const exc = excludeMatchers.some(m => m.match(path));
    const within = (size / 1024) <= cfg.maxFileKB;
    return inc && !exc && within;
  });

  const files: ManifestFileEntry[] = [];
  let bytesKept = 0;

  // 4) download kept files, normalize, hash, (optionally) upload
  for (const f of keep) {
    const blob = await octokit.git.getBlob({ owner, repo, file_sha: f.sha });
    const base64Content = (blob.data as any).content as string | undefined;
    const encoding = (blob.data as any).encoding as string | undefined;

    let bytes =
      base64Content && encoding === 'base64'
        ? Buffer.from(base64Content, 'base64')
        : Buffer.from(JSON.stringify(blob.data)); // fallback (should be rare)

    // crude binary check; skip non-text by default
    const looksBinary = bytes.includes(0);
    if (!looksBinary) {
      // Normalize CRLF→LF for stable hashing
      const normalized = bytes.toString('utf8').replace(/\r\n/g, '\n');
      bytes = Buffer.from(normalized, 'utf8');
    } else {
      continue; // skip binaries in this pipeline (or route elsewhere)
    }

    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const blobKey = toBlobKey(sha256);
    bytesKept += bytes.length;

    if (!dryRun) {
      if (!s3 || !layout) throw new Error('S3 client & layout required when dryRun=false');
      const key = s3Prefix(layout) + blobKey;

      // idempotent upload
      const exists = await s3Head(s3, layout.bucket, key);
      if (!exists) {
        await s3.send(new PutObjectCommand({
          Bucket: layout.bucket,
          Key: key,
          Body: bytes,
          ContentType: 'text/plain; charset=utf-8'
        }));
      }
    }

    files.push({
      path: f.path,
      sha: f.sha,                       // git blob SHA
      size: bytes.length,               // normalized size
      lang: guessLang(f.path),
      mime: 'text/plain; charset=utf-8',
      binary: false,
      storedAt: dryRun ? undefined : blobKey,
      startLine: 1,
      endLine: countLines(bytes)
    });
  }

  // 5) build manifest
  const manifest: ManifestJson = {
    owner, repo, commit: commitSha,
    ingestedAt: new Date().toISOString(),
    config: cfg,
    stats: {
      filesTotal: blobs.length,
      filesKept: files.length,
      filesSkipped: blobs.length - files.length,
      bytesKept
    },
    files
  };

  // 6) persist manifest/selection + refs when writing
  if (!dryRun) {
    if (!s3 || !layout) throw new Error('S3 client & layout required when dryRun=false');

    await putJsonUnderRepo(s3, layout, `commits/${commitSha}/manifest.json`, manifest);
    await putJsonUnderRepo(s3, layout, `commits/${commitSha}/selection.json`, cfg);

    // refs pointers + latest manifest copy
    const base = s3Prefix(layout); // tenants/{tenant}/repos/{owner}/{repo}/

    await putJsonRaw(s3, layout.bucket, `${base}refs/latest.json`, {
      commit: commitSha,
      updatedAt: new Date().toISOString()
    });

    const branchClean = sanitizeBranchName(branch);
    if (branchClean) {
      await putJsonRaw(s3, layout.bucket, `${base}refs/branches/${branchClean}.json`, {
        commit: commitSha,
        branch: branchClean,
        updatedAt: new Date().toISOString()
      });
    }

    await putJsonRaw(s3, layout.bucket, `${base}commits/latest/manifest.json`, manifest);

    // optional: store tarball for audit/debug
    if (saveTarball) {
      const tarResp = await octokit.request('GET /repos/{owner}/{repo}/tarball/{ref}', {
        owner, repo, ref: commitSha,
        request: { responseType: 'arraybuffer' }
      });
      await s3.send(new PutObjectCommand({
        Bucket: layout.bucket,
        Key: `${base}commits/${commitSha}/repo.tar.gz`,
        Body: Buffer.from(tarResp.data as ArrayBuffer),
        ContentType: 'application/gzip'
      }));
    }
  }

  if (truncated) {
    console.warn('⚠️ Git tree response was truncated. Consider using tarball mode for this repo.');
  }

  return manifest;
}

/* ------------------------ helpers ------------------------ */

async function resolveToCommitSha(octokit: Octokit, owner: string, repo: string, ref: string) {
  if (/^[0-9a-f]{40}$/i.test(ref)) return ref; // already a full SHA
  const { data } = await octokit.repos.getCommit({ owner, repo, ref });
  return data.sha;
}

function toBlobKey(sha256: string) {
  return `blobs/${sha256.slice(0, 2)}/${sha256.slice(2, 4)}/${sha256}`;
}

function countLines(buf: Buffer) {
  let n = 1;
  for (const b of buf) if (b === 0x0A) n++;
  return n;
}

function guessLang(path: string) {
  const p = path.toLowerCase();
  if (p.endsWith('.ts')) return 'TypeScript';
  if (p.endsWith('.tsx')) return 'TypeScript';
  if (p.endsWith('.js')) return 'JavaScript';
  if (p.endsWith('.jsx')) return 'JavaScript';
  if (p.endsWith('.py')) return 'Python';
  if (p.endsWith('.java')) return 'Java';
  if (p.endsWith('.md')) return 'Markdown';
  if (p.endsWith('.yml') || p.endsWith('.yaml')) return 'YAML';
  if (p.endsWith('.json')) return 'JSON';
  if (p.endsWith('.sh')) return 'Shell';
  return 'Text';
}

function sanitizeBranchName(name?: string): string | undefined {
  if (!name) return undefined;
  return name.replace(/^refs\/heads\//, '');
}



async function getOctokit({ installationId }: { installationId?: number }) {
  // For quick testing, prefer a PAT in env (GITHUB_TOKEN with Contents:Read)
  if (process.env.GITHUB_TOKEN) return new Octokit({ auth: process.env.GITHUB_TOKEN });
  // If you want GitHub App auth here, plug your installation token minting logic.
  if (installationId) {
    throw new Error('Installation auth not wired in this helper. Use GITHUB_TOKEN for now.');
  }
  return new Octokit(); // unauth (public repos only)
}