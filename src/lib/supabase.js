import { createClient } from '@supabase/supabase-js';

// Lazy-initialized Supabase client — avoids crash during Netlify build
// when env vars aren't available at build time
let _supabase = null;

export function getSupabase() {
  if (!_supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
    }

    _supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _supabase;
}

// For backward compatibility — lazy proxy
export const supabase = new Proxy({}, {
  get(_, prop) {
    return getSupabase()[prop];
  },
});
