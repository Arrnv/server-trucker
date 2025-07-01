import express from 'express';
import authenticateToken from '../middlewares/authMiddleware.js';
import {
  onboardBusiness,
  getMyBusiness,
  getServiceById,
  updateService,
  addDetailForBusiness,
  getAlertsForService,
  getTodayFeedbacks
} from '../controllers/businessController.js';

const router = express.Router();

router.post('/onboard', authenticateToken, onboardBusiness);
router.get('/my', authenticateToken, getMyBusiness);
router.get('/service/:id', authenticateToken, getServiceById);
router.put('/service/:id', authenticateToken, updateService);
router.post('/add-detail', authenticateToken, addDetailForBusiness);
router.get('/alerts/:id', authenticateToken, getAlertsForService);
router.get('/feedbacks/:detailId', getTodayFeedbacks);
export default router;
