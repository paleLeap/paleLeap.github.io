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

  var WORK = [
    'assets/img/work/work-01.jpg', 'assets/img/work/work-02.jpg',
    'assets/img/work/work-03.jpg', 'assets/img/work/work-04.jpg',
    'assets/img/work/work-05.jpg', 'assets/img/work/work-06.jpg',
    'assets/img/work/work-07.jpg', 'assets/img/work/work-08.jpg',
    'assets/img/work/work-09.jpg', 'assets/img/work/work-10.jpg',
    'assets/img/work/work-11.jpg'
  ];

  /* Them working, blurred, for the layer that moves against the skyline.
     Damage shots and personal posts are deliberately not in here: the owners
     asked for "images of them working, nothing about damage". */
  var HERO = [
    'assets/img/hero/hero-01.jpg', 'assets/img/hero/hero-02.jpg',
    'assets/img/hero/hero-03.jpg', 'assets/img/hero/hero-04.jpg',
    'assets/img/hero/hero-05.jpg', 'assets/img/hero/hero-06.jpg',
    'assets/img/hero/hero-07.jpg', 'assets/img/hero/hero-08.jpg',
    'assets/img/hero/hero-09.jpg', 'assets/img/hero/hero-10.jpg',
    'assets/img/hero/hero-11.jpg', 'assets/img/hero/hero-12.jpg'
  ];

  /* Anything not named here keeps the skylines. */
  var SET_FOR = { services: WORK, about: WORK };

  var SHOTS = CITY;

  /* Slower again, on the owners' second word about it: 5000/1600 first, then
     7000/2200, now this. The fade is a third of the cycle, which is the ratio
     that reads as dissolving rather than as switching.

     The other half of "slowly" is the drift, which is a CSS animation at 72s;
     the -36s offset below that keeps the two layers out of step is half of it
     and has to move with it. */
  var CYCLE_MS = 11000;
  var FADE_MS = 3400;

  /* Stamped by bump.sh from the contents of assets/img/city, for the same
     reason the vehicle models carry one: these are fetched by a path built
     here, so nothing in index.html points at them and nothing would bust them
     if one were ever replaced. */
  var SHOTS_V = '?v=9cd2974e';

  var host = document.querySelector('.backdrop');
  if (!host) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* A different city greets you each visit. The set is fixed so the files can
     be cached; only where the cycle starts moves. */
  var at = Math.floor(Math.random() * SHOTS.length);

  var layers = [makeLayer(0), makeLayer(1)];
  var front = 0;
  var timer = null;

  /* The second plane: them working, drifting the other way. Its own pair of
     layers, its own crossfade and its own clock, deliberately. Sharing the
     skyline's timer would land both changes on the same frame, and two
     photographs swapping together is a cut however long the fade is. */
  var heroLayers = [makeLayer(0, 'backdrop__layer--work'),
                    makeLayer(1, 'backdrop__layer--work')];
  var heroFront = 0;
  var heroAt = Math.floor(Math.random() * HERO.length);
  var heroTimer = null;

  function makeLayer(i, extra) {
    var d = document.createElement('div');
    d.className = 'backdrop__layer' + (extra ? ' ' + extra : '');
    d.style.transitionDuration = FADE_MS + 'ms';
    d.style.animationDelay = (i * -36) + 's';   // half of the 72s drift in the CSS
    host.appendChild(d);
    return d;
  }

  function show(src, layer) {
    layer.style.backgroundImage = 'url("' + src + SHOTS_V + '")';
  }

  /* Fetched one ahead rather than all at once. Ten photographs is 1.3 MB, and
     nobody who came here to get a quote should wait on the ninth one. At five
     seconds a turn there is a full cycle of slack to fetch the next. */
  function warm(src) {
    var img = new Image();
    img.decoding = 'async';
    img.src = src + SHOTS_V;
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
    useSet(SET_FOR[id] || CITY);
  });

  /* The working plane's own cycle. Same shape as step(), same hidden-tab
     guard, same double rAF with a timer behind it. */
  function heroStep() {
    if (document.hidden) return;
    heroAt = (heroAt + 1) % HERO.length;
    var back = heroLayers[1 - heroFront];
    back.style.backgroundImage = 'url("' + HERO[heroAt] + SHOTS_V + '")';
    var swapped = false;
    function swap() {
      if (swapped) return;
      swapped = true;
      back.classList.add('is-on');
      heroLayers[heroFront].classList.remove('is-on');
      heroFront = 1 - heroFront;
      warm(HERO[(heroAt + 1) % HERO.length]);
    }
    requestAnimationFrame(function () { requestAnimationFrame(swap); });
    setTimeout(swap, 120);
  }

  function startHero() {
    var first = HERO[heroAt];
    var img = new Image();
    img.onload = function () {
      heroLayers[0].style.backgroundImage = 'url("' + first + SHOTS_V + '")';
      heroLayers[0].classList.add('is-on');
      warm(HERO[(heroAt + 1) % HERO.length]);
      if (reduced.matches) return;
      /* Offset from the skyline's cycle on purpose. At the same interval the
         two planes would change together every time and the opposition would
         be invisible; staggered, one is always mid-dissolve while the other
         holds. */
      heroTimer = setInterval(heroStep, CYCLE_MS + 4000);
    };
    img.onerror = function () { /* the skyline alone is a fine backdrop */ };
    img.src = first + SHOTS_V;
  }

  /* ---- the landing's band: them working, in focus ----

     Owner instruction, 2026-09-23: the band where the sketch draws a truck
     becomes "smooth panning images of ONLY the employees working, humans in
     the picture". Its own element, .hero__reel, rather than another plane of
     the fixed backdrop: these are the subject, sharp and opaque, and the
     skyline stays behind the sheet below as it is on the other pages.

     Each photograph pans ONCE across the whole time it is visible, fade in to
     fade out, so the motion never stops and never reverses on screen. The pan
     is restarted on a layer each time it is reused (class off, reflow, class
     on), and alternates direction so two in a row do not slide the same way.

     fx is where the person stands, from tools/crew.py; keep the two in step. */
  var CREW = [
    { src: 'assets/img/crew/crew-01.jpg', fx: '85%' },
    { src: 'assets/img/crew/crew-02.jpg', fx: '50%' },
    { src: 'assets/img/crew/crew-03.jpg', fx: '35%' },
    { src: 'assets/img/crew/crew-04.jpg', fx: '83%' },
    { src: 'assets/img/crew/crew-05.jpg', fx: '66%' },
    { src: 'assets/img/crew/crew-06.jpg', fx: '55%' }
  ];
  var CREW_CYCLE_MS = 8000;
  var CREW_FADE_MS = 2400;     // .hero__shot's transition in the stylesheet

  function startCrew() {
    var reel = document.querySelector('.hero__reel');
    if (!reel) return;
    var shots = [0, 1].map(function () {
      var d = document.createElement('div');
      d.className = 'hero__shot';
      /* Visible for a cycle plus both fades, and panning for all of it. */
      d.style.setProperty('--pan', (CREW_CYCLE_MS + CREW_FADE_MS * 2) + 'ms');
      reel.appendChild(d);
      return d;
    });
    var on = 0;
    var i = 0;
    var flip = false;

    function load(layer, shot) {
      layer.style.backgroundImage = 'url("' + shot.src + SHOTS_V + '")';
      layer.style.setProperty('--fx', shot.fx);
      layer.classList.remove('is-panning');
      void layer.offsetWidth;                  // restart the pan from its start
      layer.classList.toggle('is-rev', flip);
      flip = !flip;
      layer.classList.add('is-panning');
    }

    function next() {
      if (document.hidden) return;
      i = (i + 1) % CREW.length;
      var back = shots[1 - on];
      var img = new Image();
      img.onload = function () {
        load(back, CREW[i]);
        back.classList.add('is-on');
        shots[on].classList.remove('is-on');
        on = 1 - on;
        warm(CREW[(i + 1) % CREW.length].src);
      };
      img.src = CREW[i].src + SHOTS_V;
    }

    var first = new Image();
    first.onload = function () {
      load(shots[0], CREW[0]);
      shots[0].classList.add('is-on');
      warm(CREW[1].src);
      if (reduced.matches) return;
      setInterval(next, CREW_CYCLE_MS);
    };
    first.src = CREW[0].src + SHOTS_V;
  }

  function start() {
    var first = SHOTS[at];
    var img = new Image();

    /* Faded up only once the first photograph has actually arrived. Switching
       the host on before then shows a bare rectangle for as long as the network
       takes, which on a slow connection reads as a rendering fault. */
    img.onload = function () {
      show(first, layers[0]);
      layers[0].classList.add('is-on');
      host.classList.add('is-on');
      warm(SHOTS[(at + 1) % SHOTS.length]);

      // Nothing switches for anyone who has asked for less motion: they get one
      // city, held, and the drift is turned off in the stylesheet.
      if (reduced.matches) return;
      timer = setInterval(step, CYCLE_MS);
    };
    img.onerror = function () { /* no backdrop is better than a broken one */ };
    img.src = first + SHOTS_V;
  }

  start();
  startHero();
  startCrew();
})();
