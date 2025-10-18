import { S3Client } from "@aws-sdk/client-s3";
import { createHash } from "crypto";
import type { S3IngestLayout, ManifestJson, ManifestFileEntry } from "../types/s3";
import type { ChunkRecord, ChunkIndex } from "../types/parser";

import {
  s3Prefix as prefix,
  getJson,
  getText,
  putJson,
  putText,
} from "../utils/s3Util";


type ChunkWithText = ChunkRecord & { text: string };

/** ---- Public API ----
 * Parse code and markdown files for a given commit manifest.
 * Produces:
 *   - commits/{sha}/parse/chunks.index.json (metadata only)
 *   - commits/{sha}/parse/chunks/{fileId}.jsonl (optional; includes chunk text)
 */
export async function parseCommit(params: {
  s3: S3Client;
  layout: S3IngestLayout & { commit: string };
  writePerFileJsonl?: boolean;                 // default true
  modelLabel?: string;                         // metadata tag (e.g., "chunker-v0.1")
  targetTokensPerChunk?: number;               // guideline, not strict
}) {
  const {
    s3,
    layout,
    writePerFileJsonl = true,
    modelLabel = "chunker-v0.1",
    targetTokensPerChunk = 1600,
  } = params;

  // 1) Load manifest
  const manifestKey = prefix(layout) + `commits/${layout.commit}/manifest.json`;
  const manifest = await getJson<ManifestJson>(s3, layout.bucket, manifestKey);

  // 2) Select only code + markdown (and only items that were stored)
  const selected = manifest.files.filter(isCodeOrMarkdown).filter(f => !!f.storedAt);

  const indexRecords: ChunkRecord[] = [];

  // 3) For each file → load blob → normalize → chunk → persist optional JSONL
  for (const file of selected) {
    const blobKey = prefix(layout) + String(file.storedAt); // e.g. blobs/aa/bb/...
    const content = await getText(s3, layout.bucket, blobKey);

    const normalized = normalizeText(content);
    const lang = (file.lang || guessLang(file.path)).toLowerCase();

    let chunksWithText: ChunkWithText[];
    if (lang === "markdown") {
      chunksWithText = chunkMarkdown({
        repoPath: file.path,
        fileSha: file.sha,
        text: normalized,
        targetTokens: targetTokensPerChunk,
      });
    } else {
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
      const hash = sha256(c.text);
      const id = chunkId(file.path, idx);
      const tokenCount = approxTokenCount(c.text);
      return { ...c, id, hash: `sha256:${hash}`, tokenCount };
    });

    // optional per-file JSONL with chunk text (handy for downstream)
    if (writePerFileJsonl && chunksWithText.length) {
      const fileId = shortId(file.path);
      const jsonl = chunksWithText.map((c) =>
        JSON.stringify({
          id: c.id,
          filePath: c.filePath,
          fileSha: c.fileSha,
          hash: c.hash,
          startLine: c.startLine,
          endLine: c.endLine,
          text: c.text, // present only in per-file JSONL
        })
      ).join("\n") + "\n";

      await putText(
        s3,
        layout.bucket,
        prefix(layout) + `commits/${layout.commit}/parse/chunks/${fileId}.jsonl`,
        jsonl,
        "application/x-ndjson"
      );
    }

    // push metadata-only records to index
    indexRecords.push(
      ...chunksWithText.map(({ text: _omit, ...meta }) => meta)
    );
  }

  // 4) Write index (metadata only)
  const index: ChunkIndex = {
    commit: layout.commit,
    chunkModel: modelLabel,
    generatedAt: new Date().toISOString(),
    chunks: indexRecords,
  };

  await putJson(
    s3,
    layout.bucket,
    prefix(layout) + `commits/${layout.commit}/parse/chunks.index.json`,
    index
  );

  // 5) Status
  await putJson(
    s3,
    layout.bucket,
    prefix(layout) + `commits/${layout.commit}/parse/status.json`,
    {
      ok: true,
      finishedAt: new Date().toISOString(),
      filesParsed: selected.length,
      chunks: indexRecords.length,
      model: modelLabel,
    }
  );

  return index;
}



/* --------------------- Selection helpers -------------------- */

function isCodeOrMarkdown(f: ManifestFileEntry): boolean {
  const lang = (f.lang || guessLang(f.path)).toLowerCase();
  if (f.binary) return false;
  if (lang === "markdown") return true;

  const codeLangs = new Set([
    "typescript", "javascript", "python", "java", "go", "rust", "c", "cpp",
    "csharp", "kotlin", "swift", "ruby", "php", "scala", "haskell", "lua",
    "shell", "bash", "powershell"
  ]);
  return codeLangs.has(lang);
}

/* ---------------------- Chunking logic ---------------------- */

function chunkCodeByLines(args: {
  repoPath: string;
  fileSha: string;
  text: string;
  targetTokens: number;
  maxLines: number;   // ~400 good default
  overlap: number;    // ~20 lines overlap
}): ChunkWithText[] {
  const { repoPath, fileSha, text, targetTokens, maxLines, overlap } = args;

  // Heuristic: 1 token ~ 4 chars. Aim line windows to reach targetTokens.
  const estLinesForTarget = Math.min(
    maxLines,
    Math.max(120, Math.floor((targetTokens * 4) / avgLineLen(text)))
  );

  const lines = text.split("\n");
  const chunks: ChunkWithText[] = [];

  let i = 0;
  while (i < lines.length) {
    const start = i;
    const end = Math.min(i + estLinesForTarget, lines.length);
    const slice = lines.slice(start, end).join("\n");

    const byteStart = byteOffsetForLine(text, start);
    const byteEnd = byteOffsetForLine(text, end);

    chunks.push({
      id: "", // fill later
      filePath: repoPath,
      fileSha,
      lang: guessLang(repoPath),
      startLine: start + 1,
      endLine: end,
      byteStart,
      byteEnd,
      tokenCount: 0, // fill later
      hash: "",
      text: slice,
    });

    if (end >= lines.length) break;
    i = end - overlap; // slide with overlap
    if (i <= start) i = end; // guard tiny windows
  }

  return chunks;
}

function chunkMarkdown(args: {
  repoPath: string;
  fileSha: string;
  text: string;
  targetTokens: number;
}): ChunkWithText[] {
  const { repoPath, fileSha, text, targetTokens } = args;

  // Split on headings, keep their text with each section
  const splitter = /^(#{1,6})\s+.*$/gm;
  const indices: number[] = [0];
  let m: RegExpExecArray | null;

  while ((m = splitter.exec(text)) !== null) {
    indices.push(m.index);
  }
  indices.push(text.length);

  // Build sections
  const rawSections: string[] = [];
  for (let i = 0; i < indices.length - 1; i++) {
    const start = indices[i];
    const end = indices[i + 1];
    const section = text.slice(start, end);
    rawSections.push(section);
  }

  // Merge tiny sections up to a target token budget
  const merged: string[] = [];
  let acc = "";
  for (const sec of rawSections) {
    if (approxTokenCount(acc + sec) < Math.floor(targetTokens * 0.9)) {
      acc += (acc ? "\n" : "") + sec.trimEnd();
    } else {
      if (acc) merged.push(acc);
      acc = sec.trimEnd();
    }
  }
  if (acc) merged.push(acc);

  // Convert merged sections to chunk records
  let offset = 0;
  const chunks: ChunkWithText[] = [];
  for (const sec of merged) {
    const startByte = offset;
    const endByte = startByte + Buffer.byteLength(sec, "utf8");

    const startLine = 1 + countLines(text.slice(0, startByte));
    const endLine = startLine + countLines(sec) - 1;

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

/* ----------------------- Util functions --------------------- */

function normalizeText(s: string) {
  // Normalize CRLF → LF; trim trailing spaces on lines
  return s.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "");
}

function avgLineLen(text: string) {
  const lines = text.split("\n");
  if (!lines.length) return 40;
  const total = lines.reduce((n, l) => n + l.length, 0);
  return Math.max(10, Math.floor(total / lines.length));
}

function byteOffsetForLine(fullText: string, lineIndex: number) {
  if (lineIndex <= 0) return 0;
  let ofs = 0;
  let remaining = lineIndex;
  for (const line of fullText.split("\n")) {
    if (remaining-- <= 0) break;
    ofs += Buffer.byteLength(line, "utf8") + 1; // +1 for '\n'
  }
  return ofs;
}

function countLines(s: string) {
  if (!s) return 1;
  let n = 1;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) n++;
  return n;
}

function sha256(text: string) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function approxTokenCount(s: string) {
  // cheap approximation: ~4 chars per token
  const chars = Buffer.byteLength(s, "utf8");
  return Math.max(1, Math.ceil(chars / 4));
}

function shortId(s: string) {
  // stable short id from path
  return createHash("sha1").update(s, "utf8").digest("hex").slice(0, 12);
}

function chunkId(filePath: string, ord: number) {
  return `${shortId(filePath)}-${String(ord).padStart(4, "0")}`;
}

function guessLang(path: string) {
  const p = path.toLowerCase();
  if (p.endsWith(".md")) return "Markdown";
  if (p.endsWith(".ts") || p.endsWith(".tsx")) return "TypeScript";
  if (p.endsWith(".js") || p.endsWith(".jsx")) return "JavaScript";
  if (p.endsWith(".py")) return "Python";
  if (p.endsWith(".java")) return "Java";
  if (p.endsWith(".go")) return "Go";
  if (p.endsWith(".rs")) return "Rust";
  if (p.endsWith(".c")) return "C";
  if (p.endsWith(".cpp") || p.endsWith(".cc") || p.endsWith(".cxx")) return "C++";
  if (p.endsWith(".cs")) return "CSharp";
  if (p.endsWith(".kt")) return "Kotlin";
  if (p.endsWith(".swift")) return "Swift";
  if (p.endsWith(".rb")) return "Ruby";
  if (p.endsWith(".php")) return "PHP";
  if (p.endsWith(".sh")) return "Shell";
  return "Text";
}


async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  return await new Promise<Buffer>((resolve, reject) => {
    stream.on("data", (d) => chunks.push(d));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}