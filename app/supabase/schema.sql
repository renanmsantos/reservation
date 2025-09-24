create extension if not exists "pgcrypto";

-- Schema definition for van reservation queue
create schema if not exists public;

create table if not exists public.vans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  departure_timestamp timestamptz not null,
  capacity integer not null default 15,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  van_id uuid not null references public.vans(id) on delete cascade,
  full_name text not null,
  email text,
  status text not null check (status in ('confirmed', 'waitlisted', 'cancelled')),
  position integer not null,
  joined_at timestamptz not null default now(),
  released_at timestamptz
);

create index if not exists reservations_van_status_position_idx
  on public.reservations (van_id, status, position);

create table if not exists public.duplicate_name_overrides (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists duplicate_name_overrides_full_name_idx
  on public.duplicate_name_overrides (full_name);

create table if not exists public.reservation_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'join',
    'waitlist',
    'release',
    'duplicate_blocked',
    'override_added',
    'override_removed',
    'capacity_updated'
  )),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists reservation_events_created_at_idx
  on public.reservation_events (created_at desc);

-- Row Level Security policies
alter table public.reservations enable row level security;
alter table public.duplicate_name_overrides enable row level security;

create or replace function public.handle_waitlist_promotion()
returns trigger as $$
declare
  promoted_id uuid;
begin
  if TG_OP = 'UPDATE' and NEW.status = 'cancelled' then
    promoted_id := (
      select id from public.reservations
      where van_id = NEW.van_id
        and status = 'waitlisted'
      order by position asc
      limit 1
    );

    update public.reservations
    set status = 'confirmed',
        position = 1
    where id = promoted_id;

    update public.reservations
    set position = sub.rn
    from (
      select id, row_number() over (partition by van_id, status order by joined_at) as rn
      from public.reservations
      where van_id = NEW.van_id
        and status in ('confirmed', 'waitlisted')
    ) as sub
    where public.reservations.id = sub.id;

    if promoted_id is not null then
      insert into public.reservation_events (event_type, payload)
      values (
        'waitlist',
        jsonb_build_object(
          'van_id', NEW.van_id,
          'previous_reservation_id', NEW.id,
          'promoted_reservation_id', promoted_id
        )
      );
    end if;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists reservations_waitlist_promotion on public.reservations;

create trigger reservations_waitlist_promotion
after update of status on public.reservations
for each row execute function public.handle_waitlist_promotion();

-- Policies (examples, adjust for your auth model)
drop policy if exists "allow authenticated reservations" on public.reservations;
drop policy if exists "allow authenticated updates" on public.reservations;
drop policy if exists "allow authenticated select" on public.reservations;

create policy "allow authenticated reservations"
  on public.reservations
  for insert
  with check (auth.role() = 'authenticated');

create policy "allow authenticated updates"
  on public.reservations
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "allow authenticated select"
  on public.reservations
  for select using (auth.role() = 'authenticated');

create or replace function public.enforce_unique_active_full_name()
returns trigger as $$
declare
  override_record public.duplicate_name_overrides%rowtype;
  active_count integer;
begin
  if NEW.status in ('confirmed', 'waitlisted') then
    select * into override_record
    from public.duplicate_name_overrides
    where full_name = NEW.full_name
      and (expires_at is null or expires_at > now())
    limit 1;

    if override_record is null then
      select count(*) into active_count
      from public.reservations
      where full_name = NEW.full_name
        and status in ('confirmed', 'waitlisted')
        and id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000');

      if active_count > 0 then
        raise exception 'duplicate_full_name' using hint = 'An active reservation already exists for this name.';
      end if;
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql;

create trigger reservations_unique_name_enforcer
before insert or update on public.reservations
for each row execute function public.enforce_unique_active_full_name();
