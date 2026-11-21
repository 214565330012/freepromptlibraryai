FreePromptLibraryAI — Update Guide (Gujarati)

આ ZIP તમારી હાલની Website પરથી તૈયાર કરેલો સુધારેલો Project છે. GitHub/Cloudflare પર મૂક્તા પહેલાં હાલની ચાલતી Website ની ZIP Backup રાખો.

1) GitHub Update
- GitHub Repository ખોલો: 214565330012/freepromptlibraryai (branch: main).
- હાલની Repository ની Backup ZIP અલગ રાખો.
- આ ZIP Extract કરો.
- Extract થયેલા freepromptlibraryai-main ફોલ્ડરની અંદરની ફાઇલો અને ફોલ્ડર્સ Repository ના Root માં Upload કરો; ફોલ્ડરનું outer wrapper `freepromptlibraryai-main/` બનાવીને nested upload ન કરશો.
- હાલના સમાન paths ની ફાઇલો replace થવી જોઈએ. ખાસ: `index.html`, `app.js`, `styles.css`, `prompt.html`, `detail.js`, `detail.css`, `admin/index.html`, `admin/admin.js`, `admin/admin.css`, `supabase-config.js`, `_redirects`, `404.html`.
- Commit કર્યા પછી Cloudflare Pages Deployment Success થાય તેની રાહ જુઓ.

2) Supabase Database Migration — એક જ વાર
- Supabase Project > SQL Editor > New Query ખોલો.
- આ Project ની `supabase/admin-upgrade-migration.sql` ફાઇલ ખોલો.
- આખો કોડ Paste કરીને Run કરો.
- `supabase/setup.sql` ફરીથી Run ન કરશો; હાલનો Admin User અને 52 Prompt records પહેલેથી છે.
- Migration additive છે: હાલના Prompts/Admin User ને delete અથવા overwrite કરતી નથી; નવા fields, Homepage Builder, Analytics tables/functions ઉમેરે છે.

3) પછી ચકાસો
- Homepage: https://freepromptlibraryai.pages.dev
- Admin: https://freepromptlibraryai.pages.dev/admin/
- Admin માં Sign In, All Prompts (1,2,3… ID ascending), Add/Edit/Delete, sample image upload, Homepage Builder અને Analytics ચકાસો.
- Admin Email/Password reset flow Supabase-managed છે.
- Image upload JPG, PNG, WebP અથવા AVIF; per-file max 5 MB.
- Existing storage bucket `prompt-images` વપરાય છે.

Language note:
- English/Hindi switch હાલના fixed Website UI labels ને બદલે છે.
- જૂના records માં `title_hi`/`prompt_hi` હશે તો Hindi mode માં એ ઉપયોગ થાય છે.
- નવા Admin prompt માટે એક જ content box છે; તેમાં તમે જે ભાષા લખશો તે જ દેખાશે. User-written prompt/About/How-to/custom section નું auto-translation આ ZIP માં નથી; તેના માટે અલગ translation service/API key જોઈએ.
- Dark mode પસંદગી browser localStorage માં સાચવાય છે.

Analytics note:
- Analytics page `page_views` માં anonymous random visitor UUID અને page path/time નોંધે છે; IP, નામ કે email track કરતું નથી.
- Unique visitors browser/device આધારિત અંદાજ છે (localStorage/browser બદલવાથી ગણતરી બદલાઈ શકે). Bots/automated traffic સંપૂર્ણ રીતે ફિલ્ટર થતું નથી.

Security:
- `supabase-config.js` માં ફક્ત Supabase Publishable Key છે. Secret/service_role key ક્યારેય browser code માં ન મૂકો.
- `_redirects` `/supabase/*` પરની SQL files ને public Pages URL પરથી 404 આપે છે.
