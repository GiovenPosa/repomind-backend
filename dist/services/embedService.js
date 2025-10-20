"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.embedCommit = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3Util_1 = require("../utils/s3Util");
const parserUtil_1 = require("../utils/parserUtil");
/** ----- Public API -----
 * Compute embeddings for parsed chunks of a commit.
 * Requires parserService to have produced per-file JSONL chunk text.
 */
async function embedCommit(params) {
    const { s3, layout, embedder, batchSize = 64, partSize = 2000, onBatchVectors } = params;
    // 1) Load manifest (to know which files we expect chunks for)
    const manifestKey = (0, s3Util_1.s3Prefix)(layout) + `commits/${layout.commit}/manifest.json`;
    const manifest = await (0, s3Util_1.getJson)(s3, layout.bucket, manifestKey);
    // Select code + markdown only (same rule as parser)
    const selected = manifest.files.filter(isCodeOrMarkdown).filter(f => !!f.storedAt);
    let total = 0;
    let part = 0;
    let currentLines = [];
    const providerDir = `${(0, s3Util_1.s3Prefix)(layout)}commits/${layout.commit}/parse/embeddings/${embedder.name}/`;
    for (const f of selected) {
        const fileId = (0, parserUtil_1.shortId)(f.path);
        const jsonlKey = `${(0, s3Util_1.s3Prefix)(layout)}commits/${layout.commit}/parse/chunks/${fileId}.jsonl`;
        let jsonl;
        try {
            jsonl = await (0, s3Util_1.getText)(s3, layout.bucket, jsonlKey);
        }
        catch {
            continue;
        }
        const items = jsonl
            .split("\n")
            .filter(Boolean)
            .map(line => JSON.parse(line));
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const vectors = await embedder.embed(batch.map(b => b.text));
            // ✅ write JSONL to S3 and (optionally) push to DB
            const dbRows = [];
            for (let j = 0; j < batch.length; j++) {
                const id = batch[j].id;
                const vec = vectors[j];
                if (!vec)
                    continue;
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
    await (0, s3Util_1.putJson)(s3, layout.bucket, `${(0, s3Util_1.s3Prefix)(layout)}commits/${layout.commit}/parse/embeddings.index.json`, {
        commit: layout.commit,
        provider: embedder.name,
        dim: embedder.dim,
        totalVectors: total,
        parts: part + (currentLines.length ? 1 : 0),
        generatedAt: new Date().toISOString(),
        layoutVersion: 1,
    });
    return { total, dim: embedder.dim, provider: embedder.name };
}
exports.embedCommit = embedCommit;
/* ---------------- helpers ---------------- */
function isCodeOrMarkdown(f) {
    const lang = (f.lang || (0, parserUtil_1.guessLang)(f.path)).toLowerCase();
    if (f.binary)
        return false;
    if (lang === "markdown")
        return true;
    const codeLangs = new Set([
        "typescript", "javascript", "python", "java", "go", "rust", "c", "cpp",
        "csharp", "kotlin", "swift", "ruby", "php", "scala", "haskell", "lua",
        "shell", "bash", "powershell"
    ]);
    return codeLangs.has(lang);
}
function float32ToBase64(vec) {
    const arr = new Float32Array(vec);
    const buf = Buffer.from(arr.buffer);
    return buf.toString("base64");
}
async function putJsonl(s3, bucket, key, lines) {
    await s3.send(new client_s3_1.PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from(lines.join("\n") + "\n", "utf8"),
        ContentType: "application/x-ndjson",
    }));
}
