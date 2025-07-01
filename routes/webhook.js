// routes/webhook.js

import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import  supabase  from '../utils/supabaseClient.js';

dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
const router = express.Router();

router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      return res.status(400).send(`Webhook error: ${err.message}`);
    }

    // Handle subscription completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const customerEmail = session.customer_email;

      const subscriptionId = session.subscription;

      // Get Stripe customer and subscription info
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      // You’ll need to identify the business using email or metadata
      const { data: business } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_email', customerEmail)
        .maybeSingle();

      if (business) {
        await supabase
          .from('business_subscriptions')
          .update({
            stripe_customer_id: subscription.customer,
            stripe_subscription_id: subscription.id,
            is_active: true,
            started_at: new Date().toISOString(),
            expires_at: null,
          })
          .eq('business_id', business.id);
      }
    }

    res.json({ received: true });
  }
);

export default router;
