"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadChunkTexts = void 0;
const s3Util_1 = require("../utils/s3Util");
async function loadChunkTexts(params) {
    const { s3, bucket, tenantId, owner, repo, commit, chunkIds } = params;
    // Group by fileId prefix (first 12 chars before "-")
    const byFile = {};
    for (const id of chunkIds) {
        const fileId = id.split("-")[0]; // "3339a3abe4b6"
        (byFile[fileId] || (byFile[fileId] = [])).push(id);
    }
    const results = {};
    for (const fileId of Object.keys(byFile)) {
        const key = `${(0, s3Util_1.s3Prefix)({ tenantId, owner, repo })}commits/${commit}/parse/chunks/${fileId}.jsonl`;
        let jsonl;
        try {
            jsonl = await (0, s3Util_1.getText)(s3, bucket, key);
        }
        catch {
            continue;
        }
        const want = new Set(byFile[fileId]);
        for (const line of jsonl.split("\n")) {
            if (!line.trim())
                continue;
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
exports.loadChunkTexts = loadChunkTexts;
