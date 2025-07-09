// routes/search.js
import express from 'express';
const router = express.Router();
import supabase from '../utils/supabaseClient.js';

// routes/search.js
router.get('/services', async (req, res) => {
  try {
    const { data, error } = await supabase.from('service_categories').select('id, label, icon_url');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch service categories' });
  }
});

router.get('/places', async (req, res) => {
  try {
    const { data, error } = await supabase.from('place_categories').select('id, label, icon_url');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch place categories' });
  }
});


export default router;
