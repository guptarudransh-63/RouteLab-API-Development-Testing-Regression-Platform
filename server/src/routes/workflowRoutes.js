import express from 'express';
import {
  getWorkflows,
  createWorkflow,
  getWorkflowById,
  updateWorkflow,
  deleteWorkflow,
  executeWorkflow,
} from '../controllers/workflowController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getWorkflows);
router.post('/', createWorkflow);
router.get('/:id', getWorkflowById);
router.patch('/:id', updateWorkflow);
router.delete('/:id', deleteWorkflow);
router.post('/:id/run', executeWorkflow);

export default router;
