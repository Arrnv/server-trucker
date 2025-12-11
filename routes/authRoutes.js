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

// Dual auth middleware: supports cookie + Bearer token (Safari-safe)

// Correct import (your file exports default)
import appAuthMiddleware from '../middlewares/appAuthMiddleware.js';
import authenticate from '../middlewares/authMiddleware.js';

const router = express.Router();

/* --------------------------- GOOGLE OAUTH --------------------------- */
router.get('/google', startGoogleLogin);
router.get('/google/callback', googleCallback);

/* ---------------------------- APPLE OAUTH --------------------------- */
router.get('/apple', startAppleLogin);
router.post('/apple/callback', appleCallback);

/* ----------------- EMAIL + PASSWORD AUTH (WEB) ---------------------- */
router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);

/* ---------------------------- PROFILE ------------------------------- */
// Web: supports both cookie + Bearer → works on Brave/Chrome/Safari/Ula
router.get('/profile', authenticate, getProfile);

// App: JWT only via Authorization header
router.get('/profileapp', appAuthMiddleware, getProfile);

/* ------------------------ APP AUTH ROUTES --------------------------- */
router.post('/signupapp', appSignup);
router.post('/loginapp', appLogin);

export default router;
