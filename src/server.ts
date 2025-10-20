import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/index';
import bodyParser from 'body-parser'; // ⬅️ add this

const server = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // bind to all interfaces in containers

server.use(cors({
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
server.use('/api/github/webhook',
  bodyParser.json({
    limit: '10mb',
    verify: (req: any, _res, buf) => { req.rawBody = buf; }
  }),
  bodyParser.urlencoded({
    extended: true,
    limit: '10mb',
    verify: (req: any, _res, buf) => { req.rawBody = buf; }
  })
);

// Global JSON parser for everything else (OK to keep small/default)
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

// 404 handler
server.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString()
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
  console.log(`Health check: /api/health`);
});