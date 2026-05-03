create table if not exists public.prism_trio_scores (
  id bigint generated always as identity primary key,
  player_name text not null,
  score integer not null,
  source text not null,
  client_id text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  constraint prism_trio_scores_player_name_check
    check (char_length(trim(player_name)) between 1 and 24),
  constraint prism_trio_scores_score_check
    check (score between -999 and 9999),
  constraint prism_trio_scores_source_check
    check (source in ('round', 'manual'))
);

create index if not exists prism_trio_scores_score_created_idx
  on public.prism_trio_scores (score desc, created_at desc);

alter table public.prism_trio_scores enable row level security;

drop policy if exists "prism_trio_scores_select_all" on public.prism_trio_scores;
create policy "prism_trio_scores_select_all"
  on public.prism_trio_scores
  for select
  to anon
  using (true);

drop policy if exists "prism_trio_scores_insert_anon" on public.prism_trio_scores;
create policy "prism_trio_scores_insert_anon"
  on public.prism_trio_scores
  for insert
  to anon
  with check (
    char_length(trim(player_name)) between 1 and 24
    and score between -999 and 9999
    and source in ('round', 'manual')
    and char_length(trim(client_id)) > 0
  );
