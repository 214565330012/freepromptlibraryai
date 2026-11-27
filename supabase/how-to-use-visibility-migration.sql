-- FreePromptLibraryAI V14: shared How-to visibility toggle
-- Run once in Supabase Dashboard > SQL Editor before deploying V14.
-- Existing prompts default to visible; the Admin checkbox controls future visibility.
alter table public.prompts
  add column if not exists show_how_to_use boolean not null default true;
