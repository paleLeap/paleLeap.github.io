/* The backdrop: Dallas at sunset, dissolving into itself behind the whole site.

   Two layers crossfade, each drifting slowly across itself the entire time, so
   something is always moving even in the middle of a hold. It runs on every
   page rather than one, because the panels are sections of a single document
   and a backdrop that restarted as you moved between them would announce the
   seams the fade transitions exist to hide.

   The blur and the darkening are baked into the files. Asking the browser to
   filter a full-screen image at 60fps costs far more than shipping one that is
   already soft, and on a phone it is the difference between a smooth drift and
   a stuttering one. Each file is 95 to 160 KB.

   Owner instruction, 2026-09-23: orange, bright and welcoming. It was ten
   generic cities dimmed to 66% and desaturated to 80%, chosen to stay out of the
   way. It is Dallas now, and the treatment is the other way round: brightness
   0.88, saturation 1.18, and the scrim over it lightened from .87 to .80 so a
   fifth of the photograph reaches the eye rather than an eighth.

   That was not a free change and the numbers are not a preference.
   tools/backdrop-contrast.py composites each shot under the real scrim and finds
   the brightest place a glyph could land; .80 is the lightest this can be with
   every text colour still clearing 4.5:1. It also turned up a failure that had
   been live all along: --faint was 4.27:1 on the OLD backdrops, because every
   grey on this site had been measured against flat --bg and never against the
   photographs actually behind it. Run that tool before touching any of this.

   tools/backdrop.py builds the files. The settings used to survive only as a
   sentence in the notes, which is enough to say what was done and not enough to
   do it again. */

(function () {
  'use strict';

  /* TWO SETS, and which one is showing depends on where the visitor is.

     Owner instruction: the skylines belong to the site at large, and the pages
     that are ABOUT the business should show the business. So Services and About
     get the owners' own photographs of their work, and everywhere else gets
     Dallas.

     This is the premise the header comment above used to deny, and the denial
     was right about the risk: a backdrop that RESTARTS as you move between
     panels announces the seams. So it does not restart. Switching sets keeps
     the same two layers and the same crossfade, and the new set simply arrives
     as the next image would have; nothing resets, nothing flashes. See
     useSet().

     THREE skylines, not ten. Of the six photographs supplied, two carry a
     photographer's credit burned into the image and one is 547px wide, which
     cannot fill a 1920 frame. */
  var CITY = [
    'assets/img/city/city-01.jpg',
    'assets/img/city/city-02.jpg',
    'assets/img/city/city-03.jpg'
  ];

  /* work-02 (the hooded selfie) and work-03 (the selfie on the grass) are out
     of the rotation, instruction 2026-10-22. Their files stay in
     assets/img/work/ and work/phone/, so either can come back by name here. */
  var WORK = [
    'assets/img/work/work-01.jpg',
    'assets/img/work/work-04.jpg',
    'assets/img/work/work-05.jpg'
  ];

  /* The blurred "working" plane that drifted against the skyline is GONE,
     owner instruction 2026-10-19, in person: it read as a glass panel sliding
     across the page, and with it on, two photographs were always showing at
     once. "It should simply show the images." Its files are still in
     assets/img/hero/ and its history is in LOG.md under "Two planes". */

  /* Owner instruction 2026-10-21: five of their own photographs, picked from
     an email, are the backdrop on EVERY page, and the skylines are retired.
     CITY and the per-panel switch are kept so a second set can come back by
     naming panels here again. */
  var SET_FOR = {};

  var SHOTS = WORK;

  /* Slower again, on the owners' second word about it: 5000/1600 first, then
     7000/2200, now this. The fade is a third of the cycle, which is the ratio
     that reads as dissolving rather than as switching.

     The other half of "slowly" is the drift, which is a CSS animation at 72s;
     the -36s offset below that keeps the two layers out of step is half of it
     and has to move with it. */
  var CYCLE_MS = 11000;
  /* Was 3400, a third of the cycle, so the two photographs blended for over
     three seconds. Owner instruction 2026-10-19: they were bleeding into each
     other. Short enough to be a change of picture, long enough not to be a
     cut. */
  var FADE_MS = 900;

  /* Stamped by bump.sh from the contents of assets/img/city, for the same
     reason the vehicle models carry one: these are fetched by a path built
     here, so nothing in index.html points at them and nothing would bust them
     if one were ever replaced. */
  var SHOTS_V = '?v=d1c82c1e';

  var host = document.querySelector('.backdrop');
  if (!host) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* A different city greets you each visit. The set is fixed so the files can
     be cached; only where the cycle starts moves. */
  var at = Math.floor(Math.random() * SHOTS.length);

  /* A second copy of the backdrop, inside the phone's bottom bar.

     Owner instruction, 2026-10-19, in person: the only thing that may show
     through the see-through bar is the background. The page scrolls under a
     fixed bar, so a plain translucent bar showed whatever text was passing
     beneath it ("All major cards, cash, Zelle" over "contact"). So the bar is
     opaque now, and what it paints is this copy: viewport-sized and fixed, so
     it lines up exactly with the real backdrop, clipped to the bar by the
     bar's own clip-path, with the orange laid over it. See .backdrop--dock.

     Every layer below is a PAIR, one element in each host, driven together:
     same image, same is-on, and created in the same instant so the CSS drift
     runs on the same clock in both. They cannot drift apart because nothing
     ever touches one without the other. */
  var hosts = [host];
  var dock = document.querySelector('.dock');
  if (dock) {
    var twin = document.createElement('div');
    twin.className = 'backdrop backdrop--dock';
    twin.setAttribute('aria-hidden', 'true');
    dock.insertBefore(twin, dock.firstChild);
    hosts.push(twin);
  }

  var layers = [makeLayer(0), makeLayer(1)];
  var front = 0;
  var timer = null;

  function makeLayer(i) {
    var els = hosts.map(function (h) {
      var d = document.createElement('div');
      d.className = 'backdrop__layer';
      d.style.transitionDuration = FADE_MS + 'ms';
      d.style.animationDelay = (i * -36) + 's';   // half of the 72s drift in the CSS
      h.appendChild(d);
      return d;
    });
    /* Shaped like the one element it used to be, so the crossfade code below
       did not have to change: classList.add/remove and a painted image. */
    return {
      els: els,
      classList: {
        add: function (c) { els.forEach(function (d) { d.classList.add(c); }); },
        remove: function (c) { els.forEach(function (d) { d.classList.remove(c); }); }
      }
    };
  }

  /* Portrait screens get the uncropped copy in phone/, panned across. See
     "Portrait screens" in the stylesheet. Only the work set has phone copies;
     anything else is shown as it is. */
  var tall = window.matchMedia('(max-aspect-ratio: 1/1)');
  var panReverse = false;

  function fit(src) {
    return tall.matches ? src.replace('assets/img/work/', 'assets/img/work/phone/') : src;
  }

  function show(src, layer) {
    layer.els.forEach(function (d) {
      d.style.backgroundImage = 'url("' + fit(src) + SHOTS_V + '")';
    });

    /* The pan restarts with every photograph, one edge to the other over its
       whole time on screen, fade out included, and the next one comes back the
       other way. Both of the pair are stopped, then restarted in the same
       instant, so the bar's copy cannot fall out of step with the page's. */
    if (!tall.matches || reduced.matches) {
      layer.els.forEach(function (d) { d.style.animation = ''; });
      return;
    }
    layer.els.forEach(function (d) { d.style.animation = 'none'; });
    void layer.els[0].offsetWidth;    // commit the stop, or the restart is a no-op
    var pan = 'pan ' + (CYCLE_MS + FADE_MS) + 'ms ease-in-out both' +
              (panReverse ? ' reverse' : '');
    layer.els.forEach(function (d) { d.style.animation = pan; });
    panReverse = !panReverse;
  }

  /* Fetched one ahead rather than all at once. Ten photographs is 1.3 MB, and
     nobody who came here to get a quote should wait on the ninth one. At five
     seconds a turn there is a full cycle of slack to fetch the next. */
  function warm(src) {
    var img = new Image();
    img.decoding = 'async';
    img.src = fit(src) + SHOTS_V;
  }

  function step() {
    /* A tab in the background does not paint, so the crossfade would not run
       and every queued step would land at once on return: ten images flashing
       through in a frame. Skip while hidden and pick up on the next tick. */
    if (document.hidden) return;

    at = (at + 1) % SHOTS.length;
    crossfadeTo(SHOTS[at]);
  }

  /* The crossfade itself, lifted out of step() so that changing SETS can use it
     too. Every visible change of image goes through here, which is what keeps
     an arrival on About looking like an ordinary dissolve rather than a cut. */
  function crossfadeTo(src) {
    var back = layers[1 - front];
    show(src, back);

    var swapped = false;
    function swap() {
      if (swapped) return;
      swapped = true;
      back.classList.add('is-on');
      layers[front].classList.remove('is-on');
      front = 1 - front;
      warm(SHOTS[(at + 1) % SHOTS.length]);
    }

    // let the image paint before it is faded up, or the first frame flashes
    requestAnimationFrame(function () { requestAnimationFrame(swap); });

    /* And a timer behind it, because requestAnimationFrame DOES NOT RUN in a
       tab the browser is not painting. This file's own step() is safe from that
       by accident: it returns early on document.hidden and so never reaches the
       rAF. useSet does not have that guard, because a panel change is something
       a visitor does, and the state this releases is which layer is showing.
       Left unreleased, `front` never flips and the backdrop stops changing.

       Same lesson as the transition lock and the slide animations, both of
       which are in LOG.md's traps for the same reason: anything that releases
       state inside rAF needs a timer as well.

       120ms, not 0: the rAF path has to win in the normal case, or the image
       gets faded up before it has painted and the first frame flashes. Two
       frames is about 32ms, so this only ever fires when rAF is not running. */
    setTimeout(swap, 120);
  }

  /* Change which set is cycling, without breaking the cycle.

     Deliberately does NOT touch the layers, the timer or `front`. It swaps the
     list and lands `at` inside it, and the next ordinary step crossfades to the
     new set exactly as it would have to the next skyline. A visitor moving to
     About sees the current image dissolve into a photograph of the work, on the
     same 3.4s fade as every other change.

     The first version of this only swapped the list and let the NEXT ordinary
     tick carry the new set in. That was wrong by up to a full cycle: click
     About and you sit looking at a skyline for eleven seconds, on the page
     where the whole point is to be looking at their work. Measured that way and
     it was exactly as bad as it sounds.

     So it crossfades NOW, through the same 3.4s dissolve every other change
     uses. Not a cut: the panel swap in landing.js happens at full page
     transparency, but the backdrop is NOT inside .flow and does not fade with
     it, so an instant swap would be the one hard edge on the screen.

     The timer is restarted rather than left running, so the new image gets a
     full hold instead of however little was left of the old one's. */
  function useSet(next) {
    if (!next || next === SHOTS) return;
    SHOTS = next;
    at = Math.floor(Math.random() * SHOTS.length);
    if (reduced.matches) { show(SHOTS[at], layers[front]); return; }
    crossfadeTo(SHOTS[at]);
    if (timer) { clearInterval(timer); timer = setInterval(step, CYCLE_MS); }
  }

  document.addEventListener('panel:change', function (e) {
    var id = e && e.detail && e.detail.id;
    useSet(SET_FOR[id] || WORK);
  });

  function start() {
    var first = SHOTS[at];
    var img = new Image();

    /* Faded up only once the first photograph has actually arrived. Switching
       the host on before then shows a bare rectangle for as long as the network
       takes, which on a slow connection reads as a rendering fault. */
    img.onload = function () {
      show(first, layers[0]);
      layers[0].classList.add('is-on');
      hosts.forEach(function (h) { h.classList.add('is-on'); });
      warm(SHOTS[(at + 1) % SHOTS.length]);

      // Nothing switches for anyone who has asked for less motion: they get one
      // city, held, and the drift is turned off in the stylesheet.
      if (reduced.matches) return;
      timer = setInterval(step, CYCLE_MS);
    };
    img.onerror = function () { /* no backdrop is better than a broken one */ };
    img.src = fit(first) + SHOTS_V;
  }

  start();
})();
