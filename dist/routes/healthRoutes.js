"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const healthController_1 = __importDefault(require("../controllers/healthController"));
const router = (0, express_1.Router)();
// Basic health check endpoint
router.get('/', healthController_1.default.checkHealth);
// Simple ping endpoint for quick checks
router.get('/ping', healthController_1.default.ping);
exports.default = router;
