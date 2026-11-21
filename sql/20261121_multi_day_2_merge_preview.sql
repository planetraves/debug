-- Multi-day / multi-place events, phase 3 (merge) — PREVIEW, read only.
-- See sql/20261121_multi_day_events_plan.md.
--
-- Lists the per-day rows (created by the old submit loop) that
-- sql/20261121_multi_day_2_merge.sql would merge into one event, and the groups it
-- would skip. Review it before running the merge.
--
--   py tools/sbdb/sbdb.py query --env dev  (Get-Content -Raw sql/20261121_multi_day_2_merge_preview.sql)
--   py tools/sbdb/sbdb.py query --env prod (Get-Content -Raw sql/20261121_multi_day_2_merge_preview.sql)
--
-- The grouping below must stay identical to the one in the merge script.

WITH one_day AS (
    SELECT e.id, e.event_date, e.created_at, e.title, e.created_by, e.location_name, e.pending,
           -- everything the per-day copies must share (they only differ by id, date, time and creation time)
           to_jsonb(e) - ARRAY['id', 'event_date', 'event_start_time', 'created_at', 'pending', 'schedule', 'end_date', 'old_ids'] AS shared,
           -- a new group starts when the previous copy was created more than 1 minute before
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
SELECT title,
       n AS rows,
       dates[1] AS first_day,
       dates[array_upper(dates, 1)] AS last_day,
       all_pending AS pending,
       CASE WHEN n_dates <> n     THEN 'skip: same day twice'
            WHEN n_payloads <> 1  THEN 'skip: copies differ'
            WHEN span > 14        THEN 'skip: longer than 14 days'
            ELSE 'merge' END AS action,
       ids[1] AS kept_id
  FROM groups
 ORDER BY action, first_day, title;
