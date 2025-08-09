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
      .eq('business_id', businessId); // Assuming your 'details' table has business_id

    if (error) return res.status(500).json({ error: error.message });

    res.status(200).json(data);
  } catch (err) {
    console.error("🔥 Error fetching business services:", err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
// GET /api/booking-options/:detailId
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




export default router;
