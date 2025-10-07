// controller: businessController.js
import supabase from '../utils/supabaseClient.js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// Set up multer for file handling (memory storage for buffer uploads)
const storage = multer.memoryStorage();
export const upload = multer({ storage });

// routes/business.js

export const onboardBusiness1 = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: "Missing form data" });
    }

    const { name = "", plan_id = "" } = req.body;

    if (!name || !plan_id) {
      return res.status(400).json({ message: "Required fields are missing" });
    }

    const owner_email = req.user?.email;
    if (!owner_email) {
      return res.status(401).json({ message: "Unauthorized: Missing user email" });
    }

    const logoFile = req.file;

    console.log("Form data received:", { name, plan_id, hasFile: !!logoFile });

    // 1. Check if business already exists
    const { data: existing } = await supabase
      .from("businesses")
      .select("*")
      .eq("owner_email", owner_email)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ message: "Business already onboarded" });
    }

    // 2. Upload logo if provided
    let logo_url = null;
    if (logoFile) {
      const fileExt = path.extname(logoFile.originalname);
      const fileName = `logos/${uuidv4()}${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("business-logos")
        .upload(fileName, logoFile.buffer, {
          contentType: logoFile.mimetype,
        });

      if (uploadError) throw new Error(`Upload error: ${uploadError.message}`);

      const { data: publicURLData } = supabase.storage
        .from("business-logos")
        .getPublicUrl(fileName);

      logo_url = publicURLData.publicUrl;
    }

    // 3. Insert new business
    const { data: business, error: businessErr } = await supabase
      .from("businesses")
      .insert([{ name, owner_email, logo_url }])
      .select()
      .single();

    if (businessErr) throw new Error(`Insert error: ${businessErr.message}`);

    // 4. Create subscription
    const { error: subErr } = await supabase
      .from("business_subscriptions")
      .insert([{
        business_id: business.id,
        plan_id,
        started_at: new Date().toISOString(),
        expires_at: null,
        is_active: true,
      }]);

    if (subErr) throw new Error(`Subscription error: ${subErr.message}`);

    // 5. Update user role to business
    const { error: roleErr, data: updatedUser } = await supabase
      .from("users")
      .update({ role: "business" })
      .eq("email", owner_email)
      .select()
      .single();

    if (roleErr) throw new Error(`Role update error: ${roleErr.message}`);

    return res.status(201).json({
      message: "Business onboarded",
      business,
      user: updatedUser,
    });
  } catch (err) {
    console.error("Onboarding Error:", err.message);
    return res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
};


export const onboardBusiness = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: 'Missing form data' });
    }

    const {
      name = '',
      plan_id = ''
    } = req.body;

    if (!name || !plan_id) {
      return res.status(400).json({ message: 'Required fields are missing' });
    }

    const owner_email = req.user?.email;
    if (!owner_email) {
      return res.status(401).json({ message: 'Unauthorized: Missing user email' });
    }

    const logoFile = req.file;

    console.log('Form data received:', {
      name, plan_id, hasFile: !!logoFile
    });

    // 1. Check if business already exists
    const { data: existing } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_email', owner_email)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ message: 'Business already onboarded' });
    }

    // 2. Upload logo to Supabase Storage if provided
    let logo_url = null;
    if (logoFile) {
      const fileExt = path.extname(logoFile.originalname);
      const fileName = `logos/${uuidv4()}${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('business-logos')
        .upload(fileName, logoFile.buffer, {
          contentType: logoFile.mimetype,
        });

      if (uploadError) throw new Error(`Upload error: ${uploadError.message}`);

      const { data: publicURLData } = supabase.storage
        .from('business-logos')
        .getPublicUrl(fileName);

      logo_url = publicURLData.publicUrl;
    }

    // 3. Insert new business
    const { data: business, error } = await supabase
      .from('businesses')
      .insert([{
        name,
        owner_email,
        logo_url
      }])
      .select()
      .single();

    if (error) throw new Error(`Insert error: ${error.message}`);

    // 4. Create subscription
    const { error: subErr } = await supabase
      .from('business_subscriptions')
      .insert([{
        business_id: business.id,
        plan_id,
        started_at: new Date().toISOString(),
        expires_at: null,
        is_active: true
      }]);

    if (subErr) throw new Error(`Subscription error: ${subErr.message}`);

    return res.status(201).json({ message: 'Business onboarded', business });
  } catch (err) {
    console.error('Onboarding Error:', err.message);
    return res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
};

export const getMyBusiness = async (req, res, next) => {
  try {
    const { email } = req.user;

    // Step 1: Get the business
    const { data: business, error: businessErr } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_email', email)
      .maybeSingle();

    if (businessErr || !business) {
      return res.status(404).json({ message: 'No business found' });
    }

    // Step 2: Get active subscription with plan
    const { data: subscription, error: subErr } = await supabase
      .from('business_subscriptions')
      .select(`
        *,
        subscription_plans (
          id, name, price, duration,
          allow_booking, allow_gallery, allow_video,
          allow_reviews, allow_social_links, allow_pricing_menu,
          allow_opening_hours, allow_coupons, featured_listing
        )
      `)
      .eq('business_id', business.id)
      .eq('is_active', true)
      .maybeSingle();

    if (subErr) {
      console.error('Subscription fetch error:', subErr.message);
      return res.status(500).json({ message: 'Failed to fetch subscription' });
    }

    const plan = subscription?.subscription_plans || null;
    console.log("Fetched plan:", plan);

    return res.status(200).json({ ...business, plan });

  } catch (err) {
    console.error('getMyBusiness error:', err.message);
    return res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
};


export const getServiceById = async (req, res) => {
  const serviceId = req.params.id;

  try {
    // 1. Fetch service detail
    const { data: detail, error } = await supabase
      .from('details')
      .select('*')
      .eq('id', serviceId)
      .maybeSingle();

    if (error || !detail) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // 2. Fetch associated images from media_assets (optional)
    const { data: mediaAssets, error: mediaErr } = await supabase
      .from('media_assets')
      .select('url')
      .eq('detail_id', serviceId)
      .eq('type', 'image');

    if (mediaErr) {
      console.warn('Could not fetch media assets:', mediaErr.message);
    }

    // Combine gallery_urls from details + media_assets
    const galleryFromField = Array.isArray(detail.gallery_urls)
      ? detail.gallery_urls
      : [];

    const galleryFromMedia = Array.isArray(mediaAssets)
      ? mediaAssets.map((m) => m.url)
      : [];

    const combinedGallery = [...galleryFromField, ...galleryFromMedia];

    return res.status(200).json({
      ...detail,
      gallery_urls: combinedGallery,
    });
  } catch (err) {
    console.error('getServiceById error:', err.message);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const updateService = async (req, res, next) => {
  const serviceId = req.params.id;
  const {
    name,
    contact,
    website,
    location,
    timings,
    status,
    tags,
    rating
  } = req.body;

  try {
    const { data: existing } = await supabase
      .from('details')
      .select('*')
      .eq('id', serviceId)
      .maybeSingle();

    if (!existing) return res.status(404).json({ message: 'Service not found' });

    const { error: updateErr } = await supabase
      .from('details')
      .update({
        name,
        contact,
        website,
        location,
        timings,
        status,
        tags,
        rating
      })
      .eq('id', serviceId);

    if (updateErr) throw updateErr;

    return res.status(200).json({ message: 'Service updated successfully' });
  } catch (err) {
    console.error('updateService error:', err.message);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};




export const addDetailForBusiness = async (req, res) => {
  try {
    const {
      name, location, contact, website, status, timings, rating, tags,
      latitude, longitude, booking_url,
      placeLabel, placeCategoryLabel, serviceLabel, serviceCategoryLabel,
    } = req.body;

    const bookings = req.body.bookings ? JSON.parse(req.body.bookings) : [];
    const selectedAmenities = req.body.selectedAmenities
      ? JSON.parse(req.body.selectedAmenities)
      : [];

    const owner_email = req.user.email;

    // 🔎 Get business and plan
    const { data: businessData, error: businessErr } = await supabase
      .from('businesses')
      .select(`id, business_subscriptions (is_active, subscription_plans (*))`)
      .eq('owner_email', owner_email)
      .maybeSingle();

    if (businessErr || !businessData)
      return res.status(404).json({ message: 'Business not found' });

    const businessId = businessData.id;
    const activeSubscription = (businessData.business_subscriptions || []).find(sub => sub.is_active);
    const plan = activeSubscription?.subscription_plans;
    if (!plan) return res.status(403).json({ message: 'No active subscription plan' });

    // 🖼️ Upload gallery images
    const galleryUrls = [];
    if (plan.allow_gallery && req.files?.galleryFiles) {
      for (const file of req.files.galleryFiles) {
        const ext = path.extname(file.originalname);
        const filename = `gallery/${uuidv4()}${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('service-gallery')
          .upload(filename, file.buffer, {
            contentType: file.mimetype,
          });
        if (uploadError) throw new Error(`Gallery upload failed: ${uploadError.message}`);
        const { data } = supabase.storage.from('service-gallery').getPublicUrl(filename);
        galleryUrls.push(data.publicUrl);
      }
    }

    // 🎥 Upload video
    let videoUrl = null;
    if (plan.allow_video && req.files?.videoFile?.[0]) {
      const file = req.files.videoFile[0];
      const ext = path.extname(file.originalname);
      const filename = `videos/${uuidv4()}${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('service-videos')
        .upload(filename, file.buffer, {
          contentType: file.mimetype,
        });
      if (uploadError) throw new Error(`Video upload failed: ${uploadError.message}`);
      const { data } = supabase.storage.from('service-videos').getPublicUrl(filename);
      videoUrl = data.publicUrl;
    }

    // 🏷️ Insert labels if new
    let placeCategory = null, serviceCategory = null;

    if (placeLabel && placeCategoryLabel) {
      const { data: place } = await supabase.from('places')
        .upsert({ label: placeLabel }, { onConflict: ['label'] }).select().single();
      const { data: pc } = await supabase.from('place_categories')
        .upsert({ label: placeCategoryLabel, place_id: place.id }, { onConflict: ['label'] }).select().single();
      placeCategory = pc;
    }

    if (serviceLabel && serviceCategoryLabel) {
      const { data: service } = await supabase.from('services')
        .upsert({ label: serviceLabel }, { onConflict: ['label'] }).select().single();
      const { data: sc } = await supabase.from('service_categories')
        .upsert({ label: serviceCategoryLabel, service_id: service.id }, { onConflict: ['label'] }).select().single();
      serviceCategory = sc;
    }

    // 📦 Create detail record
    const detailPayload = {
      business_id: businessId,
      name, location, contact, website, status, timings,
      rating: parseFloat(rating) || null,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      tags: typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags || [],
      booking_url: plan.allow_booking ? booking_url || null : null,
      video_url: videoUrl,
      gallery_urls: galleryUrls,
    };

    if (placeCategory?.id) detailPayload.place_category_id = placeCategory.id;
    if (serviceCategory?.id) detailPayload.service_category_id = serviceCategory.id;

    const { data: newDetail, error: insertErr } = await supabase
      .from('details')
      .insert([detailPayload])
      .select()
      .single();

    if (insertErr) throw new Error(`Insert error: ${insertErr.message}`);

    // 💬 Booking options
    if (plan.allow_booking && bookings.length > 0) {
      const bookingOptions = bookings.map(b => ({
        id: b.id,
        detail_id: newDetail.id,
        type: b.type,
        price: parseFloat(b.price),
        note: b.note
      }));
      const { error: bookErr } = await supabase.from('service_booking_options').insert(bookingOptions);
      if (bookErr) throw new Error(`Booking options error: ${bookErr.message}`);
    }

    // 🛎️ Insert amenities
    if (Array.isArray(selectedAmenities) && selectedAmenities.length > 0) {
      const amenityRelations = selectedAmenities.map(amenityId => ({
        detail_id: newDetail.id,
        amenity_id: amenityId
      }));
      const { error: amenityErr } = await supabase
        .from('detail_amenities')
        .insert(amenityRelations);

      if (amenityErr) throw new Error(`Amenity association error: ${amenityErr.message}`);
    }

    return res.status(201).json({ message: 'New service and booking options added successfully' });

  } catch (err) {
    console.error('addDetailForBusiness error:', err.message);
    return res.status(500).json({ message: 'Server Error', error: err.message });
  }
};


export const getAlertsForService = async (req, res) => {
  const { id } = req.params;

  try {

   const { data, error } = await supabase
  .from('service_dashboard_alerts')
  .select(`
    *,
    service_bookings (
      status,
      created_at,
      user_id
    )
  `)
  .eq('detail_id', id)
  .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
};

export const getTodayFeedbacks = async (req, res) => {
  const { detailId } = req.params;

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    const { data, error } = await supabase
      .from('feedback')
      .select(`
        id,
        rating,
        comment,
        created_at,
        users(full_name),
        service_bookings(status)
      `)
      .eq('detail_id', detailId)
      .gte('created_at', `${today}T00:00:00Z`)
      .lte('created_at', `${today}T23:59:59Z`);

    if (error) return res.status(400).json({ error: error.message });

    res.status(200).json(data);
  } catch (err) {
    console.error('Fetch feedbacks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
