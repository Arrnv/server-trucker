import supabase from '../utils/supabaseClient.js';

// Get all reviews for a business
const getReviewsByBusiness = async (req, res) => {
  try {
    const { businessId } = req.params;
    
    if (!businessId) {
      return res.status(400).json({ message: 'Business ID is required' });
    }

    const { data, error } = await supabase
      .from('reviews')
      .select('id, user_id, business_id, full_name, rating, comment, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reviews:', error);
      return res.status(500).json({ error: error.message });
    }

    // Make sure all reviews have a display name and no emails are exposed
    const sanitizedReviews = data.map(review => {
      // If full_name contains an email (has @ symbol), replace with "Anonymous"
      const fullName = review.full_name && review.full_name.includes('@') 
        ? 'Anonymous' 
        : (review.full_name || 'Anonymous');
      
      return {
        ...review,
        full_name: fullName,
        // Remove any email fields if they exist
        email: undefined
      };
    });

    return res.status(200).json(sanitizedReviews);
  } catch (error) {
    console.error('Error in getReviewsByBusiness:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Add a new review
const addReview = async (req, res) => {
  try {
    const { businessId, rating, comment, full_name } = req.body;
    
    // Log the user object to understand what we're getting from auth middleware
    console.log('User from auth middleware:', req.user);
    
    const userId = req.user.id; // Assuming you have user info from auth middleware
    console.log('User ID:', userId);
    
    // Check if required parameters are provided
    if (!businessId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Valid business ID and rating (1-5) are required' });
    }

    // First verify if the user exists in the users table
    const { data: userExists, error: userCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (userCheckError) {
      console.error('Error checking user:', userCheckError);
      return res.status(500).json({ error: userCheckError.message });
    }

    if (!userExists) {
      console.log('User not found in users table:', userId);
      return res.status(400).json({ message: 'User not found in the system' });
    }

    // Check if user has already reviewed this business
    const { data: existingReview, error: reviewCheckError } = await supabase
      .from('reviews')
      .select()
      .eq('user_id', userId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (reviewCheckError) {
      console.error('Error checking existing review:', reviewCheckError);
      return res.status(500).json({ error: reviewCheckError.message });
    }

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this business' });
    }

    // Get user's real name from the users table if possible
    let displayName = full_name || 'Anonymous';
    
    // Check if the name looks like an email
    if (displayName.includes('@')) {
      // Try to get the user's name from the users table
      const { data: userData, error: userNameError } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', userId)
        .single();
      
      if (!userNameError && userData && userData.full_name) {
        displayName = userData.full_name;
      } else {
        displayName = 'Anonymous';
      }
    }
    
    // Add new review
    const { data, error } = await supabase
      .from('reviews')
      .insert([
        { 
          user_id: userId,
          business_id: businessId,
          full_name: displayName,
          rating,
          comment
        }
      ])
      .select();

    if (error) {
      console.error('Error adding review:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error in addReview:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Update a review
const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id; // From auth middleware
    
    if (!id || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Valid review ID and rating (1-5) are required' });
    }

    // First verify if the user exists in the users table
    const { data: userExists, error: userCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (userCheckError) {
      console.error('Error checking user:', userCheckError);
      return res.status(500).json({ error: userCheckError.message });
    }

    if (!userExists) {
      console.log('User not found in users table:', userId);
      return res.status(400).json({ message: 'User not found in the system' });
    }

    // Check if the review belongs to the user
    const { data: existingReview, error: reviewCheckError } = await supabase
      .from('reviews')
      .select()
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingReview) {
      return res.status(404).json({ message: 'Review not found or you are not authorized to update it' });
    }

    // If full_name was included in the request, sanitize it
    const { full_name } = req.body;
    const updateData = { 
      rating, 
      comment,
      updated_at: new Date() 
    };
    
    // If full_name is being updated, sanitize it
    if (full_name !== undefined) {
      let displayName = full_name || existingReview.full_name || 'Anonymous';
      
      // Check if the name looks like an email
      if (displayName.includes('@')) {
        // Try to get the user's name from the users table
        const { data: userData, error: userNameError } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', userId)
          .single();
        
        if (!userNameError && userData && userData.full_name) {
          displayName = userData.full_name;
        } else {
          displayName = 'Anonymous';
        }
      }
      
      updateData.full_name = displayName;
    }
    
    // Update the review
    const { data, error } = await supabase
      .from('reviews')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error updating review:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data[0]);
  } catch (error) {
    console.error('Error in updateReview:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Get user's review for a specific business
const getUserReviewForBusiness = async (req, res) => {
  try {
    const { businessId } = req.params;
    const userId = req.user.id; // From auth middleware
    
    if (!businessId) {
      return res.status(400).json({ message: 'Business ID is required' });
    }

    // First verify if the user exists in the users table
    const { data: userExists, error: userCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (userCheckError) {
      console.error('Error checking user:', userCheckError);
      return res.status(500).json({ error: userCheckError.message });
    }

    if (!userExists) {
      console.log('User not found in users table:', userId);
      return res.status(400).json({ message: 'User not found in the system' });
    }

    const { data, error } = await supabase
      .from('reviews')
      .select('id, rating, comment, created_at, updated_at, full_name')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user review:', error);
      return res.status(500).json({ error: error.message });
    }

    // If the review exists, make sure we sanitize any potential email in full_name
    if (data) {
      // If full_name contains an email (has @ symbol), replace with the user's actual name
      if (data.full_name && data.full_name.includes('@')) {
        // Get user's actual name from the users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', userId)
          .single();
        
        if (!userError && userData && userData.full_name) {
          data.full_name = userData.full_name;
        } else {
          data.full_name = 'Anonymous';
        }
      }
    }

    return res.status(200).json(data || null);
  } catch (error) {
    console.error('Error in getUserReviewForBusiness:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

export {
  getReviewsByBusiness,
  addReview,
  updateReview,
  getUserReviewForBusiness
};