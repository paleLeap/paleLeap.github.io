# Auto Glass Site (working name)

Ground-up rebuild of a family auto glass repair company's website.
Not working off their existing hosting; this is a fresh static build.

## Goals
1. Keep the substance of the current site (they have a lot of real information).
2. Make it far easier to navigate: fewer pages, clearer hierarchy, minimal chrome.
3. Sleek, minimal visual design.
4. Ship one purpose-built tool (spec pending) that the current site does not have.

## Build order
- Desktop/PC first, then adapt to mobile. Layout should not paint us into a corner
  for the mobile pass, so structure stays flow-based and content-driven.

## Stack
Static HTML/CSS/JS, no build step, no framework. Matches how the portfolio site
is run: edit files, refresh, done. Revisit only if the tool genuinely needs more.

## Layout
- index.html          entry page
- pages/              additional pages
- css/                styles
- js/                 scripts
- assets/img, fonts   media
- reference/          dump of the CURRENT site content (source material, untouched)
- notes/              working notes, decisions, content inventory, tool spec

## Run it

    python3 -m http.server 4173 --directory /data/autoglass

then open http://localhost:4173

## Status

Desktop is built and working end to end.

The quote tool is the landing page: VIN decode against NHTSA vPIC, a no-VIN
fallback, a 3D glass picker across eight body archetypes, photographs, timing
triage, a review screen and contact capture. Around it sit services, guarantee,
about and contact, plus a help page.

Delivery is NOT wired. Nothing is sent anywhere yet.

Next: mobile, again. The first mobile pass passed emulator testing and failed
on a real phone. See notes/06-mobile.md; the short version is that the flow is a
desktop pattern wearing mobile CSS, and the phone needs one step per screen
rather than one long page.

See notes/01-decisions.md for the full record and notes/05-test-vins.md for
verified VINs to test with.
