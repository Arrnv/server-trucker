
import Stripe from 'stripe';
import express from 'express';
import dotenv from 'dotenv';
import supabase from '../utils/supabaseClient.js';
import authenticateToken from '../middlewares/authMiddleware.js';

dotenv.config();
const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});



router.post('/start-subscription', async (req, res) => {
  const { email, plan_id } = req.body;

  try {
    console.log('➡️ Received subscription request for:', email, plan_id);

    // Fetch plan from Supabase
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('stripe_price_id')
      .eq('id', plan_id)
      .single();

    if (planError) {
      console.error('❌ Supabase Error:', planError);
      return res.status(500).json({ error: 'Failed to fetch plan from database.' });
    }

    if (!plan || !plan.stripe_price_id) {
      return res.status(400).json({ error: 'Invalid plan selected or stripe_price_id missing.' });
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price: plan.stripe_price_id,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_API_URL}/business/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_API_URL}/business/cancel`,
    });

    console.log('✅ Stripe session created:', session.url);
    return res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Stripe error:', err);
    return res.status(500).json({ error: 'Failed to initiate payment.' });
  }
});

router.post('/checkout', authenticateToken, async (req, res) => {
  try {
    const { option_ids } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(option_ids) || option_ids.length === 0) {
      return res.status(400).json({ message: 'No booking options provided' });
    }

    // Fetch options with details and business in one go
    const { data: options, error } = await supabase
      .from('service_booking_options')
      .select(`
        id, type, price, note,
        detail_id:detail_id (
          id, name, business_id
        )
      `)
      .in('id', option_ids);

    if (error || options.length === 0) return res.status(404).json({ message: 'Options not found' });

    // Ensure all belong to the same business
    const businessIds = [...new Set(options.map(opt => opt.detail_id.business_id))];
    if (businessIds.length !== 1) return res.status(400).json({ message: 'Options must belong to same business' });

    // Fetch business stripe account
    const businessId = businessIds[0];
    const { data: business, error: bizErr } = await supabase
      .from('businesses')
      .select('stripe_account_id, commission_rate')
      .eq('id', businessId)
      .single();

    if (bizErr || !business?.stripe_account_id) {
      return res.status(400).json({ message: 'Business not connected to Stripe' });
    }

    const totalAmount = options.reduce((sum, o) => sum + parseFloat(o.price), 0);
    const platformFee = Math.round(totalAmount * (business.commission_rate || 0.2));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: options.map(o => ({
        price_data: {
          currency: 'inr',
          product_data: {
            name: `Booking: ${o.detail_id.name} (${o.type})`,
          },
          unit_amount: Math.round(parseFloat(o.price) * 100),
        },
        quantity: 1,
      })),
      mode: 'payment',
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/cancel`,
      payment_intent_data: {
        application_fee_amount: platformFee * 100,
        transfer_data: {
          destination: business.stripe_account_id,
        },
        metadata: {
          user_id: userId,
          business_id: businessId,
          option_ids: option_ids.join(','), // You’ll need this in webhook
        }
      }
    });

    res.json({ url: session.url });

  } catch (err) {
    console.error('[Multi Option Checkout Error]', err.message);
    res.status(500).json({ message: 'Stripe checkout failed', error: err.message });
  }
});

export default router;