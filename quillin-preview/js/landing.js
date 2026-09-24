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
  var PANELS = ['quote', 'services', 'guarantee', 'about', 'faq', 'contact', 'help'];
  var stage = document.querySelector('.flow');
  /* Both the bottom bar and any in-page link that points at a panel. */
  var links = Array.prototype.slice.call(
    document.querySelectorAll('.dock a, a[href^="#"][data-panel-link]'));
  var dockLinks = Array.prototype.slice.call(document.querySelectorAll('.dock a'));

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
  var OUT_MS = 170;          // must match .flow's transition in style.css
  // The same curve as --ease in the stylesheet and EASE in app.js.
  var EASE = 'cubic-bezier(.22,.61,.36,1)';
  /* The same two numbers app.js opens and shuts its disclosures on. They were
     260 and 200 here, which is a second opinion about how fast this site moves,
     held by the half of it that happens to live in a different file. Nobody
     chose two speeds; there are just two implementations. One vocabulary. */
  var OPEN_MS = 340;
  var SHUT_MS = 240;
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

    /* Say where we are, so anything that cares can follow. Added for the
       backdrop, which shows the skylines on the quote screen and the owners'
       own work behind the pages about them.

       Dispatched from HERE, in apply(), rather than from go(): every route into
       a panel passes through this one function, including the first paint,
       which arrives via fromHash(false) and never touches go() at all. Wiring
       it to the animated path would have left the backdrop wrong on arrival and
       right only after the first click.

       It carries the id rather than expecting a listener to read the DOM,
       because the only signal otherwise available outside this closure is
       body.on-quote, which distinguishes quote from everything else and cannot
       tell about from services. */
    /* Which panel is up, for the few pages that need a wider column than a
       page of reading does (About's photographs). */
    document.body.setAttribute('data-panel', valid ? id : 'quote');

    document.dispatchEvent(new CustomEvent('panel:change', { detail: { id: id, valid: valid } }));

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
      if (a.hasAttribute('data-home')) return;      // goHome() below
      a.addEventListener('click', function (e) {
        e.preventDefault();
        /* Retract first, then swap. The row lifts away while the page is
           fading, so the two reads as one movement rather than two. */
        setMenu(false);

        /* Pressing "quote" is ambiguous once a request is underway: it is
           either "take me back to what I was doing" or "let me start again",
           and only the customer knows which. app.js holds the answers, so it
           is asked there; this just says that the button was pressed.

           Dispatched BEFORE the already-here check below, because the most
           likely time to press it is while standing on the quote itself. */
        if (id === 'quote') {
          document.dispatchEvent(new CustomEvent('quote:relaunch'));
        }

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

  var phone = window.matchMedia('(max-width: 40rem)');

  function checkDock() {
    ticking = false;
    if (!dock) return;
    /* NOT ON THE HOME PAGE on a pointer device. Owner instruction with the
       redesign: the home page carries a full navigation across the top, and a
       second copy along the bottom is furniture saying the same thing twice.

       A phone is different: its header has no words in it, so the bar is the
       way to the other pages and it still belongs at the foot of the landing.
       But ONLY at the foot now, on every page. It used to be permanent on a
       phone, and the owners' note on seeing it over the new landing was "way
       too large. needs to only show when scrolled all the way to page bottom".
       Same rule as everywhere else: a bar that rides the screen competes with
       the page, and one that arrives when the reading is done does not. */
    if (document.body.classList.contains('on-quote') && !phone.matches) {
      dock.classList.remove('is-shown');
      return;
    }
    var doc = document.documentElement;
    var scrollable = Math.max(0, doc.scrollHeight - window.innerHeight);
    var atEnd = window.scrollY >= scrollable - 4;
    /* A page with nothing to scroll is already at its own end, so the bar
       belongs there immediately rather than never. */
    dock.classList.toggle('is-shown', atEnd || scrollable <= 24);
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
  /* ---- the logo opens the menu, everywhere -------------------------------

     It used to do two different things depending on the device. On touch it
     opened the section words, because there is no hover there and the strip
     was otherwise unreachable. On a pointer device it was a way home to the
     quote instead, on the reasoning that hover had already shown the words.

     Owner instruction: it should always open the menu. Which is the better
     rule anyway, because the old one meant the most prominent thing on the
     page did something different depending on what you were holding, and the
     one person who could not discover that was the person on a laptop who
     never thought to hover a logo.

     Hover still opens the strip on a pointer device. Clicking now pins it
     open, so it survives the mouse leaving, and clicking again or clicking
     anywhere outside puts it away. */
  var brand = document.querySelector('.brand');
  var logo = document.querySelector('.brand__logo');

  function setMenu(open) {
    if (!brand) return;
    brand.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    if (logo) logo.setAttribute('aria-expanded', String(open));
  }

  /* HOME: the landing, from anywhere. The quote panel, and app.js told to
     show the landing rather than whichever question was open; the answers
     stay, and "Get your Quote" picks up where they were. */
  var WIDE = window.matchMedia('(min-width: 40.0625rem)');

  function goHome() {
    setMenu(false);
    if (location.hash !== '#quote') {
      history.pushState(null, '', '#quote');
      enteredFromWithin = true;
      go('quote');
    }
    document.dispatchEvent(new CustomEvent('quote:home'));
  }

  /* Say what it does at this size. */
  function labelLogo() {
    if (!logo) return;
    logo.setAttribute('aria-label', WIDE.matches
      ? 'Quillin Auto Glass, home' : 'Quillin Auto Glass, open the menu');
  }
  labelLogo();
  if (WIDE.addEventListener) WIDE.addEventListener('change', labelLogo);

  /* "Get your Quote" from inside another page: home, and straight into the
     quote, the same as pressing the button on the landing. */
  Array.prototype.forEach.call(document.querySelectorAll('[data-start-quote]'), function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      goHome();
      /* After the panel swap has landed, so the flow opens on a visible page. */
      setTimeout(function () { document.dispatchEvent(new CustomEvent('quote:start')); }, OUT_MS + 60);
    });
  });

  /* ---- the gallery's large view ---- */
  var box = document.getElementById('lightbox');
  var shots = Array.prototype.slice.call(document.querySelectorAll('.gallery__item'));
  if (box && shots.length && box.showModal) {
    var bigImg = box.querySelector('.lightbox__img');
    var bigCap = box.querySelector('.lightbox__cap');
    var at = 0;
    var showShot = function (i) {
      at = (i + shots.length) % shots.length;
      var b = shots[at];
      var img = b.querySelector('img');
      bigImg.src = b.getAttribute('data-full');
      bigImg.alt = img.alt;
      bigCap.textContent = b.querySelector('span').textContent;
    };
    shots.forEach(function (b, i) {
      b.addEventListener('click', function () { showShot(i); box.showModal(); });
    });
    box.querySelector('.lightbox__close').addEventListener('click', function () { box.close(); });
    box.querySelector('.lightbox__nav--prev').addEventListener('click', function () { showShot(at - 1); });
    box.querySelector('.lightbox__nav--next').addEventListener('click', function () { showShot(at + 1); });
    /* A click on the dark around the photograph closes it, as everyone expects. */
    box.addEventListener('click', function (e) { if (e.target === box) box.close(); });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') showShot(at - 1);
      if (e.key === 'ArrowRight') showShot(at + 1);
    });
    /* Swipe on a phone. */
    var x0 = null;
    box.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) showShot(at + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-home]'), function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); goHome(); });
  });

  if (brand && logo) {
    logo.addEventListener('click', function (e) {
      e.preventDefault();
      /* On a desktop the menu words are always open, so toggling them did
         nothing at all: the biggest thing in the header was dead. It goes
         home there, which is what a logo does. On a phone it is still the
         menu handle, and "home" is the first word in that menu. */
      if (WIDE.matches) { goHome(); return; }
      setMenu(!brand.classList.contains('is-open'));
    });

    document.addEventListener('click', function (e) {
      if (brand.contains(e.target)) return;
      setMenu(false);
    });
  }

  /* Steps inside the quote are history entries too (app.js). Moving between
     them is app.js's business: the panel is still the quote, and running the
     whole-view fade for it would flash the page on every Back press. */
  /* ---- finish: the header's shadow, and things arriving on scroll ------ */
  var topBar = document.querySelector('.top');
  function onScrolled() {
    if (topBar) topBar.classList.toggle('is-scrolled', window.scrollY > 4);
  }
  window.addEventListener('scroll', onScrolled, { passive: true });
  onScrolled();

  /* Only with an observer and only for people who have not asked for less
     motion; otherwise nothing is hidden in the first place. The stagger is
     per group, so four tiles cascade rather than arriving as a block. */
  if ('IntersectionObserver' in window && !REDUCED.matches) {
    document.documentElement.classList.add('js-reveal');
    var groups = ['.welcome', '.feats li', '.tiles a', '.motto', '.landfoot'];
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.12 });
    var pending = [];
    groups.forEach(function (sel) {
      Array.prototype.forEach.call(document.querySelectorAll(sel), function (n, i) {
        n.classList.add('reveal');
        n.style.setProperty('--d', (i * 80) + 'ms');
        io.observe(n);
        pending.push(n);
      });
    });

    /* The observer only reports on frames the browser actually renders, and
       content that stays invisible until it does is the trap in LOG.md one
       more time. So a plain position check backs it up: on load, on every
       scroll, and on a timer, none of which need a painted frame. */
    var sweep = function () {
      pending = pending.filter(function (n) {
        if (n.classList.contains('is-in')) return false;
        if (n.getBoundingClientRect().top < window.innerHeight * 0.94) {
          n.classList.add('is-in');
          return false;
        }
        return true;
      });
      if (!pending.length) {
        window.removeEventListener('scroll', sweep);
        clearInterval(sweeper);
      }
    };
    window.addEventListener('scroll', sweep, { passive: true });
    /* Scroll events are frame-bound too, so the timer is the real backstop.
       Eleven measurements every 400ms, stopping as soon as all are in. */
    var sweeper = setInterval(sweep, 400);
    setTimeout(sweep, 60);
  }

  window.addEventListener('popstate', function () {
    var id = (location.hash || '').replace('#', '') || 'quote';
    if (id === 'quote' && document.body.classList.contains('on-quote')) return;
    fromHash(true);
  });
  window.addEventListener('hashchange', function () { fromHash(true); });

  fromHash(false);

  /* Arriving on a deep link, the browser scrolls to the element whose id
     matches the hash, so landing on #services opened the page already scrolled
     past its own title. The panels ARE those ids, so the jump is unavoidable.

     Undoing it once here is not enough: the browser performs that scroll AFTER
     this script runs, and again after the load event once images settle the
     layout. Both have to be answered. */
  function toTop() { window.scrollTo(0, 0); }

  /* ---- disclosure lists ---------------------------------------------------

     Used twice on the Services page: the services themselves, and the common
     questions under them. One behaviour, shared, because two accordions on one
     page that opened differently would be a bug you could see.

     Native <details> snaps open, which is the one thing nothing else on this
     site does. So the toggle is taken over and the body's height animated, the
     same way the quote flow slides its disclosures.

     The markup is still real <details>, so with this script broken or not yet
     run every one of them still opens, and keyboard and screen reader
     behaviour comes free. */
  /* ---- the About page's two sections ---------------------------------------

     Owner instruction: "About us" open, "Our work" beside it, one at a time.

     Written as a real tablist rather than two buttons that toggle a div. The
     roving tabindex and the arrow keys are the part that is easy to skip and
     the part that decides whether this is reachable without a mouse: only the
     live tab is in the tab order, and left/right move between them, which is
     what a screen reader announces a tablist as doing.

     Exclusivity is the whole instruction, so it is enforced by construction:
     every switch hides ALL panes and shows one. There is no state in which two
     are open, including the first paint, because the markup ships with the
     second pane already carrying `hidden`.

     Nothing here animates a height. The two panes are very different lengths,
     and the fade is done in CSS on .tabs__pane so it cannot get out of step
     with the rest of the site's motion. */
  Array.prototype.forEach.call(document.querySelectorAll('.tabs'), function (strip) {
    var tabs = Array.prototype.slice.call(strip.querySelectorAll('[role="tab"]'));
    if (tabs.length < 2) return;

    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = (t === tab);
        t.classList.toggle('is-on', on);
        t.setAttribute('aria-selected', String(on));
        /* Only the live tab is tabbable. Without this, tabbing through the page
           stops on every tab in the strip, which is the behaviour a tablist
           exists to replace. */
        t.setAttribute('tabindex', on ? '0' : '-1');
        var pane = document.getElementById(t.getAttribute('aria-controls'));
        if (pane) pane.hidden = !on;
      });
      if (focus) tab.focus();
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab, false); });
      tab.addEventListener('keydown', function (e) {
        var go = null;
        if (e.key === 'ArrowRight') go = tabs[(i + 1) % tabs.length];
        if (e.key === 'ArrowLeft')  go = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === 'Home')       go = tabs[0];
        if (e.key === 'End')        go = tabs[tabs.length - 1];
        if (!go) return;
        e.preventDefault();
        select(go, true);
      });
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('.expand'),
    function (item) {
      var summary = item.querySelector('summary');
      var body = item.querySelector('.expand__body');
      if (!summary || !body) return;

      function slide(open) {
        if (item._anim) { item._anim.cancel(); item._anim = null; }
        if (REDUCED.matches) { item.open = open; return; }

        if (open) item.open = true;         // measurable only once it is open
        var h = body.scrollHeight;
        var frames = open
          ? [{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }]
          : [{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }];

        var anim = body.animate(frames, { duration: open ? OPEN_MS : SHUT_MS, easing: EASE });
        item._anim = anim;

        /* Safe to run twice, and it has to be: the good path is onfinish, and
           the timer behind it is the guarantee.

           A Web Animations callback is driven by the document timeline, which
           does not advance in a tab the browser has stopped painting. This
           project has already been bitten by exactly that, twice, once on a
           navigation lock released inside rAF and once on the quote flow's own
           slide. Here it would leave a service stuck open after a phone slept
           mid-close. */
        function done() {
          if (item._anim !== anim) return;  // superseded by a later toggle
          item._anim = null;
          if (!open) item.open = false;     // closed only after it has shrunk
        }
        anim.onfinish = done;
        /* The backstop, and it has to stay BEHIND the animation. It read
           (open ? 260 : 200) + 120 with the durations written out a second time,
           so changing the speed above silently moved this in front of the
           animation it is supposed to catch, and `done` would have closed a
           <details> that was still opening. Same constants, one place. */
        setTimeout(done, (open ? OPEN_MS : SHUT_MS) + 120);
      }

      summary.addEventListener('click', function (e) {
        e.preventDefault();
        slide(!item.open);
      });
    });

  /* ---- am I the current build? --------------------------------------------

     This host sends `cache-control: max-age=600` on the document and it is not
     ours to change, so a phone can serve a ten minute old copy of the page and
     the site simply looks like it never updated. The <meta http-equiv> that
     used to sit in the head did nothing at all: browsers ignore that tag for
     caching, only the real header counts.

     So the page asks. version.txt is written by bump.sh with the same id that
     is stamped into the markup; fetched with cache: no-store it always comes
     from the server. If the two disagree, this copy is stale and reloads once
     against a URL the cache has never seen.

     Guarded by sessionStorage against the obvious way to get this wrong: if
     the reload somehow served the same stale page again, a naive version would
     reload forever. One attempt per build id per session, and it fails silent
     if version.txt cannot be reached, because a missing file must never take
     the site down. */
  (function freshness() {
    var tag = document.querySelector('meta[name="build"]');
    if (!tag || !window.fetch) return;
    var mine = tag.getAttribute('content') || '';

    fetch('version.txt', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (text) {
        if (!text) return;
        var live = text.trim();
        if (!live || live === mine) return;

        var key = 'quillin:reloaded:' + live;
        try {
          if (sessionStorage.getItem(key)) return;
          sessionStorage.setItem(key, '1');
        } catch (e) { return; }      // private mode: better stale than looping

        location.replace(location.pathname + '?b=' + live + location.hash);
      })
      .catch(function () { /* offline, or no version.txt: leave the page be */ });
  })();

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
