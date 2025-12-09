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

// ---------------- SERVICES ----------------
// Get top-level services or places
router.get("/roots", async (req, res) => {
  try {
    const { type } = req.query;

    if (type === "service") {
      const { data, error } = await supabase.from("services").select("id, label, icon_url");
      if (error) throw error;
      return res.json({ data });
    } else if (type === "place") {
      const { data, error } = await supabase.from("places").select("id, label, icon_url");
      if (error) throw error;
      return res.json({ data });
    }

    res.status(400).json({ error: "Invalid type" });
  } catch (err) {
    console.error("🔥 roots error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get categories for a given service or place
router.get("/categories", async (req, res) => {
  try {
    const { type, root_id } = req.query;

    if (type === "service") {
      const { data, error } = await supabase
        .from("service_categories")
        .select("id, label, icon_url")
        .eq("service_id", root_id);
      if (error) throw error;
      return res.json({ data });
    } else if (type === "place") {
      const { data, error } = await supabase
        .from("place_categories")
        .select("id, label, icon_url")
        .eq("place_id", root_id);
      if (error) throw error;
      return res.json({ data });
    }

    res.status(400).json({ error: "Invalid type" });
  } catch (err) {
    console.error("🔥 categories error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/servicesapp", async (req, res) => {
  try {
    const { category_id, lat_min, lat_max, lng_min, lng_max, limit = 20, offset = 0 } = req.query;

    let query = supabase
      .from("details")
      .select(`
        id,
        name,
        rating,
        location,
        latitude,
        longitude,
        service_category:service_categories (
          label,
          icon_url,
          service:services ( label )
        )
      `)
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    // --- START: NEW MULTI-CATEGORY FILTER LOGIC (Pure JS) ---
    if (category_id) {
        let categoryIdsArray = [];

        if (Array.isArray(category_id)) {
            // Case 1: Framework parsed into an array (e.g., ?category_id[]=id1&category_id[]=id2)
            categoryIdsArray = category_id;
        } else if (typeof category_id === 'string' && category_id.includes(',')) {
            // Case 2: Framework joined multiple category_id params into a comma-separated string
            categoryIdsArray = category_id.split(',').filter(id => id.trim() !== '');
        } else {
            // Case 3: Single category ID passed as a string
            categoryIdsArray = [category_id];
        }
        
        // Use the 'in' filter for multiple values
        if (categoryIdsArray.length > 0) {
            query = query.in("service_category_id", categoryIdsArray);
        }
    }
    // --- END: NEW MULTI-CATEGORY FILTER LOGIC ---
    
    if (lat_min && lat_max && lng_min && lng_max) {
      query = query
        .gte("latitude", Number(lat_min))
        .lte("latitude", Number(lat_max))
        .gte("longitude", Number(lng_min))
        .lte("longitude", Number(lng_max));
    }

    const { data, error } = await query;
    if (error) throw error;

    const flatData = data.map(d => ({
      id: d.id,
      name: d.name,
      category: d.service_category?.service?.label,
      subcategory: d.service_category?.label,
      address: d.location,
      latitude: d.latitude,
      longitude: d.longitude,
      icon: d.service_category?.icon_url || null,
      type: "service",
      rating: d.rating ?? null,
    }));

    res.json({ data: flatData });
  } catch (err) {
    console.error("🔥 servicesapp error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete('/users/:id', async (req, res) => {
  const userId = req.params.id;

  try {
    // 1️⃣ Fetch user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userEmail = user.email;

    // 2️⃣ Fetch user's business (if any)
    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_email', userEmail);

    if (businessError) throw businessError;

    const businessId = businesses?.[0]?.id;

    if (businessId) {
      // 3️⃣ Fetch details of the business
      const { data: details, error: detailsError } = await supabase
        .from('details')
        .select('id')
        .eq('business_id', businessId);

      if (detailsError) throw detailsError;

      const detailIds = details.map(d => d.id);

      if (detailIds.length > 0) {
        // 4️⃣ Delete all related child data for all details in batch
        await supabase.from('service_dashboard_alerts').delete().in('detail_id', detailIds);
        await supabase.from('service_bookings').delete().in('detail_id', detailIds);
        await supabase.from('feedback').delete().in('detail_id', detailIds);
        await supabase.from('media_assets').delete().in('detail_id', detailIds);
        await supabase.from('detail_amenities').delete().in('detail_id', detailIds);
        await supabase.from('analytics_events').delete().in('detail_id', detailIds);
      }

      // 5️⃣ Delete details
      await supabase.from('details').delete().eq('business_id', businessId);

      // 6️⃣ Delete business subscriptions
      await supabase.from('business_subscriptions').delete().eq('business_id', businessId);

      // 7️⃣ Delete business
      await supabase.from('businesses').delete().eq('id', businessId);
    }

    // 8️⃣ Delete user-related bookings, feedback, analytics not tied to business
    await supabase.from('service_bookings').delete().eq('user_id', userId);
    await supabase.from('feedback').delete().eq('user_id', userId);
    await supabase.from('analytics_events').delete().eq('user_id', userId);

    // 9️⃣ Delete the user
    const { error: deleteUserError } = await supabase.from('users').delete().eq('id', userId);
    if (deleteUserError) throw deleteUserError;

    res.json({ message: 'User and all related data deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * GET /api/placesapp (MODIFIED - Pure JS logic for category_id parsing)
 */
router.get("/placesapp", async (req, res) => {
  try {
    const { category_id, lat_min, lat_max, lng_min, lng_max, limit = 20, offset = 0 } = req.query;

    let query = supabase
      .from("details")
      .select(`
        id,
        name,
        rating,
        location,
        latitude,
        longitude,
        place_category:place_categories (
          label,
          icon_url,
          place:places ( label )
        )
      `)
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    // --- START: NEW MULTI-CATEGORY FILTER LOGIC (Pure JS) ---
    if (category_id) {
        let categoryIdsArray = [];

        if (Array.isArray(category_id)) {
            categoryIdsArray = category_id;
        } else if (typeof category_id === 'string' && category_id.includes(',')) {
            categoryIdsArray = category_id.split(',').filter(id => id.trim() !== '');
        } else {
            categoryIdsArray = [category_id];
        }
        
        // Use the 'in' filter for multiple values
        if (categoryIdsArray.length > 0) {
            query = query.in("place_category_id", categoryIdsArray);
        }
    }
    // --- END: NEW MULTI-CATEGORY FILTER LOGIC ---

    if (lat_min && lat_max && lng_min && lng_max) {
      query = query
        .gte("latitude", Number(lat_min))
        .lte("latitude", Number(lat_max))
        .gte("longitude", Number(lng_min))
        .lte("longitude", Number(lng_max));
    }

    const { data, error } = await query;
    if (error) throw error;

    const flatData = data.map(d => ({
      id: d.id,
      name: d.name,
      category: d.place_category?.place?.label,
      subcategory: d.place_category?.label,
      address: d.location,
      latitude: d.latitude,
      longitude: d.longitude,
      icon: d.place_category?.icon_url || null,
      type: "place",
      rating: d.rating ?? null,
    }));

    res.json({ data: flatData });
  } catch (err) {
    console.error("🔥 placesapp error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
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

// GET /place-categories
router.get("/place-categories", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("place_categories")
      .select("id, label, icon_url")
      .order("label", { ascending: true });

    if (error) throw error;

    
    res.json({
      data: data.map((cat) => ({
        id: cat.id,
        label: cat.label,
        icon_url: cat.icon_url,
        type: "place",
      })),
    });
  } catch (err) {
    console.error("🔥 place categories error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
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
// GET /api/detail/:id
router.get('/detail/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // 1️⃣ Fetch detail
    const { data: detail, error } = await supabase
      .from('details')
      .select(`
        *,
        gallery_urls,
        bookings:service_bookings (
          id,
          note,
          price,
          booking_time
        ),
        service_category:service_categories (
          id,
          label,
          icon_url
        ),
        place_category:place_categories (
          id,
          label,
          icon_url
        ),
        detail_amenities (
          amenities (
            id,
            name,
            icon_url
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error("🔥 Supabase Fetch Error:", error.message);
      return res.status(500).json({ error: error.message });
    }

    // 2️⃣ Fetch business separately
    let business = null;
    if (detail.business_id) {
      const { data, error: businessError } = await supabase
        .from('businesses')
        .select('id, name, logo_url')
        .eq('id', detail.business_id)
        .single();

      if (businessError) console.warn("⚠️ Failed to fetch business:", businessError.message);
      else business = data;
    }

    // 3️⃣ Attach business to detail
    detail.business = business;

    return res.status(200).json(detail);

  } catch (err) {
    console.error("🔥 detail fetch error:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});
router.get('/details/:type', async (req, res) => {
  const { type } = req.params;
  const ids = req.query.ids;

  if (!ids) return res.status(400).json({ error: 'Missing ids query param.' });

  const column = type === 'service' ? 'service_category_id' : type === 'place' ? 'place_category_id' : null;
  if (!column) return res.status(400).json({ error: 'Invalid type. Must be "service" or "place".' });

  const idArray = ids.split(',');

  try {
    console.log('Fetching details for column:', column, 'ids:', idArray);

    const { data: details, error } = await supabase
      .from('details')
      .select(`
        *,
        bookings:service_bookings (
          id,
          note,
          price,
          status,
          created_at,
          updated_at,
          option_id,
          option_title
        ),
        service_category:service_categories (
          id,
          label,
          icon_url
        ),
        place_category:place_categories (
          id,
          label,
          icon_url
        ),
        detail_amenities (
          amenities (
            id,
            name,
            icon_url
          )
        )
      `)
      .in(column, idArray);

    if (error) {
      console.error("Supabase details fetch error:", error);
      return res.status(500).json({ error: error.message });
    }

    console.log('Details fetched:', details.length);

    const businessIds = [...new Set(details.map(d => d.business_id).filter(Boolean))];
    console.log('Business IDs to fetch:', businessIds);

    let businessesMap = {};
    if (businessIds.length > 0) {
      const { data: businesses, error: businessError } = await supabase
        .from('businesses')
        .select('id, name, logo_url')
        .in('id', businessIds);

      if (businessError) {
        console.error("Supabase business fetch error:", businessError);
        return res.status(500).json({ error: businessError.message });
      }

      businessesMap = businesses.reduce((acc, b) => {
        acc[b.id] = b;
        return acc;
      }, {});
    }

    const detailsWithBusiness = details.map(d => ({
      ...d,
      business: businessesMap[d.business_id] || null
    }));

    return res.status(200).json(detailsWithBusiness);

  } catch (err) {
    console.error("Unexpected server error:", err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
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
  business:business_id (
    id,
    name,
    logo_url
  ),
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
