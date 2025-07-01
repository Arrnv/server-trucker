import supabase from '../utils/supabaseClient.js';

// GET /admin/dashboard
export const getAdminDashboard = async (req, res) => {
  try {
    const [users, businesses, services] = await Promise.all([
      supabase.from('users').select('id'),
      supabase.from('businesses').select('id'),
      supabase.from('details').select('id'),
    ]);

    res.json({
      totalUsers: users.data.length,
      totalBusinesses: businesses.data.length,
      totalServices: services.data.length,
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ message: 'Error fetching dashboard' });
  }
};

// GET /admin/analytics
export const getAdminAnalytics = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('analytics_events')
      .select('event_type, created_at');

    if (error) throw error;

    const dailyCounts = {};
    data.forEach(event => {
      const date = new Date(event.created_at).toISOString().slice(0, 10);
      if (!dailyCounts[date]) {
        dailyCounts[date] = { view: 0, click: 0 };
      }
      if (event.event_type === 'view') dailyCounts[date].view++;
      if (event.event_type === 'click') dailyCounts[date].click++;
    });

    const formatted = Object.entries(dailyCounts).map(([date, counts]) => ({
      date,
      view: counts.view,
      click: counts.click
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ message: 'Error fetching analytics' });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    let query = supabase.from('users').select('*');
    const { search, role, sort = 'created_at', order = 'desc' } = req.query;

    if (search) query = query.ilike('full_name', `%${search}%`);
    if (role) query = query.eq('role', role);

    const { data, error } = await query.order(sort, { ascending: order === 'asc' });
    if (error) throw error;

    res.json(data); // raw array, keep it simple
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

// GET /admin/users/stats/roles
export const getUserRoleStats = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .then(({ data }) => {
        const roleCounts = data.reduce((acc, user) => {
          acc[user.role] = (acc[user.role] || 0) + 1;
          return acc;
        }, {});
        return { data: roleCounts };
      });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching role stats' });
  }
};

// GET /admin/users/stats/created
export const getUserCreatedStats = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('created_at');

    if (error) throw error;

    const dailyCounts = {};
    data.forEach(user => {
      const date = new Date(user.created_at).toISOString().slice(0, 10);
      if (!dailyCounts[date]) dailyCounts[date] = 0;
      dailyCounts[date]++;
    });

    const result = Object.entries(dailyCounts).map(([date, count]) => ({ date, count }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching creation stats' });
  }
};

// PUT /admin/users/:id/role
export const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  try {
    const { error } = await supabase.from('users').update({ role }).eq('id', id);
    if (error) throw error;

    res.json({ message: 'Role updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating role' });
  }
};

// DELETE /admin/users/:id
export const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;

    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting user' });
  }
};

// 📦 GET all businesses (with optional filters)
export const getAllBusinesses = async (req, res) => {
  try {
    const { status, search } = req.query;

    let query = supabase.from('businesses').select('*').order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Error fetching businesses:', err);
    res.status(500).json({ message: 'Failed to fetch businesses' });
  }
};

// ✅ PUT /admin/businesses/:id/status
export const updateBusinessStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    // Optional: check if business exists
    const { data: existingBusiness, error: fetchError } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !existingBusiness) {
      return res.status(404).json({ message: 'Business not found' });
    }

    if (status === 'rejected') {
      const { error } = await supabase.from('businesses').delete().eq('id', id);
      if (error) throw error;
      return res.json({ message: 'Business rejected and deleted' });
    } else {
      const { error } = await supabase.from('businesses').update({ status }).eq('id', id);
      if (error) throw error;
      return res.json({ message: 'Business approved' });
    }
  } catch (err) {
    console.error('Error updating business status:', err);
    res.status(500).json({ message: 'Failed to update status' });
  }
};

// 🗑️ DELETE business directly
export const deleteBusiness = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.from('businesses').delete().eq('id', id);
    if (error) throw error;

    res.json({ message: 'Business deleted' });
  } catch (err) {
    console.error('Error deleting business:', err);
    res.status(500).json({ message: 'Failed to delete business' });
  }
};

// 📊 GET business category stats (top categories)
export const getBusinessCategoryStats = async (req, res) => {
  try {
    const { data, error } = await supabase.from('details').select('business_id, service_category_id');

    if (error) throw error;

    const categoryMap = {};
    data.forEach(row => {
      if (!row.service_category_id) return;
      categoryMap[row.service_category_id] = (categoryMap[row.service_category_id] || 0) + 1;
    });

    const formatted = Object.entries(categoryMap).map(([category, count]) => ({
      category,
      count
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching category stats:', err);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
};

// 📅 GET business signup trend stats
export const getBusinessCreatedStats = async (req, res) => {
  try {
    const { data, error } = await supabase.from('businesses').select('created_at');
    if (error) throw error;

    const daily = {};
    data.forEach(b => {
      const date = new Date(b.created_at).toISOString().slice(0, 10);
      daily[date] = (daily[date] || 0) + 1;
    });

    const result = Object.entries(daily).map(([date, count]) => ({ date, count }));
    res.json(result);
  } catch (err) {
    console.error('Error fetching creation stats:', err);
    res.status(500).json({ message: 'Failed to fetch creation stats' });
  }
};

// GET /admin/services/stats/top-revenue
export const getTopRevenueServices = async (req, res) => {
  try {
    // 1. Group service bookings by detail_id and sum the revenue
    const { data, error } = await supabase
      .from('service_bookings')
      .select('detail_id, price')
      .eq('status', 'completed'); // only completed ones count as revenue

    if (error) throw error;

    // 2. Aggregate revenue by detail_id
    const revenueMap = {};
    data.forEach(row => {
      if (!row.detail_id) return;
      revenueMap[row.detail_id] = (revenueMap[row.detail_id] || 0) + Number(row.price || 0);
    });

    // 3. Sort by revenue descending and take top 5
    const sorted = Object.entries(revenueMap)
      .map(([detail_id, total_revenue]) => ({ detail_id, total_revenue }))
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 5);

    // 4. Fetch service names from `details` table for top 5
    const detailIds = sorted.map(r => r.detail_id);
    const { data: detailsData, error: detailsError } = await supabase
      .from('details')
      .select('id, name')
      .in('id', detailIds);

    if (detailsError) throw detailsError;

    // 5. Merge names into result
    const detailsMap = Object.fromEntries(detailsData.map(d => [d.id, d.name]));
    const enriched = sorted.map(item => ({
      name: detailsMap[item.detail_id] || 'Unnamed',
      total_revenue: item.total_revenue
    }));

    res.json(enriched);
  } catch (err) {
    console.error('Error fetching top revenue services:', err);
    res.status(500).json({ message: 'Failed to fetch top revenue services' });
  }
};
