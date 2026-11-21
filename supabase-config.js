/* Public Supabase client configuration.
   Database security is enforced by Row Level Security (RLS) policies.
   Uses the official Supabase JS SDK loaded via CDN. */

window.SUPABASE_URL = 'https://poktxcaedrrhwfgbiosz.supabase.co';
window.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_4fKPJL2HrWg0-TI90Y2uLw_VyM5xtHn';

// Initialize Supabase Client once SDK is loaded
function initSupabase() {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    window.supabaseClient = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_PUBLISHABLE_KEY
    );
  }
}

initSupabase();
