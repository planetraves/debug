# Plan: multi-day and multi-place events

Status (2026-11-23) — phases 1–3 done on **DEV** and **PROD**; only phase 4 is left.

- PROD run done 2026-11-23: dump, phase 1, `deploy.py --release`, phase 3. Counts and
  merged events checked by a human, all good.
- Next: phase 4, not before **2026-12-07** (2 weeks after PROD phase 3): rehearse on DEV,
  new PROD dump, then PROD.

DEV details (2026-11-21):

- Phase 1 applied. Backfill checked: same rows, same `future_events` rows, old columns
  unchanged. Trigger checked with 13 rolled-back cases (old/new inserts and edits, no-op
  updates, validation errors, view). Revert script rehearsed: it restores the exact
  previous view, grants and cron job.
- Phase 2 implemented and deployed to the DEV site (`deploy.py`), not committed yet. Checked locally
  against DEV: agenda sections/tiles ("jusqu'au", places, areas), calendar dots, modal
  (places, programme), old per-day links (agenda and edit page), submit form (places,
  programme, validation; payload accepted by the trigger), edit form (multi-day and
  one-day events), `tools/publish` (dry run + real publish), `tools/dummy` (payloads).
- Phase 3 applied: 4 per-day groups merged (68 → 52 rows). The merge → revert → merge
  cycle was rehearsed: the revert restores every row identically. PROD preview (read
  only, without the schedule filter): 3 groups to merge, 13 rows → 3 events.
- Manual test of the deployed DEV site done by a human (2026-11-23).

- Phase 4 script written (`20261121_multi_day_3_contract.sql`), not run anywhere yet.

DEV test data (all `is_test`): "Test multi-jours en cours / 5 jours / 8 jours" and "tt"
(merged per-day events), "Test multi-lieux" (2 places, removed day), "Festival des arts
de rue (test)" (from `tools/publish`).

## Goal

- An event can have **several places**, and **several places on the same day**
  (each with its own time).
- A multi-day event is **one event**, not one copy per day. The agenda shows **one tile**,
  placed on its **next upcoming day**, with "jusqu'au …" when it lasts longer.
- When creating an event with an end date, a **programme** lists every day between the
  start and end date: per day, the creator can change the time and place, add another
  place, or delete the day (e.g. no event on the weekend).
- Maximum duration: **14 days** (last day − first day + 1), for now.

## Starting point (2026-11-21)

- Each day of a multi-day event is a separate, unlinked row in `events`.
  PROD: 45 rows, 13 of them form 3 multi-day events (no gaps, max 8 days).
- These only look at `event_date`, so a long event would vanish after its first day
  unless they change:
  - the `future_events` view (`event_date >= current_date`);
  - the cron job `delete old events` (`event_date < current_date - 1 day`);
  - ordering by `event_date` in the site.
- Unaffected: the `trg_daily_event_limit` trigger, the `delete-orphan-event-images`
  job, RLS policies (everything stays in `events`).
- The cron job `publish pending events after 3 days` updates almost every old row every
  night (`WHERE pending = pending`): the new trigger must accept such no-op updates.
- DEV and PROD are identical for every object above.

## Target structure

One row per event in `events`, with two JSON columns:

```sql
locations jsonb  -- [{"name","address","address_2","code","town"}, ...]
schedule  jsonb  -- [{"date":"2026-12-05","time":"20:00","loc":0},
                 --  {"date":"2026-12-05","time":"21:00","loc":1}, ...]
end_date  date   -- last day, set by the trigger
old_ids   uuid[] -- ids of the per-day rows merged into this event (old shared links)
```

- `schedule` has one entry per (day, place); `loc` is an index in `locations`.
- `event_date` keeps its name and means "first day". The trigger sets `event_date` and
  `end_date` from `schedule` on every write, so SQL keeps using real date columns.
- The trigger rejects invalid data: at least one place and one entry, span ≤ 14 days,
  no duplicate (date, place), every `loc` valid, every place used, required place
  fields present.

Why JSON columns rather than `event_days` / `event_locations` tables:

- one insert/update per event: a failure can't leave a half-published event (today's
  day-by-day loop can);
- the existing RLS rules apply as is; new tables would need their own;
- the daily publication limit counts a long event once instead of once per day;
- all filtering already happens in the browser, and the data is small.

## Rollout

The site and the database can't change at the same instant, and an open tab may still
run old code. The old columns (`event_start_time`, `location_*`) are kept and filled by
the trigger until phase 4.

Every phase runs and is tested on **DEV first**; PROD only starts once the whole
sequence has passed on DEV.

| Phase | Action | Visible to users | Undo |
| --- | --- | --- | --- |
| 1. Expand (DB) | `20261121_multi_day_1_expand.sql`: new columns, trigger, backfill (each row = one-day event), view and cron use `end_date`. | Nothing | `20261121_multi_day_1_expand_revert.sql` |
| 2. New site | New front-end (see below). Update `tools/publish` and `tools/dummy` too. | New form, single tiles | Redeploy previous commit (old columns still in sync) |
| 3. Merge data | Backup table, then `…_2_merge.sql` merges per-day rows (PROD: 13 rows → 3 events). Review the preview query output first. | Long events = one tile | Restore from the backup table |
| 4. Contract | `…_3_contract.sql`: drop old columns, simplify the trigger. | — | Restore from the dump |

Each SQL step is one transaction of a few milliseconds: no downtime expected.

### DEV run

1. Phase 1 on DEV. ✅ done 2026-11-21
2. Check the **current** site against DEV (`serve.bat` uses the DEV database): create,
   edit, delete and approve an `is_test` event.
3. Seed merge test data: still with the current site, create a few multi-day events with
   an end date (e.g. 2, 5 and 8 days) so DEV has per-day groups like PROD.
   ✅ done (3 groups seeded by SQL as the old form does, plus "tt" from the site)
4. Phase 2 on DEV: build the new front-end, test with `serve.bat`, then `deploy.py`
   (dev site). ✅ done
5. Phase 3 on DEV: merge the groups from step 3. ✅ done
6. **Complete test on DEV** (see Checks): everything in phases 1–3, plus an old per-day
   link and an old open tab. ✅ done 2026-11-23
7. Optional full rehearsal on real data: copy PROD into DEV
   (`sbdb migrate --from prod --to dev --include-data --clean`, wipes DEV data), then
   replay phases 1 and 3 on it and compare with the PROD numbers (45 → 35 rows).

### PROD run (only after the DEV run passes)

1. Dump PROD (`sbdb dump --env prod`).
2. Phase 1 on PROD, check counts.
3. Phase 2: `deploy.py --release`.
4. Phase 3 on PROD right after, at a quiet time; check counts and the 3 merged events.

✅ done 2026-11-23

### Phase 4 (2–4 weeks after PROD phase 3)

Rehearse `…_3_contract.sql` on DEV first (the new site must keep working without the old
columns), then apply it on PROD after a new dump.

Compatibility rules of the trigger during phases 1–3:

- **Old code inserts** (old columns only, `schedule` null): `schedule`/`locations` are
  built from the old columns.
- **New code writes** `schedule`/`locations`: the old columns are filled from the first
  entry, so a stale tab still displays the event.
- **Old code edits** the date/time/place of a one-entry event: `schedule`/`locations` are
  rebuilt. On an event with several entries, the save is refused with
  "Rechargez la page" to avoid overwriting the programme.
- Updates that don't touch dates/places (cron, moderation) always pass.

Shared links: opening an event looks it up by `id`, then in `old_ids`
(`.or("id.eq.X,old_ids.cs.{X}")`), so links to day 2+ of a merged event keep working.

Merge grouping key: same `title`, `created_by`, `location_name` and creation minute.
On PROD it finds exactly the 3 expected events.

## Front-end changes (phase 2)

- `includes/forms/submit_form.html` + `global/eventform.js`
  - repeatable **Lieux** block (add/remove places);
  - **Programme** list under the end date: one row per date with time, place,
    "+ lieu ce jour", delete/restore day. Changing start/end rebuilds the list but keeps
    edits on remaining dates;
  - `MAX_EVENT_DAYS` = 14.
- `global/address.js`: works inside each place block instead of fixed ids
  (`#location_address`, `#address-autocomplete`); keep the Couffouleux fix.
- `submit/submit.js`: single insert; remove the per-day loop and the
  "partly published" error.
- `edit_event/edit_event.js`: show end date and programme (hidden in edit mode today);
  load by `id` or `old_ids`.
- `events/events.js`
  - "next date" per event (first schedule date ≥ today) drives sections and sorting;
  - calendar: a dot on every scheduled day;
  - "Aujourd'hui" filter, search and area filter use all days and all places.
- `events/renderevents.js`: tile shows next date, time and place ("N lieux" if several),
  plus "jusqu'au …" when `end_date` is later.
- `global/helper.js`: modal lists the programme and each place's address with its map
  link (the repeated-town rule applies per place); share/email texts use
  `formatDateRange`.
- `global/modal.js`: accept/delete emails show the date range.
- `account/account.js`: one tile per event, nothing else.
- Docs/tools: `events/design.md`, README "Dates des évènements", `tools/publish`
  (JSON: `schedule` + `locations`), `tools/dummy/create.py`.

## Checks

- Phase 1: the old site still creates, edits, deletes and approves an `is_test` event;
  the view returns the same rows as before.
- Phase 2: one-day event; multi-day with a gap; two places on one day; a started long
  event shows in "Aujourd'hui" with "jusqu'au"; calendar, filters, search; editing an
  old one-day event; an old day-3 link opens the merged event.
- Phase 3: row count before/after (PROD today: 45 → 35); spot-check the merged events.
- Complete DEV test, in addition: an old tab (loaded before phase 2) editing a merged
  event gets "rechargez la page"; the nightly cron queries (run by hand) keep a started
  event and delete a finished one; publish and dummy tools create valid events.
