import express from 'express';
import authenticateToken from '../middlewares/authMiddleware.js';
import {
  getMyBookings,
  submitFeedback,
  submitBookingFeedback,
} from '../controllers/customerController.js';

const router = express.Router();

router.get('/my-bookings', authenticateToken, getMyBookings);
router.post('/feedback', authenticateToken, submitFeedback);
router.post('/booking-feedback',authenticateToken,submitBookingFeedback)
export default router;
