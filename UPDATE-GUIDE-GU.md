# FreePromptLibraryAI – Homepage Builder, Information Pages & Complaints Update

## What this update adds

- Editable homepage hero headings, subtitle, font family and heading sizes.
- Editable Search button text, gradient colors and hover/tap animation.
- Editable top navigation labels and links, including adding/removing buttons.
- Footer appearance controls (background/text colors, font and size), with a larger dark footer and subtle curved-line motif.
- Editable public About, Contact, Privacy, Terms, Disclaimer and DMCA pages.
- Public Contact page showing the configured contact email and a complaint/suggestion form.
- Complaint submissions stored in Supabase and visible to Admin under **Complaints**; admins can change status or delete a submission.
- Configurable WhatsApp, Instagram, Facebook and Threads links. The Follow Us section is shown when at least one valid social URL is saved.
- Complaint shortcut beside the homepage Search button.
- Existing homepage prompts, cards, navigation and Header layout are retained.

## Required order

1. **Back up the current GitHub repository first.** In GitHub, select Code → Download ZIP and keep that ZIP safely.
2. Run `supabase/homepage-control-complaints-migration.sql` once in Supabase → SQL Editor → New Query. This is additive: it creates `site_settings`, `content_pages` and `complaints`; it does not delete prompts, admin users, or existing tables.
3. Upload the project files from this ZIP to the GitHub repository root, preserving the folder structure. For a patch upload, replace files only at their matching paths.
4. Commit changes and wait for the newest Cloudflare Pages deployment to report Success.
5. Test the homepage, `/page.html?slug=contact`, `/admin/`, Homepage Builder saving, and a complaint submission. Then confirm the complaint appears in Admin → Complaints.

## Important notes

- Do **not** run the original `setup.sql`, `admin-upgrade-migration.sql` or `content-blocks-migration.sql` again. They were used in earlier setup stages.
- `homepage-control-complaints-migration.sql` requires the existing `public.is_admin()` helper created by the original setup. It uses the existing admin_users role check.
- Homepage settings and public links are readable by visitors; only authenticated admins can change them.
- Complaint submissions are public inserts with field-length checks and a honeypot field. Only admins can read, update or delete complaint records. For stronger spam prevention, add Cloudflare Turnstile/rate limiting before a high-traffic public launch.
- Complaints are stored in the Admin inbox. This update does not send automatic email notifications; that requires a separately configured email provider/Edge Function.
- The language switch translates the site's built-in interface labels. User-authored prompt text and information-page text are displayed exactly as entered; automatic translation of arbitrary user content requires a translation API.
- Do not put Supabase service-role/secret keys in frontend files. Keep only the public publishable key in `supabase-config.js`.

## Changed files

- `index.html`, `app.js`, `styles.css`
- `page.html`, `page.css`, `page.js`
- `admin/index.html`, `admin/admin.js`, `admin/admin.css`
- `supabase/homepage-control-complaints-migration.sql`

The other existing website files are included in the full ZIP to preserve the current project structure.
