---
name: checktickets
description: Check ticket availability on GetYourGuide and/or Tiqets for a specific date, time slot, and party size, and report whether tickets are currently bookable. Optionally watch automatically on a schedule, and fire macOS desktop alerts when run on a Mac. Use whenever the user wants to check, monitor, or watch for tickets/availability on GetYourGuide or Tiqets — e.g. timed-entry attractions like Sagrada Familia or the Alhambra. Trigger on "check tickets", "are tickets available", "watch for tickets", "GetYourGuide", "Tiqets", or when the user pastes a GetYourGuide/Tiqets product URL and asks about a date.
---

# Check Tickets

Runs an availability check against GetYourGuide and/or Tiqets using a headless browser, then reports whether tickets are bookable for the requested date and time slot.

It supports three modes:

- **On-demand (default):** one check per invocation. To re-check, run it again.
- **Watch (scheduled):** a Cowork scheduled task re-runs the check every N minutes and messages the user when tickets appear. See *Optional: watch on a schedule* below.
- **macOS desktop alerts:** when the script runs on a Mac (not the Cowork sandbox), it can fire a desktop notification + voice + sound. See `--notify` in *Step 3*.

## Step 1 — Gather inputs

Use **AskUserQuestion** to collect the details below. Ask for any that the user hasn't already provided; skip ones they have. The two URLs can be asked together. At least one of the two URLs is required.

1. **GetYourGuide URL** — the product page URL on getyourguide.com (optional if a Tiqets URL is given)
2. **Tiqets URL** — the product page URL on tiqets.com (optional if a GetYourGuide URL is given)
3. **Date** — the target date, e.g. `October 13 2026`
4. **Preferred time slot** — e.g. `9:00 AM`, or `any` for no preference
5. **Party size** — number of adults (11–99), children (5–10), infants (4 and under). Default 0 for any not given.

## Step 2 — Locate the script and install dependencies (first run only)

The check script (`check.js`) sits next to this SKILL.md in the skill's root directory. Resolve that directory dynamically — do **not** hardcode an absolute path, since the skill may be installed anywhere. From the skill root:

```bash
cd "$SKILL_DIR"                   # $SKILL_DIR = the directory containing this SKILL.md and check.js
[ -d node_modules/playwright ] || npm install
npx playwright install --with-deps chromium  # downloads the headless browser + system libs if missing
```

`npm install` and the Playwright Chromium download only need to happen once per environment; on later runs they are quick no-ops. If `npm install` reports the dependency already present, skip straight to running the check.

If `--with-deps` fails because the environment doesn't allow installing system packages (no root), fall back to `npx playwright install chromium`. Should the browser then fail to launch with a missing-library error (e.g. `libxdamage1`), the host is missing Chromium's shared libraries — install them once with `sudo apt-get install -y libnss3 libnspr4 libxdamage1 libgbm1 libasound2t64 libatk-bridge2.0-0 libatk1.0-0 libcups2 libpango-1.0-0` (or run the skill in an environment where they're already present).

## Step 3 — Run the check

Run the script with the collected values. Omit `--gyg-url` or `--tiqets-url` if the user only gave one site.

```bash
node check.js \
  --gyg-url="<GYG_URL>" \
  --tiqets-url="<TIQETS_URL>" \
  --date="<DATE>" \
  --time="<TIME_SLOT>" \
  --adults=<ADULTS> \
  --children=<CHILDREN> \
  --infants=<INFANTS> \
  --notify=auto
```

`--notify` controls desktop alerts when tickets are found:

- `auto` (default) — fire a macOS desktop notification + voice + sound, **but only when the script runs on macOS**. In the Cowork Linux sandbox this is silently skipped (results still come back in chat).
- `macos` — force the macOS alert (ignored if not actually on a Mac).
- `none` — never fire desktop alerts.

The macOS alerts only work when the script executes directly on a Mac — e.g. a user who runs the skill on their own machine, or runs `node check.js ...` from Terminal. They cannot fire from inside the Cowork sandbox, which is Linux.

The script prints a human-readable log to **stderr** and a single machine-readable JSON line to **stdout**, e.g.:

```json
{"date":"October 13 2026","timeSlot":"9:00 AM","results":{"GetYourGuide":false,"Tiqets":true},"urls":{...},"available":true,"checkedAt":"..."}
```

Parse the final JSON line to determine the outcome.

## Step 4 — Report

- If `available` is `true`: tell the user **which site(s)** have tickets and show the booking **URL** from `urls`. Advise them to book immediately — timed-entry tickets sell out fast.
- If `available` is `false`: tell the user tickets aren't available yet for that date/time, and offer to run the check again.
- If the JSON has an `error` field: report what went wrong (e.g. a site couldn't be reached or the date couldn't be parsed) and suggest a fix.

## Optional: watch on a schedule

After a one-off check, if the user wants to be alerted automatically when tickets open up, offer to set up a **Cowork scheduled task** that re-runs this check periodically. (Cowork has no persistent background loop, so recurring checks are done via scheduled tasks, not a long-running process.)

Ask the user how often to check (e.g. every 15 or 30 minutes) and how they want to be alerted (chat message and/or email via a connected mail tool). Then create the task with `mcp__scheduled-tasks__create_scheduled_task`, using a `cronExpression` for the cadence (e.g. `*/30 * * * *` for every 30 minutes) and a prompt that re-runs this skill, for example:

> Run the **checktickets** skill for: GetYourGuide `<GYG_URL>`, Tiqets `<TIQETS_URL>`, date `<DATE>`, time `<TIME_SLOT>`, party `<ADULTS> adults / <CHILDREN> children / <INFANTS> infants`. If the result's `available` is true, alert me with the site name and booking URL and tell me to book immediately. If not available, do not message me.

Notes for the watch mode:

- Hold the booking URLs, date, time, and party size in the scheduled prompt so each run is self-contained.
- Tell the user they can stop or change the cadence anytime (e.g. "stop watching for those tickets", or via `mcp__scheduled-tasks__list_scheduled_tasks` / `update_scheduled_task`).
- Suggest a sensible default cadence (every 15–30 min). Avoid sub-minute intervals — they hammer the sites and aren't necessary.

## Notes

- **Environment:** runs in a Linux sandbox with a headless browser. There are no desktop/sound notifications — results come back in chat. The script reaches GetYourGuide and Tiqets over the network, so those sites must be reachable from the environment where the skill runs.
- **Selectors:** the scraper targets GetYourGuide's and Tiqets' current calendar/time-slot markup. If a site redesigns its page, the selectors in `check.js` may need updating. A `false` result with no error usually means "date not bookable"; persistent failures across known-available dates suggest the selectors need a refresh.
- **One site or two:** providing a single URL is fully supported — the script only checks the site(s) you give it.
- **CLI / continuous version:** a standalone command-line variant (`monitor.js`) that loops every 2 minutes on macOS lives in the original repo at <https://github.com/zeebees/checktickets>. It shares the same scraping logic and CLI flags; use it for an always-on Mac terminal monitor instead of Cowork. See the README for a comparison.
