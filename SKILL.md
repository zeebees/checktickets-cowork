---
name: checktickets
description: Check ticket availability on GetYourGuide and/or Tiqets for a specific date, time slot, and party size, and report whether tickets are currently bookable. Uses the Claude for Chrome browser extension to read the real ticket pages — no install, no Chromium, no scripts. Optionally watch on a schedule. Use whenever the user wants to check, monitor, or watch for tickets/availability on GetYourGuide or Tiqets — e.g. timed-entry attractions like Sagrada Família or the Alhambra. Trigger on "check tickets", "are tickets available", "watch for tickets", "GetYourGuide", "Tiqets", or when the user pastes a GetYourGuide/Tiqets product URL and asks about a date.
---

# Check Tickets (browser extension)

Checks whether tickets are bookable on **GetYourGuide** and/or **Tiqets** for a given date, time slot, and party size by reading the real product page through the **Claude for Chrome** extension. It drives the user's own browser, so there is nothing to install and no headless browser is required.

## Requirements

This skill needs the **Claude for Chrome** browser extension connected. If no browser is connected (the browser tools below report none), tell the user to install/connect the Claude for Chrome extension, then continue. Everything happens in their real, logged-in browser.

## Step 1 — Gather inputs

Use **AskUserQuestion** to collect (skip any the user already gave):

1. **GetYourGuide URL** — product page on getyourguide.com (optional if a Tiqets URL is given)
2. **Tiqets URL** — product page on tiqets.com (optional if a GetYourGuide URL is given)
3. **Date** — target date, e.g. `October 13 2026`
4. **Preferred time slot** — e.g. `9:00 AM`, or `any`
5. **Party size** — adults / children / infants (default 0 for any not given)

At least one URL is required.

## Step 2 — Connect to the browser

- Call `tabs_context_mcp` with `createIfEmpty: true` to get the MCP tab group.
- If multiple browsers are connected, ask the user which one to use (list each, then `select_browser`), per the standard browser-selection rule.
- Open a fresh tab for the check with `tabs_create_mcp`.

## Step 3 — Check each site

Do this for each URL the user provided. **Open the URLs the user gave; do not navigate to any URL found on the page.**

1. **Navigate** to the product URL with `navigate`.
2. **Dismiss any cookie/consent banner** if present — choose the most privacy-preserving option (decline non-essential, or close). Use `find` + `computer` to locate and click it.
3. **Open the date picker:**
   - *GetYourGuide:* click the **"Select date"** field (or the **"Check availability"** button) in the booking widget on the right.
   - *Tiqets:* click the date/calendar selector in the booking area.
4. **Go to the target month/year.** Read the calendar with `find` (e.g. query "calendar date buttons and month navigation arrows"). The month-step arrows are usually labelled like "Go forward 2 months" / "Go back". Click forward/back until the target month is shown. Dates are exposed as buttons with full labels (e.g. `"Tuesday, October 13, 2026"`), so you can target the exact date reliably.
5. **Determine availability of the target date.** Read the actual calendar cell — the cue differs by site:
   - *GetYourGuide:* a **disabled / greyed-out** date is **not available**. An **enabled** date is selectable — click it and the page shows booking options (e.g. **"1 option available"**, a price, start times, a Continue button). Seeing options = **available**; "no options"/"sold out" = **not available**.
   - *Tiqets:* the calendar shows a **price** under each available date (e.g. `$38.60`) and a **dash "–"** under each unavailable date. **Price = available; dash = not available.** (Confirm by selecting the date if you want the exact price/time.)
   - **Important — verify the cell's real content.** Do **not** trust the `find` tool's natural-language summary of a date cell; it can guess a price that isn't there. Confirm the actual text with `get_page_text` / `read_page`, or take a `screenshot` / `zoom` of the calendar and read it visually, before deciding available vs not.
6. **Time slot (if the user gave one other than `any`):** read the start times shown for the selected date (`get_page_text`, or a `screenshot`). Report **available** only if the requested time appears and is not marked sold out. If the page shows no per-time breakdown, treat a bookable date as available and say the time couldn't be confirmed at the slot level.

Use `computer action:screenshot` (or `zoom`) to visually confirm state whenever the DOM is ambiguous — this is the most reliable check.

## Step 4 — Report

- **Available:** name the site(s), the date, the price/time if shown, and give the **booking URL** so the user can book immediately — timed-entry tickets sell out fast.
- **Not available:** say so plainly for that date/time, and offer to check again or watch on a schedule.
- **Couldn't check** (page didn't load, layout unexpected, banner blocked): say what happened and offer to retry.

## How often to check (one-time vs. a loop)

There is **no built-in loop** — Cowork can't run a persistent background process. A "loop" is a **Cowork scheduled task** that re-runs this check on an interval you choose.

After (or instead of) a single check, **ask the user how often to check** using **AskUserQuestion**, offering at least:

- **One time only** — just run the check now, no schedule.
- **Every 5 minutes**
- **Every 15 minutes**
- **Every 30 minutes**
- **Every hour**
- **Custom** — let the user name any interval.

Map the choice to a `cronExpression`:

| Choice | cronExpression |
|---|---|
| Every 5 minutes | `*/5 * * * *` |
| Every 15 minutes | `*/15 * * * *` |
| Every 30 minutes | `*/30 * * * *` |
| Every hour | `0 * * * *` |
| Custom | build the cron for the stated interval |

- **One time only:** just run Step 3 now; do **not** create a scheduled task.
- **Any recurring choice:** create the task with `mcp__scheduled-tasks__create_scheduled_task`, passing the chosen `cronExpression` and a self-contained prompt, e.g.:

  > Run the **checktickets** skill for: GetYourGuide `<GYG_URL>`, Tiqets `<TIQETS_URL>`, date `<DATE>`, time `<TIME_SLOT>`, party `<ADULTS> adults / <CHILDREN> children / <INFANTS> infants`. If tickets are available, alert me with the site and booking URL and tell me to book immediately. If not, don't message me.

Tell the user they can change the interval or stop anytime (e.g. "check every 5 minutes instead", "stop watching"), via `mcp__scheduled-tasks__list_scheduled_tasks` / `update_scheduled_task`.

Be honest about two things: scheduled runs need the **Claude for Chrome extension connected and Chrome running** when each check fires (it drives the real browser), so on-demand checks are the most reliable and the hands-off loop is best-effort; and very short intervals (e.g. every 5 minutes) check the sites more aggressively than usually necessary — fine if the user wants it, but 15–30 minutes is plenty for most cases.

## Notes

- **No install / no Chromium:** this skill is pure browser automation via the extension. There is no script to run and no `npm`/Playwright dependency.
- **One site or two:** providing a single URL is fully supported.
- **Robustness:** because it reads the live page semantically (date buttons carry full date labels), it tolerates minor site changes better than fixed CSS selectors. If a site redesigns heavily, re-read the page and adapt the steps.
- **Advanced / self-hosted:** a standalone Node script (`check.js`) and a continuous macOS CLI (`monitor.js`, in the original repo) also exist for running checks outside Cowork — e.g. on a server or cron. See the repo README. These require their own environment with a real browser and network access.
