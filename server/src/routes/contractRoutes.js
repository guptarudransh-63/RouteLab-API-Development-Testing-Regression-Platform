import express from 'express';
import {
  getSnapshotsForRequest,
  captureSnapshot,
  promoteToBaseline,
  compareSnapshotWithBaseline,
  getContractFindings,
  suppressFinding,
} from '../controllers/contractController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/requests/:requestId/snapshots', getSnapshotsForRequest);
router.post('/requests/:requestId/snapshots', captureSnapshot);
router.post('/snapshots/:id/promote-baseline', promoteToBaseline);
router.post('/snapshots/:id/compare', compareSnapshotWithBaseline);
router.get('/contract-findings', getContractFindings);
router.patch('/contract-findings/:id/suppress', suppressFinding);

export default router;
