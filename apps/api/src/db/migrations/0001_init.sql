-- LLD §4 city, economy, and command tables.
-- Applied once by the migration runner. Statements are IF NOT EXISTS so a
-- repaired database can re-run this file without dropping data.

create table if not exists schema_meta (
  id text primary key,
  note text not null,
  recorded_at timestamptz not null
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  locale text not null default 'en',
  settings jsonb not null default '{}'::jsonb,
  recovery_code_hash text unique,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists sessions_user_id_idx on sessions (user_id);

create table if not exists cities (
  id text primary key,
  owner_id uuid references users (id) on delete cascade,
  name text not null,
  level integer not null default 1 check (level between 1 and 15),
  xp integer not null default 0 check (xp >= 0),
  coins integer not null default 0 check (coins >= 0),
  gems integer not null default 0 check (gems >= 0),
  civic_stars integer not null default 0 check (civic_stars >= 0),
  version integer not null default 0 check (version >= 0),
  content_version integer not null,
  population integer not null default 0 check (population >= 0),
  population_cap integer not null default 0 check (population_cap >= 0),
  warehouse_tier integer not null default 0 check (warehouse_tier between 0 and 5),
  warehouse_cap integer not null default 40 check (warehouse_cap >= 0),
  is_npc boolean not null default false,
  catalog_id text,
  tutorial_state jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists cities_one_player_city
  on cities (owner_id)
  where owner_id is not null and is_npc = false;

create table if not exists city_cells (
  city_id text not null references cities (id) on delete cascade,
  x integer not null,
  y integer not null,
  terrain_id text not null,
  owner_claimed boolean not null default true,
  cell_role text not null default 'terrain' check (cell_role in ('terrain', 'franchise_plot')),
  primary key (city_id, x, y)
);

create table if not exists building_instances (
  id text primary key,
  city_id text not null references cities (id) on delete cascade,
  definition_id text not null,
  x integer not null,
  y integer not null,
  rotation integer not null default 0 check (rotation between 0 and 3),
  state text not null,
  level integer not null default 1 check (level between 1 and 3),
  version integer not null default 0 check (version >= 0),
  pending_output jsonb,
  created_at timestamptz not null default now()
);

create index if not exists building_instances_city_id_idx on building_instances (city_id);

-- One cell belongs to one building. Deleting the building releases the footprint.
create table if not exists building_cells (
  city_id text not null references cities (id) on delete cascade,
  x integer not null,
  y integer not null,
  building_id text not null references building_instances (id) on delete cascade,
  primary key (city_id, x, y)
);

create index if not exists building_cells_building_id_idx on building_cells (building_id);

create table if not exists inventory_balances (
  city_id text not null references cities (id) on delete cascade,
  good_id text not null,
  qty integer not null check (qty >= 0),
  primary key (city_id, good_id)
);

create table if not exists inventory_ledger (
  id bigserial primary key,
  city_id text not null references cities (id) on delete restrict,
  good_id text not null,
  delta integer not null,
  source text not null,
  command_id text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_ledger_city_created_idx
  on inventory_ledger (city_id, created_at);

create table if not exists production_jobs (
  id text primary key,
  building_id text not null references building_instances (id) on delete cascade,
  city_id text not null references cities (id) on delete cascade,
  slot integer not null check (slot >= 0),
  recipe_id text not null,
  started_at timestamptz not null,
  completes_at timestamptz not null,
  claimed_at timestamptz,
  moved_to_output_at timestamptz,
  cancelled_at timestamptz
);

create unique index if not exists production_jobs_active_slot
  on production_jobs (building_id, slot)
  where moved_to_output_at is null and cancelled_at is null;

create index if not exists production_jobs_city_id_idx on production_jobs (city_id);

create table if not exists order_instances (
  id text primary key,
  city_id text not null references cities (id) on delete cascade,
  slot integer not null check (slot >= 0),
  template_id text not null,
  requirements jsonb not null,
  status text not null check (status in ('OPEN', 'FULFILLED')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'specialized')),
  solvable boolean not null,
  reward_coins integer not null check (reward_coins >= 0),
  reward_xp integer not null check (reward_xp >= 0),
  civic_stars integer not null check (civic_stars >= 0),
  version integer not null default 0 check (version >= 0)
);

create unique index if not exists order_instances_open_slot
  on order_instances (city_id, slot)
  where status = 'OPEN';

create index if not exists order_instances_city_id_idx on order_instances (city_id);

create table if not exists train_shipments (
  id text primary key,
  city_id text not null references cities (id) on delete cascade,
  status text not null check (status in ('LOADING', 'IN_TRANSIT', 'ARRIVED')),
  station_id text,
  wagons jsonb not null default '[]'::jsonb,
  departed_at timestamptz,
  returns_at timestamptz
);

create unique index if not exists train_shipments_one_active
  on train_shipments (city_id)
  where status <> 'ARRIVED';

create table if not exists franchises (
  id text primary key,
  owner_city text not null references cities (id) on delete cascade,
  host_city text not null references cities (id) on delete cascade,
  business_definition_id text not null,
  state text not null,
  split_bps integer not null check (split_bps between 0 and 10000),
  streak_days integer not null default 0 check (streak_days >= 0),
  version integer not null default 0 check (version >= 0),
  plot_x integer,
  plot_y integer
);

create unique index if not exists franchises_one_open_business
  on franchises (owner_city, business_definition_id)
  where state in ('REQUESTED', 'ACCEPTED', 'ACTIVE', 'PAUSED');

create table if not exists franchise_shipments (
  id text primary key,
  franchise_id text not null references franchises (id) on delete cascade,
  goods jsonb not null default '[]'::jsonb,
  owner_amount integer not null check (owner_amount >= 0),
  host_amount integer not null check (host_amount >= 0),
  total_value integer not null check (total_value >= 0),
  state text not null,
  constraint franchise_shipments_split check (owner_amount + host_amount = total_value)
);

create table if not exists quests (
  city_id text not null references cities (id) on delete cascade,
  quest_id text not null,
  step_state jsonb not null default '{}'::jsonb,
  status text not null,
  step_index integer not null default 0 check (step_index >= 0),
  version integer not null default 0 check (version >= 0),
  primary key (city_id, quest_id)
);

create table if not exists npc_visits (
  id text primary key,
  visitor_city_id text not null references cities (id) on delete cascade,
  host_city_id text not null references cities (id) on delete cascade,
  visited_at timestamptz not null default now()
);

create index if not exists npc_visits_host_city_id_idx on npc_visits (host_city_id);

create table if not exists command_dedup (
  actor_id uuid not null references users (id) on delete cascade,
  command_id text not null,
  request_hash text not null,
  status_code integer,
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (actor_id, command_id)
);

create table if not exists telemetry_events (
  id bigserial primary key,
  player_id uuid,
  session_id uuid,
  name text not null,
  payload jsonb not null default '{}'::jsonb,
  content_version integer,
  city_level integer,
  created_at timestamptz not null default now()
);

create index if not exists telemetry_events_player_created_idx
  on telemetry_events (player_id, created_at);
