import express from 'express';
import { signup, login, getProfile,logout,appSignup, appLogin,startAppleLogin, appleCallback } from '../controllers/authController.js';
import authenticate from '../middlewares/authMiddleware.js';
// authRoutes.js
import { startGoogleLogin, googleCallback} from '../controllers/authController.js';
import {appAuthMiddleware} from '../middlewares/appAuthMiddleware.js'
const router = express.Router();

router.get('/google', startGoogleLogin);
router.get('/google/callback', googleCallback);

router.get('/apple', startAppleLogin);
router.get('/apple/callback', appleCallback);

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);
router.get('/profile', authenticate, getProfile);
router.get('/profileapp', appAuthMiddleware, getProfile);
router.post('/signupapp', appSignup);
router.post('/loginapp', appLogin);
export default router;
