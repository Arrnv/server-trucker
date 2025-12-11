import express from 'express';
import authenticateTokenDual from '../middlewares/authMiddleware.js';
import appAuthMiddleware from "../middlewares/appAuthMiddleware.js"
import {
  onboardBusiness,
  onboardBusiness1,
  getMyBusiness,
  getServiceById,
  updateService,
  addDetailForBusiness,
  getAlertsForService,
  getTodayFeedbacks,
} from '../controllers/businessController.js';
import {  upload } from '../controllers/businessController.js';

import supabase from '../utils/supabaseClient.js';

const router = express.Router();
router.post('/onboard', authenticateTokenDual, upload.single('logo'), onboardBusiness);
router.get('/my', authenticateTokenDual, getMyBusiness);
router.get('/service/:id', authenticateTokenDual, getServiceById);
router.put('/service/:id', authenticateTokenDual, updateService);

router.post('/add-detail',
  authenticateTokenDual,
  upload.fields([
    { name: 'galleryFiles' },
    { name: 'videoFile', maxCount: 1 }
  ]),
  addDetailForBusiness
);
router.get('/alerts/:id', authenticateTokenDual, getAlertsForService);

router.get('/me', authenticateTokenDual, async (req, res) => {
  const userEmail = req.user.email;

  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_email', userEmail)
    .single();

  if (error || !data) return res.status(404).json({ message: 'Business not found' });

  res.json(data);
});
export default router;
