// routes/adminUsers.js
import express from 'express';
import supabase from '../utils/supabaseClient.js';
import isAdmin from '../middlewares/isAdmin.js';

const router = express.Router();

router.use(isAdmin);

// Get all users with optional search, filter, sort
router.get('/', async (req, res) => {
  try {
    const { search = '', role, sort = 'created_at', order = 'desc' } = req.query;

    let query = supabase.from('users').select('*');

    if (search) {
      query = query.ilike('full_name', `%${search}%`);
    }

    if (role) {
      query = query.eq('role', role);
    }

    query = query.order(sort, { ascending: order === 'asc' });

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Change user role
router.put('/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  try {
    const { error } = await supabase.from('users').update({ role }).eq('id', id);
    if (error) throw error;
    res.json({ message: 'Role updated successfully' });
  } catch (err) {
    console.error('Update role error:', err);
    res.status(500).json({ message: 'Failed to update role' });
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

// Get user role counts for analytics
router.get('/stats/roles', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('role, count:count(*)')
      .group('role');

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Role stats error:', err);
    res.status(500).json({ message: 'Error fetching user stats' });
  }
});

export default router;
