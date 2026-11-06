import express from 'express';
import { register, login, logout, getMe, updatePreferences } from '../controllers/authController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);
router.patch('/preferences', authenticate, updatePreferences);

export default router;
