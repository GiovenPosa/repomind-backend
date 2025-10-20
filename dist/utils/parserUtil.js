"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.guessLang = exports.chunkId = exports.shortId = exports.approxTokenCount = exports.sha256 = exports.countLines = exports.byteOffsetForLine = exports.avgLineLen = exports.normalizeText = void 0;
const crypto_1 = require("crypto");
/** Text normalization */
function normalizeText(s) {
    // Normalize CRLF → LF; trim trailing spaces on lines
    return s.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "");
}
exports.normalizeText = normalizeText;
/** Average line length (for chunk sizing heuristics) */
function avgLineLen(text) {
    const lines = text.split("\n");
    if (!lines.length)
        return 40;
    const total = lines.reduce((n, l) => n + l.length, 0);
    return Math.max(10, Math.floor(total / lines.length));
}
exports.avgLineLen = avgLineLen;
/** Byte offset for the start of a given 0-based line index */
function byteOffsetForLine(fullText, lineIndex) {
    if (lineIndex <= 0)
        return 0;
    let ofs = 0;
    let remaining = lineIndex;
    for (const line of fullText.split("\n")) {
        if (remaining-- <= 0)
            break;
        ofs += Buffer.byteLength(line, "utf8") + 1; // +1 for '\n'
    }
    return ofs;
}
exports.byteOffsetForLine = byteOffsetForLine;
/** Count UTF-8 line breaks */
function countLines(s) {
    if (!s)
        return 1;
    let n = 1;
    for (let i = 0; i < s.length; i++)
        if (s.charCodeAt(i) === 10)
            n++;
    return n;
}
exports.countLines = countLines;
/** Hash helpers */
function sha256(text) {
    return (0, crypto_1.createHash)("sha256").update(text, "utf8").digest("hex");
}
exports.sha256 = sha256;
/** Very cheap token approximation (~4 chars per token) */
function approxTokenCount(s) {
    const chars = Buffer.byteLength(s, "utf8");
    return Math.max(1, Math.ceil(chars / 4));
}
exports.approxTokenCount = approxTokenCount;
/** Stable short id from path */
function shortId(s) {
    return (0, crypto_1.createHash)("sha1").update(s, "utf8").digest("hex").slice(0, 12);
}
exports.shortId = shortId;
/** Chunk id `shortPathHash-0000` */
function chunkId(filePath, ord) {
    return `${shortId(filePath)}-${String(ord).padStart(4, "0")}`;
}
exports.chunkId = chunkId;
/** Lightweight language guess from file extension */
function guessLang(path) {
    const p = path.toLowerCase();
    if (p.endsWith(".md"))
        return "Markdown";
    if (p.endsWith(".ts") || p.endsWith(".tsx"))
        return "TypeScript";
    if (p.endsWith(".js") || p.endsWith(".jsx"))
        return "JavaScript";
    if (p.endsWith(".py"))
        return "Python";
    if (p.endsWith(".java"))
        return "Java";
    if (p.endsWith(".go"))
        return "Go";
    if (p.endsWith(".rs"))
        return "Rust";
    if (p.endsWith(".c"))
        return "C";
    if (p.endsWith(".cpp") || p.endsWith(".cc") || p.endsWith(".cxx"))
        return "C++";
    if (p.endsWith(".cs"))
        return "CSharp";
    if (p.endsWith(".kt"))
        return "Kotlin";
    if (p.endsWith(".swift"))
        return "Swift";
    if (p.endsWith(".rb"))
        return "Ruby";
    if (p.endsWith(".php"))
        return "PHP";
    if (p.endsWith(".sh"))
        return "Shell";
    return "Text";
}
exports.guessLang = guessLang;
