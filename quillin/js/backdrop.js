/* The backdrop: ten cities, dissolving into one another behind the whole site.

   Two layers crossfade, each drifting slowly across itself the entire time, so
   something is always moving even in the middle of a hold. It runs on every
   page rather than one, because the panels are sections of a single document
   and a backdrop that restarted as you moved between them would announce the
   seams the fade transitions exist to hide.

   The blur and the darkening are baked into the files. Asking the browser to
   filter a full-screen image at 60fps costs far more than shipping one that is
   already soft, and on a phone it is the difference between a smooth drift and
   a stuttering one. Each file is 95 to 160 KB.

   The photographs are the customer's own wallpapers, cropped to 16:9, blurred,
   dimmed to 66% and desaturated, so type never has to compete with a skyline. */

(function () {
  'use strict';

  var SHOTS = [
    'assets/img/city/city-01.jpg',
    'assets/img/city/city-02.jpg',
    'assets/img/city/city-03.jpg',
    'assets/img/city/city-04.jpg',
    'assets/img/city/city-05.jpg',
    'assets/img/city/city-06.jpg',
    'assets/img/city/city-07.jpg',
    'assets/img/city/city-08.jpg',
    'assets/img/city/city-09.jpg',
    'assets/img/city/city-10.jpg'
  ];

  /* One image every five seconds, the fade included rather than added on top:
     asked for a switch every five seconds, five seconds is what the eye should
     be able to count between switches. */
  var CYCLE_MS = 5000;
  var FADE_MS = 1600;

  var host = document.querySelector('.backdrop');
  if (!host) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* A different city greets you each visit. The set is fixed so the files can
     be cached; only where the cycle starts moves. */
  var at = Math.floor(Math.random() * SHOTS.length);

  var layers = [makeLayer(0), makeLayer(1)];
  var front = 0;
  var timer = null;

  function makeLayer(i) {
    var d = document.createElement('div');
    d.className = 'backdrop__layer';
    d.style.transitionDuration = FADE_MS + 'ms';
    d.style.animationDelay = (i * -23) + 's';   // so the two never drift in step
    host.appendChild(d);
    return d;
  }

  function show(src, layer) {
    layer.style.backgroundImage = 'url("' + src + '")';
  }

  /* Fetched one ahead rather than all at once. Ten photographs is 1.3 MB, and
     nobody who came here to get a quote should wait on the ninth one. At five
     seconds a turn there is a full cycle of slack to fetch the next. */
  function warm(src) {
    var img = new Image();
    img.decoding = 'async';
    img.src = src;
  }

  function step() {
    /* A tab in the background does not paint, so the crossfade would not run
       and every queued step would land at once on return: ten images flashing
       through in a frame. Skip while hidden and pick up on the next tick. */
    if (document.hidden) return;

    at = (at + 1) % SHOTS.length;
    var back = layers[1 - front];
    show(SHOTS[at], back);

    // let the image paint before it is faded up, or the first frame flashes
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        back.classList.add('is-on');
        layers[front].classList.remove('is-on');
        front = 1 - front;
        warm(SHOTS[(at + 1) % SHOTS.length]);
      });
    });
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
    img.src = first;
  }

  start();
})();
