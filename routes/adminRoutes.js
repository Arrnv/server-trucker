import express from 'express';
import isAdmin from '../middlewares/isAdmin.js';
import authenticate from "../middlewares/authMiddleware.js"

const router = express.Router();

router.use(authenticate, isAdmin);

router.get('/dashboard', (req, res) => {
  res.json({ message: 'Welcome Admin!', user: req.user });
});

router.get('/users', async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, role');

  if (error) return res.status(500).json({ error });
  res.json({ users: data });
});


export default router;
