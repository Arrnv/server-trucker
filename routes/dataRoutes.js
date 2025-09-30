import express from 'express';
const router = express.Router();
import supabase from '../utils/supabaseClient.js';

// ✅ GET /api/services - Fetch services and their details
router.get('/services', async (req, res) => {
  try {
    const { data: services, error } = await supabase
      .from('services')
      .select(`
        id, label, icon_url,
        subcategories:service_categories (
          id, label,
          details:details (
            id, name, rating, location, status, timings, contact, website, tags, latitude, longitude,
            service_category:service_categories ( icon_url )
          )
        )
      `);
    if (error) {
      console.error("🔥 Supabase error:", error.message);
      return res.status(500).json({ error: error.message });
    }

    res.json({ data: services });
    
  } catch (err) {
    console.error("🔥 Express error:", err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



// ✅ GET /api/places - Fetch places and their details
router.get('/places', async (req, res) => {
  const { data: places, error: placeErr } = await supabase
    .from('places')
    .select(`
      id, label, icon_url,
      subcategories:place_categories (
        id, label,
        details:details (
          id, name, rating, location, status, timings, contact, website, tags, latitude, longitude,
          place_category:place_categories ( icon_url )
        )
      )
    `);


  if (placeErr) return res.status(500).json({ error: placeErr.message });
  res.json({ data: places });
});

// GET /api/services?lat_min=18.5&lat_max=18.7&lng_min=73.85&lng_max=74.05
router.get('/servicesapp', async (req, res) => {
  try {
    const { lat_min, lat_max, lng_min, lng_max } = req.query;

    let query = supabase
      .from('services')
      .select(`
        id, label, icon_url,
        subcategories:service_categories (
          id, label,
          details:details (
            id, name, rating, location, status, timings, contact, website, tags,
            latitude, longitude,
            service_category:service_categories ( icon_url )
          )
        )
      `);

    // ✅ Only filter if bounds are provided
    if (lat_min && lat_max && lng_min && lng_max) {
      query = query.contains('subcategories.details', [
        {
          latitude: { gte: Number(lat_min), lte: Number(lat_max) },
          longitude: { gte: Number(lng_min), lte: Number(lng_max) }
        }
      ]);
    }

    const { data: services, error } = await query;
    if (error) {
      console.error("🔥 Supabase error:", error.message);
      return res.status(500).json({ error: error.message });
    }

    res.json({ data: services });
  } catch (err) {
    console.error("🔥 Express error:", err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/placesapp', async (req, res) => {
  const { lat_min, lat_max, lng_min, lng_max } = req.query;

  let query = supabase
    .from('places')
    .select(`
      id, label, icon_url,
      subcategories:place_categories (
        id, label,
        details:details (
          id, name, rating, location, status, timings, contact, website, tags,
          latitude, longitude,
          place_category:place_categories ( icon_url )
        )
      )
    `);

  if (lat_min && lat_max && lng_min && lng_max) {
    query = query.contains('subcategories.details', [
      {
        latitude: { gte: Number(lat_min), lte: Number(lat_max) },
        longitude: { gte: Number(lng_min), lte: Number(lng_max) }
      }
    ]);
  }

  const { data: places, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  res.json({ data: places });
});


// ✅ GET /api/business-services?businessId=xyz - Services for a specific business
router.get('/business-services', async (req, res) => {
  const { businessId } = req.query;

  if (!businessId) {
    return res.status(400).json({ error: 'Missing businessId in query parameters.' });
  }

  try {
    const { data, error } = await supabase
      .from('details')
      .select('*')
      .eq('business_id', businessId); 

    if (error) return res.status(500).json({ error: error.message });

    res.status(200).json(data);
  } catch (err) {
    console.error("🔥 Error fetching business services:", err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/details/:id/booking-options
router.get('/details/:id/booking-options', async (req, res) => {
  const { id } = req.params;

  if (!id) return res.status(400).json({ error: 'Missing detail ID' });

  try {
    const { data, error } = await supabase
      .from('service_booking_options')
      .select('*')
      .eq('detail_id', id);

    if (error) {
      console.error('Supabase error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch booking options' });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Unexpected error:', err.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});
// GET /api/booking-options/:detailId
router.get('/details/by-id', async (req, res) => {
  const ids = req.query.ids;

  if (!ids) {
    return res.status(400).json({ error: 'Missing ids query param.' });
  }

  const idArray = ids.split(',');

  const { data: details, error } = await supabase
    .from('details')
    .select(
      `
      *,
      bookings(id, note, price, booking_time),
      service_category:service_categories!details_service_category_id_fkey(icon_url),
      place_category:place_categories!details_place_category_id_fkey(icon_url),
      detail_amenities (
        amenities (
          id,
          name,
          icon_url
        )
      )
    `
    )
    .in('id', idArray);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (!details || details.length === 0) {
    return res.status(404).json({ error: 'Detail not found.' });
  }

  res.status(200).json(details);
});


router.get('/details/:type', async (req, res) => {
  const { type } = req.params;
  const ids = req.query.ids; // Accepts comma-separated IDs, e.g., "1,2,3"

  if (!ids) return res.status(400).json({ error: 'Missing ids query param.' });

  let column = null;
  if (type === 'service') column = 'service_category_id';
  else if (type === 'place') column = 'place_category_id';
  else return res.status(400).json({ error: 'Invalid type. Must be "service" or "place".' });

  const idArray = ids.split(',');

  try {
    const { data: details, error } = await supabase
      .from('details')
      .select(`
        *,
        bookings(id, note, price, booking_time),
        service_category:service_categories!details_service_category_id_fkey(icon_url),
        place_category:place_categories!details_place_category_id_fkey(icon_url),
        detail_amenities (
          amenities (
            id,
            name,
            icon_url
          )
        )
      `)
      .in(column, idArray);  // <-- Allow multiple values using `.in`

    if (error) return res.status(500).json({ error: error.message });
    if (!details || details.length === 0)
      return res.status(404).json({ error: 'No matching details found.' });

    res.status(200).json(details);
  } catch (err) {
    console.error("🔥 Unexpected error:", err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// In your Express router




router.get('/subcategories', async (req, res) => {
  const idsQuery = req.query.ids;

  if (!idsQuery) {
    return res.status(400).json({ error: 'Missing ids query parameter' });
  }

  const ids = idsQuery.split(',');

  try {
    // Fetch matching service categories
    const { data: serviceCategories, error: serviceErr } = await supabase
      .from('service_categories')
      .select('id, label')
      .in('id', ids);

    if (serviceErr) {
      console.error('Error fetching service categories:', serviceErr.message);
      return res.status(500).json({ error: serviceErr.message });
    }

    // Fetch matching place categories
    const { data: placeCategories, error: placeErr } = await supabase
      .from('place_categories')
      .select('id, label')
      .in('id', ids);

    if (placeErr) {
      console.error('Error fetching place categories:', placeErr.message);
      return res.status(500).json({ error: placeErr.message });
    }

    // Add a 'type' property to distinguish between service/place
    const services = (serviceCategories || []).map((c) => ({ ...c, type: 'service' }));
    const places = (placeCategories || []).map((c) => ({ ...c, type: 'place' }));

    return res.status(200).json({ data: [...services, ...places] });
  } catch (err) {
    console.error('Unexpected error fetching subcategories:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ✅ GET /api/business/:id - Fetch full business detail
router.get('/business/:id', async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Missing business ID.' });
  }

  try {
    // Fetch main detail
    const { data: detail, error: detailErr } = await supabase
      .from('details')
      .select(`
        *,
        service_category:service_categories!details_service_category_id_fkey(icon_url, label),
        place_category:place_categories!details_place_category_id_fkey(icon_url, label),
        detail_amenities (
          amenities (
            id,
            name,
            icon_url
          )
        ),
        bookings(id, note, price, booking_time)
      `)
      .eq('id', id)
      .single(); // We expect a single business

    if (detailErr) {
      console.error("🔥 Supabase error:", detailErr.message);
      return res.status(500).json({ error: detailErr.message });
    }

    if (!detail) {
      return res.status(404).json({ error: 'Business not found.' });
    }

    // Fetch reviews
    const { data: reviews, error: reviewErr } = await supabase
      .from('feedback')
      .select(`
        id,
        rating,
        comment,
        created_at,
        user:users(full_name, avatar_url)
      `)
      .eq('detail_id', id)
      .order('created_at', { ascending: false });


    if (reviewErr) {
      console.error("🔥 Supabase error (reviews):", reviewErr.message);
      return res.status(500).json({ error: reviewErr.message });
    }

    // Fetch booking options
    const { data: bookingOptions, error: bookingErr } = await supabase
      .from('service_booking_options')
      .select('*')
      .eq('detail_id', id);

    if (bookingErr) {
      console.error("🔥 Supabase error (booking options):", bookingErr.message);
      return res.status(500).json({ error: bookingErr.message });
    }

    // Return combined object
    return res.status(200).json({
      ...detail,
      reviews: reviews || [],
      bookingOptions: bookingOptions || [],
    });

  } catch (err) {
    console.error("🔥 Unexpected error:", err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
