
import Stripe from 'stripe';
import express from 'express';
import dotenv from 'dotenv';
import supabase from '../utils/supabaseClient.js';

dotenv.config();
const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

router.post('/start-subscription', async (req, res) => {
  const { email, plan_id } = req.body;

  try {
    // Get stripe_price_id for the selected plan
    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('stripe_price_id')
      .eq('id', plan_id)
      .single();

    if (!plan || !plan.stripe_price_id) {
      return res.status(400).json({ error: 'Invalid plan selected.' });
    }

    // Create checkout session
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
      success_url: `http://localhost:3000/business/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:3000/business/cancel`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

export default router;
