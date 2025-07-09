// File: routes/analyticsRoutes.js
import express from 'express';
import supabase from '../utils/supabaseClient.js';
const router = express.Router();

router.post('/track', async (req, res) => {
  const { userId, detailId, eventType } = req.body;

  if (!detailId || !eventType) {
    return res.status(400).json({ error: 'Missing detailId or eventType' });
  }

  const { error } = await supabase
    .from('analytics_events')
    .insert([{ user_id: userId, detail_id: detailId, event_type: eventType }]);

  if (error) return res.status(500).json({ error: error.message });

  if (eventType === 'view') {
    await supabase.rpc('increment_view_count', { d_id: detailId });
  }

  res.status(201).json({ message: 'Event tracked' });
});

router.get('/repeat-visitors/:businessId', async (req, res) => {
  const { businessId } = req.params;

  const { data: details, error: detailError } = await supabase
    .from('details')
    .select('id')
    .eq('business_id', businessId);

    
  if (detailError) return res.status(500).json({ error: detailError.message });

  const detailIds = details.map(d => d.id);

  const { data: events, error: eventError } = await supabase
    .from('analytics_events')
    .select('user_id')
    .in('detail_id', detailIds)
    .neq('user_id', null); // only logged-in users

  if (eventError) return res.status(500).json({ error: eventError.message });

  const counts = {};
  for (const event of events) {
    counts[event.user_id] = (counts[event.user_id] || 0) + 1;
  }

  const repeatVisitors = Object.values(counts).filter(c => c > 1).length;

  res.json({ totalLoggedInVisitors: Object.keys(counts).length, repeatVisitors });
});

router.get('/business/:ownerId/stats', async (req, res) => {
  const { ownerId } = req.params;

  const { data: details, error: dError } = await supabase
    .from('details')
    .select('id, name')
    .eq('owner_id', ownerId);

  if (dError) return res.status(500).json({ error: dError.message });

  const ids = details.map(d => d.id);

  const { data: stats, error: sError } = await supabase
    .from('analytics_events')
    .select('detail_id, event_type, count(*)')
    .in('detail_id', ids)
    .group('detail_id, event_type');

  if (sError) return res.status(500).json({ error: sError.message });

  res.json({ stats });
});

router.get('/insights', async (req, res) => {
  const { businessId } = req.query;

  if (!businessId) {
    return res.status(400).json({ error: 'Missing businessId' });
  }

  try {
    const { data: details, error: detailError } = await supabase
        .from('details')
        .select('id')
        .eq('business_id', businessId); 

    if (detailError) throw new Error(detailError.message);

    const detailIds = details.map((d) => d.id);
    if (detailIds.length === 0) {
      return res.json({ views: [], clicks: [] });
    }

    // Step 2: Get all events for these details
    const { data: events, error: eventError } = await supabase
      .from('analytics_events')
      .select('event_type, created_at')
      .in('detail_id', detailIds);

    if (eventError) throw new Error(eventError.message);

    const aggregate = (type) => {
      const counts = {};
      events
        .filter((e) => e.event_type === type)
        .forEach((e) => {
          const date = e.created_at.split('T')[0];
          counts[date] = (counts[date] || 0) + 1;
        });
      return Object.entries(counts).map(([date, count]) => ({ date, count }));
    };

    res.json({
      views: aggregate('view'),
      clicks: aggregate('click'),
    });
  } catch (err) {
    console.error('Error in /insights:', err);
    res.status(500).json({ error: err.message || 'Unknown server error' });
  }
});


router.get('/insights/service', async (req, res) => {
  const { detailId } = req.query;

  if (!detailId) {
    return res.status(400).json({ error: 'Missing detailId' });
  }

  try {
    const { data: events, error } = await supabase
      .from('analytics_events')
      .select('event_type, created_at')
      .eq('detail_id', detailId);

    if (error) throw new Error(error.message);

    const aggregate = (type) => {
      const counts = {};
      events
        .filter((e) => e.event_type === type)
        .forEach((e) => {
          const date = e.created_at.split('T')[0];
          counts[date] = (counts[date] || 0) + 1;
        });
      return Object.entries(counts).map(([date, count]) => ({ date, count }));
    };

    res.json({
      views: aggregate('view'),
      clicks: aggregate('click'),
    });
  } catch (err) {
    console.error('Error in /insights/service:', err);
    res.status(500).json({ error: err.message || 'Unknown server error' });
  }
});
router.get('/revenue/:detailId', async (req, res) => {
  const { detailId } = req.params;

  try {
    const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

    // Total Revenue for completed bookings
    const { data: revenueData, error: revenueError } = await supabase
      .from('service_bookings')
      .select('price')
      .eq('detail_id', detailId)
      .eq('status', 'completed');

    if (revenueError) throw new Error(revenueError.message);
    const revenue = revenueData.reduce((sum, booking) => sum + Number(booking.price), 0);

    // Total Completed Bookings
    const { count: totalCompleted, error: completedError } = await supabase
      .from('service_bookings')
      .select('*', { count: 'exact', head: true })
      .eq('detail_id', detailId)
      .eq('status', 'completed');

    if (completedError) throw new Error(completedError.message);

    // Today's Bookings
    const { count: todayBookings, error: todayError } = await supabase
      .from('service_bookings')
      .select('*', { count: 'exact', head: true })
      .eq('detail_id', detailId)
      .gte('created_at', `${today}T00:00:00+00:00`)
      .lt('created_at', `${today}T23:59:59+00:00`);

    if (todayError) throw new Error(todayError.message);

    res.json({
      revenue,
      total_completed: totalCompleted || 0,
      today_bookings: todayBookings || 0,
    });
  } catch (err) {
    console.error('Revenue API error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to fetch revenue stats' });
  }
});

router.get('/revenue/:detailId', async (req, res) => {
  const { detailId } = req.params;

  try {
    const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

    const { data: revenueData, error: revenueError } = await supabase
      .from('service_bookings')
      .select('price')
      .eq('detail_id', detailId)
      .eq('status', 'completed');

    if (revenueError) throw new Error(revenueError.message);
    const revenue = revenueData.reduce((sum, booking) => sum + Number(booking.price), 0);

    // Total Completed Bookings
    const { count: totalCompleted, error: completedError } = await supabase
      .from('service_bookings')
      .select('*', { count: 'exact', head: true })
      .eq('detail_id', detailId)
      .eq('status', 'completed');

    if (completedError) throw new Error(completedError.message);

    // Today's Bookings
    const { count: todayBookings, error: todayError } = await supabase
      .from('service_bookings')
      .select('*', { count: 'exact', head: true })
      .eq('detail_id', detailId)
      .gte('created_at', `${today}T00:00:00+00:00`)
      .lt('created_at', `${today}T23:59:59+00:00`);

    if (todayError) throw new Error(todayError.message);

    res.json({
      revenue,
      total_completed: totalCompleted || 0,
      today_bookings: todayBookings || 0,
    });
  } catch (err) {
    console.error('Revenue API error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to fetch revenue stats' });
  }
});


export default router;
