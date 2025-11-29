// routes/search.js
import express from 'express';
const router = express.Router();
import supabase from '../utils/supabaseClient.js';

router.get('/services', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('details')
      .select(`
        id,
        name,
        location,
        service_category_id,
        service_categories (id, label, icon_url)
      `)
      .neq('status', 'inactive');

    if (error) throw error;

    const cityServicesMap = new Map();

    data.forEach((detail) => {
      const fullLocation = detail.location || '';
      const city = extractCityFromAddress(fullLocation); // You write this logic

      const key = `${detail.service_categories?.id}-${city}`;
      if (!cityServicesMap.has(key)) {
        cityServicesMap.set(key, {
          id: detail.service_categories?.id,
          label: detail.service_categories?.label,
          icon_url: detail.service_categories?.icon_url,
          city,
        });
      }
    });

    const uniqueCities = Array.from(new Set([...cityServicesMap.values()].map((s) => s.city)));

    res.json({
      cities: uniqueCities,
      services: Array.from(cityServicesMap.values()),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch city-based services' });
  }

function extractCityFromAddress(address) {
  if (!address) return "";

  const parts = address.split(",").map(p => p.trim());

  // Example parts:
  // [ "1220 Fox Run Ave #102", "Opelika", "AL 36801", "United States" ]

  if (parts.length < 3) return address;

  const city = parts[1];         // Opelika
  const stateZip = parts[2];     // AL 36801

  return `${city}, ${stateZip}`;
}

});


router.get('/places', async (req, res) => {
  try {
    const { data, error } = await supabase.from('place_categories').select('id, label, icon_url');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch place categories' });
  }
});


export default router;
