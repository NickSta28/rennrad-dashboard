-- Rennrad Dashboard: eigenes Schema "rad" (Wein-Tabellen in public bleiben unberührt)
create schema if not exists rad;
grant usage on schema rad to authenticated;

create table rad.bikes (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null,                 -- Kurzname aus der Rohdatei, z. B. 'TCR SL'
  label text not null,
  full_name text,
  status text not null default 'aktiv' check (status in ('aktiv','inaktiv')),
  sort int not null default 0,
  photo_path text,
  unique (user_id, key)
);
create table rad.wheelsets (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  status text not null default 'aktiv' check (status in ('aktiv','inaktiv')),
  unique (user_id, name)
);
create table rad.bike_wheelsets (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bike_id bigint not null references rad.bikes(id) on delete cascade,
  wheelset_id bigint not null references rad.wheelsets(id) on delete cascade,
  primary key (bike_id, wheelset_id)
);
create table rad.rides (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  datum date not null,
  uhrzeit time,
  name text,
  ort text,
  art text not null default 'Training' check (art in ('Training','Rennen','virtuell')),
  strava_activity_id bigint,
  bike_id bigint references rad.bikes(id),
  wheelset_id bigint references rad.wheelsets(id),
  km numeric(7,2),
  total_time_s int,
  ride_time_s int,
  avg_speed numeric(5,1),
  max_speed numeric(5,1),
  avg_power int,
  norm_power int,
  elevation_m int,
  avg_hr int,
  max_hr int,
  avg_cadence int,
  max_cadence int,
  avg_temp numeric(4,1),
  beschreibung text,
  created_at timestamptz not null default now()
);
create index rides_user_datum on rad.rides (user_id, datum desc);
create index rides_bike on rad.rides (bike_id);
create table rad.component_changes (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  part text not null check (part in ('kette','ritzel','reifen','bremsscheibe')),
  bike_id bigint references rad.bikes(id) on delete cascade,
  wheelset_id bigint references rad.wheelsets(id) on delete cascade,
  datum date not null,
  note text,
  check ((bike_id is not null) <> (wheelset_id is not null))
);
create table rad.settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  accent text not null default '#1D4ED8',
  limits jsonb not null default '{"kette":[1500,3000],"ritzel":[2000,4000],"reifen":[1500,3000],"bremse":[2000,4000]}',
  goals jsonb not null default '{}'
);

-- Zugriff: nur eingeloggt, nur eigene Zeilen (gleiches Muster wie die Wein-Tabellen)
do $$
declare t text;
begin
  foreach t in array array['bikes','wheelsets','bike_wheelsets','rides','component_changes','settings'] loop
    execute format('alter table rad.%I enable row level security', t);
    execute format('create policy own_rows on rad.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('grant select, insert, update, delete on rad.%I to authenticated', t);
  end loop;
end $$;
grant usage, select on all sequences in schema rad to authenticated;
