-- Undo of sql/20261121_multi_day_1_expand.sql (restores the previous view, cron job,
-- and drops the new columns). Only valid before phase 3 (merge): after it, a merged
-- event would lose all its days but the first.
--
--   py tools/sbdb/sbdb.py exec --env dev --file sql/20261121_multi_day_1_expand_revert.sql

BEGIN;

SELECT cron.schedule(
    'delete old events',
    '0 6 * * *',
    $$DELETE FROM public.events
    WHERE event_date < CURRENT_DATE - INTERVAL '1 day';$$
);

-- the view depends on the new columns: recreate it without them
DROP VIEW public.future_events;
CREATE VIEW public.future_events WITH (security_invoker = on) AS
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
    to_drink
   FROM public.events
  WHERE event_date >= CURRENT_DATE;
GRANT ALL ON public.future_events TO anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_events_sync_schedule ON public.events;
DROP FUNCTION IF EXISTS public.events_sync_schedule();

ALTER TABLE public.events
    DROP COLUMN IF EXISTS locations,
    DROP COLUMN IF EXISTS schedule,
    DROP COLUMN IF EXISTS end_date,
    DROP COLUMN IF EXISTS old_ids;

COMMIT;
