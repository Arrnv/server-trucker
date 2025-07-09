// routes/amenities.js
import express from 'express';
import supabase from '../utils/supabaseClient.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('amenities').select('id, name, icon_url');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
