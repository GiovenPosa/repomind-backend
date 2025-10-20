"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const githubController_1 = __importDefault(require("../controllers/githubController"));
const router = (0, express_1.Router)();
// User repositories endpoint
router.get('/user-repos', githubController_1.default.getUserRepose);
// Webhook endpoints
router.post('/webhook', githubController_1.default.handleWebhook);
router.get('/webhook/status', githubController_1.default.getWebhookStatus);
// New repositories tracking
router.get('/new-repos', githubController_1.default.getNewRepositories);
exports.default = router;
