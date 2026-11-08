create table public.url_memos (
  id uuid primary key default gen_random_uuid(),
  url text not null check (
    char_length(url) <= 2048
    and url ~* '^https?://'
  ),
  title text not null check (char_length(title) between 1 and 200),
  note text not null default '' check (char_length(note) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index url_memos_updated_at_idx on public.url_memos (updated_at desc);

alter table public.url_memos enable row level security;

revoke all on public.url_memos from anon, authenticated;
grant select on public.url_memos to anon, authenticated;

create policy "Anyone can read URL memos"
  on public.url_memos
  for select
  to anon, authenticated
  using (true);

create function public.set_url_memo_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_url_memo_updated_at
  before update on public.url_memos
  for each row
  execute function public.set_url_memo_updated_at();
