/* The backdrop behind the About page.

   Two layers that crossfade, each drifting slowly across itself the whole time.
   The blur and the darkening are baked into the files, so the browser is never
   asked to filter a full-screen image at 60fps; each one is 14 to 18 KB.

   It only runs while About is open. A slideshow behind a VIN field would be
   decoration competing with a job. */

(function () {
  'use strict';

  var SHOTS = [
    'assets/img/bg/aria-jacob.jpg',
    'assets/img/bg/chip.jpg',
    'assets/img/bg/jacob.jpg',
    'assets/img/bg/door-glass.jpg'
  ];

  var HOLD_MS = 4200;      // how long each image sits
  var FADE_MS = 2600;      // how long one dissolves into the next

  var host = document.querySelector('.backdrop');
  if (!host) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var layers = [makeLayer(0), makeLayer(1)];
  var at = 0;
  var front = 0;
  var timer = null;
  var started = false;

  function makeLayer(i) {
    var d = document.createElement('div');
    d.className = 'backdrop__layer';
    d.style.transitionDuration = FADE_MS + 'ms';
    d.style.animationDelay = (i * -21) + 's';   // so the two never drift in step
    host.appendChild(d);
    return d;
  }

  function show(src, layer) {
    layer.style.backgroundImage = 'url("' + src + '")';
  }

  function step() {
    at = (at + 1) % SHOTS.length;
    var back = layers[1 - front];
    show(SHOTS[at], back);
    // let the image paint before it is faded up, or the first frame flashes
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        back.classList.add('is-on');
        layers[front].classList.remove('is-on');
        front = 1 - front;
      });
    });
  }

  function start() {
    if (started) return;
    started = true;
    show(SHOTS[0], layers[0]);
    layers[0].classList.add('is-on');
    // Nothing moves for anyone who has asked for less motion: they get the one
    // image, held.
    if (reduced.matches) return;
    timer = setInterval(step, HOLD_MS + FADE_MS);
  }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  /* Driven by the same hash the panels are. Preloading on first open rather
     than at page load keeps 60 KB of photographs off the critical path for
     someone who only ever wants a quote. */
  function sync() {
    var on = location.hash === '#about';
    host.classList.toggle('is-on', on);
    if (on) start(); else stop();
  }

  window.addEventListener('hashchange', sync);
  window.addEventListener('popstate', sync);
  sync();
})();
