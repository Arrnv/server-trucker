// routes/search.js
import express from 'express';
import supabase from '../utils/supabaseClient.js';

const router = express.Router();

router.get('/services', async (req, res) => {
  try {
    const { q = '', city = '', limit = 10 } = req.query;
    const shortCity = city ? city.split(',')[0].trim() : null;

    // 1️⃣ Find services available in selected city
    let baseQuery = supabase
      .from('details')
      .select(`
        service_category_id,
        city,
        latitude,
        longitude,
        service_categories (
          id,
          label,
          icon_url
        )
      `)
      .neq('status', 'inactive')
      .not('city', 'is', null);

    if (q) {
      baseQuery = baseQuery.ilike(
        'service_categories.label',
        `${q}%`
      );
    }

    if (shortCity) {
      baseQuery = baseQuery.ilike('city', `${shortCity}%`);
    }

    const { data: cityData, error } = await baseQuery;
    if (error) throw error;

    // 2️⃣ Group by service
    const servicesMap = new Map();

    for (const row of cityData || []) {
      const svc = row.service_categories;
      if (!svc) continue;

      if (!servicesMap.has(svc.id)) {
        servicesMap.set(svc.id, {
          serviceId: svc.id,
          serviceName: svc.label,
          icon: svc.icon_url,
          city,
          available: true,
          nearest: []
        });
      }
    }

    // 3️⃣ If available → return early
// 3️⃣ EXACT CITY RESULTS
if (servicesMap.size > 0) {
  return res.json({
    results: Array.from(servicesMap.values()).slice(0, limit)
  });
}

// 4️⃣ SAME CITY NAME, DIFFERENT STATE
const { data: sameNameCities } = await supabase
  .from('details')
  .select(`
    city,
    service_categories (
      id,
      label,
      icon_url
    )
  `)
  .ilike('city', `${shortCity},%`)
  .not('city', 'eq', city)
  .neq('status', 'inactive');

const sameCityMap = new Map();

for (const row of sameNameCities || []) {
  const svc = row.service_categories;
  if (!svc) continue;

  if (!sameCityMap.has(svc.id)) {
    sameCityMap.set(svc.id, {
      serviceId: svc.id,
      serviceName: svc.label,
      icon: svc.icon_url,
      available: false,
      city,
      nearest: [{ city: row.city, distanceKm: 0 }]
    });
  }
}

if (sameCityMap.size > 0) {
  return res.json({
    results: Array.from(sameCityMap.values()).slice(0, limit)
  });
}


    // 4️⃣ NOT AVAILABLE → FIND NEAREST CITIES
    // Get city coordinates
    const { data: cityCoords } = await supabase
      .from('details')
      .select('latitude, longitude')
      .ilike('city', `${shortCity}%`)
      .limit(1)
      .maybeSingle();

    if (!cityCoords) {
      return res.json({ results: [] });
    }

    // 5️⃣ Find nearest cities where service exists
    const { data: nearest } = await supabase.rpc(
      'find_nearest_service_cities',
      {
        search_service: q,
        lat: cityCoords.latitude,
        lng: cityCoords.longitude,
        max_results: 3
      }
    );

    res.json({
      results: [
        {
          serviceId: null,
          serviceName: q,
          available: false,
          city,
          nearest: nearest || []
        }
      ]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});



router.get('/cities', async (req, res) => {
  try {
    const { q = '' } = req.query;
    if (q.length < 2) return res.json({ cities: [] });

    const short = q.split(',')[0].trim();

    const { data, error } = await supabase
      .from('details')
      .select('city')
      .ilike('city', `${short}%`)
      .not('city', 'is', null)
      .limit(500);

    if (error) throw error;

    const uniqueCities = [
      ...new Set(
        data
          .map(d => d.city?.trim())
          .filter(Boolean)
      ),
    ];

    res.json({ cities: uniqueCities });
  } catch (err) {
    console.error(err);
    res.status(500).json({ cities: [] });
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
