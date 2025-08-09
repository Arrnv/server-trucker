// server/utils/supabaseAdmin.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // ⚠️ Use the service role key here, NOT anon key
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export default supabaseAdmin;
