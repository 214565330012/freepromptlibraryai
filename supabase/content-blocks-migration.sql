-- FreePromptLibraryAI: ordered prompt/about page content blocks
-- Run once in Supabase Dashboard > SQL Editor before deploying the matching website files.
-- Additive migration: existing prompts, IDs, admin users, images and RLS policies are preserved.

alter table public.prompts
  add column if not exists content_blocks jsonb not null default '[]'::jsonb;

-- Existing rows remain unchanged and receive an empty ordered-block array by default.
-- New/edited records store an ordered JSON array with items of type "prompt" or "about".
