import express from 'express';
import {
  createTestRun,
  getTestRuns,
  getTestRunById,
  compareTestRunsHandler,
  getRegressionDashboardStats,
} from '../controllers/testRunController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/', createTestRun);
router.get('/', getTestRuns);
router.get('/regression-stats', getRegressionDashboardStats);
router.get('/:id', getTestRunById);
router.post('/:id/compare', compareTestRunsHandler);

export default router;
