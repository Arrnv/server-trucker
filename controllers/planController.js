import supabase from '../utils/supabaseClient.js';

export const getPlans = async (req, res) => {
  try {
    const { data, error } = await supabase.from('subscription_plans').select('*');
    if (error) throw new Error(error.message);
    res.status(200).json(data);
  } catch (err) {
    console.error('Get plans error:', err.message);
    res.status(500).json({ message: 'Failed to load plans', error: err.message });
  }
};
