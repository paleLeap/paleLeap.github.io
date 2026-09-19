# paleLeap site: working notes

Point Claude Code at this folder. This file is the map and the rules; `LOG.md`
next to it is the history of why things are the way they are. Read both before
changing anything.

## What this is

The personal site for paleLeap, live at **https://paleleap.com**.

Plain static HTML, CSS and JavaScript. **No build step, no framework, no
dependencies.** Every file here is the file that ships. Keep it that way: the
point is that it can be edited directly, years from now, by hand.

## Where everything lives

    /data/portfolio                 THIS FOLDER. The live site.
    /data/outreach                  agency list and cold-email copy.
                                    Deliberately NOT in this repo: it holds
                                    third-party contact details and this repo
                                    is public.
    /data/wp/wordpress              a local WordPress, PHP built-in server
                                    plus SQLite. No MySQL, no Docker.
      .../themes/paleleap           a block theme that reproduces this site.
                                    Its own git repo, committed, NOT pushed.
    /data/setup-paleleap-domain.sh  one-time DNS/GitHub Pages wiring. Done.
    /data/setup-paleleap-dns.sh     one-time Cloudflare DNS. Done.

## Publishing

    cd /data/portfolio
    git add -A && git commit -m "what changed" && git push

Live at https://paleleap.com about a minute later. GitHub Pages serves it from
`paleLeap/paleLeap.github.io`.

Run it locally with `./serve.sh`, or open `index.html` from disk.

**Do not delete `CNAME`.** It is what tells GitHub which domain to answer for.
Removing it takes the site down.

## House rules

**Never use an em dash or en dash.** Anywhere: page copy, code comments, commit
messages, replies. Use a colon, comma, full stop or parentheses. This is a
standing instruction, not a preference about one paragraph.

**Verify by measurement, not by eye.** Nearly every bug in this project was
found by measuring geometry in a browser and comparing numbers, and several
were missed for a while by assuming. If a change is about position, size or
motion, measure it before and after and report the numbers.

**The browser pane does not composite frames.** `requestAnimationFrame` does
not run and CSS transitions freeze at their first frame, so reading a computed
style mid-transition returns the START value and looks like a bug that is not
there. To measure a settled state, force animations to finish first:

    document.querySelectorAll('.menu a, .brand, .panel').forEach(function (e) {
      e.getAnimations().forEach(function (a) { try { a.finish(); } catch (x) {} });
    });

**The browser caches CSS and JS hard.** A query string on the HTML does not
bust the stylesheet. This has caused several false "the fix did not work"
conclusions. Re-fetch it explicitly:

    document.querySelector('link[rel=stylesheet]').href =
      '/css/style.css?b=' + Date.now();

## How the page works

At rest: the name, and four lines reading `+ about`, `+ projects`, `+ social`,
`+ contact`. Clicking one sends the other three sliding left and fading, while
the chosen line steps right, grows, turns its `+` into `−`, and its panel
slides in from the right. Clicking again reverses it. The open section is in
the URL hash, so links are shareable and the back button works.

    index.html            the whole front end
    js/projects-data.js   THE PROJECT LIST. The only file to edit to add one.
    js/backgrounds.js     the background images and their timing
    js/main.js            open/close behaviour, project list, slideshow
    css/style.css         one stylesheet, all tokens at the top
    projects/_template.html   copy this to start a new project page
    assets/bg/            six pre-processed photographs
    assets/screenshots/   project screenshots (empty)
    downloads/            project zips (empty)

## Things that will bite you

**Nothing may change the document's height.** `html` is pinned to the viewport
with `overflow: hidden` and `body` is the scroll container. This is not
decoration: any change in document height makes a mobile browser re-clamp the
scroll position and animate its URL bar, which reads as the page jumping. Three
separate attempts failed before this one. If you add content, keep it inside
`body`'s scroll, and do not restore scrolling to `html`.

**The panels are positioned, not stacked.** `.panels` reserves the height of
the deepest panel, measured by `reserveSpace()` in `main.js` and written to
`--panel-reserve`. Reserve by the deepest bottom **edge**, not the tallest
panel: each row sits at a different offset, so the tallest is not always the
one reaching furthest down. A `ResizeObserver` recomputes it on width changes,
because the answer depends on how the copy wraps.

**The menu never changes height.** It is always four rows. `--i-open` moves the
panel instead. An animated height drags the panel vertically while it slides
sideways, turning the motion diagonal.

**Alignment is derived, not typed.** The menu's `+` lines up with the `l` in
paleLeap via `--menu-indent: calc(var(--brand-size) * 0.998)`, where 0.998 is
the measured width of "pa" in this face. A panel's copy hangs in by `--hang` so
its first letter sits under the *second* letter of the title. Both track the
type size automatically. **If the word `paleLeap` ever changes, remeasure
0.998**, because it is the width of "pa" specifically.

**Adding a fifth menu item takes three edits:** the new `--i` index in
`index.html`, the slug in `PANELS` in `main.js`, and the `4` in the `.menu`
height rule in `style.css`.

**Backgrounds must stay within the pan margin.** Layers are `scale(1.14)`, so
they overhang each edge by 7% of the width. A translate of P shows an edge once
`S * P > (S-1)/2`, which is 6.1% here. The pans reach 4%. Raising the pan
distance or lowering the scale without redoing that arithmetic will show black
edges. New images need the same treatment: cover 2100x1181, centre crop,
gaussian blur radius 0.8, JPEG quality 72.

**Only the first background loads up front.** The other five attach after
`load`, staggered, so 850KB of photographs do not compete with first paint.

**No `color-mix()` and no `:has()`.** Both were removed after the site broke on
an older iPhone. Dim colours are plain `rgba()` tokens: `--text-soft`,
`--text-ghost`, `--glow`, `--wash`, defined for light and dark.

**Reduced motion drops travel, not fades.** A blanket
`transition-duration: 0.01ms` made the whole site snap for anyone with Reduce
Motion switched on, which looked broken. Keep the crossfades.

## Open items

- The projects section says "Nothing published yet." Slate has a page at
  `projects/slate.html` but is not in `js/projects-data.js`, has no screenshots
  and no download.
- `assets/screenshots/` and `downloads/` are empty.
- The six background photographs are other people's work, taken from a personal
  wallpaper collection. Fine on a desktop, worth revisiting on a public site.
- The WordPress theme is committed locally but never pushed.
