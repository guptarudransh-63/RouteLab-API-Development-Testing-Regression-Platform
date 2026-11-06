import express from 'express';
import {
  getEnvironments,
  createEnvironment,
  getEnvironmentById,
  updateEnvironment,
  deleteEnvironment,
  exportEnvironment,
} from '../controllers/environmentController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getEnvironments);
router.post('/', createEnvironment);
router.get('/:id', getEnvironmentById);
router.patch('/:id', updateEnvironment);
router.delete('/:id', deleteEnvironment);
router.get('/:id/export', exportEnvironment);

export default router;
