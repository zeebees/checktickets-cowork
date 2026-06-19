# checktickets — Cowork skill

Check ticket availability on **GetYourGuide** and/or **Tiqets** for a specific date, time slot, and party size — and get told whether tickets are currently bookable. Built for timed-entry attractions like the Sagrada Família or the Alhambra, where slots sell out fast.

**No Chromium, no scripts, nothing to install.** The skill reads the real ticket pages through the **Claude for Chrome** browser extension — it drives your own browser, so it just works.

> ### ⬇️ Get it in 30 seconds (no coding)
>
> 1. **[Download the skill file → ](https://github.com/zeebees/checktickets-cowork/releases/latest)** (grab `checktickets.skill` under **Assets**)
> 2. In the **Claude desktop app**: open **Cowork → Settings → Capabilities** and add the `checktickets.skill` file.
> 3. Make sure the **[Claude for Chrome](https://www.anthropic.com/claude/chrome) extension** is installed and connected.
>
> Then just chat — e.g. *"check Sagrada Família tickets on GetYourGuide for Oct 13 2026, 2 adults"* and paste the ticket page link. A tab opens in your browser, Claude reads the calendar, and tells you if it's bookable.

## Install (step by step)

1. **Download** `checktickets.skill` from the [latest release](https://github.com/zeebees/checktickets-cowork/releases/latest) (under **Assets**).
2. Open the **Claude desktop app** → **Cowork** → **Settings → Capabilities**.
3. **Add** the `checktickets.skill` file there. It loads automatically whenever you ask about checking tickets.
4. Install/connect the **[Claude for Chrome](https://www.anthropic.com/claude/chrome) extension** — that's how the skill reads the ticket pages.

You don't need to run any commands or install anything else — just talk to Cowork.

## Use

Ask Cowork naturally and paste the ticket page URL(s), e.g.:

> Check Sagrada Família tickets on GetYourGuide for October 13 2026 at 9am for 2 adults
> (paste the GetYourGuide and/or Tiqets product-page URL)

The skill asks for anything missing (URLs, date, time slot, party size), runs one check, and reports whether tickets are bookable — with the booking link if they are.

### Modes

- **On-demand (default):** one check each time you ask.
- **Watch on a loop:** have Cowork re-check automatically on a schedule and ping you when tickets appear. See below.
- **macOS desktop alert:** when run on a Mac, it can pop a desktop notification + voice + sound. On non-Mac environments, results just come back in chat.

## Watch on a loop (recurring checks)

You don't have to keep asking. Cowork can re-run the check on a schedule and only message you when tickets actually open up — no coding, all in chat.

1. After a normal check, just say something like:

   > Watch these every 30 minutes and tell me the moment tickets open up.

2. Cowork sets up a **scheduled task** that re-runs the check on that cadence, holding your URLs, date, time, and party size.
3. Each run, it only messages you **if tickets are available** — with the site and booking link so you can grab them fast. If nothing's available, it stays quiet.

Tips:

- **Pick a sensible frequency.** Every 15–30 minutes is plenty. Checking every minute just hammers the ticket sites and isn't more useful.
- **Change or stop it anytime** by asking in chat, e.g. *"check every 15 minutes instead"* or *"stop watching those tickets."*
- **Where alerts show up:** in your Cowork chat. (On a Mac you can also get the desktop pop-up — see the macOS alert mode above.)
- The scheduled task runs on its own once set up; you don't need to keep the conversation open.

> Prefer an always-on loop in a terminal instead? See the [CLI / continuous-monitor version](#cli--continuous-monitor-version) below.

## What you need

- The **Claude desktop app** with Cowork.
- The **Claude for Chrome** browser extension, connected.
- At least one **GetYourGuide or Tiqets product-page URL**.

That's it — no Node, no Playwright, no Chromium, no terminal.

## How it works (under the hood)

The skill is a set of instructions that drive the **Claude for Chrome** extension. When you ask, Claude opens a tab in your own browser, goes to the ticket page, dismisses the cookie banner, opens the date picker, steps to your month, and reads the calendar. Each date is exposed as a labelled button (e.g. `"Tuesday, October 13, 2026"`), so Claude can target the exact date and tell whether it's selectable. Selecting an available date reveals the booking options/price/times, which Claude reads back to you. Because it reads the live page in your real, logged-in browser, there's no headless browser to install and no bot-detection headaches.

## Advanced: self-hosted / cron (optional)

For running checks **outside Cowork** — e.g. on a server or a schedule that doesn't depend on your browser being open — the repo also includes a standalone Node script, `check.js`, that uses Playwright:

```bash
npm install
npx playwright install --with-deps chromium
node check.js --gyg-url="..." --tiqets-url="..." --date="October 13 2026" --time="9:00 AM" --adults=2 --notify=auto
```

This needs its own environment with a real browser and network access to the ticket sites (it will **not** run inside Cowork's sandbox). `--notify`: `auto` (macOS alert only on a Mac, default), `macos` (force), `none` (off).

## CLI / continuous-monitor version

The original project also ships a **command-line / continuous-monitor** version (`monitor.js`) that loops on its own every 2 minutes and is meant to run on a Mac — see the original repo: <https://github.com/zeebees/checktickets>.

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

### Which one should I use?

| | Cowork skill (this repo) | Self-host `check.js` | CLI `monitor.js` (original) |
|---|---|---|---|
| Where it runs | Your browser, via Claude for Chrome | A server / your machine (Playwright) | A Mac terminal |
| Install needed | Just the Chrome extension | Node + Playwright + Chromium | Node + Playwright + Chromium |
| Recurring | Cowork scheduled task | Your own cron | Built-in 2-min loop |
| Alerts | Cowork chat (+ Mac pop-up) | JSON / optional Mac alert | macOS notification + voice |
| Best for | Most people — no setup | Always-on, browser-independent watching | Developers on a Mac |

Most people should use the **Cowork skill**. Reach for the self-host script or CLI only if you want unattended watching that doesn't depend on your browser being open.

## Notes & limitations

- The skill reads each site's **live** calendar in your browser, so it adapts to minor changes better than fixed CSS selectors. If a site redesigns heavily, the step-by-step instructions in `SKILL.md` may need a tweak.
- "Not available" means the date wasn't selectable or showed no booking options when checked.
- **Scheduled watching** drives your real browser, so it needs Chrome running and the extension connected when each check fires. On-demand checks are the most reliable.

## Credits

Adapted for Cowork from the original macOS monitor at
<https://github.com/zeebees/checktickets>.
