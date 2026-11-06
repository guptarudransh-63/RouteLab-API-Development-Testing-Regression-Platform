import express from 'express';
import {
  getCollections,
  createCollection,
  getCollectionById,
  updateCollection,
  deleteCollection,
  exportCollection,
  importCollection,
} from '../controllers/collectionController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getCollections);
router.post('/', createCollection);
router.post('/import', importCollection);
router.get('/:id', getCollectionById);
router.patch('/:id', updateCollection);
router.delete('/:id', deleteCollection);
router.get('/:id/export', exportCollection);

export default router;
