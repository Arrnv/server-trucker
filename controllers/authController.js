import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import supabase from '../utils/supabaseClient.js';
import dotenv from 'dotenv';
import axios from "axios";
import supabaseAdmin from '../utils/supabaseAdmin.js';
dotenv.config();

// const COOKIE_OPTIONS = {
//   httpOnly: true,
//   secure: false ,
//   sameSite: 'Lax',
//   maxAge: 60 * 60 * 1000, 
// };


const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'None',
  domain: 'api.desi22.com',   
  path: '/',               // ✅ cookie valid for entire site
  maxAge: 60 * 60 * 1000,  // 1 hour
};

const JWT_SECRET = process.env.JWT_SECRET;

export const signup = async (req, res, next) => {
  const { email, password, fullName, role } = req.body;
  if (!email || !password || !fullName)
    return res.status(400).json({ message: "All fields required" });

  try {
    // 1️⃣ Check if user exists
    const { data: existingUser, error: existingError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (existingError) throw existingError;

    // 2️⃣ If user exists and same role → block
    if (existingUser && existingUser.role === role) {
      return res.status(400).json({ message: "User already exists with this role" });
    }

    // 3️⃣ If user exists as visitor and wants business → UPGRADE
    if (existingUser && existingUser.role === "visitor" && role === "business") {
      const { data: updatedUser, error: updateError } = await supabase
        .from("users")
        .update({ role: "business" })
        .eq("email", email)
        .select()
        .single();

      if (updateError) throw updateError;

      const token = jwt.sign({
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.full_name,
        role: updatedUser.role,
      }, JWT_SECRET, { expiresIn: "1h" });

      // ✅ Cookie + token in response
      res.cookie("token", token, COOKIE_OPTIONS);
      return res.json({ user: updatedUser, token, message: "Role upgraded to business" });
    }

    // 4️⃣ Invalid role transition
    if (existingUser) {
      return res.status(400).json({ message: "User already exists with a different role" });
    }

    // 5️⃣ Normal signup
    const hashedPassword = await bcrypt.hash(password, 10);
    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert([{ email, full_name: fullName, password: hashedPassword, role }])
      .select()
      .single();

    if (insertError) throw insertError;

    const token = jwt.sign({
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.full_name,
      role: newUser.role,
    }, JWT_SECRET, { expiresIn: "1h" });

    res.cookie("token", token, COOKIE_OPTIONS);
    res.json({ user: newUser, token });

  } catch (err) {
    console.error("Signup error:", err);
    next(err);
  }
};

// ----------------- login -----------------
export const login = async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password required' });

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) return res.status(401).json({ message: 'Invalid credentials' });
    if (!user.password) return res.status(401).json({ message: 'Use Google sign-in for this account' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    }, JWT_SECRET, { expiresIn: '1h' });

    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ user, token }); // ✅ Return token in response for Bearer auth
  } catch (err) {
    next(err);
  }
};

// ----------------- profile -----------------
export const getProfile = async (req, res, next) => {
  const { email } = req.user || {};
  if (!email) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, avatar_url')
      .eq('email', email)
      .single();

    if (error || !user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
};
// ----------------- logout -----------------
export const logout = async (req, res) => {
  res.clearCookie('token');
  return res.status(200).json({ message: 'Logged out successfully' });
};

// ----------------- start Google OAuth (redirect user to Google) -----------------
import querystring from 'querystring';


// ----------------- Start Google OAuth -----------------
export const startGoogleLogin = async (req, res) => {
  const role = req.query.role || "visitor";
  const intent = req.query.intent || "login";
  const platform = req.query.platform || "web";
  const mobileRedirectUri = req.query.redirect_uri || null;

  const redirectUri = `${process.env.BACKEND_URL}/api/auth/google/callback`;
  const state = encodeURIComponent(
    JSON.stringify({ role, intent, platform, mobileRedirectUri })
  );

  const params = {
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
    state,
  };

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${querystring.stringify(
    params
  )}`;

  return res.redirect(authUrl);
};

// ----------------- Google Callback -----------------
export const googleCallback = async (req, res, next) => {
  const { code, state: stateParam } = req.query;
  if (!code) return res.status(400).json({ message: "Missing code" });

  try {
    // Parse state
    let role = "visitor";
    let intent = "login";
    let platform = "web";
    let mobileRedirectUri = null;

    if (stateParam) {
      try {
        const parsedState = JSON.parse(decodeURIComponent(stateParam));
        role = parsedState.role || role;
        intent = parsedState.intent || intent;
        platform = parsedState.platform || platform;
        mobileRedirectUri = parsedState.mobileRedirectUri || null;
      } catch (e) {
        console.warn("Failed to parse OAuth state param:", e.message);
      }
    }

    // Exchange code for tokens
    const tokenRes = await axios.post(
      "https://oauth2.googleapis.com/token",
      null,
      {
        params: {
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
          redirect_uri: `${process.env.BACKEND_URL}/api/auth/google/callback`,
        },
      }
    );

    const { id_token } = tokenRes.data;
    const userInfo = JSON.parse(
      Buffer.from(id_token.split(".")[1], "base64").toString()
    );

    const email = userInfo.email;
    const fullName = userInfo.name || "";
    const avatarUrl = userInfo.picture || null;
    const googleId = userInfo.sub || null;

    // ----------------- Check user -----------------
    const { data: existingUser, error: selectErr } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    if (selectErr) throw selectErr;

    let dbUser = existingUser;

    // ----------------- Create new user if not exists -----------------
    if (!existingUser) {
      const { data: newUser, error: insertErr } = await supabaseAdmin
        .from("users")
        .insert([
          {
            email,
            full_name: fullName,
            password: null,
            role,
            google_id: googleId,
            avatar_url: avatarUrl,
          },
        ])
        .select()
        .single();
      if (insertErr) throw insertErr;
      dbUser = newUser;
    }

    // ----------------- Upgrade visitor → business -----------------
    if (existingUser && existingUser.role === "visitor" && role === "business") {
      const { data: upgradedUser, error: updateErr } = await supabaseAdmin
        .from("users")
        .update({ role: "business" })
        .eq("email", email)
        .select()
        .single();
      if (updateErr) throw updateErr;
      dbUser = upgradedUser;
    }

    // ----------------- Reject downgrade -----------------
    if (existingUser && existingUser.role === "business" && role === "visitor") {
      dbUser = existingUser; // keep as business
    }

    // ----------------- Generate JWT -----------------
    const token = jwt.sign(
      {
        id: dbUser.id,
        email: dbUser.email,
        fullName: dbUser.full_name,
        role: dbUser.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // ----------------- Dual Auth: Cookie + Bearer -----------------
    if (platform === "web") {
      // Cookie for web browsers
      res.cookie("token", token, COOKIE_OPTIONS);

      let redirectUrl = "/";
      if (dbUser.role === "business") {
        redirectUrl =
          intent === "signup" ? "/business/onboarding" : "/business/dashboard";
      } else if (dbUser.role === "admin") {
        redirectUrl = "/admin/dashboard";
      }

      // You could also pass token in query for SPA if needed
      return res.redirect(`${process.env.NEXT_PUBLIC_API_URL}${redirectUrl}`);
    }

    // ----------------- Mobile / other platforms -----------------
    if (platform === "mobile" && mobileRedirectUri) {
      // Send token in URL query for mobile app
      return res.redirect(`${mobileRedirectUri}?token=${token}`);
    }

    // ----------------- Fallback JSON -----------------
    return res.status(200).json({ user: dbUser, token });
  } catch (err) {
    console.error("Google OAuth error:", err.response?.data || err.message);
    next(err);
  }
};


// Start Apple login
export const startAppleLogin = async (req, res) => {
  const role = req.query.role || "visitor";
  const intent = req.query.intent || "login";
  const platform = req.query.platform || "web";
  const mobileRedirectUri = req.query.redirect_uri || null;

  const state = encodeURIComponent(
    JSON.stringify({ role, intent, platform, mobileRedirectUri })
  );

  const redirectUri = `${process.env.BACKEND_URL}/api/auth/apple/callback`;

  const params = {
    response_type: "code",
    response_mode: "form_post",
    client_id: process.env.APPLE_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "name email",
    state,
  };

  const authUrl = `https://appleid.apple.com/auth/authorize?${querystring.stringify(
    params
  )}`;
  return res.redirect(authUrl);
};

// Apple callback
// --- APPLE CALLBACK (email-only) ---
export const appleCallback = async (req, res, next) => {
  try {
    const { code, state: stateParam } = req.body; // POST body from Apple
    if (!code) return res.status(400).json({ message: "Missing code" });

    // --- Parse state ---
    let role = "visitor";
    let intent = "login";
    let platform = "web";
    let mobileRedirectUri = null;

    if (stateParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(stateParam));
        role = parsed.role || role;
        intent = parsed.intent || intent;
        platform = parsed.platform || platform;
        mobileRedirectUri = parsed.mobileRedirectUri || null;
      } catch (e) {
        console.warn("Failed to parse OAuth state:", e.message);
      }
    }

    // --- Generate client secret dynamically ---
    const clientSecret = jwt.sign(
      {
        iss: process.env.APPLE_TEAM_ID,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 180 * 24 * 60 * 60, // ~6 months
        aud: "https://appleid.apple.com",
        sub: process.env.APPLE_CLIENT_ID,
      },
      process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      {
        algorithm: "ES256",
        keyid: process.env.APPLE_KEY_ID,
      }
    );

    // --- Exchange code for token ---
    const tokenRes = await axios.post(
      "https://appleid.apple.com/auth/token",
      querystring.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${process.env.BACKEND_URL}/api/auth/apple/callback`,
        client_id: process.env.APPLE_CLIENT_ID,
        client_secret: clientSecret,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { id_token } = tokenRes.data;
    const appleUser = JSON.parse(
      Buffer.from(id_token.split(".")[1], "base64").toString()
    );

    const email = appleUser.email;
    const fullName = `${appleUser.name?.firstName || ""} ${appleUser.name?.lastName || ""}`.trim() || "Apple User";

    if (!email) {
      return res.status(400).json({ message: "Apple did not return an email" });
    }

    // --- Check if user exists by email ---
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    let dbUser = existingUser;

    if (!existingUser) {
      // --- Create new user ---
      const { data: newUser, error } = await supabaseAdmin
        .from("users")
        .insert([{ email, full_name: fullName, role }])
        .select()
        .single();
      if (error) throw error;
      dbUser = newUser;
    }

    // --- Create JWT token ---
    const token = jwt.sign(
      { id: dbUser.id, email: dbUser.email, fullName: dbUser.full_name, role: dbUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // --- Redirect based on platform ---
    if (platform === "web") {
      res.cookie("token", token, { httpOnly: true, secure: true });
      return res.redirect(`${process.env.NEXT_PUBLIC_API_URL}/`);
    }

    if (platform === "mobile" && mobileRedirectUri) {
      return res.redirect(`${mobileRedirectUri}?token=${token}`);
    }

    return res.status(200).json({ token, user: dbUser });

  } catch (err) {
    console.error("Apple OAuth error:", err.response?.data || err.message);
    next(err);
  }
};


export const appSignup = async (req, res, next) => {
  const { email, password, fullName, role } = req.body;
  if (!email || !password || !fullName) 
    return res.status(400).json({ message: 'All fields required' });

  try {
    const { data: existingUser, error: existingError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (existingError && existingError.code !== 'PGRST116') throw existingError;
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{ email, full_name: fullName, password: hashedPassword, role }])
      .select()
      .single();

    if (insertError) throw insertError;

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, fullName: newUser.full_name, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Return JWT and user info directly
    res.json({ token, user: { id: newUser.id, email: newUser.email, fullName: newUser.full_name, role: newUser.role } });
  } catch (err) {
    console.error('App signup error:', err);
    next(err);
  }
};

export const appLogin = async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) return res.status(401).json({ message: 'Invalid credentials' });
    if (!user.password) return res.status(401).json({ message: 'Use Google sign-in for this account' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, fullName: user.full_name, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Return JWT and user info
    res.json({ token, user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role } });
  } catch (err) {
    console.error('App login error:', err);
    next(err);
  }
};
