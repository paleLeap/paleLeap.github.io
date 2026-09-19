/* Page wiring. No dependencies, no build step. */

(function () {
  "use strict";

  var PANELS = ["about", "projects", "social", "contact"];
  var stage = document.querySelector(".stage");

  /* ---- open one section, or none -----------------------------------------
     Closed is the resting state: just the name and four "+" lines. Opening
     hides the name and the other three; the chosen line steps right and
     turns into "−". Clicking it again closes back to the resting state.
     The choice lives in the URL hash, so links are shareable and the back
     button works.                                                          */
  var leaving = null;            // panel currently animating out, if any

  /* Reserve the height of the tallest panel, once, so the page height never
     changes when a section opens. A height change on a phone re-clamps the
     scroll position and can toggle the URL bar, which reads as a jump. */
  function reserveSpace() {
    var box = document.querySelector(".panels");
    if (!box) return;
    var row = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue("--row")) * 16 || 28;
    var gap = 1.4 * 16;
    var deepest = 0;

    PANELS.forEach(function (id, i) {
      var p = document.getElementById(id);
      if (!p) return;
      var wasHidden = p.hidden;
      p.style.visibility = "hidden";
      p.hidden = false;
      /* Where this panel's bottom edge lands, not just how tall it is. Each
         row sits at a different offset, so the tallest panel is not always
         the one that reaches furthest down. */
      var top = (i + 1 - PANELS.length) * row + gap;
      deepest = Math.max(deepest, top + p.offsetHeight);
      p.hidden = wasHidden;
      p.style.visibility = "";
    });

    box.style.setProperty("--panel-reserve", Math.ceil(deepest) + "px");
  }


  /* Take a panel off screen properly: run the leaving animation, and only
     hide it once that has finished. Hiding it outright is what made it blink
     away. */
  function close(panel) {
    if (!panel || panel.hidden) return;
    panel.classList.remove("is-in");
    panel.classList.add("is-out");
    leaving = panel;

    /* animationend is the normal path, but a backgrounded tab can stop
       painting mid-exit and never fire it, which would strand the panel
       on screen. The timeout is the backstop. */
    var settled = false;
    var timer = setTimeout(function () { done(); }, 900);

    panel.addEventListener("animationend", done);

    function done() {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      panel.removeEventListener("animationend", done);
      if (leaving !== panel) return;   // it was reopened mid-flight
      panel.hidden = true;
      panel.classList.remove("is-out");
      leaving = null;
    }
  }

  function open(panel) {
    if (!panel) return;
    if (leaving === panel) leaving = null;   // cancel a pending hide
    panel.classList.remove("is-out");
    panel.hidden = false;
    // restart the animation even if the class is already there
    panel.classList.remove("is-in");
    void panel.offsetWidth;
    panel.classList.add("is-in");
  }

  function route() {
    var want = window.location.hash.replace("#", "");
    var target = PANELS.indexOf(want) !== -1 ? want : null;

    if (stage) stage.classList.toggle("is-open", !!target);

    /* Set the row and collapse the menu BEFORE the panel is shown, so the
       panel is at its final height from the very first frame and only ever
       travels sideways. */
    /* Which row is open decides where the panel sits. Set before the panel
       is shown so it is in position from the first frame. Left in place on
       close so the leaving panel does not move while it fades. */
    if (target) {
      document.querySelector(".panels")
        .style.setProperty("--i-open", String(PANELS.indexOf(target)));
    }

    PANELS.forEach(function (id) {
      var panel = document.getElementById(id);
      if (!panel) return;
      if (id === target) open(panel);
      else close(panel);
    });

    document.querySelectorAll(".menu a").forEach(function (a) {
      var id = a.getAttribute("href").replace(/^.*#/, "");
      a.classList.toggle("is-open", id === target);
    });
  }

  /* Clicks are handled here rather than left to the browser. Following a
     real "#id" link makes the browser scroll the target into view, which on
     a longer page jolts and reads as having gone somewhere. Taking over the
     click keeps everything in place; the hash is still written to the URL so
     links stay shareable and back/forward still work. */
  function wireMenu() {
    document.querySelectorAll(".menu a").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var id = a.getAttribute("href").replace(/^.*#/, "");
        var closing = a.classList.contains("is-open");
        history.pushState("", document.title,
          window.location.pathname + (closing ? "" : "#" + id));
        route();
      });
    });
  }

  /* ---- the project list --------------------------------------------------
     Plain text lines, built from js/projects-data.js. data-base="../" on
     pages that sit inside projects/.                                       */
  function renderProjects() {
    document.querySelectorAll("[data-projects]").forEach(function (el) {
      var base = el.dataset.base || "";
      var list = (typeof PROJECTS === "undefined") ? [] : PROJECTS;

      if (!list.length) {
        el.innerHTML = '<li><span class="note">Nothing here yet. Add one to ' +
                       "js/projects-data.js.</span></li>";
        return;
      }

      el.innerHTML = list.map(function (p) {
        return '<li><a href="' + base + "projects/" + p.slug + '.html">' + p.name + "</a>" +
               '<span class="note">' + p.blurb + "</span></li>";
      }).join("");
    });
  }

  /* ---- screenshots that don't exist yet ---------------------------------- */
  function shotFallbacks() {
    function swap(img) {
      var box = document.createElement("div");
      box.className = "shot-pending";
      box.textContent = "screenshot to come";
      img.replaceWith(box);
    }
    document.querySelectorAll("figure img").forEach(function (img) {
      if (img.complete && img.naturalWidth === 0) { swap(img); return; }
      img.addEventListener("error", function () { swap(img); });
    });
  }


  /* ---- the background slideshow -----------------------------------------
     One layer per image, stacked and fixed behind everything. Only one is
     at full opacity at a time; the crossfade is a plain opacity transition,
     so the browser composites it on the GPU and the page stays responsive.
     The blur and the downscale are already baked into the files.          */
  function backgrounds() {
    var host = document.querySelector(".bg");
    if (!host || typeof BACKGROUNDS === "undefined" || !BACKGROUNDS.length) return;

    var base = host.dataset.base || "";
    var fade = (typeof BG_FADE_MS === "number") ? BG_FADE_MS : 4000;
    var hold = (typeof BG_HOLD_MS === "number") ? BG_HOLD_MS : 7000;

    /* Only the first image is fetched up front. The rest are attached once
       the page has loaded, staggered, so six photographs do not compete with
       the page itself for bandwidth on first paint. */
    var layers = BACKGROUNDS.map(function (src, i) {
      var el = document.createElement("div");
      el.className = "bg-layer";
      el.style.transitionDuration = fade + "ms";
      if (i === 0) {
        el.style.backgroundImage = 'url("' + base + src + '")';
        el.classList.add("is-showing");
      } else {
        el.dataset.src = base + src;
      }
      host.appendChild(el);
      return el;
    });

    function loadRest() {
      layers.forEach(function (el, i) {
        if (!el.dataset.src) return;
        setTimeout(function () {
          el.style.backgroundImage = 'url("' + el.dataset.src + '")';
          delete el.dataset.src;
        }, i * 400);
      });
    }

    if (document.readyState === "complete") loadRest();
    else window.addEventListener("load", loadRest);

    if (layers.length < 2) return;

    /* Someone who has asked for reduced motion gets one still image. */
    var still = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (still.matches) return;

    var at = 0;
    setInterval(function () {
      /* A hidden tab does not paint, so advancing would stack up a pile of
         queued transitions that all resolve at once on return. */
      if (document.hidden) return;
      layers[at].classList.remove("is-showing");
      at = (at + 1) % layers.length;
      layers[at].classList.add("is-showing");
    }, hold + fade);
  }

  /* ---- on-device diagnostic -------------------------------------------
     Add ?debug to the URL. Reports what actually changes when a section is
     tapped, which is the only way to see this on a real phone.           */
  function debugPanel() {
    if (window.location.search.indexOf("debug") === -1) return;

    var el = document.createElement("pre");
    el.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99;margin:0;" +
      "padding:8px;font:11px/1.35 monospace;background:#000;color:#0f0;" +
      "white-space:pre-wrap;max-height:45vh;overflow:auto";
    document.body.appendChild(el);

    function read() {
      var vv = window.visualViewport;
      return {
        docH: document.documentElement.scrollHeight,
        scrollY: Math.round(window.scrollY),
        innerH: window.innerHeight,
        vvH: vv ? Math.round(vv.height) : "-",
        vvTop: vv ? Math.round(vv.offsetTop) : "-",
        padTop: Math.round(parseFloat(getComputedStyle(
          document.querySelector(".stage")).paddingTop)),
        nameY: Math.round(document.querySelector(".brand").getBoundingClientRect().y),
        row0Y: Math.round(document.querySelector(".menu a").getBoundingClientRect().y)
      };
    }

    function line(tag, a, b) {
      var keys = Object.keys(a), out = tag + "\n";
      keys.forEach(function (k) {
        var changed = a[k] !== b[k];
        out += "  " + k + ": " + a[k] + (changed ? "  ->  " + b[k] + "   <<<< MOVED" : "") + "\n";
      });
      return out;
    }

    el.textContent = "tap a section\n" + line("at rest", read(), read());

    document.querySelectorAll(".menu a").forEach(function (a) {
      a.addEventListener("click", function () {
        var before = read();
        setTimeout(function () {
          el.textContent = line("before tap -> 700ms after", before, read());
        }, 700);
      });
    });
  }

  renderProjects();
  debugPanel();
  reserveSpace();
  window.addEventListener("resize", reserveSpace);
  window.addEventListener("load", reserveSpace);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", reserveSpace);
  }
  backgrounds();
  shotFallbacks();
  route();
  wireMenu();
  window.addEventListener("hashchange", route);   // direct links
  window.addEventListener("popstate", route);      // back / forward
})();
