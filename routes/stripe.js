// routes/stripe.js
import express from 'express';
import Stripe from 'stripe';
import authenticateToken from '../middlewares/authMiddleware.js'; // ✅ Adjust path if needed
import supabase from '../utils/supabaseClient.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2022-11-15',
});

// ✅ POST /stripe/manual-connect — Save an existing Stripe Account ID
router.post('/manual-connect', authenticateToken, async (req, res) => {
  try {
    const { stripe_account_id } = req.body;
    if (!stripe_account_id || !stripe_account_id.startsWith('acct_')) {
      return res.status(400).json({ message: 'Invalid Stripe Account ID' });
    }

    const userEmail = req.user.email;

    // 🔍 Optional: verify that account exists in Stripe
    const account = await stripe.accounts.retrieve(stripe_account_id);
    if (!account || account.deleted) {
      return res.status(404).json({ message: 'Stripe account not found or deleted' });
    }

    // ✅ Update business with Stripe account ID
    const { error } = await supabase
      .from('businesses')
      .update({ stripe_account_id })
      .eq('owner_email', userEmail);

    if (error) {
      console.error('[Supabase Error]', error);
      return res.status(500).json({ message: 'Failed to update business' });
    }

    res.status(200).json({ message: 'Stripe account linked successfully' });
  } catch (err) {
    console.error('[Stripe Manual Connect Error]', err);
    res.status(500).json({ message: 'Failed to connect to Stripe', error: err.message });
  }
});

export default router;
