import express from 'express';
import {
  signup,
  login,
  getProfile,
  logout,
  appSignup,
  appLogin,
  startAppleLogin,
  appleCallback,
  startGoogleLogin,
  googleCallback,
} from '../controllers/authController.js';

// Dual auth middleware: supports cookie + Bearer token
import authenticateTokenDual from '../middlewares/authMiddleware.js';
import { appAuthMiddleware } from '../middlewares/appAuthMiddleware.js';

const router = express.Router();

// ----------------- Google OAuth -----------------
router.get('/google', startGoogleLogin);
router.get('/google/callback', googleCallback);

// ----------------- Apple OAuth -----------------
router.get('/apple', startAppleLogin);
router.post('/apple/callback', appleCallback);

// ----------------- Email/Password Auth -----------------
router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);

// ----------------- Profile -----------------
// Use dual auth for web
router.get('/profile', authenticateTokenDual, getProfile);
// App authentication
router.get('/profileapp', appAuthMiddleware, getProfile);

// ----------------- App-specific auth -----------------
router.post('/signupapp', appSignup);
router.post('/loginapp', appLogin);

export default router;
