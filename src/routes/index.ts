import { Router } from 'express';
import githubRoutes from './githubRoutes';
import healthRoutes from './healthRoutes';
import testRoutes from './testRoutes';
import qaRoutes from './qaRoutes';
import docRoutes from './docsRoutes';

const router = Router();

router.use('/test', testRoutes);
router.use('/docs', docRoutes);
router.use('/health', healthRoutes);
router.use('/github', githubRoutes);
router.use('/qa', qaRoutes);

export default router;