do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'matches'
      and column_name = 'round'
      and data_type <> 'text'
  ) then
    alter table public.matches
      alter column round type text using round::text;
  end if;
end $$;
