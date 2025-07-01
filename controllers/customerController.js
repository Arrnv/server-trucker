import supabase from '../utils/supabaseClient.js';

export const getMyBookings = async (req, res) => {
  const userId = req.user.id;

  try {
    const { data, error } = await supabase
      .from('service_bookings')
      .select(`
        id, option_title, price, status, created_at,
        details (
          name
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Error fetching bookings:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const submitFeedback = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { detail_id, rating, comment } = req.body;

    console.log('Feedback submission request:', {
      userId,
      detail_id,
      rating,
      comment
    });

    if (!userId) return res.status(401).json({ error: 'Unauthorized: No user ID' });
    if (!detail_id || !rating) return res.status(400).json({ error: 'Missing required fields' });

    const { error } = await supabase
      .from('feedback')
      .insert([
        {
          user_id: userId,
          detail_id,
          rating: parseInt(rating),
          comment: comment || '',
        },
      ]);

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }

    res.status(201).json({ message: 'Feedback submitted successfully' });
  } catch (err) {
    console.error('Error submitting feedback:', err.message);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
};

export const submitBookingFeedback = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { booking_id, rating, comment } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!booking_id || !rating) return res.status(400).json({ error: 'Missing required fields' });

    // Verify booking belongs to user
    const { data: booking, error: bookingError } = await supabase
      .from('service_bookings')
      .select('id, detail_id')
      .eq('id', booking_id)
      .eq('user_id', userId)
      .single();

    if (bookingError || !booking) return res.status(404).json({ error: 'Booking not found' });

    const { error } = await supabase.from('feedback').insert([{
      user_id: userId,
      detail_id: booking.detail_id,
      booking_id: booking.id,
      rating: parseInt(rating),
      comment: comment || '',
    }]);

    if (error) throw error;

    res.status(201).json({ message: 'Feedback submitted successfully' });
  } catch (err) {
    console.error('Feedback Error:', err.message);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
};