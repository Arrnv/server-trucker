import supabase from '../utils/supabaseClient.js';
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });


// export const createBooking = async (req, res) => {
//   const { option_id, note } = req.body;
//   const user_id = req.user?.id;

//   if (!user_id) return res.status(401).json({ error: 'User not authenticated' });

//   try {
//     const { data: option, error: optErr } = await supabase
//       .from('service_booking_options')
//       .select('id, detail_id, type, price')
//       .eq('id', option_id)
//       .single();

//     if (optErr || !option) return res.status(404).json({ error: 'Invalid booking option' });

//     const { data: detail } = await supabase
//       .from('details')
//       .select('business_id, name')
//       .eq('id', option.detail_id)
//       .single();

//     const { data: business } = await supabase
//       .from('users')
//       .select('stripe_account_id, email')
//       .eq('id', detail.business_id)
//       .single();

//     if (!business?.stripe_account_id) {
//       return res.status(400).json({ error: 'Business not connected to Stripe.' });
//     }

//     const session = await stripe.checkout.sessions.create({
//       payment_method_types: ['card'],
//       mode: 'payment',
//       customer_email: req.user.email, // Assuming user's email is in auth session
//       line_items: [
//         {
//           price_data: {
//             currency: 'usd',
//             product_data: {
//               name: `${detail.name} - ${option.type}`,
//             },
//             unit_amount: option.price * 100,
//           },
//           quantity: 1,
//         },
//       ],
//       payment_intent_data: {
//         application_fee_amount: Math.floor(option.price * 0.1 * 100), // 10% platform fee
//         transfer_data: {
//           destination: business.stripe_account_id,
//         },
//       },
//       success_url: `${process.env.CLIENT_URL}/booking-success`,
//       cancel_url: `${process.env.CLIENT_URL}/booking-cancel`,
//       metadata: {
//         option_id: option.id,
//         detail_id: option.detail_id,
//         user_id,
//         note,
//       },
//     });

//     res.status(200).json({ url: session.url });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// };
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

