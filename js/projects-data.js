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
