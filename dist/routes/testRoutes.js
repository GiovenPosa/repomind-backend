"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ingestService_1 = require("../services/ingestService");
const router = (0, express_1.Router)();
/**
 * POST /api/ingest/test
 * Body: { owner, repo, ref, include[], exclude[], maxFileKB }
 */
router.post('/ingest', async (req, res) => {
    try {
        const { owner, repo, ref, include = ['src/**', 'README.md', '.github/workflows/**'], exclude = ['node_modules/**', 'dist/**', '**/*.png', '**/*.jpg', '**/*.pdf'], maxFileKB = 400 } = req.body || {};
        if (!owner || !repo || !ref) {
            return res.status(400).json({ error: 'owner, repo, ref are required' });
        }
        const manifest = await (0, ingestService_1.ingestRepository)({
            owner,
            repo,
            commit: ref,
            cfg: { include, exclude, maxFileKB },
            dryRun: true // ⬅️ important: no S3 writes
        });
        // Keep the response light: send summary + first N files
        const summary = {
            owner: manifest.owner,
            repo: manifest.repo,
            commit: manifest.commit,
            stats: manifest.stats,
            keptSample: manifest.files.slice(0, 25).map(f => ({ path: f.path, size: f.size, lang: f.lang }))
        };
        return res.json(summary);
    }
    catch (err) {
        console.error('ingest test error:', err);
        return res.status(500).json({ error: err.message || 'ingest test failed' });
    }
});
exports.default = router;
