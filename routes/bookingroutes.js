import express from 'express';
import {  getBusinessBookings,updateBookingStatus } from '../controllers/bookingController.js';
import { requireAuth } from '../middlewares/authMiddleware2.js';
// import createBooking from '../controllers/bookingController.js'
const router = express.Router();

// router.post('/', requireAuth, createBooking);

router.get('/business/:businessId', requireAuth, getBusinessBookings);
router.put('/status/:id', requireAuth, updateBookingStatus);

export default router;