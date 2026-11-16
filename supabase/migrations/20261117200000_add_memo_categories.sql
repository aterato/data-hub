create table if not exists public.memo_categories (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{0,62}$'),
  name text not null unique,
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer not null default 100
);

alter table public.memo_categories enable row level security;
revoke all on public.memo_categories from anon, authenticated;
grant select on public.memo_categories to anon, authenticated;

drop policy if exists "Anyone can read memo categories" on public.memo_categories;
create policy "Anyone can read memo categories"
  on public.memo_categories
  for select
  to anon, authenticated
  using (true);

insert into public.memo_categories (id, name, color, sort_order)
values
  ('design', 'Design', '#547C65', 10),
  ('print', 'Print', '#9B7653', 20),
  ('living', 'Living', '#66808B', 30)
on conflict (id) do nothing;

alter table public.url_memos
  add column if not exists category_id text
  references public.memo_categories (id)
  on delete set null;

update public.url_memos
set category_id = 'design'
where category_id is null
  and (url ~* '^https?://(www\.)?dribbble\.com(/|$)'
   or url ~* '^https?://(www\.)?northkingdom\.com(/|$)'
   or url ~* '^https?://(www\.)?footer\.design(/|$)'
   or url ~* '^https?://(www\.)?designspells\.com(/|$)'
   or url ~* '^https?://(www\.)?awwwards\.com(/|$)');

update public.url_memos
set category_id = 'living'
where category_id is null
  and url ~* '^https?://([a-z0-9-]+\.)*muji\.(net|com)(/|$)'
  and url ~* 'renovation';
