import express from 'express';
import { 
  getReviewsByBusiness, 
  addReview, 
  updateReview, 
  getUserReviewForBusiness
} from '../controllers/reviewController.js';
import appAuthMiddleware from '../middlewares/appAuthMiddleware.js';

const router = express.Router();

// Get all reviews for a business
router.get('/business/:businessId', getReviewsByBusiness);

// Get the current user's review for a specific business
router.get('/user/business/:businessId', appAuthMiddleware, getUserReviewForBusiness);

// Add a new review (requires authentication)
router.post('/', appAuthMiddleware, addReview);

// Update a review (requires authentication)
router.put('/:id', appAuthMiddleware, updateReview);

export default router;