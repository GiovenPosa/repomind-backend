"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const docsController_1 = require("../controllers/docsController");
const router = (0, express_1.Router)();
// POST /api/docs/:owner/:repo/:commit
router.post("/:owner/:repo/:commit", docsController_1.generateRepoDocsLocal);
exports.default = router;
