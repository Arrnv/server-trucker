// controllers/adminServiceController.js
import supabase from '../utils/supabaseClient.js';

// GET /admin/services
export const getAllServices = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('details')
      .select(`
        id, name, status, location, website, timings, tags,
        businesses(name, owner_email),
        service_categories(label),
        place_categories(label),
        view_counts(total_views),
        feedback(rating)
      `);

    if (error) throw error;

    const formatted = data.map(item => {
      const feedbackRatings = item.feedback || [];
      const totalRating = feedbackRatings.reduce((acc, f) => acc + f.rating, 0);
      const avgRating = feedbackRatings.length > 0
        ? (totalRating / feedbackRatings.length).toFixed(2)
        : 'N/A';

      return {
        id: item.id,
        name: item.name,
        status: item.status,
        location: item.location,
        website: item.website,
        timings: item.timings,
        tags: item.tags,
        business_name: item.businesses?.name || 'N/A',
        owner_email: item.businesses?.owner_email || 'N/A',
        category: item.service_categories?.label || item.place_categories?.label || 'N/A',
        type: item.service_categories ? 'Service' : item.place_categories ? 'Place' : 'Unknown',
        views: item.view_counts?.total_views || 0,
        avg_rating: avgRating
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching services:', err);
    res.status(500).json({ message: 'Failed to fetch services' });
  }
};

// PUT /admin/services/:id/status
export const updateServiceStatus = async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' });
  }

  try {
    if (status === 'rejected') {
      // Optional: Log rejection reason somewhere
      const { error } = await supabase.from('details').delete().eq('id', id);
      if (error) throw error;
      return res.json({ message: 'Service rejected and deleted' });
    }

    const { error } = await supabase.from('details').update({ status }).eq('id', id);
    if (error) throw error;
    res.json({ message: 'Service status updated' });
  } catch (err) {
    console.error('Error updating service status:', err);
    res.status(500).json({ message: 'Failed to update status' });
  }
};

// GET /admin/services/stats/views (optional)
export const getServiceViewStats = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('view_counts')
      .select('detail_id, total_views');

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Error fetching view stats:', err);
    res.status(500).json({ message: 'Error fetching view stats' });
  }
};

// GET /admin/services/stats/feedback (optional)
export const getServiceFeedbackStats = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('feedback')
      .select('detail_id, rating');

    if (error) throw error;

    const stats = {};

    data.forEach(({ detail_id, rating }) => {
      if (!stats[detail_id]) {
        stats[detail_id] = { total: 0, count: 0 };
      }
      stats[detail_id].total += rating;
      stats[detail_id].count += 1;
    });

    const result = Object.entries(stats).map(([id, val]) => ({
      detail_id: id,
      avg_rating: (val.total / val.count).toFixed(2)
    }));

    res.json(result);
  } catch (err) {
    console.error('Error fetching feedback stats:', err);
    res.status(500).json({ message: 'Error fetching feedback stats' });
  }
};

// GET /admin/services/stats/top-rated
export const getTopRatedServices = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('feedback')
      .select('detail_id, rating, details(name)');

    if (error) throw error;

    const ratingMap = {};
    data.forEach(({ detail_id, rating, details }) => {
      if (!ratingMap[detail_id]) ratingMap[detail_id] = { ratings: [], name: details?.name || 'N/A' };
      ratingMap[detail_id].ratings.push(rating);
    });

    const averageRatings = Object.entries(ratingMap).map(([id, obj]) => ({
      detail_id: id,
      name: obj.name,
      avg_rating: obj.ratings.reduce((a, b) => a + b, 0) / obj.ratings.length
    }));

    const topRated = averageRatings.sort((a, b) => b.avg_rating - a.avg_rating).slice(0, 5);

    res.json(topRated);
  } catch (err) {
    console.error('Error fetching top-rated services:', err);
    res.status(500).json({ message: 'Failed to fetch top-rated services' });
  }
};

// GET /admin/services/stats/most-viewed
export const getMostViewedServices = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('view_counts')
      .select('detail_id, total_views, details(name)');

    if (error) throw error;

    const topViews = data.sort((a, b) => b.total_views - a.total_views).slice(0, 5);
    res.json(topViews);
  } catch (err) {
    console.error('Error fetching most viewed services:', err);
    res.status(500).json({ message: 'Failed to fetch view stats' });
  }
};


export const getMonthlyStats = async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_monthly_service_stats');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error fetching monthly stats:', err);
    res.status(500).json({ message: 'Failed to fetch monthly stats' });
  }
};

// GET /admin/services/stats/by-category
export const getCategoryStats = async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_service_category_summary');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error fetching category stats:', err);
    res.status(500).json({ message: 'Failed to fetch category stats' });
  }
};

// GET /admin/services/stats/status-summary
export const getStatusStats = async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('get_service_status_summary');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error fetching status stats:', err);
    res.status(500).json({ message: 'Failed to fetch status stats' });
  }
};
