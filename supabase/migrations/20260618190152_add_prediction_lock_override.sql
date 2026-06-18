alter table public.matches
  add column if not exists prediction_lock_override text;

alter table public.matches
  drop constraint if exists matches_prediction_lock_override_check;

alter table public.matches
  add constraint matches_prediction_lock_override_check
  check (
    prediction_lock_override is null
    or prediction_lock_override in ('locked', 'unlocked')
  );

comment on column public.matches.prediction_lock_override is
  'Manual Prode lock override. locked forces predictions closed, unlocked forces predictions open, null uses the automatic rule.';
