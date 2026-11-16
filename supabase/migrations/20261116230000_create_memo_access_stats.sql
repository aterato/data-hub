create table public.memo_access_stats (
  id boolean primary key default true check (id),
  last_access_at timestamptz,
  access_count bigint not null default 0 check (access_count >= 0)
);

insert into public.memo_access_stats (id, last_access_at, access_count)
values (true, null, 0);

alter table public.memo_access_stats enable row level security;
revoke all on public.memo_access_stats from anon, authenticated;
grant select, insert, update on public.memo_access_stats to service_role;

create function public.record_memo_access()
returns table (last_access_at timestamptz, access_count bigint)
language sql
security definer
set search_path = ''
as $function$
  insert into public.memo_access_stats as stats (id, last_access_at, access_count)
  values (true, now(), 1)
  on conflict (id) do update
    set last_access_at = excluded.last_access_at,
        access_count = stats.access_count + 1
  returning stats.last_access_at, stats.access_count;
$function$;

revoke all on function public.record_memo_access() from public, anon, authenticated;
grant execute on function public.record_memo_access() to service_role;
