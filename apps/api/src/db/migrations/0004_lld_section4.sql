-- Align the live schema with LLD §4. Databases that already applied the
-- earlier text-id tables are rebuilt here. Seeds run after migrate, so the
-- empty NPC rows are inserted again on startup.

drop table if exists telemetry_events cascade;
drop table if exists command_dedup cascade;
drop table if exists npc_visits cascade;
drop table if exists quests cascade;
drop table if exists franchise_shipments cascade;
drop table if exists franchises cascade;
drop table if exists train_shipments cascade;
drop table if exists order_instances cascade;
drop table if exists production_jobs cascade;
drop table if exists inventory_ledger cascade;
drop table if exists inventory_balances cascade;
drop table if exists building_cells cascade;
drop table if exists building_instances cascade;
drop table if exists city_cells cascade;
drop table if exists cities cascade;
drop table if exists sessions cascade;
drop table if exists users cascade;

create table users (
  id uuid primary key default gen_random_uuid(),
  locale text not null default 'en',
  settings jsonb not null default '{}'::jsonb,
  recovery_code_hash text unique,
  created_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at timestamptz
);

create index sessions_user_id_idx on sessions (user_id);

create table cities (
  id uuid primary key,
  owner_id uuid references users (id) on delete cascade,
  name text not null,
  level integer not null default 1 check (level between 1 and 15),
  xp bigint not null default 0 check (xp >= 0),
  coins bigint not null default 0 check (coins >= 0),
  gems integer not null default 0 check (gems >= 0),
  civic_stars integer not null default 0 check (civic_stars >= 0),
  version bigint not null default 1 check (version >= 0),
  content_version integer not null,
  population integer not null default 0 check (population >= 0),
  population_cap integer not null default 0 check (population_cap >= 0),
  warehouse_tier smallint not null default 0 check (warehouse_tier between 0 and 5),
  warehouse_cap integer not null default 40 check (warehouse_cap >= 0),
  is_npc boolean not null default false,
  npc_key text unique,
  tutorial_state jsonb,
  unlocked_bounds jsonb not null default '[]'::jsonb,
  collect_priority text not null default 'QUEST_FIRST' check (collect_priority in ('QUEST_FIRST', 'OLDEST_FIRST')),
  last_free_reroll_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index cities_one_player_city
  on cities (owner_id)
  where owner_id is not null and is_npc = false;

create table city_cells (
  city_id uuid not null references cities (id) on delete cascade,
  x smallint not null,
  y smallint not null,
  terrain_id text not null,
  owner_claimed boolean not null default true,
  cell_role text not null default 'terrain' check (cell_role in ('terrain', 'franchise_plot')),
  primary key (city_id, x, y)
);

create table building_instances (
  id uuid primary key,
  city_id uuid not null references cities (id) on delete cascade,
  definition_id text not null,
  x smallint not null,
  y smallint not null,
  rotation smallint not null default 0 check (rotation between 0 and 3),
  state text not null check (state in (
    'UNDER_CONSTRUCTION',
    'ACTIVE',
    'NEEDS_SUPPLY',
    'PRODUCING',
    'READY_TO_COLLECT',
    'UPGRADING',
    'RELOCATING'
  )),
  level smallint not null default 1 check (level between 1 and 3),
  construction_completes_at timestamptz,
  upgrade_completes_at timestamptz,
  last_collected_at timestamptz,
  cycle_started_at timestamptz,
  stock jsonb not null default '{}'::jsonb,
  output_ready jsonb not null default '{}'::jsonb,
  removed_at timestamptz,
  undo_expires_at timestamptz,
  version bigint not null default 1 check (version >= 0),
  created_at timestamptz not null default now()
);

create index building_instances_city_id_idx on building_instances (city_id);
create index building_instances_city_version_idx on building_instances (city_id, version);

create table building_cells (
  city_id uuid not null references cities (id) on delete cascade,
  x smallint not null,
  y smallint not null,
  building_id uuid not null references building_instances (id) on delete cascade,
  primary key (city_id, x, y)
);

create index building_cells_building_id_idx on building_cells (building_id);

create table inventory_balances (
  city_id uuid not null references cities (id) on delete cascade,
  good_id text not null,
  qty integer not null check (qty >= 0),
  version bigint not null default 1 check (version >= 0),
  primary key (city_id, good_id)
);

create table inventory_ledger (
  id bigserial primary key,
  city_id uuid not null references cities (id) on delete restrict,
  resource text not null,
  delta bigint not null check (delta <> 0),
  balance_after bigint not null,
  source text not null,
  command_id uuid,
  ref_type text,
  ref_id uuid,
  created_at timestamptz not null default now()
);

create index inventory_ledger_city_created_idx on inventory_ledger (city_id, created_at);

create or replace function inventory_ledger_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'inventory_ledger is append-only';
end;
$$;

create trigger inventory_ledger_no_update
  before update or delete on inventory_ledger
  for each row
  execute function inventory_ledger_append_only();

create table production_jobs (
  id uuid primary key,
  building_id uuid not null references building_instances (id) on delete cascade,
  city_id uuid not null references cities (id) on delete cascade,
  slot smallint not null check (slot between 0 and 2),
  recipe_id text not null,
  inputs jsonb not null default '{}'::jsonb,
  outputs jsonb not null default '{}'::jsonb,
  started_at timestamptz not null,
  completes_at timestamptz not null,
  claimed_at timestamptz,
  moved_to_output_at timestamptz,
  cancelled_at timestamptz,
  version bigint not null default 1 check (version >= 0)
);

create unique index production_jobs_active_slot
  on production_jobs (building_id, slot)
  where moved_to_output_at is null and cancelled_at is null;

create index production_jobs_city_id_idx on production_jobs (city_id);
create index production_jobs_building_completes_idx on production_jobs (building_id, completes_at);

create table order_instances (
  id uuid primary key,
  city_id uuid not null references cities (id) on delete cascade,
  slot smallint not null check (slot between 0 and 2),
  template_id text not null,
  requirements jsonb not null,
  status text not null check (status in ('OPEN', 'FULFILLED', 'REROLLED', 'REPLACED')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'specialized', 'story', 'recovery')),
  solvable boolean not null,
  reward_coins integer not null check (reward_coins >= 0),
  reward_xp integer not null check (reward_xp >= 0),
  civic_stars integer not null check (civic_stars >= 0),
  version bigint not null default 1 check (version >= 0),
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz
);

create unique index order_instances_open_slot
  on order_instances (city_id, slot)
  where status = 'OPEN';

create index order_instances_city_id_idx on order_instances (city_id);
create index order_instances_city_status_idx on order_instances (city_id, status);

create table train_shipments (
  id uuid primary key,
  city_id uuid not null references cities (id) on delete cascade,
  status text not null check (status in ('LOADING', 'IN_TRANSIT', 'ARRIVED')),
  station_id text,
  wagons jsonb not null default '[]'::jsonb,
  completion_bonus_paid boolean not null default false,
  help_request_at timestamptz,
  departed_at timestamptz,
  returns_at timestamptz,
  version bigint not null default 1 check (version >= 0)
);

create unique index train_shipments_one_active
  on train_shipments (city_id)
  where status <> 'ARRIVED';

create table franchises (
  id uuid primary key,
  owner_city uuid not null references cities (id) on delete cascade,
  host_city uuid not null references cities (id) on delete cascade,
  business_definition_id text not null,
  host_plot jsonb not null default '{}'::jsonb,
  is_trial boolean not null default false,
  state text not null check (state in (
    'DRAFT',
    'REQUESTED',
    'ACCEPTED',
    'ACTIVE',
    'PAUSED',
    'DECLINED',
    'EXPIRED',
    'TERMINATED'
  )),
  split_bps integer not null default 6000 check (split_bps between 0 and 10000),
  streak_days integer not null default 0 check (streak_days >= 0),
  last_supply_day date,
  stock_cycles smallint not null default 0 check (stock_cycles between 0 and 2),
  cycle_started_at timestamptz,
  plot_x integer,
  plot_y integer,
  version bigint not null default 1 check (version >= 0),
  created_at timestamptz not null default now()
);

create unique index franchises_one_open_business
  on franchises (owner_city, business_definition_id)
  where state in ('REQUESTED', 'ACCEPTED', 'ACTIVE', 'PAUSED');

create index franchises_host_state_idx on franchises (host_city, state);

create table franchise_shipments (
  id uuid primary key,
  franchise_id uuid not null references franchises (id) on delete cascade,
  command_id uuid not null,
  goods jsonb not null default '[]'::jsonb,
  owner_amount integer not null check (owner_amount >= 0),
  host_amount integer not null check (host_amount >= 0),
  total_value integer not null check (total_value >= 0),
  streak_bonus_bps integer not null default 0,
  state text not null check (state in ('SUPPLIED', 'EARNING', 'READY', 'SETTLED')),
  supplied_at timestamptz,
  earn_completes_at timestamptz,
  settled_at timestamptz,
  constraint franchise_shipments_split check (owner_amount + host_amount = total_value),
  constraint franchise_shipments_command_unique unique (franchise_id, command_id)
);

create table quests (
  city_id uuid not null references cities (id) on delete cascade,
  quest_id text not null,
  period_key text not null default '-',
  track text not null check (track in ('story', 'growth', 'weekly')),
  step_state jsonb not null default '{}'::jsonb,
  status text not null check (status in ('ACTIVE', 'COMPLETED', 'CLAIMED')),
  step_index integer not null default 0 check (step_index >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  version bigint not null default 1 check (version >= 0),
  primary key (city_id, quest_id, period_key)
);

create table npc_visits (
  city_id uuid not null references cities (id) on delete cascade,
  npc_city_id uuid not null references cities (id) on delete cascade,
  window_started_at timestamptz,
  actions_used smallint not null default 0 check (actions_used between 0 and 5),
  primary key (city_id, npc_city_id)
);

create table command_dedup (
  actor_id uuid not null references users (id) on delete cascade,
  command_id text not null,
  request_hash text not null,
  status_code integer,
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (actor_id, command_id)
);

create table telemetry_events (
  id bigserial primary key,
  player_id uuid,
  session_id uuid,
  name text not null,
  payload jsonb not null default '{}'::jsonb,
  content_version integer,
  city_level integer,
  created_at timestamptz not null default now()
);

create index telemetry_events_player_created_idx on telemetry_events (player_id, created_at);
create index telemetry_events_name_created_idx on telemetry_events (name, created_at);
