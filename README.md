# Money Map

A personal operating system for all of your money: every entry in one ledger,
budgets on the groups it derives, subscriptions with real due dates, a
write-off tag for tax time, and a summary of where it comes from, where it
goes, and where it's heading. Warm paper-light theme, spring physics, no
dashboard chrome.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5199.

> Note: the npm scripts call `node ./node_modules/…` directly rather than the
> usual bare `vite`. This folder's path contains a `:`, which corrupts the
> `node_modules/.bin` entry npm injects into `PATH` (PATH is colon-separated),
> so the bare binary name can't be resolved. Nothing else depends on this.

## Pages

| Page | What it does |
|---|---|
| **Overview** | Deliberately sparse: the quick-add bar, one card with what's safe to spend this month (in, out, still due, all-time savings), and what's due in the next two weeks. Everything else has its own page. |
| **Ledger** | The whole history, stacked by day with month and day totals, newest first. Click any row to edit it. Search, or filter by month, direction, category or group. Hover any expense to mark it as a write-off in one click. |
| **Categories** | Your own buckets — a business, a channel, a trip. Pick one across the top and get that category's finances on their own: net, earned, spent, this month, earned-vs-spent ring, month-by-month bars, where its money comes from and goes, and every entry filed under it. |
| **Summary** | Two pies — where it comes from and where it goes — over this month, three months, the year or all time. Month-by-month cash flow. Then the estimates: where this month lands, a three-month forecast, and runway. |
| **Budgets** | Progress rings — the tick on each ring is where an even pace would put you today. Offers limits for the groups you already spend on, and a six-month trend per group. |
| **Subscriptions** | Everything on a schedule. Monthly and yearly totals, a 30-day timeline, "log payment" that advances the next date, pause / cancel, and suggestions for rhythms it spotted in the ledger. |
| **Taxes** | Write-offs by tax year, quarter and group. Business income and spend. Every tag's totals. CSV export for your accountant. |
| **Goals** | Progress cards. Money goals track your entries by themselves. |
| **Mind Map** | Infinite canvas. Double-click empty space to drop a bubble, drag from any edge to connect two, double-click a bubble to edit it. |

## Logging money

The quick-add bar at the top of Overview and Ledger is the fast path: pick
Spent or Earned, type what it was and how much, optionally pick a category,
press Enter. Today's date, nothing else to fill in. The grip button beside it
(or **N** anywhere) opens the full form for a different date, a new category,
something that repeats, or a note. Everything can be edited later by clicking
it in the ledger.

## Categories

Categories are the one thing you file by hand. Make one for anything you want
to see on its own — "Silas AI", "Consulting", a trip — and anything you earn
or spend can carry it. The **+ New** chip in the entry form makes one on the
spot. A subscription's category is carried onto every payment logged from it.
Removing a category leaves its entries in place, just uncategorised.

Groups (Groceries, Fuel, Ad Revenue…) are still worked out automatically from
titles, so the two never compete: groups say what a thing *was*, categories
say what it was *for*.

## Write-offs

Hover any expense in the ledger and hit the receipt icon to mark it as a
write-off (tax deductible). That single tag drives the Taxes page. Nothing
else needs tagging.

## Budgets

A budget is a ceiling on a group the ledger already derives — you never make a
category, you just cap one. Monthly or yearly, per group or across everything.
Each ring shows spend against limit, a pace tick, what's left, and a daily
allowance for the rest of the period. Past months can be reviewed with the
month picker.

## Subscriptions

Declared, not inferred: name, amount, cadence, next date. Logging a payment
writes an ordinary ledger entry and advances the date, so every chart keeps
reading from one record. The Summary page treats active subscriptions as
committed money when projecting the month. Anything the ledger shows repeating
on a steady interval that isn't already tracked is offered as a suggestion.

### Mind Map controls

| Action | How |
|---|---|
| Pan | Drag empty canvas, or two-finger scroll |
| Zoom | Pinch, or ⌘/Ctrl + scroll, or the dock |
| New bubble | Double-click empty canvas, or the dock's `+` |
| Edit text | Double-click a bubble (⌘↵ or Esc to finish) |
| Connect | Drag out from **anywhere along an edge** and draw whatever shape you like onto — or near — another bubble |
| Resize | Drag any **corner** |
| Recolour / delete | Select a bubble — the palette appears above it |
| Remove a connection | Hover it and click the ✕, or click it and press Delete |
| Fit everything on screen | The crosshair in the dock |
| Reset zoom | ⌘0 |

## Settings

| Setting | Notes |
|---|---|
| **Appearance** | Light, Dark, or System. System keeps following the OS as it changes. |
| **Motion** | Full or Reduced. Full defers to the OS preference; Reduced forces it. |
| **Currency** | Ten currencies. Changes how amounts are shown — it does not convert anything already logged. |
| **Export / Restore** | A JSON backup. The only copy that survives clearing your browser. |
| **Reset everything** | Clears entries, budgets, subscriptions, goals and bubbles behind a confirm step. Settings are kept. |

## How the automatic grouping works

You never make a category. Every transaction is just a title, an amount, an
optional note and a date. `src/lib/grouping.ts` derives the groups on every
read, in two passes:

1. **A small lexicon** snaps well-known concepts together, so `Shell`,
   `Chevron` and `gas` all land in **Fuel** even though the strings share
   nothing.
2. **String similarity** clusters everything else, so `YouTube AdSense`,
   `youtube adsense payout` and `Adsense` collapse into one group that nobody
   defined.

Because groups are derived rather than stored, no category state can drift out
of sync with the entries. The dialog shows where a title will be filed as you
type it — and if you disagree, **Change** lets you name the group yourself.
That correction is keyed to the title, so fixing one misfiled brand deal fixes
every entry with that name, past and future.

## Architecture

```
src/
  lib/
    types.ts        the domain model
    store.ts        persistence, migrations, every write
    ui.ts           ephemeral state: the global composer, cross-page filters
    grouping.ts     derived groups
    finance.ts      totals, month slices, trends, tax year, CSV
    budgets.ts      budget status against a window
    subscriptions.ts cadence math, due dates, payment matching
    outlook.ts      recurring detection, commitments, projection (feeds Summary)
    tags.ts         built-in tags
  components/       Sidebar, quick-add, icons, tags, month picker, ring, donut
  pages/
    registry.ts     ← the single source of truth for navigation
    overview/ ledger/ summary/ spending/ subscriptions/ taxes/ goals/ mindmap/
  styles/           design tokens + base
```

**Adding a page** takes three steps: build the component, add its id to
`PageId` in `lib/types.ts`, and append one entry to `PAGES` in
`pages/registry.ts`. The sidebar, routing and page transitions all read from
that list.

**One composer.** The entry form is mounted once at the app root and opened
through `lib/ui.ts`, so "add entry" means the same thing on every page — and
other pages can pre-fill it (a subscription's "log payment" is the composer
with the fields already in).

**Migrations.** Stored data carries a version; `migrate` in `store.ts` walks
older shapes forward. Restoring a backup from before budgets and subscriptions
existed works, and the storage key never changes because the inline theme
script in `index.html` reads it before React loads.

## Data

Everything is stored in `localStorage` under `money-map-os/v1` — no account, no
network. Clearing site data clears the app, so take a backup from Settings if
any of it matters.
