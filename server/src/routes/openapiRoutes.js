import express from 'express';
import { importOpenApi, compareOpenApi } from '../controllers/openapiController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.use(authenticate);

router.post('/import', importOpenApi);
router.post('/compare', compareOpenApi);

export default router;
