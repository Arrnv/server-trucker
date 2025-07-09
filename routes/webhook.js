import express from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import supabase from '../utils/supabaseClient.js';

dotenv.config();
const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

router.post('/connect/onboard', async (req, res) => {
  const { user_id, email } = req.body;

  const account = await stripe.accounts.create({
    type: 'express',
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  await supabase.from('users').update({ stripe_account_id: account.id }).eq('id', user_id);

  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.CLIENT_URL}/onboarding/refresh`,
    return_url: `${process.env.CLIENT_URL}/dashboard`,
    type: 'account_onboarding',
  });

  res.json({ url: accountLink.url });
});

export default router;
