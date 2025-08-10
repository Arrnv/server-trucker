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
  secure: true, // 
  sameSite: 'None', //
  maxAge: 60 * 60 * 1000, // 1 hour
};
const JWT_SECRET = process.env.JWT_SECRET;

// ----------------- signup (email/password) -----------------
export const signup = async (req, res, next) => {
  const { email, password, fullName, role } = req.body;
  if (!email || !password || !fullName) return res.status(400).json({ message: 'All fields required' });

  try {
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()
      .catch(() => ({ data: null }));

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

    res.cookie('token', token, COOKIE_OPTIONS);

    res.json({ user: { id: newUser.id, email: newUser.email, fullName: newUser.full_name, role: newUser.role } });
  } catch (err) {
    console.error('Signup error:', err);
    next(err);
  }
};

// ----------------- login (email/password) -----------------
export const login = async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) return res.status(401).json({ message: 'Invalid credentials' });

    // If user has no password (OAuth account), reject (they should use Google)
    if (!user.password) return res.status(401).json({ message: 'Use Google sign-in for this account' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email, fullName: user.full_name, role: user.role }, JWT_SECRET, { expiresIn: '1h' });

    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role } });
  } catch (err) {
    next(err);
  }
};

// ----------------- profile -----------------
export const getProfile = async (req, res, next) => {
  // auth middleware sets req.user
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

export const startGoogleLogin = async (req, res) => {
  const role = req.query.role || 'visitor'; // get role from query, fallback to visitor
  const redirectUri = `${process.env.BACKEND_URL}/api/auth/google/callback`;

  // encode role inside the 'state' param as JSON string (URI encoded)
  const state = encodeURIComponent(JSON.stringify({ role }));

  const params = {
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state,  // <--- include state with role here
  };

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${querystring.stringify(params)}`;

  return res.redirect(authUrl);
};

export const googleCallback = async (req, res, next) => {
  const { code, state: stateParam } = req.query;
  if (!code) return res.status(400).json({ message: "Missing code" });

  try {
    // Default role fallback
    let role = 'visitor';

    // Parse state param if exists to extract role
    if (stateParam) {
      try {
        const parsedState = JSON.parse(decodeURIComponent(stateParam));
        if (parsedState.role) role = parsedState.role;
      } catch (e) {
        console.warn('Failed to parse OAuth state param:', e.message);
      }
    }

    // 1️⃣ Exchange code for tokens
    const tokenRes = await axios.post("https://oauth2.googleapis.com/token", null, {
      params: {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${process.env.BACKEND_URL}/api/auth/google/callback`,
      },
    });

    const { id_token } = tokenRes.data;
    const userInfo = JSON.parse(Buffer.from(id_token.split(".")[1], "base64").toString());

    const email = userInfo.email;
    const fullName = userInfo.name || "";
    const avatarUrl = userInfo.picture || null;
    const googleId = userInfo.sub || null;

    // 2️⃣ Fetch existing user
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    let dbUser;

    // 3️⃣ If not exists → create with dynamic role from OAuth flow
    if (!existingUser) {
      const payload = {
        email,
        full_name: fullName,
        password: null,
        role, // <--- use dynamic role here
        google_id: googleId,
        avatar_url: avatarUrl,
      };

      const { data: newUser, error: insertError } = await supabaseAdmin
        .from("users")
        .insert([payload])
        .select()
        .single();

      if (insertError) throw insertError;
      dbUser = newUser;
    } else {
      // Update Google info if needed
      const updates = {};

      if (avatarUrl && existingUser.avatar_url !== avatarUrl) updates.avatar_url = avatarUrl;
      if (googleId && existingUser.google_id !== googleId) updates.google_id = googleId;

      if (Object.keys(updates).length > 0) {
        const { data: updatedUser, error: updateError } = await supabaseAdmin
          .from("users")
          .update(updates)
          .eq("id", existingUser.id)
          .select()
          .single();
        if (updateError) throw updateError;
        dbUser = updatedUser;
      } else {
        dbUser = existingUser;
      }
    }

    // 4️⃣ Create JWT
    const token = jwt.sign(
      { id: dbUser.id, email: dbUser.email, fullName: dbUser.full_name, role: dbUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 5️⃣ Decide redirect URL based on role
    let redirectUrl = "/";
    if (dbUser.role === "business") redirectUrl = "/business/onboarding";
    if (dbUser.role === "admin") redirectUrl = "/admin/dashboard";

    // 6️⃣ Set cookie & redirect
    res.cookie("token", token, COOKIE_OPTIONS);
    return res.redirect(`${process.env.NEXT_PUBLIC_API_URL}${redirectUrl}`);

  } catch (err) {
    console.error("Google OAuth error:", err.response?.data || err.message);
    next(err);
  }
};
