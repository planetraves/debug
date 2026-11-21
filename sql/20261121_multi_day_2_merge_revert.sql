-- Undo of the last run of sql/20261121_multi_day_2_merge.sql: deletes the merged events
-- and restores their original per-day rows from backup.events_before_merge.
-- Changes made to a merged event after the merge are lost.
--
--   py tools/sbdb/sbdb.py exec --env dev --file sql/20261121_multi_day_2_merge_revert.sql

BEGIN;

CREATE TEMP TABLE last_merge ON COMMIT DROP AS
SELECT l.*
  FROM backup.events_merge_log l
 WHERE l.run_at = (SELECT max(run_at) FROM backup.events_merge_log);

-- restored rows keep their original creation date: don't count them in today's limit
ALTER TABLE public.events DISABLE TRIGGER trg_daily_event_limit;

DELETE FROM public.events
 WHERE id IN (SELECT kept_id FROM last_merge);

INSERT INTO public.events
SELECT (jsonb_populate_record(NULL::public.events, b.row)).*
  FROM backup.events_before_merge b
 WHERE b.backup_at = (SELECT max(run_at) FROM last_merge)
   AND (b.row->>'id')::uuid IN (
        SELECT kept_id FROM last_merge
        UNION ALL
        SELECT unnest(merged_ids) FROM last_merge);

ALTER TABLE public.events ENABLE TRIGGER trg_daily_event_limit;

DELETE FROM backup.events_merge_log
 WHERE run_at = (SELECT max(run_at) FROM last_merge);

COMMIT;
