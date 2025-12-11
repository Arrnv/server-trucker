import express from 'express';
import supabase from '../utils/supabaseClient.js';
// Dual auth: supports cookie + Bearer token
import authenticateTokenDual from '../middlewares/authMiddleware.js';

const router = express.Router();

// ----------------- GET reviews -----------------
router.get('/:detailId', async (req, res) => {
  const { detailId } = req.params;
  const { data, error } = await supabase
    .from('feedback')
    .select('*, users(full_name)')
    .eq('detail_id', detailId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: 'Fetch failed' });

  const formatted = data.map(f => ({
    ...f,
    full_name: f.users.full_name,
    users: undefined,
  }));

  res.json(formatted);
});

// ----------------- POST review -----------------
router.post('/:detailId', authenticateTokenDual, async (req, res) => {
  const { detailId } = req.params;
  const { rating, comment } = req.body;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { error } = await supabase
    .from('feedback')
    .insert([{ user_id: userId, detail_id: detailId, rating, comment }]);

  if (error) return res.status(500).json({ error: 'Submit failed' });

  res.status(201).json({ success: true });
});

export default router;
