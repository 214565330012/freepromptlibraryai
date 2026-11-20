# FreePromptLibraryAI — reference-matched homepage

This revision follows the latest reference screenshot:
- Compact white header with brand on the left and navigation on the right
- Full-width purple/indigo gradient hero under the header
- Centered heading and description in the hero
- White search field and separate soft-pink Search button
- Pale blue/lavender page background
- Centered three-column prompt-card grid
- Large fixed-ratio thumbnail area, title, description and purple Get Prompts action on each card
- Further photo, video and category sections below, plus footer
- Premium Purple & White brand palette and responsive mobile layout

This is an original implementation based on the user's reference image. It does not reuse PromptBhai's logos, code, images or exact copy.

Important:
- Card artwork areas currently use designed gradient art panels, not real photographic sample images. The layout and sizing are ready; real prompt sample images can be uploaded to R2 later.
- Admin authentication, database, R2 upload workflow, trend research scheduler, separate prompt detail URLs and policy page contents remain to be built.


## Prompt detail pages (added)
- Each Get Prompts button now opens `prompt.html?id=<prompt-id>` as a separate page.
- The detail page includes English/Hindi prompt explanations, language switching, copy action, prompt details and related prompts.
- The preview block is an illustrative category placeholder because this repository does not yet contain sample image files. Real prompt sample images can be uploaded after the Admin + Cloudflare R2 image workflow is built.
- The homepage header CSS was left unchanged in this update.


## Homepage updates in this package
- Search results apply only after clicking Search or pressing Enter.
- Added three Trending Prompt cards above New Prompts.
- New Prompts shows 18 records per page with numbered pagination and Previous/Next controls.
- Pagination adapts automatically as prompt records are added.
- Trending illustrations are local SVG files in `assets/` (no third-party image hotlinks).

- Entire prompt cards are clickable and open their prompt detail page; trending cards open their matching filtered collection.
