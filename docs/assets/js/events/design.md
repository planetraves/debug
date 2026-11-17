# Events page design

## Event tile grouping

How the tile view groups and shows events. The logic lives in `events.js`:
`getNearPeriods`, `groupEvents` and `renderTiles`.

### Rules

- Events are grouped by their calendar date (`YYYY-MM-DD`) and sorted by date.
- Past events are not shown.
- A section with no visible events is hidden.
- A month section only exists if that month has at least one event.
- If no tile is visible, the empty-state message is shown.

### Sections for each day

| Today               | Section 2                            | Section 3                           | Then   |
| ------------------- | ------------------------------------ | ----------------------------------- | ------ |
| Monday to Wednesday | `Cette semaine` (tomorrow to Friday) | `Ce week-end` (Saturday and Sunday) | Months |
| Thursday            | `Demain` (Friday)                    | `Ce week-end`                       | Months |
| Friday              | `Ce week-end`                        | —                                   | Months |
| Saturday            | `Dimanche`                           | —                                   | Months |
| Sunday              | —                                    | —                                   | Months |

`Aujourd'hui` is always the first section, and month sections always come last.

### What is shown in each case

✅ = has events, ❌ = no events, — = this section doesn't exist on that day.
"Months" means events from the Monday after this weekend onward.

|   # | Today    | `Aujourd'hui` | Section 2 | Section 3 | Months | What you see, in order                                   |
| --: | -------- | :-----------: | :-------: | :-------: | :----: | -------------------------------------------------------- |
|   1 | Mon–Wed  |       ✅       |     ✅     |     ✅     |   ✅    | `Aujourd'hui` → `Cette semaine` → `Ce week-end` → months |
|   2 | Mon–Wed  |       ❌       |     ✅     |     ✅     |   ✅    | `Cette semaine` → `Ce week-end` → months                 |
|   3 | Mon–Wed  |       ✅       |     ❌     |     ✅     |   ✅    | `Aujourd'hui` → `Ce week-end` → months                   |
|   4 | Mon–Wed  |       ✅       |     ✅     |     ❌     |   ✅    | `Aujourd'hui` → `Cette semaine` → months                 |
|   5 | Mon–Wed  |       ✅       |     ✅     |     ✅     |   ❌    | `Aujourd'hui` → `Cette semaine` → `Ce week-end`          |
|   6 | Mon–Wed  |       ❌       |     ❌     |     ✅     |   ❌    | `Ce week-end`                                            |
|   7 | Mon–Wed  |       ❌       |     ❌     |     ❌     |   ✅    | Months only                                              |
|   8 | Mon–Wed  |       ❌       |     ❌     |     ❌     |   ❌    | Empty-state message                                      |
|   9 | Thursday |       ✅       |     ✅     |     ✅     |   ✅    | `Aujourd'hui` → `Demain` → `Ce week-end` → months        |
|  10 | Thursday |       ❌       |     ✅     |     ✅     |   ✅    | `Demain` → `Ce week-end` → months                        |
|  11 | Thursday |       ✅       |     ❌     |     ✅     |   ❌    | `Aujourd'hui` → `Ce week-end`                            |
|  12 | Thursday |       ❌       |     ❌     |     ✅     |   ✅    | `Ce week-end` → months                                   |
|  13 | Thursday |       ❌       |     ❌     |     ❌     |   ❌    | Empty-state message                                      |
|  14 | Friday   |       ✅       |     ✅     |     —     |   ✅    | `Aujourd'hui` → `Ce week-end` → months                   |
|  15 | Friday   |       ❌       |     ✅     |     —     |   ✅    | `Ce week-end` → months                                   |
|  16 | Friday   |       ✅       |     ❌     |     —     |   ✅    | `Aujourd'hui` → months                                   |
|  17 | Friday   |       ❌       |     ❌     |     —     |   ✅    | Months only                                              |
|  18 | Saturday |       ✅       |     ✅     |     —     |   ✅    | `Aujourd'hui` → `Dimanche` → months                      |
|  19 | Saturday |       ❌       |     ✅     |     —     |   ✅    | `Dimanche` → months                                      |
|  20 | Saturday |       ✅       |     ❌     |     —     |   ❌    | `Aujourd'hui` only                                       |
|  21 | Saturday |       ❌       |     ❌     |     —     |   ✅    | Months only                                              |
|  22 | Sunday   |       ✅       |     —     |     —     |   ✅    | `Aujourd'hui` → months                                   |
|  23 | Sunday   |       ❌       |     —     |     —     |   ✅    | Months only                                              |
|  24 | Sunday   |       ❌       |     —     |     —     |   ❌    | Empty-state message                                      |

### Other cases

| Situation                                                         | Result                                                                                                     |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Monday–Wednesday with a Friday event                              | It goes in `Cette semaine`, not `Ce week-end`.                                                             |
| Monday 30 November with events on 1–4 December                    | They go in `Cette semaine`. The first month section is `décembre 2026`, starting from Monday 7 December.   |
| Later events in several months                                    | One section per month that has events, e.g. `décembre 2026` → `février 2027`. Months with no events are skipped. |
| Category, area, price or age filters hide every tile in a section | That section is hidden. If nothing is left, the empty-state message appears.                                |

### Date filters ("Quand")

Every section has a key that the date filters use:

| Section                                                      | Key | Shown by filter |
| ------------------------------------------------------------ | --- | --------------- |
| `Aujourd'hui`                                                | `0` | Aujourd'hui     |
| `Cette semaine`, `Demain`, `Ce week-end`, `Dimanche`, months | `1` | Prochainement   |

- Only "Aujourd'hui" selected: only the `Aujourd'hui` section can appear.
- Only "Prochainement" selected: every section except `Aujourd'hui` can appear.
- Both or none selected: every section can appear.