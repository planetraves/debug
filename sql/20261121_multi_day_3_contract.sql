-- Multi-day / multi-place events, phase 4 (contract).
-- See sql/20261121_multi_day_events_plan.md. Run 2-4 weeks after phase 3, once no open
-- tab can still run the pre-phase-2 site (it reads/writes the old columns).
--
-- Drops the legacy columns (event_start_time, location_*) and simplifies the trigger:
-- no more compatibility with old code, schedule/locations are the only source.
-- Fails (and changes nothing) if another object still depends on a dropped column.
-- Undo: restore from the dump taken just before (py tools/sbdb/sbdb.py dump --env ...).
--
--   py tools/sbdb/sbdb.py exec --env dev  --file sql/20261121_multi_day_3_contract.sql
--   py tools/sbdb/sbdb.py exec --env prod --file sql/20261121_multi_day_3_contract.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.events_sync_schedule()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
declare
    max_days    constant integer := 14;
    max_places  constant integer := 10;
    nb_places   integer;
    normalized  jsonb;
    first_day   date;
    last_day    date;
    nb_entries  integer;
    nb_pairs    integer;
    nb_used     integer;
    has_null    boolean;
    loc_ok      boolean;
begin
    -- validate places
    if jsonb_typeof(new.locations) is distinct from 'array' or jsonb_array_length(new.locations) = 0 then
        raise exception 'Au moins un lieu est requis';
    end if;
    nb_places := jsonb_array_length(new.locations);
    if nb_places > max_places then
        raise exception 'Un évènement ne peut pas avoir plus de % lieux', max_places;
    end if;
    if exists (
        select 1 from jsonb_array_elements(new.locations) l
        where jsonb_typeof(l) <> 'object'
           or coalesce(trim(l->>'name'), '') = ''
           or coalesce(trim(l->>'town'), '') = ''
           or coalesce(l->>'code', '') !~ '^[0-9]{5}$'
           or l->>'address' is null
    ) then
        raise exception 'Chaque lieu doit avoir un nom, une adresse, un code postal (5 chiffres) et une ville';
    end if;

    -- validate and normalize the schedule (typed values, sorted by date, time, place)
    if jsonb_typeof(new.schedule) is distinct from 'array' or jsonb_array_length(new.schedule) = 0 then
        raise exception 'Au moins une date est requise';
    end if;
    select jsonb_agg(jsonb_build_object('date', d, 'time', to_char(t, 'HH24:MI'), 'loc', l)
                     order by d, t nulls first, l),
           min(d), max(d), count(*),
           count(distinct (d, l)),
           count(distinct l),
           bool_or(d is null or l is null),
           coalesce(bool_and(l between 0 and nb_places - 1), false)
      into normalized, first_day, last_day, nb_entries, nb_pairs, nb_used, has_null, loc_ok
      from (
        select (e->>'date')::date                 as d,
               nullif(e->>'time', '')::time       as t,
               (e->>'loc')::integer               as l
          from jsonb_array_elements(new.schedule) e
      ) s;

    if has_null then
        raise exception 'Chaque date de l''évènement doit avoir un jour et un lieu';
    end if;
    if not loc_ok then
        raise exception 'L''évènement fait référence à un lieu inexistant';
    end if;
    if nb_pairs <> nb_entries then
        raise exception 'Un même lieu apparaît deux fois le même jour';
    end if;
    if nb_used <> nb_places then
        raise exception 'Chaque lieu doit être utilisé au moins une fois dans l''évènement';
    end if;
    if last_day - first_day + 1 > max_days then
        raise exception 'Un évènement ne peut pas durer plus de % jours', max_days;
    end if;

    new.schedule   := normalized;
    new.event_date := first_day;
    new.end_date   := last_day;

    return new;
end;
$function$;


-- the view selects the old columns: recreate it without them
DROP VIEW public.future_events;
CREATE VIEW public.future_events WITH (security_invoker = on) AS
 SELECT id,
    title,
    event_date,
    tags,
    created_at,
    created_by,
    is_test,
    long_description,
    pending,
    min_price,
    category,
    max_price,
    image_url,
    phone,
    site_url,
    to_eat,
    price,
    email,
    creator_name,
    min_age,
    max_age,
    creator_email,
    to_drink,
    locations,
    schedule,
    end_date,
    old_ids
   FROM public.events
  WHERE end_date >= CURRENT_DATE;
GRANT ALL ON public.future_events TO anon, authenticated, service_role;


-- no CASCADE: if anything else still uses these columns, the whole transaction aborts
ALTER TABLE public.events
    DROP COLUMN event_start_time,
    DROP COLUMN location_name,
    DROP COLUMN location_address,
    DROP COLUMN location_address_2,
    DROP COLUMN location_address_code,
    DROP COLUMN location_address_town;

COMMIT;
