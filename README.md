# Portfolio site

Plain static HTML, CSS and JavaScript. No build step, no dependencies, no
framework. Every file here is the file that ships.

## Look at it

    ./serve.sh            # http://localhost:8080

Or just open `index.html` in a browser: it works from disk too.

## Layout

    index.html            the whole front end: the name, the four lines, and
                          the about / projects / social / contact panels
    projects/
      _template.html      copy this to start a new project page
      slate.html          one real page per project
    js/
      projects-data.js    THE PROJECT LIST: the only file you edit to add one
      main.js             open/close behaviour, project list, image fallbacks
    css/style.css         one stylesheet, all colours set at the top
    assets/bg/            the background photographs
    assets/screenshots/   project screenshots
    downloads/            the .zip files the download links point at

## How it behaves

At rest the page is the name and four lines:

    + about
    + projects
    + social
    + contact

Hovering a line glows it and grows it very slightly. Clicking one sends the
other three sliding left and fading out. The chosen line stays on its own row -
it only steps right, keeps the grown size, and turns its `+` into `−`. Its
content appears beneath. Clicking it again reverses the whole thing: it slides
back left, shrinks and dims, and the other three come back in from the right to
their old positions.

The menu shrinks to end just below whichever row is open (`--i-open` plus the
`is-collapsed` class, both set by `main.js`), so the gap between a title and its
content is the same whether you opened the first row or the last.

That height change is deliberately instant, never animated, and the class is
only removed once a leaving panel has finished. The panel sits below the menu in
normal flow, so a height that moved while the panel was sliding would drag it
vertically and turn a sideways slide into a diagonal one: which is exactly what
happened when the height was transitioned. Row position is set before the panel
is un-hidden, so it is at its final height from the first frame.

A panel's content slides in from the right as it appears and slides back out to
the right as it fades away: `main.js` waits for the leaving animation to finish
before hiding the panel, rather than hiding it outright. Nothing structural is
ever underlined; only links inside running copy underline on hover.

A panel's copy hangs in by `--hang` so its first letter sits under the *second*
letter of the title above it: the "I" of "I build" lands exactly on the "b" of
"about". `--hang` is the marker width plus one lowercase letter, multiplied by
`--open-scale`, so it follows the title's growth on its own. Remeasure the
`--letter-w` value only if you change the menu's font-size.

The menu items are absolutely positioned on a `--row` grid rather than sitting
in normal flow. That is what lets the chosen one travel to the top smoothly -
in normal flow the list would reflow and jump as the others left. If you add a
fifth item, give it the next `--i` index in the HTML, add it to `PANELS` in
`main.js`, and raise the `4` in the `.menu` height rule.

`paleLeap` is an `<h1>`, not a link. It has no hover state and no pointer
cursor. Opening a section does not remove it: it keeps its place in the layout
and only drifts up and left, shrinks to 85% and thins from 72% to 40% opacity,
over 900ms. Because it keeps its box, nothing below it reflows.

Clicks on the menu are intercepted in `main.js` rather than left to the browser.
Following a real `#id` link makes the browser scroll the target into view, which
on a longer page jolts and reads as having navigated somewhere. The handler
calls `preventDefault()` and writes the hash with `pushState` instead, so the
page never moves and the URL stays shareable.

The open section lives in the URL hash (`index.html#about`), so links are
shareable and the back button works. Motion is disabled for anyone whose system
asks for reduced motion.

## The background

Six photographs fade one into the next behind everything, dimmed almost to
black. Edit the list and the timing in `js/backgrounds.js`.

They are sourced from the wallpaper collection in
`/data/home-media/Pictures/wallpapers` and prepared for the web: scaled to
cover 1600x900, centre cropped, gaussian blurred at radius 3, and saved as
progressive JPEG at quality 70. That is about 40KB each, 296KB for all six,
against roughly 20MB for the 4K originals. The blur is baked into the files
rather than applied with a CSS filter, so the browser never pays to blur a
full-screen image on every frame.

The dimming is one number: the `opacity` on `.bg::after` in the stylesheet.
That scrim sits over the photographs at full strength, which keeps the
crossfade clean and means the six images do not each need their own exposure
adjustment.

Contrast was measured rather than eyeballed. The faint menu text reads 2.94:1
on the bare page; over the brightest patch of any background behind the menu it
drops to 2.35:1. Body copy stays above 15:1 throughout. Anyone who has asked
their system for reduced motion gets a single still image and no cycling.

## Why the page does not shift

Three rules work together to stop the layout moving when a section opens:

`scrollbar-gutter: stable` on `html` reserves the scrollbar's space whether or
not one is showing. Without it, opening a section grew the page, the scrollbar
appeared, the viewport narrowed by about 15px, and every `vw`-based value
reflowed at once. That lurch was the "twitchy" feel.

`overflow-x: clip` on `body` means the panel sliding in from the right can
never produce a horizontal scrollbar during the animation.

`min-height: 100svh` on `.stage` holds the page at least a screen tall, so a
short section opening does not add a vertical scrollbar at all. With the
tallest section open the document is exactly the viewport height.

## Browser support notes

Two things were changed after the site behaved badly on an iPhone:

`color-mix()` is gone. Safari only got it in 16.2, and an older iPhone drops
every declaration using it, so the dimmed name and the hover glow came out
wrong. Those colours are now plain `rgba()` tokens (`--text-soft`,
`--text-ghost`, `--glow`, `--wash`) defined for both light and dark.

The reduced-motion rule used to set every duration on the page to 0.01ms,
which made the whole site snap instead of transition. Anyone with iOS Settings
> Accessibility > Motion > Reduce Motion switched on would see no animation at
all. It now drops only the travel and keeps the crossfades: elements still land
in their designed positions, they just arrive without sliding.

## Type

Weights 100-200 throughout. The font stack picks faces that have a genuine
Thin cut (Ubuntu Sans on Linux, Helvetica Neue on macOS, Segoe UI on Windows)
so the thin weights are real rather than synthesised. Nothing is downloaded -
no webfont, no network request. If you ever want the same hairline on every
visitor's machine regardless of OS, that means self-hosting a variable font in
`assets/fonts/`, which is the one thing that would add weight to the page.

## Adding a project

1. Add an entry to the array in `js/projects-data.js`. There's a filled-in
   template at the bottom of that file to copy.
2. Copy `projects/_template.html` to `projects/<slug>.html` and write the page.
3. Drop screenshots in `assets/screenshots/` and point the `<figure>` tags at
   them. Missing images degrade to a placeholder box rather than breaking.
4. Drop the zip in `downloads/` and point the download button at it.

## Live at

**https://paleleap.com**

Hosted free on GitHub Pages from the `paleLeap/paleLeap.github.io` repo. DNS is
at Cloudflare: four A records and four AAAA records on the apex pointing at
GitHub's Pages addresses, plus a `www` CNAME. Every record is DNS-only, never
proxied, because proxying in front of Pages breaks certificate issuance. The
`CNAME` file in this folder is what tells GitHub which domain to answer for;
deleting it would break the site.

`www.paleleap.com` and `paleleap.github.io` both 301 to the apex, so older
links keep working.

To publish a change:

    git add -A && git commit -m "what changed" && git push

Live about a minute later.

## Hosting

The site is static, so anything that serves files works:

- **From this laptop**: `./serve.sh`, then a tunnel (cloudflared, ngrok) if it
  needs to be reachable from outside.
- **GitHub Pages**: push this folder, enable Pages on the branch. No config.
- **Netlify / Cloudflare Pages**: drag the folder in, or connect the repo.
  No build command, publish directory is the repo root.

Nothing in the site assumes a domain or a path prefix, so all of the above work
without edits.

## Still to do

- Real name and bio in `about.html`, links in `social.html`, address in
  `contact.html` (all marked with PLACEHOLDER).
- Screenshots.
- Build the download zips.
