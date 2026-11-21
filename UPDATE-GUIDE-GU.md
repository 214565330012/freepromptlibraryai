# FreePromptLibraryAI – Ordered Content Sections Update

## આ Update માં
- Admin prompt cards desktop પર 4 columns માં દેખાય છે.
- Admin card image `contain` mode માં છે જેથી આખી image દેખાય.
- Prompt editor માં જૂના `Add format`, `Add prompt`, અને અલગ `Extra information sections` controls દૂર કર્યા છે.
- એક વાદળી `Add Section` બટન નીચે રહે છે. તે ખોલતાં `Add Prompt` અથવા `Add About Section` પસંદ કરી શકાય છે.
- નવી sections જે ક્રમમાં ઉમેરાય છે તે જ ક્રમ `content_blocks` JSON array માં સાચવાય છે અને Prompt Detail Page પર દર્શાવાય છે.
- About section માં image heading/information પહેલાં દેખાય છે; optional URL link પણ છે.
- Prompt section માં title, type, category, about, prompt, how-to-use, aspect ratio, duration અને image fields છે.
- Unsaved editor backdrop click થી બંધ થતો નથી; X/Cancel પર unsaved changes discard confirm થાય છે.

## Supabase – એકવારનું Migration
1. `supabase/content-blocks-migration.sql` ખોલો.
2. Supabase → SQL Editor → New Query માં આખો SQL paste કરો.
3. Run કરો. આ migration માત્ર `prompts.content_blocks` JSONB column ઉમેરે છે; જૂનો data delete/replace કરતું નથી.
4. જૂની `setup.sql` અથવા `admin-upgrade-migration.sql` ફરીથી ચલાવવાની જરૂર નથી.

## GitHub Upload
1. હાલની live repository ZIP backup રાખો.
2. આ ZIP Extract કરો.
3. Extract કરેલા project folder ની અંદરની બધી files/folders GitHub repository ના root માં upload કરો; બહારનું wrapper folder નહીં.
4. Existing same-path files replace કરો; GitHub root માં `index.html` અને project folders ની રચના યથાવત્ રાખો.
5. Commit કરો અને Cloudflare Pages deployment `Success` થાય ત્યાં સુધી રાહ જુઓ.

## નોંધ
- Existing columns `prompt_variants`, `related_prompts`, `extra_sections` ને delete કરેલા નથી. જૂના prompt records માટે detail page compatibility રાખવામાં આવી છે.
- New ordered blocks માટે Supabase migration run થયેલું હોવું જરૂરી છે; નહીં તો Save વખતે `content_blocks` missing-column error મળશે.
- Live Supabase CRUD અને image upload deployment પછી actual browser માં ચકાસવાનું બાકી રહેશે.
