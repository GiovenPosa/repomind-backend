import { Router } from 'express';
import HealthController from '../controllers/healthController';

const router = Router();

// Basic health check endpoint
router.get('/', HealthController.checkHealth);

// Simple ping endpoint for quick checks
router.get('/ping', HealthController.ping);

export default router;