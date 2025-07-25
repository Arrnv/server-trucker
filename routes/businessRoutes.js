import express from 'express';
import authenticateToken from '../middlewares/authMiddleware.js';
import {
  onboardBusiness,
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



router.post('/onboard', authenticateToken, upload.single('logo'), onboardBusiness);
router.get('/my', authenticateToken, getMyBusiness);
router.get('/service/:id', authenticateToken, getServiceById);
router.put('/service/:id', authenticateToken, updateService);

router.post('/add-detail',
  authenticateToken,
  upload.fields([
    { name: 'galleryFiles' },
    { name: 'videoFile', maxCount: 1 }
  ]),
  addDetailForBusiness
);router.get('/alerts/:id', authenticateToken, getAlertsForService);
router.get('/feedbacks/:detailId', getTodayFeedbacks);


router.get('/me', authenticateToken, async (req, res) => {
  const userEmail = req.user.email;

  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_email', userEmail)
    .single();

  if (error || !data) {
    return res.status(404).json({ message: 'Business not found' });
  }

  res.json(data);
});
export default router;
