alter table public.matches
  add column if not exists highlights_url text,
  add column if not exists highlights_title text;

comment on column public.matches.highlights_url is
  'Optional YouTube or external URL used by match detail to show the match summary/highlights.';

comment on column public.matches.highlights_title is
  'Optional short title for the match summary/highlights card.';
