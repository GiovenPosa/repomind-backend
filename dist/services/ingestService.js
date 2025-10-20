"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestRepository = void 0;
const fs_1 = require("fs");
const crypto_1 = require("crypto");
const s3Util_1 = require("../utils/s3Util");
const parserUtil_1 = require("../utils/parserUtil");
let _minimatchNS = null;
async function getMinimatch() {
    return (_minimatchNS ?? (_minimatchNS = await Promise.resolve().then(() => __importStar(require("minimatch")))));
}
let _s3ns = null;
async function getS3NS() {
    return (_s3ns ?? (_s3ns = await Promise.resolve().then(() => __importStar(require("@aws-sdk/client-s3")))));
}
/* ---------------- main ---------------- */
async function ingestRepository(params) {
    const { owner, repo, commit, installationId, cfg, s3, layout, dryRun = true, saveTarball = false, branch } = params;
    const octokit = await getOctokit({ installationId });
    try {
        const { data: repoInfo } = await octokit.repos.get({ owner, repo });
        console.log("🔎 GitHub access OK", {
            owner: repoInfo.owner?.login,
            repo: repoInfo.name,
            private: repoInfo.private,
            using: installationId ? "installation-token" : (process.env.GITHUB_TOKEN ? "PAT" : "unauthenticated"),
        });
    }
    catch (e) {
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
        recursive: "1",
    });
    const tree = treeResp.data;
    const truncated = tree.truncated === true;
    const blobs = (tree.tree ?? [])
        .filter((i) => i.type === "blob");
    // minimatch is ESM-only; load it lazily
    const { Minimatch } = await getMinimatch();
    const includeMatchers = cfg.include.map(p => new Minimatch(p, { dot: true }));
    const excludeMatchers = cfg.exclude.map(p => new Minimatch(p, { dot: true }));
    const keep = blobs.filter(({ path, size = 0 }) => {
        const inc = includeMatchers.length ? includeMatchers.some(m => m.match(path)) : true;
        const exc = excludeMatchers.some(m => m.match(path));
        const within = (size / 1024) <= cfg.maxFileKB;
        return inc && !exc && within;
    });
    const files = [];
    let bytesKept = 0;
    for (const f of keep) {
        const blob = await octokit.git.getBlob({ owner, repo, file_sha: f.sha });
        const base64Content = blob.data.content;
        const encoding = blob.data.encoding;
        let bytes = base64Content && encoding === "base64"
            ? Buffer.from(base64Content, "base64")
            : Buffer.from(JSON.stringify(blob.data));
        const looksBinary = bytes.includes(0);
        if (!looksBinary) {
            const normalized = bytes.toString("utf8").replace(/\r\n/g, "\n");
            bytes = Buffer.from(normalized, "utf8");
        }
        else {
            continue;
        }
        const sha256 = (0, crypto_1.createHash)("sha256").update(bytes).digest("hex");
        const blobKey = toBlobKey(sha256);
        bytesKept += bytes.length;
        if (!dryRun) {
            if (!s3 || !layout)
                throw new Error("S3 client & layout required when dryRun=false");
            const key = (0, s3Util_1.s3Prefix)(layout) + blobKey;
            const exists = await (0, s3Util_1.s3Head)(s3, layout.bucket, key);
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
            lang: (0, parserUtil_1.guessLang)(f.path),
            mime: "text/plain; charset=utf-8",
            binary: false,
            storedAt: dryRun ? undefined : blobKey,
            startLine: 1,
            endLine: countLines(bytes),
        });
    }
    const manifest = {
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
        if (!s3 || !layout)
            throw new Error("S3 client & layout required when dryRun=false");
        await (0, s3Util_1.putJsonUnderRepo)(s3, layout, `commits/${commitSha}/manifest.json`, manifest);
        await (0, s3Util_1.putJsonUnderRepo)(s3, layout, `commits/${commitSha}/selection.json`, cfg);
        const base = (0, s3Util_1.s3Prefix)(layout);
        await (0, s3Util_1.putJsonRaw)(s3, layout.bucket, `${base}refs/latest.json`, {
            commit: commitSha,
            updatedAt: new Date().toISOString(),
        });
        const branchClean = sanitizeBranchName(branch);
        if (branchClean) {
            await (0, s3Util_1.putJsonRaw)(s3, layout.bucket, `${base}refs/branches/${branchClean}.json`, {
                commit: commitSha,
                branch: branchClean,
                updatedAt: new Date().toISOString(),
            });
        }
        await (0, s3Util_1.putJsonRaw)(s3, layout.bucket, `${base}commits/latest/manifest.json`, manifest);
        if (saveTarball) {
            const tarResp = await octokit.request("GET /repos/{owner}/{repo}/tarball/{ref}", {
                owner, repo, ref: commitSha,
                request: { responseType: "arraybuffer" },
            });
            const { PutObjectCommand } = await getS3NS();
            await s3.send(new PutObjectCommand({
                Bucket: layout.bucket,
                Key: `${base}commits/${commitSha}/repo.tar.gz`,
                Body: Buffer.from(tarResp.data),
                ContentType: "application/gzip",
            }));
        }
    }
    if (truncated) {
        console.warn("⚠️ Git tree response was truncated. Consider using tarball mode for this repo.");
    }
    return manifest;
}
exports.ingestRepository = ingestRepository;
/* ---------------- helpers ---------------- */
async function resolveToCommitSha(octokit, owner, repo, ref) {
    if (/^[0-9a-f]{40}$/i.test(ref))
        return ref;
    const { data } = await octokit.repos.getCommit({ owner, repo, ref });
    return data.sha;
}
async function resolveTreeShaForCommit(octokit, owner, repo, commitSha) {
    const { data } = await octokit.repos.getCommit({ owner, repo, ref: commitSha });
    return data.commit?.tree?.sha;
}
function toBlobKey(sha256) {
    return `blobs/${sha256.slice(0, 2)}/${sha256.slice(2, 4)}/${sha256}`;
}
function countLines(buf) {
    let n = 1;
    for (const b of buf)
        if (b === 0x0A)
            n++;
    return n;
}
function sanitizeBranchName(name) {
    if (!name)
        return undefined;
    return name.replace(/^refs\/heads\//, "");
}
async function getOctokit({ installationId }) {
    const { Octokit } = await Promise.resolve().then(() => __importStar(require("@octokit/rest")));
    if (installationId &&
        process.env.GITHUB_APP_ID &&
        (process.env.GITHUB_PRIVATE_KEY || process.env.GITHUB_PRIVATE_KEY_PATH)) {
        const { createAppAuth } = await Promise.resolve().then(() => __importStar(require("@octokit/auth-app")));
        const pkRaw = process.env.GITHUB_PRIVATE_KEY ??
            (0, fs_1.readFileSync)(process.env.GITHUB_PRIVATE_KEY_PATH, "utf8");
        const privateKey = pkRaw.includes("\\n") ? pkRaw.replace(/\\n/g, "\n") : pkRaw;
        return new Octokit({
            authStrategy: createAppAuth,
            auth: {
                appId: process.env.GITHUB_APP_ID,
                privateKey,
                installationId,
            },
        });
    }
    if (process.env.GITHUB_TOKEN) {
        const { Octokit } = await Promise.resolve().then(() => __importStar(require("@octokit/rest")));
        return new Octokit({ auth: process.env.GITHUB_TOKEN });
    }
    const { Octokit: OctokitNoAuth } = await Promise.resolve().then(() => __importStar(require("@octokit/rest")));
    return new OctokitNoAuth();
}
