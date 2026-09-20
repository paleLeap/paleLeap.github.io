/* The landing.

   Closed is the resting state: the name, one line, and four choices. Opening a
   choice hides the other three and reveals its panel in place. Clicking the open
   one closes it again.

   The choice lives in the URL hash, so a link to the quote tool is shareable and
   the back button does what it should. */

(function () {
  'use strict';

  /* `help` is reachable from the VIN hint rather than from the bars: it is for
     the moment someone is stuck, not a place to browse to. */
  var PANELS = ['quote', 'services', 'guarantee', 'about', 'contact', 'help'];
  var stage = document.querySelector('.flow');
  /* Both the bottom bar and any in-page link that points at a panel. */
  var links = Array.prototype.slice.call(
    document.querySelectorAll('.dock a, a[href^="#"][data-panel-link]'));
  var dockLinks = Array.prototype.slice.call(document.querySelectorAll('.dock a'));

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
  var OUT_MS = 170;          // must match .flow's transition in style.css
  var busy = false;
  var target = null;         // where we are heading, which a click can change mid-fade

  function apply(id) {
    var valid = PANELS.indexOf(id) !== -1;

    PANELS.forEach(function (p) {
      var panel = document.getElementById(p);
      if (panel) panel.hidden = (p !== id);
    });

    // the bottom bar and the icon strip both show where you are
    Array.prototype.forEach.call(
      document.querySelectorAll('.dock a, .brandnav a'),
      function (a) { a.classList.toggle('is-on', a.getAttribute('href') === '#' + id); });

    stage.classList.toggle('is-open', valid);
    document.body.classList.toggle('on-quote', id === 'quote');

    // the new view has a different height and a different rule, so re-decide
    if (typeof checkDock === 'function') requestAnimationFrame(checkDock);
  }

  /* Leaving and arriving are two halves of one move: the current view fades
     out, the swap happens while nothing is visible, then the new view fades in.
     Swapping mid-fade is what stops it reading as a flicker, and it means the
     page never shows two views at once or jumps as the height changes. */
  /* A second click during a fade must not be dropped. Returning early on `busy`
     left the URL on the new section while the view stayed on the old one, which
     is worse than any amount of jank: the page and the address bar disagreed.
     The target is recorded instead, and the run in flight picks up whatever the
     latest one is. */
  /* Set the moment a link inside the site is followed. Read by "Go back." to
     decide between history.back() and simply going home. */
  var enteredFromWithin = false;

  function go(id) {
    target = id;

    if (REDUCED.matches) {          // no fade, just the swap
      apply(id);
      window.scrollTo(0, 0);
      return;
    }

    if (busy) return;               // the run in flight will land on `target`

    busy = true;
    stage.classList.add('is-leaving');

    setTimeout(function () {
      var landed = target;
      apply(landed);
      window.scrollTo(0, 0);

      /* `busy` is released here, and it MUST be released.
     
         It used to be cleared only inside two nested requestAnimationFrames,
         which do not run at all in a tab the browser has stopped painting. Put
         a phone to sleep or switch apps during the fade and the flag stuck true
         forever: every link afterwards returned at the `if (busy) return` above
         and the site quietly stopped navigating, with nothing on screen to say
         why. Found it when a test harness that does not composite reproduced
         exactly that.

         Two frames is still the good path, because it lets the browser paint
         the new view at scroll zero before lifting the fade. The timer is the
         guarantee that it happens regardless. */
      var released = false;
      function release() {
        if (released) return;
        released = true;
        stage.classList.remove('is-leaving');
        busy = false;
        // changed its mind again while we were fading in
        if (target !== landed) go(target);
      }

      requestAnimationFrame(function () { requestAnimationFrame(release); });
      setTimeout(release, 400);
    }, OUT_MS);
  }

  /* The quote is the landing. Arriving with no hash lands on it, rather than on
     a menu: this is a service, and the thing the customer came to do is the
     first thing in front of them. */
  function fromHash(animate) {
    var id = (location.hash || '').replace('#', '');
    id = PANELS.indexOf(id) !== -1 ? id : 'quote';
    if (animate) go(id); else apply(id);
  }

  /* Every link that names a panel drives the same switch, including the small
     "Contact us!" button under the VIN. */
  Array.prototype.forEach.call(
    document.querySelectorAll('a[href^="#"]'),
    function (a) {
      var id = a.getAttribute('href').slice(1);
      if (PANELS.indexOf(id) === -1) return;
      /* The logo points at #quote so it is a way home on a pointer device, but
         it is ALSO the menu toggle on touch. Wiring it here as well meant one
         tap ran both handlers: the menu opened and was closed again in the same
         gesture while the page navigated. It gets its own handler below. */
      if (a.classList.contains('brand__logo')) return;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        /* Retract first, then swap. The row lifts away while the page is
           fading, so the two reads as one movement rather than two. */
        if (brand) brand.classList.remove('is-open');
        document.body.classList.remove('menu-open');
        if (location.hash === '#' + id) return;   // already here
        // Write the hash without firing hashchange, so the transition runs once.
        history.pushState(null, '', '#' + id);
        enteredFromWithin = true;
        go(id);
      });
    });

  /* ---- "Go back." at the foot of every supporting page -------------------

     Literally back, when there is somewhere to go back to: someone who opened
     Services from the quote page should land on the quote page, and someone who
     opened it from Contact should land on Contact. history.back() is the only
     thing that knows which.

     It is not used blindly. A person who followed a link straight to
     /quillin/#services has nothing behind them in this site, and history.back()
     would take them off it entirely, which is not what a link at the bottom of
     a page should ever do. `entered` records whether this session has navigated
     within the site yet; if it has not, the quote page is the sensible home. */
  Array.prototype.forEach.call(document.querySelectorAll('.goback__btn'),
    function (btn) {
      btn.addEventListener('click', function () {
        if (history.length > 1 && enteredFromWithin) { history.back(); return; }
        history.pushState(null, '', '#quote');
        go('quote');
      });
    });

  /* ---- the bottom bar appears once you can see the end of the page -------
     The rule is simply "is the bottom of the content in view". It used to also
     require the page to be meaningfully scrollable, which quietly broke any
     page that nearly fits: Contact came out 854px against an 840px viewport, so
     it had 14px of scroll, fell under that threshold, and the bar could never
     be reached at all. A page you cannot scroll is a page whose end you are
     already looking at. */
  var dock = document.querySelector('.dock');
  var ticking = false;

  var persistentDock = window.matchMedia('(max-width: 40rem)');

  function checkDock() {
    ticking = false;
    if (!dock) return;
    /* On a phone the bar is permanent furniture, so the scroll rule does not
       apply to it at all. */
    if (persistentDock.matches) { dock.classList.add('is-shown'); return; }
    var doc = document.documentElement;
    var scrollable = Math.max(0, doc.scrollHeight - window.innerHeight);
    var atEnd = window.scrollY >= scrollable - 4;
    // The quote is a working surface, so it keeps its chrome out of the way
    // until there is genuinely nothing left below.
    var onQuote = document.body.classList.contains('on-quote');
    dock.classList.toggle('is-shown', atEnd && (!onQuote || scrollable > 24));
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(checkDock);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  // the flow changes height as steps open and as panels swap
  new ResizeObserver(onScroll).observe(document.body);

  // back and forward get the same transition
  /* ---- the logo opens the nav where there is no hover ---------------------
     The strip is a hover affordance, and a phone has no hover, so on touch the
     whole section navigation was unreachable. There, the logo becomes a toggle
     instead of a link: first tap opens the words, a tap on one of them goes,
     and a tap anywhere else closes it again. */
  var brand = document.querySelector('.brand');
  var logo = document.querySelector('.brand__logo');
  var canHover = window.matchMedia('(hover: hover)');

  if (brand && logo) {
    logo.addEventListener('click', function (e) {
      e.preventDefault();
      if (canHover.matches) {
        // pointer devices: the strip is already open on hover, so this is home
        if (location.hash !== '#quote') { history.pushState(null, '', '#quote'); go('quote'); }
        return;
      }
      var open = !brand.classList.contains('is-open');
      brand.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
    });

    document.addEventListener('click', function (e) {
      if (canHover.matches) return;
      if (brand.contains(e.target)) return;
      brand.classList.remove('is-open');
      document.body.classList.remove('menu-open');
    });
  }

  window.addEventListener('popstate', function () { fromHash(true); });
  window.addEventListener('hashchange', function () { fromHash(true); });

  fromHash(false);

  /* Arriving on a deep link, the browser scrolls to the element whose id
     matches the hash, so landing on #services opened the page already scrolled
     past its own title. The panels ARE those ids, so the jump is unavoidable.

     Undoing it once here is not enough: the browser performs that scroll AFTER
     this script runs, and again after the load event once images settle the
     layout. Both have to be answered. */
  function toTop() { window.scrollTo(0, 0); }

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  requestAnimationFrame(toTop);
  window.addEventListener('load', function () { requestAnimationFrame(toTop); });

  /* ---- align each subtitle under the second letter of its title ----------
     The CSS carries a ratio measured from a capital S, which is right for
     "Services" and wrong for every other word: O, C and G all advance
     differently. Measuring the actual first glyph makes it exact for any title
     anyone writes later, and it has to be redone when the font finishes loading
     and whenever the heading resizes. */
  function alignSubs() {
    Array.prototype.forEach.call(
      document.querySelectorAll('.panel__title'),
      function (title) {
        var sub = title.nextElementSibling;
        if (!sub || !sub.classList.contains('panel__sub')) return;
        var node = title.firstChild;
        if (!node || node.nodeType !== 3 || !node.length) return;

        var r = document.createRange();
        r.setStart(node, 0);
        r.setEnd(node, 1);
        var w = r.getBoundingClientRect().width;
        if (w > 0) sub.style.marginLeft = w.toFixed(2) + 'px';
      });
  }

  alignSubs();
  window.addEventListener('resize', alignSubs);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(alignSubs);

  checkDock();
})();
