// backend/routes/services.js
import express from 'express';
import supabase from '../utils/supabaseClient.js';

const router = express.Router();

// Get all service categories (for menu)
router.get('/categories', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('service_categories')  // ✅ query the correct table
      .select('id, label, icon_url')
      .limit(50);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Map to your frontend expected format
    const formatted = data.map(cat => ({
      type: 'service',       // you can hardcode "service" as type
      category: cat.label,   // the category name
      icon_url: cat.icon_url
    }));

    res.json({ data: formatted });
  } catch (err) {
    console.error('🔥 Express error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ✅ Get services (paginated)
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const type = req.query.type;
    const category = req.query.category;
    const subcategory = req.query.subcategory;

    let query = supabase
      .from('services')
      .select('id, label, type, category, subcategory, icon_url, latitude, longitude');

    if (type) query = query.eq('type', type);
    if (category) query = query.eq('category', category);
    if (subcategory) query = query.eq('subcategory', subcategory);

    const { data, error } = await query.range(offset, offset + limit - 1);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ data });
  } catch (err) {
    console.error('🔥 Express error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ✅ Get full service details
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('id, label, type, category, subcategory, icon_url, latitude, longitude, details')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ data });
  } catch (err) {
    console.error('🔥 Express error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
