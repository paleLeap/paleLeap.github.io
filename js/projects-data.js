/* ==========================================================================
   THE PROJECT LIST. The only file you edit to add a project.

   The home page and the projects page both build their cards from this array.
   Order here is the order they appear. To add a project:

     1. Copy the TEMPLATE block at the bottom of this file.
     2. Fill it in and move it into the array below.
     3. Copy projects/_template.html to projects/<slug>.html and write the page.

   Fields:
     slug      file name under projects/ (without .html). Also the id.
     name      display name
     blurb     one or two sentences, shown on the card
     tags      short labels: language, platform, status
     shot      path to the card image, or null for a placeholder box
     year      shown on the project page
     status    shown on the project page, free text
     download  path or URL for the download button, or null to hide it
     featured  true to show it on the home page
   ========================================================================== */

const PROJECTS = [

  {
    slug:     "westurn",
    name:     "Westurn",
    blurb:    "A first-person western duel. Draw from the holster, no crosshair, only the head or heart kills outright. Duel a friend online with a room code, take on five stages of outlaws, or work the shooting gallery out back.",
    tags:     ["Godot", "Windows, Linux, browser", "Online 1v1"],
    shot:     "assets/screenshots/westurn-01.jpg",
    year:     "2026",
    status:   "Prototype, playable",
    download: "downloads/Westurn-windows.zip",
    featured: true,
  },

  {
    slug:     "wallpaper-finder",
    name:     "Wallpaper Finder",
    blurb:    "Searches several wallpaper sites at once, shows small previews, and downloads only the ones you tick. Pick themes, a minimum size and a main colour. Does GIFs too.",
    tags:     ["Python", "Linux, Windows", "Open source"],
    shot:     "assets/screenshots/wallpaper-finder-01.jpg",
    year:     "2026",
    status:   "In use",
    download: "https://github.com/paleLeap/wallpaper-finder/archive/refs/heads/main.zip",
    featured: true,
  },

  {
    slug:     "slate",
    name:     "Slate",
    blurb:    "A single-window trading terminal that watches social feeds for the earliest mention of a ticker and keeps a live Top 10 ranked against your strategy. Read-only by design, it never places a trade.",
    tags:     ["Python", "Desktop", "Market data"],
    shot:     null,
    year:     "2026",
    status:   "Running daily",
    download: null,
    featured: true,
  },

];

/* --------------------------------------------------------------------------
   TEMPLATE. Copy this, fill it in, paste it into the array above.

  {
    slug:     "",
    name:     "",
    blurb:    "",
    tags:     ["", ""],
    shot:     null,              // "assets/screenshots/<slug>-card.png"
    year:     "2026",
    status:   "",
    download: null,              // "downloads/<slug>.zip"
    featured: false,
  },

   -------------------------------------------------------------------------- */
