revoke all on function public.rls_auto_enable() from public, anon, authenticated;
comment on function public.rls_auto_enable() is 'Internal automatic RLS event trigger; intentionally not executable via Data API';
