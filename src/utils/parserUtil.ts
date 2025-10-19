import { createHash } from "crypto";

/** Text normalization */
export function normalizeText(s: string) {
  // Normalize CRLF → LF; trim trailing spaces on lines
  return s.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "");
}

/** Average line length (for chunk sizing heuristics) */
export function avgLineLen(text: string) {
  const lines = text.split("\n");
  if (!lines.length) return 40;
  const total = lines.reduce((n, l) => n + l.length, 0);
  return Math.max(10, Math.floor(total / lines.length));
}

/** Byte offset for the start of a given 0-based line index */
export function byteOffsetForLine(fullText: string, lineIndex: number) {
  if (lineIndex <= 0) return 0;
  let ofs = 0; 
  let remaining = lineIndex;
  for (const line of fullText.split("\n")) {
    if (remaining-- <= 0) break;
    ofs += Buffer.byteLength(line, "utf8") + 1; // +1 for '\n'
  }
  return ofs;
}

/** Count UTF-8 line breaks */
export function countLines(s: string) {
  if (!s) return 1;
  let n = 1;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) n++;
  return n;
}

/** Hash helpers */
export function sha256(text: string) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Very cheap token approximation (~4 chars per token) */
export function approxTokenCount(s: string) {
  const chars = Buffer.byteLength(s, "utf8");
  return Math.max(1, Math.ceil(chars / 4));
}

/** Stable short id from path */
export function shortId(s: string) {
  return createHash("sha1").update(s, "utf8").digest("hex").slice(0, 12);
}

/** Chunk id `shortPathHash-0000` */
export function chunkId(filePath: string, ord: number) {
  return `${shortId(filePath)}-${String(ord).padStart(4, "0")}`;
}

/** Lightweight language guess from file extension */
export function guessLang(path: string) {
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