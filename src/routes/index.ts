import { Router } from 'express';
import githubRoutes from './githubRoutes';
import healthRoutes from './healthRoutes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/github', githubRoutes);

export default router;