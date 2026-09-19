# Log

Newest last. Why things are the way they are, including the wrong turns, so
they do not get repeated. Times are local (CDT).

## 2026-09-18 19:04 CDT: built

Started as a multi-page static portfolio: home, projects, about, contact, with
cards and a sticky header. That was wrong for what was wanted and got stripped
back over several passes:

- The nav moved from a top bar to a left column, then to four bare lines.
- The cards went. A portfolio of boxes fought the minimal direction, so the
  projects list became plain text.
- The separate pages were folded into one shell, because the requirement was
  that no content shows until a section is clicked. That only works if the
  content lives on one page.
- `paleLeap` went from a 21px bold link to 88px weight 100, not clickable, at
  72% opacity.

**Type.** Weights 100 to 200 throughout. Checked what was installed rather than
assuming: Ubuntu Sans here is a variable font with a real Thin cut, so the
stack prefers faces that have one (Ubuntu Sans, Helvetica Neue, Segoe UI). No
webfont, no network request. A visitor on an OS without a thin face gets a
lighter-looking regular.

**Alignment.** The menu's `+` lines up with the `l` in paleLeap. Measured
rather than guessed: "pa" is 0.998x the font size in this face, so the indent
is `calc(var(--brand-size) * 0.998)` and tracks the type at every width.
Verified identical to the pixel at 375, 974 and 1600.

## 2026-09-18 19:41 CDT: motion

Opening a section had to move rather than blink. Several iterations:

1. Panels were hidden with the `hidden` attribute, which cannot animate at all.
   Replaced with enter/exit animations, hiding only after the exit finishes.
2. The chosen row rode up to the top row. Reported as "they all move up and to
   the right". Correct: `about` looked fine only because it is already row 0.
   The row now stays where it is and only steps right.
3. Panels appeared to slide in from the bottom-right rather than the right.
   Cause: the menu height was animating underneath them, dragging them upward
   during the horizontal slide. `contact` looked right because it is the bottom
   row and nothing collapses under it. The menu height is now instant and the
   row is set before the panel is shown.

## 2026-09-18 21:00 CDT: iPhone

Reported as pages opening and closing with no transition. Two causes:

- A blanket `prefers-reduced-motion` rule set every duration to 0.01ms, so
  anyone with Reduce Motion enabled got no animation anywhere. It now drops
  travel and keeps fades.
- `color-mix()` needs Safari 16.2. On older iOS every declaration using it was
  discarded, so the dimmed name and the hover glow rendered wrong. Replaced
  with plain `rgba()` tokens. A `:has()` rule was removed at the same time.

## 2026-09-18 22:28 CDT: live

Registered paleleap.com at Cloudflare at 22:09. `.leap` is not a TLD, confirmed
against IANA's list, so `pale.leap` was never possible.

DNS: four A and four AAAA records on the apex at GitHub's Pages addresses, plus
a `www` CNAME, all DNS-only. Proxying breaks certificate issuance. GitHub Pages
serves from `paleLeap/paleLeap.github.io`; the `CNAME` file in the repo is what
binds the domain.

Note for future debugging: the local resolver cached a negative answer from
before the A records existed and kept reporting no A records while Cloudflare's
own nameservers had them. Query the authoritative nameserver directly before
concluding DNS is broken.

## 2026-09-18 22:39 CDT: the layout would not sit still

Reported as twitchy on desktop and jumping on mobile. Took four attempts.

**Attempt 1, 22:39.** Found that opening a section grew the page past the
viewport, the scrollbar appeared, and the viewport width dropped 1280 to 1265.
The padding is measured in `vw`, so everything reflowed horizontally in one
frame. Added `scrollbar-gutter: stable`, `overflow-x: clip` and
`min-height: 100svh`. Fixed desktop. Softened the easing at the same time,
since the old curve started fast and braked hard.

**Attempt 2, 23:12.** Mobile still jumped. Took the panels out of flow,
reserved the tallest panel's height, stopped the menu changing height. Measured
everything as constant and was wrong.

**Attempt 3, 23:16.** Found a leftover rule cutting the stage's top padding
from 7vh to 5vh on open, moving the whole page up 16px. Removed it. Also found
the reserve used the tallest panel's **height** when it needed the deepest
bottom **edge**, and was only measured once at load so a width change broke it.
Added a `ResizeObserver`. Still jumped.

**Attempt 4, 23:21, the one that worked.** Every previous attempt kept the
document scrollable and tried to hold its height constant. That is fragile, and
any change at all makes a mobile browser re-clamp the scroll and animate its
URL bar. `html` is now pinned to the viewport with `overflow: hidden` and
`body` is the scroll container. The document height cannot change, so there is
nothing to re-clamp. Verified: `html` cannot scroll, document height 812 in
every state.

**Lesson worth keeping:** two of those attempts were declared fixed on the
strength of desktop measurements. The browser pane here does not composite
frames and caches CSS hard, which produced false readings in both directions. A
diagnostic overlay on the real device is what finally settled it.

## 2026-09-18 23:12 CDT: backgrounds

Six photographs crossfading, each drifting slowly across itself.

Picked from roughly 280 landscape 4K+ wallpapers. First attempt used ffmpeg's
`tile` filter to build a contact sheet; it emitted frames early and produced a
scrambled index-to-image mapping, so the first six picks were effectively
random. Caught when a file named `bg-peak` turned out to be an aerial city.
Rebuilt the sheet with Pillow and labelled every cell.

Processing: cover 2100x1181, centre crop, gaussian blur radius 0.8, JPEG
quality 72. Larger than a screen needs because the layer is scaled to 1.14 to
have room to pan. 852KB for six, against roughly 20MB for the originals. Only
the first loads up front.

## 2026-09-18 21:30 CDT: WordPress

Built a block theme reproducing this site, to make "I do WordPress" true with a
public repo behind it rather than a claim. Runs on PHP's built-in server with
WordPress's SQLite integration: no MySQL, no Docker.

First version was a conventional blog that happened to share the colours, which
was wrong. Rebuilt so the front page is its own template driving two
server-rendered blocks, `paleleap/menu` and `paleleap/sections`, reading the
same list of page slugs. The four sections stay editable as ordinary Pages.
Verified identical to this site on every measured value.

Committed locally. Never pushed.

## 2026-09-18 20:20 CDT: outreach

Not part of the site, but the reason it exists. In `/data/outreach`: 32
verified-live agencies with contact routes, split into 20 that need no
WordPress and 12 that do, plus cold-email copy and follow-ups. Nothing sent.

The pitch is overflow capacity, not website building. Those agencies already
build websites; what they buy is a spare pair of hands when they have sold more
than they can staff.
