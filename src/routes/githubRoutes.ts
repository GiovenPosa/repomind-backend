import { Router } from 'express';
import GitHubController from '../controllers/githubController';

const router = Router();

// User repositories endpoint
router.get('/user-repos', GitHubController.getUserRepose);

// Webhook endpoints
router.post('/webhook', GitHubController.handleWebhook);
router.get('/webhook/status', GitHubController.getWebhookStatus);

// New repositories tracking
router.get('/new-repos', GitHubController.getNewRepositories);

export default router;