/* Browser-safe Supabase client configuration.
   Only the publishable key belongs here. Never put a service_role/secret key in this file.
   Database access is restricted by the Supabase Row Level Security policies. */
window.SUPABASE_URL = 'https://poktxcaedrrhwfgbiosz.supabase.co';
window.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_4fKPJL2HrWg0-TI90Y2uLw_VyM5xtHn';
if (window.supabase && typeof window.supabase.createClient === 'function') {
  window.supabaseClient = window.supabaseClient || window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_PUBLISHABLE_KEY
  );
} else {
  console.error('Supabase JavaScript SDK did not load. Check the CDN script request.');
}
