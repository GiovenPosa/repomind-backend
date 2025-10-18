import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/index';

const server = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins (configure as needed for production)
server.use(cors({
    origin: '*', // In production, replace with your frontend URL
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

server.use(express.json());

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
server.use('/api', apiRoutes);

// 404 handler for undefined routes
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