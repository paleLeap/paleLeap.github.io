/* ==========================================================================
   THE BACKGROUND SLIDESHOW

   The images that fade behind the page, in the order they cycle. Add, remove
   or reorder freely. Paths are relative to the site root; main.js prefixes
   "../" automatically on the project pages.

   Images live in assets/bg/. They are pre-scaled to 1600x900 and the blur is
   already baked into the file, so the browser never pays to blur them at
   runtime. To add one, run it through the same treatment (scale to cover
   1600x900, centre crop, gaussian blur radius 3, JPEG quality 70) so it
   matches the others and stays small.

   HOLD_MS  how long each image sits at full strength
   FADE_MS  how long the crossfade between two images takes

   Each layer also drifts slowly across itself the whole time. That is pure
   CSS, in style.css: the layer is scaled to 1.14 so it has room to move
   without ever exposing an edge.
   ========================================================================== */

const BACKGROUNDS = [
  "assets/bg/mountain-stars.jpg",
  "assets/bg/harbour.jpg",
  "assets/bg/peaks-dusk.jpg",
  "assets/bg/tower-night.jpg",
  "assets/bg/ridges.jpg",
  "assets/bg/skyline.jpg",
];

const BG_HOLD_MS = 4000;
const BG_FADE_MS = 3500;
