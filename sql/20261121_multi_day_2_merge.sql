-- Multi-day / multi-place events, phase 3 (merge).
-- See sql/20261121_multi_day_events_plan.md. Run only once the new site is live.
--
-- Merges the per-day rows created by the old submit loop into one event:
--   - the row of the first day is kept (its id, so links to it keep working);
--   - its schedule gets one entry per day, the other rows' ids go to old_ids
--     (the site resolves links to them), then the other rows are deleted;
--   - the event is published if at least one day was published.
-- Groups whose copies differ, repeat a day or span more than 14 days are left as is
-- (see sql/20261121_multi_day_2_merge_preview.sql, to review first).
--
-- Every row is saved first in backup.events_before_merge and every merge is logged in
-- backup.events_merge_log (schema "backup" is not exposed by the API).
-- Undo: sql/20261121_multi_day_2_merge_revert.sql
--
--   py tools/sbdb/sbdb.py exec --env dev  --file sql/20261121_multi_day_2_merge.sql
--   py tools/sbdb/sbdb.py exec --env prod --file sql/20261121_multi_day_2_merge.sql

BEGIN;

CREATE SCHEMA IF NOT EXISTS backup;
REVOKE ALL ON SCHEMA backup FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS backup.events_before_merge (
    backup_at timestamptz NOT NULL,
    row       jsonb       NOT NULL
);
CREATE TABLE IF NOT EXISTS backup.events_merge_log (
    run_at     timestamptz NOT NULL,
    kept_id    uuid        NOT NULL,
    merged_ids uuid[]      NOT NULL,
    title      text,
    dates      date[]
);
ALTER TABLE backup.events_before_merge ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup.events_merge_log    ENABLE ROW LEVEL SECURITY;

-- now() is the transaction start: the same value tags the backup and the log
INSERT INTO backup.events_before_merge (backup_at, row)
SELECT now(), to_jsonb(e) FROM public.events e;

-- same grouping as sql/20261121_multi_day_2_merge_preview.sql
CREATE TEMP TABLE merge_groups ON COMMIT DROP AS
WITH one_day AS (
    SELECT e.id, e.event_date, e.created_at, e.title, e.created_by, e.location_name, e.pending,
           -- each day keeps its own start time in the schedule, so times may differ
           to_jsonb(e) - ARRAY['id', 'event_date', 'event_start_time', 'created_at', 'pending', 'schedule', 'end_date', 'old_ids'] AS shared,
           CASE WHEN e.created_at - lag(e.created_at) OVER w <= interval '1 minute' THEN 0 ELSE 1 END AS new_group
      FROM public.events e
     WHERE jsonb_array_length(e.schedule) = 1
    WINDOW w AS (PARTITION BY e.title, e.created_by, e.location_name ORDER BY e.created_at, e.id)
),
numbered AS (
    SELECT *, sum(new_group) OVER (PARTITION BY title, created_by, location_name ORDER BY created_at, id) AS group_no
      FROM one_day
),
groups AS (
    SELECT title, created_by, location_name, group_no,
           array_agg(id ORDER BY event_date, created_at, id) AS ids,
           array_agg(event_date ORDER BY event_date)          AS dates,
           count(*)                                           AS n,
           count(DISTINCT event_date)                         AS n_dates,
           count(DISTINCT shared)                             AS n_payloads,
           max(event_date) - min(event_date) + 1              AS span,
           bool_and(pending)                                  AS all_pending
      FROM numbered
     GROUP BY title, created_by, location_name, group_no
    HAVING count(*) > 1
)
SELECT title, ids, dates, all_pending
  FROM groups
 WHERE n_dates = n AND n_payloads = 1 AND span <= 14;

INSERT INTO backup.events_merge_log (run_at, kept_id, merged_ids, title, dates)
SELECT now(), ids[1], ids[2:], title, dates FROM merge_groups;

-- the trigger validates the new schedule and sets end_date
UPDATE public.events k
   SET schedule = (
           SELECT jsonb_agg(jsonb_build_object(
                      'date', e.event_date,
                      'time', to_char(e.event_start_time, 'HH24:MI'),
                      'loc',  0) ORDER BY e.event_date)
             FROM public.events e
            WHERE e.id = ANY (g.ids)),
       old_ids = k.old_ids || g.ids[2:],
       pending = g.all_pending
  FROM merge_groups g
 WHERE k.id = g.ids[1];

DELETE FROM public.events
 WHERE id IN (SELECT unnest(ids[2:]) FROM merge_groups);

COMMIT;
