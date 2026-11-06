import express from 'express';
import {
  getRequestById,
  createRequest,
  updateRequest,
  deleteRequest,
  duplicateRequest,
  executeRequestHandler,
} from '../controllers/requestController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/collections/:collectionId/requests', createRequest);
router.get('/:id', getRequestById);
router.patch('/:id', updateRequest);
router.delete('/:id', deleteRequest);
router.post('/:id/duplicate', duplicateRequest);
router.post('/:id/execute', executeRequestHandler);
router.post('/execute-ad-hoc', executeRequestHandler);

export default router;
