alter table public.cat_arcade_scores
  drop constraint if exists cat_arcade_scores_score_check;

alter table public.cat_arcade_scores
  alter column score type bigint
  using score::bigint;

alter table public.cat_arcade_scores
  add constraint cat_arcade_scores_score_check
  check (score >= 0);

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
