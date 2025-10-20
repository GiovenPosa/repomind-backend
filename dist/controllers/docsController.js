"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRepoDocsLocal = void 0;
const docs_1 = require("../types/docs");
const documentationService_1 = require("../services/documentationService");
async function generateRepoDocsLocal(req, res) {
    try {
        const { owner, repo, commit } = req.params;
        if (!process.env.OPENAI_API_KEY)
            return res.status(400).json({ error: "OPENAI_API_KEY missing" });
        const out = await (0, documentationService_1.generateDocsLocal)({
            owner, repo, commit,
            tenantId: "default",
            bucket: process.env.S3_BUCKET_NAME,
            sections: docs_1.DEFAULT_SECTIONS
        });
        res.json({ ok: true, ...out });
    }
    catch (e) {
        console.error("generateRepoDocsLocal error", e);
        res.status(500).json({ error: e.message || "Internal error" });
    }
}
exports.generateRepoDocsLocal = generateRepoDocsLocal;
