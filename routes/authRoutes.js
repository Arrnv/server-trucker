import express from 'express';
import { signup, login, getProfile,logout } from '../controllers/authController.js';
import authenticate from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);
router.get('/profile', authenticate, getProfile);

export default router;
