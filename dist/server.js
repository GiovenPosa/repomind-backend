"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const index_1 = __importDefault(require("./routes/index"));
const body_parser_1 = __importDefault(require("body-parser")); // ⬅️ add this
const server = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
server.use((0, cors_1.default)({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
/**
 * IMPORTANT:
 * For the GitHub webhook route, increase the limit and keep RAW bytes
 * BEFORE mounting /api routes.
 */
server.use('/api/github/webhook', body_parser_1.default.json({
    limit: '10mb',
    verify: (req, _res, buf) => { req.rawBody = buf; }
}), body_parser_1.default.urlencoded({
    extended: true,
    limit: '10mb',
    verify: (req, _res, buf) => { req.rawBody = buf; }
}));
// Global JSON parser for everything else (OK to keep small/default)
server.use(express_1.default.json());
// Root endpoint
server.get('/', (req, res) => {
    res.json({
        message: 'RepoMind Backend API',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            ping: '/api/health/ping',
            github: {
                userRepos: '/api/github/user-repos',
                webhook: '/api/github/webhook',
                webhookStatus: '/api/github/webhook/status'
            }
        }
    });
});
// API routes
server.use('/api', index_1.default);
// 404 handler
server.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.originalUrl}`,
        timestamp: new Date().toISOString()
    });
});
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Health check available at http://localhost:${PORT}/api/health`);
});
