-- Multi-day / multi-place events, phase 1 (expand).
-- See sql/20261121_multi_day_events_plan.md.
--
-- Backward compatible: the current site keeps working unchanged. The old columns
-- (event_start_time, location_*) stay and are kept in sync by the trigger.
-- Undo: sql/20261121_multi_day_1_expand_revert.sql
--
--   py tools/sbdb/sbdb.py exec --env dev  --file sql/20261121_multi_day_1_expand.sql
--   py tools/sbdb/sbdb.py exec --env prod --file sql/20261121_multi_day_1_expand.sql

BEGIN;

ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS locations jsonb,   -- [{"name","address","address_2","code","town"}, ...]
    ADD COLUMN IF NOT EXISTS schedule  jsonb,   -- [{"date":"YYYY-MM-DD","time":"HH:MM"|null,"loc":<index in locations>}, ...]
    ADD COLUMN IF NOT EXISTS end_date  date,    -- last scheduled day (event_date = first day)
    ADD COLUMN IF NOT EXISTS old_ids   uuid[] NOT NULL DEFAULT '{}';  -- per-day rows merged into this event


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
    first_entry jsonb;
    first_place jsonb;
begin
    -- Old code edits the legacy date/time/place columns without sending "schedule".
    -- One-entry event: rebuild the JSON from them. Several entries: refuse, the old
    -- form can't represent the programme and would overwrite it.
    -- Updates that don't touch these columns (cron, moderation) pass untouched.
    if tg_op = 'UPDATE'
       and new.schedule is not distinct from old.schedule
       and new.locations is not distinct from old.locations
       and (new.event_date, new.event_start_time, new.location_name, new.location_address,
            new.location_address_2, new.location_address_code, new.location_address_town)
           is distinct from
           (old.event_date, old.event_start_time, old.location_name, old.location_address,
            old.location_address_2, old.location_address_code, old.location_address_town)
    then
        if jsonb_array_length(old.schedule) > 1 then
            raise exception 'Cet évènement a plusieurs dates ou lieux : rechargez la page pour le modifier';
        end if;
        new.schedule  := null;
        new.locations := null;
    end if;

    -- Old code inserting, legacy edit above, or backfill: build the JSON from the old columns.
    if new.schedule is null then
        new.locations := jsonb_build_array(jsonb_build_object(
            'name',      new.location_name,
            'address',   new.location_address,
            'address_2', new.location_address_2,
            'code',      lpad(new.location_address_code::text, 5, '0'),  -- numeric drops leading zeros
            'town',      new.location_address_town));
        new.schedule := jsonb_build_array(jsonb_build_object(
            'date', new.event_date,
            'time', to_char(new.event_start_time, 'HH24:MI'),
            'loc',  0));
    end if;

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

    -- keep the old columns filled from the first entry, for code that still reads them
    first_entry := normalized->0;
    first_place := new.locations->((first_entry->>'loc')::integer);
    new.event_start_time      := nullif(first_entry->>'time', '')::time;
    new.location_name         := first_place->>'name';
    new.location_address      := first_place->>'address';
    new.location_address_2    := nullif(trim(first_place->>'address_2'), '');
    new.location_address_code := (first_place->>'code')::numeric;
    new.location_address_town := first_place->>'town';

    return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_events_sync_schedule ON public.events;
CREATE TRIGGER trg_events_sync_schedule
    BEFORE INSERT OR UPDATE ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.events_sync_schedule();


-- backfill: every existing row becomes a one-day, one-place event (the trigger builds the JSON)
UPDATE public.events SET schedule = NULL, locations = NULL;

ALTER TABLE public.events
    ALTER COLUMN locations SET NOT NULL,
    ALTER COLUMN schedule  SET NOT NULL,
    ALTER COLUMN end_date  SET NOT NULL;


-- an event stays visible until its last day (same column order, new columns appended)
CREATE OR REPLACE VIEW public.future_events WITH (security_invoker = on) AS
 SELECT id,
    title,
    event_date,
    event_start_time,
    location_name,
    location_address,
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
    location_address_2,
    location_address_code,
    location_address_town,
    creator_email,
    to_drink,
    locations,
    schedule,
    end_date,
    old_ids
   FROM public.events
  WHERE end_date >= CURRENT_DATE;


-- delete an event only once its last day is over (same name: pg_cron updates the job)
SELECT cron.schedule(
    'delete old events',
    '0 6 * * *',
    $$DELETE FROM public.events
    WHERE end_date < CURRENT_DATE - INTERVAL '1 day';$$
);

COMMIT;
