import supabase from '../utils/supabaseClient.js';

// In bookingController.js - enhance createBooking
export const createBooking = async (req, res) => {
  const { option_id, note } = req.body;
  const user_id = req.user?.id;

  if (!user_id) return res.status(401).json({ error: 'User not authenticated' });

  try {
    const { data: option, error: optErr } = await supabase
      .from('service_booking_options')
      .select('id, detail_id, type, price')
      .eq('id', option_id)
      .single();

    if (optErr || !option) return res.status(404).json({ error: 'Invalid booking option' });

    const { data: booking, error } = await supabase
      .from('service_bookings')
      .insert([{
        user_id,
        detail_id: option.detail_id,
        option_id: option.id,
        option_title: option.type,
        price: option.price,
        note,
      }])
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    // ✅ Create a dashboard alert
    await supabase.from('service_dashboard_alerts').insert([{
      detail_id: option.detail_id,
      booking_id: booking.id,
      message: `New booking received for ${option.type}`,
    }]);

    res.status(201).json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getBusinessBookings = async (req, res) => {
  const { businessId } = req.params;

  try {
    const { data, error } = await supabase
      .from('service_bookings')
      .select(`
        *,
        users(full_name, email),
        details!inner(id, name, business_id)
      `)
      .eq('details.business_id', businessId);

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
export const updateBookingStatus = async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  const validStatuses = ['pending', 'ongoing', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' });
  }

  try {
    const { error } = await supabase
      .from('service_bookings')
      .update({ status })
      .eq('id', id);

    if (error) return res.status(400).json({ message: error.message });

    // Optional: Log the reason in alerts table
    if (status === 'cancelled' && reason) {
      // Get detail_id from booking
      const { data: booking } = await supabase
        .from('service_bookings')
        .select('detail_id')
        .eq('id', id)
        .single();

      await supabase.from('service_dashboard_alerts').insert([{
        detail_id: booking.detail_id,
        booking_id: id,
        message: `Booking cancelled by user: ${reason}`,
      }]);
    }

    res.json({ message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

