"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const githubRoutes_1 = __importDefault(require("./githubRoutes"));
const healthRoutes_1 = __importDefault(require("./healthRoutes"));
const testRoutes_1 = __importDefault(require("./testRoutes"));
const qaRoutes_1 = __importDefault(require("./qaRoutes"));
const docsRoutes_1 = __importDefault(require("./docsRoutes"));
const router = (0, express_1.Router)();
router.use('/test', testRoutes_1.default);
router.use('/docs', docsRoutes_1.default);
router.use('/health', healthRoutes_1.default);
router.use('/github', githubRoutes_1.default);
router.use('/qa', qaRoutes_1.default);
exports.default = router;
