import express from 'express';
import Stripe from 'stripe';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import supabase from '../utils/supabaseClient.js';

dotenv.config();

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Stripe requires raw body to verify signature
router.post(
  '/webhook',
  bodyParser.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const session = event.data.object;

    // ✅ Handle booking confirmation
    if (event.type === 'checkout.session.completed') {
      const metadata = session.metadata;

      // Step 1: Avoid duplicate insertions
      const { data: existing } = await supabase
        .from('service_bookings')
        .select('id')
        .eq('stripe_payment_id', session.payment_intent)
        .maybeSingle();

      if (existing) {
        console.log('⚠️ Booking already exists for this payment.');
        return res.status(200).send('Already handled');
      }

      // Step 2: Insert new booking
      const { data: booking, error } = await supabase
        .from('service_bookings')
        .insert([
          {
            user_id: metadata.user_id,
            detail_id: metadata.detail_id,
            option_id: metadata.option_id,
            note: metadata.note || '',
            option_title: metadata.option_title || '',
            price: session.amount_total / 100,
            status: 'confirmed',
            stripe_payment_id: session.payment_intent,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('❌ Booking insert failed:', error.message);
        return res.status(500).send('Booking insert error');
      }

      // Step 3: Add alert
      await supabase.from('service_dashboard_alerts').insert([
        {
          detail_id: metadata.detail_id,
          booking_id: booking.id,
          message: `New booking confirmed!`,
        },
      ]);

      console.log(`✅ Booking created: ${booking.id}`);
    }

    res.status(200).send('Webhook received');
  }
);

export default router;
