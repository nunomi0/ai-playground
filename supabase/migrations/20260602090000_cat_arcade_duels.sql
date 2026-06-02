create table if not exists public.cat_arcade_duel_players (
  room_code text not null,
  player_id text not null,
  player_name text not null,
  mode text not null,
  score bigint not null default 0,
  done boolean not null default false,
  snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (room_code, player_id),
  constraint cat_arcade_duel_players_room_code_check
    check (room_code ~ '^[A-Z0-9]{4,6}$'),
  constraint cat_arcade_duel_players_player_id_check
    check (char_length(trim(player_id)) between 1 and 96),
  constraint cat_arcade_duel_players_player_name_check
    check (char_length(trim(player_name)) between 1 and 24),
  constraint cat_arcade_duel_players_mode_check
    check (mode in ('suika', 'blocks', 'dodge', 'breakout')),
  constraint cat_arcade_duel_players_score_check
    check (score >= 0)
);

create index if not exists cat_arcade_duel_players_room_updated_idx
  on public.cat_arcade_duel_players (room_code, updated_at desc);

alter table public.cat_arcade_duel_players enable row level security;

drop policy if exists "cat_arcade_duel_players_select_all" on public.cat_arcade_duel_players;
create policy "cat_arcade_duel_players_select_all"
  on public.cat_arcade_duel_players
  for select
  to anon
  using (true);

drop policy if exists "cat_arcade_duel_players_insert_anon" on public.cat_arcade_duel_players;
create policy "cat_arcade_duel_players_insert_anon"
  on public.cat_arcade_duel_players
  for insert
  to anon
  with check (
    room_code ~ '^[A-Z0-9]{4,6}$'
    and char_length(trim(player_id)) between 1 and 96
    and char_length(trim(player_name)) between 1 and 24
    and mode in ('suika', 'blocks', 'dodge', 'breakout')
    and score >= 0
  );

drop policy if exists "cat_arcade_duel_players_update_anon" on public.cat_arcade_duel_players;
create policy "cat_arcade_duel_players_update_anon"
  on public.cat_arcade_duel_players
  for update
  to anon
  using (true)
  with check (
    room_code ~ '^[A-Z0-9]{4,6}$'
    and char_length(trim(player_id)) between 1 and 96
    and char_length(trim(player_name)) between 1 and 24
    and mode in ('suika', 'blocks', 'dodge', 'breakout')
    and score >= 0
  );

create table if not exists public.cat_arcade_duel_messages (
  id bigint generated always as identity primary key,
  room_code text not null,
  player_id text not null,
  player_name text not null,
  message text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint cat_arcade_duel_messages_room_code_check
    check (room_code ~ '^[A-Z0-9]{4,6}$'),
  constraint cat_arcade_duel_messages_player_id_check
    check (char_length(trim(player_id)) between 1 and 96),
  constraint cat_arcade_duel_messages_player_name_check
    check (char_length(trim(player_name)) between 1 and 24),
  constraint cat_arcade_duel_messages_message_check
    check (char_length(trim(message)) between 1 and 140)
);

create index if not exists cat_arcade_duel_messages_room_created_idx
  on public.cat_arcade_duel_messages (room_code, created_at desc);

alter table public.cat_arcade_duel_messages enable row level security;

drop policy if exists "cat_arcade_duel_messages_select_all" on public.cat_arcade_duel_messages;
create policy "cat_arcade_duel_messages_select_all"
  on public.cat_arcade_duel_messages
  for select
  to anon
  using (true);

drop policy if exists "cat_arcade_duel_messages_insert_anon" on public.cat_arcade_duel_messages;
create policy "cat_arcade_duel_messages_insert_anon"
  on public.cat_arcade_duel_messages
  for insert
  to anon
  with check (
    room_code ~ '^[A-Z0-9]{4,6}$'
    and char_length(trim(player_id)) between 1 and 96
    and char_length(trim(player_name)) between 1 and 24
    and char_length(trim(message)) between 1 and 140
  );

create table if not exists public.cat_arcade_duel_signals (
  id bigint generated always as identity primary key,
  room_code text not null,
  sender_id text not null,
  recipient_id text,
  signal_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint cat_arcade_duel_signals_room_code_check
    check (room_code ~ '^[A-Z0-9]{4,6}$'),
  constraint cat_arcade_duel_signals_sender_id_check
    check (char_length(trim(sender_id)) between 1 and 96),
  constraint cat_arcade_duel_signals_recipient_id_check
    check (recipient_id is null or char_length(trim(recipient_id)) between 1 and 96),
  constraint cat_arcade_duel_signals_signal_type_check
    check (signal_type in ('offer', 'answer', 'ice'))
);

create index if not exists cat_arcade_duel_signals_room_created_idx
  on public.cat_arcade_duel_signals (room_code, created_at asc);

alter table public.cat_arcade_duel_signals enable row level security;

drop policy if exists "cat_arcade_duel_signals_select_all" on public.cat_arcade_duel_signals;
create policy "cat_arcade_duel_signals_select_all"
  on public.cat_arcade_duel_signals
  for select
  to anon
  using (true);

drop policy if exists "cat_arcade_duel_signals_insert_anon" on public.cat_arcade_duel_signals;
create policy "cat_arcade_duel_signals_insert_anon"
  on public.cat_arcade_duel_signals
  for insert
  to anon
  with check (
    room_code ~ '^[A-Z0-9]{4,6}$'
    and char_length(trim(sender_id)) between 1 and 96
    and (recipient_id is null or char_length(trim(recipient_id)) between 1 and 96)
    and signal_type in ('offer', 'answer', 'ice')
  );
