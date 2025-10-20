"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
class HealthController {
    static async checkHealth(req, res) {
        try {
            const healthCheck = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                service: 'repomind-backend',
                environment: process.env.NODE_ENV || 'development',
                version: process.env.npm_package_version || '1.0.0',
                checks: {
                    api: 'operational',
                    memory: {
                        usage: process.memoryUsage(),
                        percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
                    }
                }
            };
            res.status(200).json(healthCheck);
        }
        catch (error) {
            res.status(503).json({
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    static async ping(req, res) {
        res.status(200).json({
            message: 'pong',
            timestamp: new Date().toISOString()
        });
    }
}
exports.HealthController = HealthController;
exports.default = HealthController;
