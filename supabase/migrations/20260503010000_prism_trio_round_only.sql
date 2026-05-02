update public.prism_trio_scores
set source = 'round'
where source is distinct from 'round';

alter table public.prism_trio_scores
  drop constraint if exists prism_trio_scores_source_check;

alter table public.prism_trio_scores
  add constraint prism_trio_scores_source_check
  check (source = 'round');

drop policy if exists "prism_trio_scores_insert_anon" on public.prism_trio_scores;
create policy "prism_trio_scores_insert_anon"
  on public.prism_trio_scores
  for insert
  to anon
  with check (
    char_length(trim(player_name)) between 1 and 24
    and score between -999 and 9999
    and source = 'round'
    and char_length(trim(client_id)) > 0
  );
