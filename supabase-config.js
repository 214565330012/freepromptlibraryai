/* Public Supabase client configuration. The publishable key is designed for browser use.
   Database security is enforced by the RLS policies in supabase/setup.sql. */
window.SUPABASE_URL = 'https://poktxcaedrrhwfgbiosz.supabase.co';
window.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_4fKPJL2HrWg0-TI90Y2uLw_VyM5xtHn';
window.supabaseClient = window.supabaseClient || window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_PUBLISHABLE_KEY
);
