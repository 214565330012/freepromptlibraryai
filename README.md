# FreePromptLibraryAI

## Hosting and architecture
- Cloudflare Pages serves this static website.
- Supabase Auth handles Admin email/password sign-in.
- Supabase Postgres stores prompts and their bilingual detail sections.
- Supabase Storage bucket `prompt-images` stores public sample images, limited to 5 MB each.

## Supabase one-time setup
1. Open the Supabase project `poktxcaedrrhwfgbiosz`.
2. Open SQL Editor, create a new query, paste all of `supabase/setup.sql`, and Run it once.
3. The setup script creates tables, RLS policies, the public image bucket, and seeds the 52 prompts in this package. It uses your existing `public.admin_users` entry; it does not create an Admin user.
4. Deploy the full contents of this ZIP to the GitHub repository connected to Cloudflare Pages.
5. Open `https://YOUR-DOMAIN/admin/` and sign in with the Supabase Auth email/password you created.

## Important security notes
- `supabase-config.js` contains only the Supabase URL and publishable key. The publishable key is safe to include in browser code only because Row Level Security policies protect the database.
- Never put a Supabase secret/service-role key or database password in this repository or browser code.
- Admin access is checked against `public.admin_users`; only a matching signed-in user can manage prompts and upload images.
- If Admin login says no admin permission, verify that the signed-in user's UUID exists in `public.admin_users`.

## Admin features
- Email/password login and Admin membership verification.
- Add, edit, publish, draft, and delete prompts.
- English and Hindi title and prompt text.
- Prompt type, category, aspect ratio, duration, and trending toggle.
- Sample image upload (JPG/PNG/WebP/AVIF, maximum 5 MB).
- Additional bilingual detail sections with optional images.

## Notes
- The homepage hero/header CSS is preserved from the uploaded ZIP.
- Prompt details remain separate pages (`prompt.html?id=...`).
- The current Admin panel does not yet include automatic trend research or a scheduled publishing workflow.
