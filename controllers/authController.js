import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import supabase from '../utils/supabaseClient.js';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
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
export const signup = async (req, res, next) => {
  const { email, password, fullName, role } = req.body;

  if (!email || !password || !fullName)
    return res.status(400).json({ message: 'All fields are required' });

  try {
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching user:', fetchError);
      throw fetchError;
    }

    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{ email, full_name: fullName, password: hashedPassword, role }])
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting user:', insertError);
      throw insertError;
    }

    // ✅ Include `id` in token
    const token = jwt.sign(
      {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.full_name,
        role: newUser.role,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.cookie('token', token, COOKIE_OPTIONS);

    res.json({
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.full_name,
        role: newUser.role,
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    next(err);
  }
};

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

    if (error || !user)
      return res.status(401).json({ message: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(401).json({ message: 'Invalid credentials' });

    // ✅ Include `id` in token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.cookie('token', token, COOKIE_OPTIONS);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getProfile = async (req, res, next) => {
  const { email } = req.user;

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, role')
      .eq('email', email)
      .single();

    if (error || !user)
      return res.status(404).json({ message: 'User not found' });

    res.json({ user });
  } catch (err) {
    next(err);
  }
};
export const logout = async (req, res) => {
  res.clearCookie('token'); // or however your session/token is stored
  return res.status(200).json({ message: 'Logged out successfully' });
};
