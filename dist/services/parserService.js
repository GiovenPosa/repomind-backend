"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCommit = void 0;
const s3Util_1 = require("../utils/s3Util");
const parserUtil_1 = require("../utils/parserUtil");
/** ---- Public API ----
 * Parse code and markdown files for a given commit manifest.
 * Produces:
 *   - commits/{sha}/parse/chunks.index.json (metadata only)
 *   - commits/{sha}/parse/chunks/{fileId}.jsonl (optional; includes chunk text)
 */
async function parseCommit(params) {
    const { s3, layout, writePerFileJsonl = true, modelLabel = "chunker-v0.1", targetTokensPerChunk = 1600, } = params;
    // 1) Load manifest
    const manifestKey = (0, s3Util_1.s3Prefix)(layout) + `commits/${layout.commit}/manifest.json`;
    const manifest = await (0, s3Util_1.getJson)(s3, layout.bucket, manifestKey);
    // 2) Select only code + markdown (and only items that were stored)
    const selected = manifest.files.filter(isCodeOrMarkdown).filter(f => !!f.storedAt);
    const indexRecords = [];
    // 3) For each file → load blob → normalize → chunk → persist optional JSONL
    for (const file of selected) {
        const blobKey = (0, s3Util_1.s3Prefix)(layout) + String(file.storedAt); // e.g. blobs/aa/bb/...
        const content = await (0, s3Util_1.getText)(s3, layout.bucket, blobKey);
        const normalized = (0, parserUtil_1.normalizeText)(content);
        const lang = (file.lang || (0, parserUtil_1.guessLang)(file.path)).toLowerCase();
        let chunksWithText;
        if (lang === "markdown") {
            chunksWithText = chunkMarkdown({
                repoPath: file.path,
                fileSha: file.sha,
                text: normalized,
                targetTokens: targetTokensPerChunk,
            });
        }
        else {
            chunksWithText = chunkCodeByLines({
                repoPath: file.path,
                fileSha: file.sha,
                text: normalized,
                targetTokens: targetTokensPerChunk,
                maxLines: 400,
                overlap: 20,
            });
        }
        // compute hashes + token counts + ids
        chunksWithText = chunksWithText.map((c, idx) => {
            const hash = (0, parserUtil_1.sha256)(c.text);
            const id = (0, parserUtil_1.chunkId)(file.path, idx);
            const tokenCount = (0, parserUtil_1.approxTokenCount)(c.text);
            return { ...c, id, hash: `sha256:${hash}`, tokenCount };
        });
        // optional per-file JSONL with chunk text (handy for downstream)
        if (writePerFileJsonl && chunksWithText.length) {
            const fileId = (0, parserUtil_1.shortId)(file.path);
            const jsonl = chunksWithText
                .map((c) => JSON.stringify({
                id: c.id,
                filePath: c.filePath,
                fileSha: c.fileSha,
                hash: c.hash,
                startLine: c.startLine,
                endLine: c.endLine,
                text: c.text, // present only in per-file JSONL
            }))
                .join("\n") + "\n";
            await (0, s3Util_1.putText)(s3, layout.bucket, (0, s3Util_1.s3Prefix)(layout) + `commits/${layout.commit}/parse/chunks/${fileId}.jsonl`, jsonl, "application/x-ndjson");
        }
        // push metadata-only records to index
        indexRecords.push(...chunksWithText.map(({ text: _omit, ...meta }) => meta));
    }
    // 4) Write index (metadata only)
    const index = {
        commit: layout.commit,
        chunkModel: modelLabel,
        generatedAt: new Date().toISOString(),
        chunks: indexRecords,
    };
    await (0, s3Util_1.putJson)(s3, layout.bucket, (0, s3Util_1.s3Prefix)(layout) + `commits/${layout.commit}/parse/chunks.index.json`, index);
    // 5) Status
    await (0, s3Util_1.putJson)(s3, layout.bucket, (0, s3Util_1.s3Prefix)(layout) + `commits/${layout.commit}/parse/status.json`, {
        ok: true,
        finishedAt: new Date().toISOString(),
        filesParsed: selected.length,
        chunks: indexRecords.length,
        model: modelLabel,
    });
    return index;
}
exports.parseCommit = parseCommit;
/* --------------------- Selection helpers (stay here) -------------------- */
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
/* ---------------------- Chunking logic (stay here) ---------------------- */
function chunkCodeByLines(args) {
    const { repoPath, fileSha, text, targetTokens, maxLines, overlap } = args;
    // Heuristic: 1 token ~ 4 chars. Aim line windows to reach targetTokens.
    const estLinesForTarget = Math.min(maxLines, Math.max(120, Math.floor((targetTokens * 4) / (0, parserUtil_1.avgLineLen)(text))));
    const lines = text.split("\n");
    const chunks = [];
    let i = 0;
    while (i < lines.length) {
        const start = i;
        const end = Math.min(i + estLinesForTarget, lines.length);
        const slice = lines.slice(start, end).join("\n");
        const byteStart = (0, parserUtil_1.byteOffsetForLine)(text, start);
        const byteEnd = (0, parserUtil_1.byteOffsetForLine)(text, end);
        chunks.push({
            id: "",
            filePath: repoPath,
            fileSha,
            lang: (0, parserUtil_1.guessLang)(repoPath),
            startLine: start + 1,
            endLine: end,
            byteStart,
            byteEnd,
            tokenCount: 0,
            hash: "",
            text: slice,
        });
        if (end >= lines.length)
            break;
        i = end - overlap; // slide with overlap
        if (i <= start)
            i = end; // guard tiny windows
    }
    return chunks;
}
function chunkMarkdown(args) {
    const { repoPath, fileSha, text, targetTokens } = args;
    // Split on headings, keep their text with each section
    const splitter = /^(#{1,6})\s+.*$/gm;
    const indices = [0];
    let m;
    while ((m = splitter.exec(text)) !== null) {
        indices.push(m.index);
    }
    indices.push(text.length);
    // Build sections
    const rawSections = [];
    for (let i = 0; i < indices.length - 1; i++) {
        const start = indices[i];
        const end = indices[i + 1];
        const section = text.slice(start, end);
        rawSections.push(section);
    }
    // Merge tiny sections up to a target token budget
    const merged = [];
    let acc = "";
    for (const sec of rawSections) {
        if ((0, parserUtil_1.approxTokenCount)(acc + sec) < Math.floor(targetTokens * 0.9)) {
            acc += (acc ? "\n" : "") + sec.trimEnd();
        }
        else {
            if (acc)
                merged.push(acc);
            acc = sec.trimEnd();
        }
    }
    if (acc)
        merged.push(acc);
    // Convert merged sections to chunk records
    let offset = 0;
    const chunks = [];
    for (const sec of merged) {
        const startByte = offset;
        const endByte = startByte + Buffer.byteLength(sec, "utf8");
        const startLine = 1 + (0, parserUtil_1.countLines)(text.slice(0, startByte));
        const endLine = startLine + (0, parserUtil_1.countLines)(sec) - 1;
        chunks.push({
            id: "",
            filePath: repoPath,
            fileSha,
            lang: "Markdown",
            startLine,
            endLine,
            byteStart: startByte,
            byteEnd: endByte,
            tokenCount: 0,
            hash: "",
            text: sec,
        });
        offset = endByte;
    }
    return chunks;
}
