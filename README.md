# checktickets — Cowork skill

Check ticket availability on **GetYourGuide** and/or **Tiqets** for a specific date, time slot, and party size — and get told whether tickets are currently bookable. Built for timed-entry attractions like the Sagrada Família or the Alhambra, where slots sell out fast.

> ### ⬇️ Get it in 30 seconds (no coding)
>
> **[Download the skill file → ](https://github.com/zeebees/checktickets-cowork/releases/latest)** (grab `checktickets.skill` under **Assets**)
>
> Then, in the **Claude desktop app**: open **Cowork → Settings → Capabilities**, click to add a skill, and pick the `checktickets.skill` file you just downloaded. That's it.
>
> To use it, just chat — e.g. *"check Sagrada Família tickets on GetYourGuide for Oct 13 2026, 2 adults"* and paste the ticket page link.

## Install (step by step)

1. **Download** `checktickets.skill` from the [latest release](https://github.com/zeebees/checktickets-cowork/releases/latest) (under **Assets**).
2. Open the **Claude desktop app** → **Cowork** → **Settings → Capabilities**.
3. **Add** the `checktickets.skill` file there. It loads automatically whenever you ask about checking tickets.

You don't need to run any commands or install anything else — just talk to Cowork.

## Use

Ask Cowork naturally and paste the ticket page URL(s), e.g.:

> Check Sagrada Família tickets on GetYourGuide for October 13 2026 at 9am for 2 adults
> (paste the GetYourGuide and/or Tiqets product-page URL)

The skill asks for anything missing (URLs, date, time slot, party size), runs one check, and reports whether tickets are bookable — with the booking link if they are.

### Modes

- **On-demand (default):** one check each time you ask.
- **Watch on a schedule:** say *"watch these and tell me when they open up"* and it sets up a recurring check (default every 15–30 min) that messages you only when tickets appear.
- **macOS desktop alert:** when run on a Mac, it can pop a desktop notification + voice + sound. On non-Mac environments, results just come back in chat.

## What you need

- The **Claude desktop app** with Cowork.
- At least one **GetYourGuide or Tiqets product-page URL**.
- Network access to those sites from wherever the skill runs.

## How it works (under the hood)

`check.js` drives a headless Chromium browser (via Playwright) to open each site's date picker, look for your target date, and — if you gave a time preference — check the time-slot UI. It prints a machine-readable JSON result that Cowork reads to report back. First run installs dependencies automatically:

```bash
npm install
npx playwright install --with-deps chromium
node check.js --gyg-url="..." --tiqets-url="..." --date="October 13 2026" --time="9:00 AM" --adults=2 --notify=auto
```

`--notify`: `auto` (macOS alert only when on a Mac, default), `macos` (force), `none` (off).

## CLI / continuous-monitor version

This skill is the **single-shot, Cowork-friendly** adaptation. The original project also ships a **command-line / continuous-monitor** version (`monitor.js`) that loops on its own every 2 minutes and is meant to run on a Mac — see the original repo: <https://github.com/zeebees/checktickets>.

That CLI version can be used standalone, without Cowork:

```bash
# interactive — prompts for each input
npm start

# or pass everything as flags
node monitor.js \
  --gyg-url="https://www.getyourguide.com/..." \
  --tiqets-url="https://www.tiqets.com/..." \
  --date="October 13 2026" \
  --time="9:00 AM" \
  --adults=2 --children=1 --infants=0
```

The two share the same scraping logic and CLI flags. The differences:

| | CLI `monitor.js` (original) | Skill `check.js` (this repo) |
|---|---|---|
| Runs | Loops every 2 min until stopped | One check per call |
| Alerts | macOS notification + voice + sound | JSON result + optional macOS alert via `--notify` |
| Recurring | Built-in loop | Cowork scheduled task |
| Best for | Running in a Mac terminal | Running inside Cowork |

If you want the always-on Mac terminal experience, use the CLI version from the original repo. If you want it inside Cowork (with scheduled re-checks and chat alerts), use this skill.

## Notes & limitations

- The scraper targets each site's **current** calendar/time-slot markup. If a site redesigns its page, the selectors in `check.js` may need updating.
- A `false` result with no error means "date not bookable." Persistent failures on a known-available date usually mean the selectors need a refresh.
- Headless Chromium needs system libraries present in the run environment (`npx playwright install --with-deps chromium` handles this where you have permission to install packages).

## Credits

Adapted for Cowork from the original macOS monitor at
<https://github.com/zeebees/checktickets>.
