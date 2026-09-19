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

  function menuEl() { return document.querySelector(".menu"); }

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

      /* Only now let the menu grow back to its full four rows. Doing it at
         the start of the close would drop the panel down mid-exit. */
      var menu = menuEl();
      if (menu && !document.querySelector(".panel:not([hidden])")) {
        menu.classList.remove("is-collapsed");
      }
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
    var menu = menuEl();
    if (menu && target) {
      menu.style.setProperty("--i-open", String(PANELS.indexOf(target)));
      menu.classList.add("is-collapsed");
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

    var layers = BACKGROUNDS.map(function (src, i) {
      var el = document.createElement("div");
      el.className = "bg-layer";
      el.style.backgroundImage = 'url("' + base + src + '")';
      el.style.transitionDuration = fade + "ms";
      if (i === 0) el.classList.add("is-showing");
      host.appendChild(el);
      return el;
    });

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

  renderProjects();
  backgrounds();
  shotFallbacks();
  route();
  wireMenu();
  window.addEventListener("hashchange", route);   // direct links
  window.addEventListener("popstate", route);      // back / forward
})();
