create table if not exists public.cat_arcade_scores (
  id bigint generated always as identity primary key,
  player_name text not null,
  score integer not null,
  source text not null,
  client_id text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  constraint cat_arcade_scores_player_name_check
    check (char_length(trim(player_name)) between 1 and 24),
  constraint cat_arcade_scores_score_check
    check (score >= 0),
  constraint cat_arcade_scores_source_check
    check (source = 'round')
);

create index if not exists cat_arcade_scores_score_created_idx
  on public.cat_arcade_scores (score desc, created_at desc);

alter table public.cat_arcade_scores enable row level security;

drop policy if exists "cat_arcade_scores_select_all" on public.cat_arcade_scores;
create policy "cat_arcade_scores_select_all"
  on public.cat_arcade_scores
  for select
  to anon
  using (true);

drop policy if exists "cat_arcade_scores_insert_anon" on public.cat_arcade_scores;
create policy "cat_arcade_scores_insert_anon"
  on public.cat_arcade_scores
  for insert
  to anon
  with check (
    char_length(trim(player_name)) between 1 and 24
    and score >= 0
    and source = 'round'
    and char_length(trim(client_id)) > 0
    and client_id like 'cat-arcade:%'
  );
