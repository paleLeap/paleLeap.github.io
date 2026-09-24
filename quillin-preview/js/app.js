/* Step flow: VIN -> confirm -> glass.
   Each step reveals the next below it. Nothing above ever disappears, so the
   customer can always scroll up and change an earlier answer. */

(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var el = {
    field:     $('vin-field'),
    fork:      $('vin-fork'),
    yesVin:    $('yes-vin'),
    helpask:   document.querySelector('.helpask'),
    giveUpVin: $('give-up-vin'),
    vin:       $('vin'),
    helpBtn:   $('vin-help-btn'),
    help:      $('vin-help'),
    note:      $('vin-note'),
    noVin:     $('no-vin'),
    manual:    $('manual'),
    manualNote: $('manual-note'),
    mYear:     $('m-year'),
    mMake:     $('m-make'),
    mModel:    $('m-model'),
    mMakeText: $('m-make-text'),
    mModelText:$('m-model-text'),
    mGo:       $('m-go'),
    glass:     $('step-glass'),
    onVehicle: $('on-vehicle'),
    vinNav:    $('vin-nav'),
    chip:      $('step-chip'),
    glassLabel: $('glass-label'),
    declineNote: $('decline-note'),
    chipQ:     $('chipq'),
    chipChoices: $('chip-choices'),
    chipLabel: $('chip-label'),
    chipLegend: $('chip-legend'),
    chipDone: $('chip-done'),
    picker:    $('picker'),
    pickerStage: $('picker-stage'),
    pickerNote:  $('picker-note'),
    shapeAsk:    $('shape-ask'),
    shapeRow:    $('shape-row'),
    pickerList:  $('picker-list'),
    justTell:  $('just-tell'),
    tellus:    $('tellus'),
    tellText:  $('tellus-text'),
    tellNote:  $('tellus-note'),
    when:      $('step-when'),
    whenChoices: $('when-choices'),
    reach:     $('step-reach'),
    reviewYes: $('review-yes'),
    photos:    $('step-photos'),
    addPhotos: $('add-photos'),
    photoInput: $('photo-input'),
    shots:     $('shots'),
    photoNote: $('photo-note'),
    review:    $('step-review'),
    /* Was `.greeting h1`, which the redesign removed. The opening screen is
       the landing sheet now, and "How this works" belongs at the foot of it. */
    greeting:  document.querySelector('.sheet'),
    /* The marketing page under the greeting. It goes away with it: once the
       flow is running, the question on screen is the heading, and a page of
       sales copy underneath is the thing the whole "one thing at a time" rule
       exists to prevent. */
    home:      document.querySelector('.landing'),
    start:     $('start-quote'),
    vinStep:   $('step-vin'),
    summary:   $('summary'),
    sendWhere: $('send-where'),
    send:      $('send-request'),
    sendNote:  $('send-note'),
    custName:  $('cust-name'),
    custLoc:   $('cust-loc'),
    locList:   $('loc-list'),
    locNote:   $('loc-note'),
    insured:   $('cust-insured'),
    hp:        $('hp-company'),
    sent:      $('step-sent'),
    sentLabel: $('sent-label'),
    sentBody:  $('sent-body'),
    sentHome:  $('sent-home')
  };

  /* Makes NHTSA's model lookup has nothing for, filled in by hand from each
     make's US line-up. Checked against vPIC on 2026-09-23: GetModelsForMake
     returns 0 for Scion at every year. Used only when vPIC comes back empty,
     so the moment vPIC gains a make, its answer wins. body is the archetype,
     so the 3D picker shows the right shape. */
  var FALLBACK_MODELS = {
    Scion: [
      { name: 'FR-S', from: 2013, to: 2016, body: 'coupe' },
      { name: 'iA',   from: 2016, to: 2016, body: 'sedan' },
      { name: 'iM',   from: 2016, to: 2016, body: 'hatch' },
      { name: 'iQ',   from: 2012, to: 2015, body: 'hatch' },
      { name: 'tC',   from: 2005, to: 2016, body: 'coupe' },
      { name: 'xA',   from: 2004, to: 2006, body: 'hatch' },
      { name: 'xB',   from: 2004, to: 2006, body: 'hatch' },
      { name: 'xB',   from: 2008, to: 2015, body: 'hatch' },   // no 2007 model year
      { name: 'xD',   from: 2008, to: 2014, body: 'hatch' }
    ]
  };
  var fallbackBody = Object.create(null);

  function fallbackModels(make, year) {
    var y = parseInt(year, 10);
    return (FALLBACK_MODELS[make] || []).filter(function (m) {
      return y >= m.from && y <= m.to;
    });
  }

  var OTHER = '__other';

  var MAKES = [
    'Acura', 'Alfa Romeo', 'Aston Martin', 'Audi', 'Bentley', 'BMW', 'Buick',
    'Cadillac', 'Chevrolet', 'Chrysler', 'Dodge', 'Ferrari', 'Fiat', 'Ford',
    'Freightliner', 'Genesis', 'Geo', 'GMC', 'Hino', 'Honda', 'Hummer',
    'Hyundai', 'Infiniti', 'International', 'Isuzu', 'Jaguar', 'Jeep',
    'Kenworth', 'Kia', 'Lamborghini', 'Land Rover', 'Lexus', 'Lincoln',
    'Lotus', 'Lucid', 'Mack', 'Maserati', 'Mazda', 'McLaren', 'Mercedes-Benz',
    'Mercury', 'Mini', 'Mitsubishi', 'Nissan', 'Oldsmobile', 'Peterbilt',
    'Plymouth', 'Polestar', 'Pontiac', 'Porsche', 'Ram', 'Rivian',
    'Rolls-Royce', 'Saab', 'Saturn', 'Scion', 'Smart', 'Subaru', 'Suzuki',
    'Tesla', 'Toyota', 'Volkswagen', 'Volvo', 'Western Star'
  ];

  var vehicle = null;      // the decoded vehicle
  var panels = [];         // glass panels picked in the picker
  var picker = null;       // the live picker instance, if WebGL is available
  var archetype = null;    // resolved body style for this vehicle
  var windshield = null;   // 'chip' | 'crack' | 'unsure', when a windshield is picked

  /* panel id -> 'chip' | 'crack' | 'unsure'. Only ever holds the windshield
     now; see chipPanels() for why, and for the one line to change if a second
     pane ever earns the question back. It stays a MAP rather than a string
     because the question, the answered rows and the outgoing record all read it
     by pane id, and a map of one is cheaper than three call sites of surgery. */
  var damageKind = {};

  /* Sized the way the trade sizes it, and the way a customer can actually
     check: a quarter and a dollar bill are in everyone's pocket. */
  /* Two wordings each, and they are doing different jobs.

     `label` is the ANSWER being offered, and it has to be decidable by somebody
     looking at their own windscreen: a quarter is in everyone's pocket, which is
     why the size is in the option rather than left to be judged.

     `short` is the same answer once it is settled, on the running list above the
     question. A row is a record, not a decision, and repeating the full wording
     there wrapped every row to three lines on a phone: 90px each, 292px of
     scroll on a four pane job. The long form is still what was chosen and still
     what the shop is told. */
  var CHIP = [
    { value: 'chip',   label: 'A chip, smaller than a quarter', short: 'Chip' },
    { value: 'crack',  label: 'A crack, or bigger than that',   short: 'Crack' },
    { value: 'unsure', label: 'I am not sure',                  short: 'Not sure' }
  ];

  var urgency = null;      // step 5
  var reach = {};          // step 6, channel value -> what the customer typed
  var lastRequest = null;  // the record Quillin would receive
  /* Where the vehicle is, as the customer gave it. null, or
     { label, source: 'search' | 'exact' | 'typed', lat, lon, city, state,
       postcode, accuracyM }. Optional, like the name. */
  var place = null;
  var photos = [];         // { file, url } for each attached image
  var noPhotos = false;    // they answered the question with "No images"

  /* Phone cameras produce 3 to 12 MB a shot, so this is capped in three ways at
     once. A customer photographing a smashed door will take a handful, not a
     roll of film. */
  var PHOTO_MAX = 8;
  var PHOTO_MAX_BYTES = 15 * 1024 * 1024;
  var PHOTO_TOTAL_BYTES = 48 * 1024 * 1024;

  /* How Quillin gets back to the customer, and the detail needed to do it.

     This is the shop reaching OUT, not the customer choosing a postbox, so each
     option carries the customer's own handle rather than Quillin's. It is also
     the contact information the request had been missing all along: a perfect
     glass specification with no way to reach anyone is not an actionable job.

     Checkboxes, not radios. Someone may well want a text and an email, and
     nothing about picking one rules out another. */
  /* How Quillin gets back to the customer, and the detail needed to do it.

     Three, and the owners named them: email, text, call. Instagram and Facebook
     were here too, on the reasoning that a shop which gets messages there should
     be able to answer there. They are gone. A quote is a number and a date, and
     the two handles were the only options on this list that could not carry one
     reliably, which made them four ways to say the same thing rather than three
     clear ones.

     This is the shop reaching OUT, not the customer choosing a postbox, so each
     option carries the customer's own handle rather than Quillin's. It is the
     contact information the request had been missing all along: a perfect glass
     specification with no way to reach anybody is not an actionable job.

     Checkboxes, not radios. Someone may well want a text and an email, and
     nothing about picking one rules out another. */
  /* On the placeholders: the two phone fields read "(214) 555 0142" before.
     555-01xx is the range reserved for fiction precisely so examples cannot
     ring anybody, so it was safe, but safe is not the same as obviously an
     example. It looked like a phone number, and the customer this is built for
     is not reading it as a typographer: a real looking number in a box is a
     number somebody might take for ours and try to call.

     Xs instead, with the format kept, because the format is the useful half of
     a placeholder for somebody who is unsure what to type. Owner instruction.

     The email one is left as it is. example.com is reserved for exactly this
     by RFC 2606 and "you@" is already addressed at the reader, so it reads as
     an instruction rather than as somebody's address. */
  var CHANNELS = [
    {
      value: 'email', label: 'Email', type: 'email',
      placeholder: 'you@example.com', autocomplete: 'email',
      clean: function (v) { return v.trim(); },
      ok: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); }
    },
    {
      value: 'text', label: 'Text message', type: 'tel',
      placeholder: '(214) xxx-xxxx', autocomplete: 'tel',
      clean: function (v) { return v.replace(/[^\d]/g, ''); },
      ok: function (v) {
        var d = v.replace(/[^\d]/g, '');
        return d.length === 10 || (d.length === 11 && d.charAt(0) === '1');
      }
    },
    {
      value: 'call', label: 'A phone call', type: 'tel',
      placeholder: '(214) xxx-xxxx', autocomplete: 'tel',
      clean: function (v) { return v.replace(/[^\d]/g, ''); },
      ok: function (v) {
        var d = v.replace(/[^\d]/g, '');
        return d.length === 10 || (d.length === 11 && d.charAt(0) === '1');
      }
    }
  ];

  /* Triage. The point is to separate the customer standing next to a car with no
     windshield from the one comparing prices on their lunch break. */
  var WHEN = [
    { value: 'now',   label: 'Right away.', flag: true },
    { value: 'soon',  label: 'In the next day or two.' },
    { value: 'week',  label: 'Sometime this week.' },
    { value: 'price', label: 'Just getting a price for now.' }
  ];
  var lastLookup = '';
  var modelTypes = Object.create(null);     // guards against out-of-order responses

  /* ---------- small helpers ---------- */

  function show(node) { node.hidden = false; }
  function hide(node) { node.hidden = true; }

  function say(text, kind) {
    if (!text) { hide(el.note); el.note.textContent = ''; return; }
    el.note.textContent = text;
    el.note.className = 'note' + (kind ? ' note--' + kind : '');
    show(el.note);
  }

  /* ---------- smooth disclosure ----------

     The `hidden` attribute is display:none, and display cannot be transitioned,
     so everything that opened with it snapped into place: clicking "I don't
     have my VIN" dropped three dropdowns into the page in a single frame.

     height:auto cannot be transitioned either, so the height is measured and
     animated to an explicit value, then handed back to auto once it lands. The
     Web Animations API is used rather than CSS so the measurement and the
     animation live in the same place, and so an interrupted open cancels
     cleanly instead of fighting a class. */

  var MOTION_OK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EASE = 'cubic-bezier(.22,.61,.36,1)';

  /* THE MARGIN HAS TO COME WITH IT.

     These animated height alone, and a disclosure with a top margin therefore
     collapsed to nothing while still holding its margin, sat there for a frame
     occupying 20px of empty space, and then had that space taken away the
     instant `hidden` was applied. That last step is not animated and cannot be:
     it is a jump, and it is what the stutter at the end of every close was.

     box-sizing is border-box throughout, so scrollHeight already accounts for
     padding and only the margins need collecting separately.

     BORDERS ARE NOT IN scrollHeight though, padding is. Every disclosure this
     was first written for was an unbordered div, so the difference was zero and
     nobody noticed. The reach fields have a 1px rule under them, which made the
     animation land a pixel short of where releasing the height to auto then put
     it: a one pixel jump at the end of every open. Small, but it is the same
     class of thing as the margin note above, and it is the last frame of the
     animation, which is the frame people actually look at. */
  function slideBox(node) {
    var cs = getComputedStyle(node);
    var borders = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    return { h: node.scrollHeight + (borders || 0), mt: cs.marginTop, mb: cs.marginBottom };
  }

  /* Where an interrupted slide is right now, so the next one can start from it
     rather than from a standing start.

     Read BEFORE cancelling, because cancel() puts the element back to its
     unanimated size and the current height is gone the moment it runs. */
  function slideFrom(node) {
    var cs = getComputedStyle(node);
    return { h: cs.height, o: cs.opacity };
  }

  function slideOpen(node) {
    if (!node) return;

    /* A close still in flight has NOT set hidden yet; it sets it in its own
       callback when it lands. So "already open" and "halfway shut" looked
       identical here, and the early return took the second one: ticking a
       checkbox, unticking it, and ticking it again inside 240ms left the field
       hidden while its box stayed checked, because the close that was still
       running went on to hide an element the reopen thought it had handled.

       An animation in flight is the tell. */
    var busy = !!node._anim;
    if (!node.hidden && !busy) return;

    /* Read where it actually is before anything cancels it, so an interrupted
       slide carries on from there instead of snapping to nothing first. */
    var from = busy ? slideFrom(node) : { h: '0px', o: 0 };

    node.hidden = false;
    if (!MOTION_OK) return;

    if (node._anim) { node._anim.cancel(); node._anim = null; }
    var box = slideBox(node);
    if (!box.h) return;

    node.style.overflow = 'hidden';
    var anim = node.animate(
      [{ height: from.h, marginTop: '0px', marginBottom: '0px', opacity: from.o },
       { height: box.h + 'px', marginTop: box.mt, marginBottom: box.mb, opacity: 1 }],
      { duration: 340, easing: EASE }
    );
    node._anim = anim;

    function done() {
      // superseded by a later open or close; that run owns the end state now
      if (node._anim !== anim) return;
      node.style.overflow = '';
      node._anim = null;
    }
    anim.onfinish = done;
    settle(done, 340);
  }

  /* The backstop behind every one of these animations.

     A Web Animations callback is driven by the document timeline, and that
     timeline does not advance in a tab the browser has stopped painting. This
     project has already been bitten once by state released inside
     requestAnimationFrame, where a transition lock stuck true forever if a
     phone slept mid-fade and navigation silently stopped working. onfinish has
     exactly the same exposure, and it is worse here because what it releases is
     an element's `hidden`: a panel left open beside the question it was meant
     to replace reads as the page being broken.

     setTimeout keeps running when a tab is backgrounded, throttled but alive,
     so it is the guarantee. The good path is still the callback; this only ever
     fires second, and done() is written to be safe to run twice. */
  function settle(fn, duration) {
    setTimeout(fn, duration + 120);
  }

  function slideShut(node) {
    if (!node || node.hidden) return;
    if (!MOTION_OK) { node.hidden = true; return; }

    /* Same as the open: if a slide is already running, start from where it has
       got to. Shutting an element that is halfway open used to measure its FULL
       height, jump it there, and shrink from that, which read as a flinch. */
    var from = node._anim ? slideFrom(node) : null;
    if (node._anim) { node._anim.cancel(); node._anim = null; }
    var box = slideBox(node);

    node.style.overflow = 'hidden';
    var anim = node.animate(
      [{ height: from ? from.h : box.h + 'px', marginTop: box.mt, marginBottom: box.mb,
         opacity: from ? from.o : 1 },
       { height: '0px', marginTop: '0px', marginBottom: '0px', opacity: 0 }],
      { duration: 240, easing: EASE }
    );
    node._anim = anim;

    function done() {
      if (node._anim !== anim) return;
      node.hidden = true;
      node.style.overflow = '';
      node._anim = null;
    }
    anim.onfinish = done;
    settle(done, 240);
  }

  function reveal(node) {
    /* The glass step is faded, not slid: a height animation there would drive
       the picker's ResizeObserver every frame and resize a WebGL canvas twenty
       times for one reveal. */
    if (node === el.glass) show(node); else slideOpen(node);

    /* Only pull it into view if it is actually out of view. Scrolling on every
       reveal means that picking a second window yanks the page away from the
       car you are still working on. */
    var r = node.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    if (r.top < 0 || r.bottom > vh) {
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /* Empties a choice fieldset without destroying its <legend>. */
  function clearChoices(fieldset) {
    Array.prototype.forEach.call(
      fieldset.querySelectorAll('.choice'),
      function (n) { n.remove(); }
    );
  }

  function resetBelow(step) {
    if (step <= 3) hide(el.onVehicle);
    if (step <= 4) {
      hide(el.glass);
      hide(el.tellus);
      el.justTell.hidden = false;
      el.tellText.value = '';
      el.tellText.style.height = '';   // back to the rows= starting height
      hide(el.tellNote);
      panels = [];
      windshield = null;
      damageKind = {};
      hide(el.chipQ);
      el.chipDone.innerHTML = '';
      el.chipDone.hidden = true;
      teardownPicker();
      hide(el.photos);
      noPhotos = false;
      clearPhotos();
    }
    if (step <= 5) {
      hide(el.when);
      urgency = null;
      Array.prototype.forEach.call(
        el.whenChoices.querySelectorAll('input'),
        function (i) { i.checked = false; }
      );
    }
    if (step <= 6) {
      hide(el.review);
      hide(el.reach);
      el.summary.innerHTML = '';
      hide(el.sendNote);
      reach = {};
      el.send.disabled = true;
      el.send.textContent = 'Send My Request';
      Array.prototype.forEach.call(
        el.sendWhere.querySelectorAll('input'),
        function (i) { if (i.type === 'checkbox') i.checked = false; else i.value = ''; }
      );
      Array.prototype.forEach.call(
        el.sendWhere.querySelectorAll('.reach__input'),
        function (n) { n.hidden = true; n.classList.remove('reach__input--bad'); }
      );
      el.custName.value = '';
      el.custLoc.value = '';
      el.insured.checked = false;
      place = null;
      closeLoc();
      hide(el.locNote);
    }
  }

  /* ---------- step 1: the fork ----------

     The step is a question with two answers, and pressing one reveals only
     that answer's controls. Owner instruction, after three rounds of the same
     complaint: "it keeps displaying TOO much information".

     forkTaken is the flag the rest of the step reads. It is what tells
     placeReset there is a decision worth undoing on a VIN step where nothing
     has been typed yet, which is how somebody who pressed the wrong one gets
     back: the existing "Start over" control, which already asks before it
     clears anything. */
  var forkTaken = false;

  function takeFork() {
    if (forkTaken) return;
    forkTaken = true;
    /* Slid, not snapped. This is the FIRST thing anybody does here, and the two
       halves of it used to disagree: the buttons vanished in a frame while the
       branch they chose grew in underneath. One gesture, so one animation. The
       shut is 240 and the open 340, so the fork is gone before the branch has
       fully arrived and the step never looks like it holds both. */
    slideShut(el.fork);
  }

  /* Back to the question itself. Called by startOver, so every route that
     clears the request also puts this step back to two buttons rather than
     leaving it on a branch nobody chose this time round. */
  function resetFork() {
    forkTaken = false;
    show(el.fork);
    hide(el.field);
    hide(el.helpask);
    shutHelp();
  }

  /* hide(), not slideShut(). slideShut sets `hidden` from an animation's
     onfinish, and both callers here are removing the control that opened this
     panel in the same breath: animating a disclosure closed while its own
     trigger disappears above it is motion for nothing, and it makes the panel's
     final state depend on a callback that does not run in a tab the browser has
     stopped painting. Direct is both calmer and safer. */
  function shutHelp() {
    hide(el.help);
    el.helpBtn.setAttribute('aria-expanded', 'false');
  }

  el.yesVin.addEventListener('click', function () {
    takeFork();
    slideOpen(el.field);
    slideOpen(el.helpask);
    syncNav();
    /* Not on a touch screen: a keyboard thrown up the instant the button is
       released covers the branch that was just revealed. Same reasoning as the
       start button. */
    /* preventScroll: focusing an element that is still growing is the browser's
       cue to scroll it into view, against a height changing under it. */
    if (!COARSE) el.vin.focus({ preventScroll: true });
  });

  /* The crossing from one branch to the other, offered inside the help panel
     for somebody who said they knew their VIN and then could not find it. */
  el.giveUpVin.addEventListener('click', function () {
    slideShut(el.field);
    slideShut(el.helpask);
    shutHelp();
    el.vin.value = '';
    el.field.classList.remove('field--ok');
    say('');
    vehicle = null;
    resetBelow(2);
    openManual(true);
    if (!COARSE) el.mYear.focus();
  });

  el.helpBtn.addEventListener('click', function () {
    var open = el.help.hidden;
    if (open) slideOpen(el.help); else slideShut(el.help);
    el.helpBtn.setAttribute('aria-expanded', String(open));
  });

  el.vin.addEventListener('input', function () {
    var raw = el.vin.value;
    var cleaned = VIN.clean(raw);
    if (cleaned !== raw) el.vin.value = cleaned;

    var r = VIN.inspect(cleaned);
    el.field.classList.toggle('field--ok', r.state === 'ok');
    resetBelow(2);
    vehicle = null;

    if (r.state === 'short') {
      say(cleaned.length ? (17 - cleaned.length) + ' to go' : '');
      return;
    }
    if (r.state === 'chars') {
      say('A VIN never contains the letters I, O or Q.', 'err');
      return;
    }
    // 'checksum' is a soft warning. NHTSA often decodes these anyway.
    lookup(r.vin, r.state === 'checksum');
  });

  function lookup(vin, doubtful) {
    undecline();
    lastLookup = vin;
    say('Looking that up…');

    VIN.decode(vin).then(function (v) {
      if (lastLookup !== vin) return;   // a newer edit already superseded this
      if (!v.usable) {
        say('We couldn’t identify that VIN. Check it, or enter your vehicle below.', 'err');
        openManual();
        return;
      }
      /* vPIC can work out what a mistyped VIN was meant to be. Saying so is
         worth more than a bare warning about a check digit, which means
         nothing to anyone who has not had to explain one. */
      if (v.suggested) {
        say('That VIN looks like it was meant to be ' + v.suggested +
            '. Here’s what we found for it.', 'warn');
      } else {
        say(doubtful ? 'That VIN’s check digit looks off, but here’s what we found.' : '',
            doubtful ? 'warn' : '');
      }
      vehicle = v;
      vehicleSettled(v);
    }).catch(function () {
      if (lastLookup !== vin) return;
      say('We couldn’t reach the vehicle database. Enter your vehicle below instead.', 'err');
      openManual();
    });
  }

  /* ---------- step 1b: no-VIN fallback ---------- */

  /* Opens and closes the same way the VIN help does: the control that opened it
     is still there, still says what it does, and a second press puts it away.
     It used to hide itself on opening, which left the panel with no way out at
     all, and the customer looking at three dropdowns they could not dismiss. */
  function openManual(announce) {
    if (!el.manual.hidden) return;
    /* Said out loud rather than just opening three dropdowns. Someone who has
       just told us they cannot find their VIN has already had one small
       failure; the next thing they see should not be another form. */
    if (announce) {
      el.manualNote.textContent = 'No problem! Let\u2019s continue.';
      slideOpen(el.manualNote);
    }
    /* Populated BEFORE opening. scrollHeight is measured as the animation
       starts, so filling the dropdowns afterwards would animate to the height
       of an empty box and then jump to the real one. */
    fillManual();
    slideOpen(el.manual);
    el.noVin.setAttribute('aria-expanded', 'true');
    syncNav();
  }

  function shutManual() {
    if (el.manual.hidden) return;
    slideShut(el.manual);
    slideShut(el.manualNote);
    el.noVin.setAttribute('aria-expanded', 'false');

    /* Unlike the help panel, this one holds an ANSWER: which vehicle this is.
       Putting it away has to take the answer with it, or a year and make nobody
       can see any more would go on driving every step below. */
    el.mYear.value = '';
    el.mMake.value = '';
    el.mMake.disabled = true;
    clearModels('Model');
    el.mModel.disabled = true;
    typedShut();
    vehicle = null;
    resetBelow(2);
    syncNav();
  }

  function fillManual() {
    if (el.mYear.options.length > 1) return;

    var now = new Date().getFullYear() + 1;
    for (var y = now; y >= 1981; y--) {          // vPIC coverage starts at 1981
      el.mYear.add(new Option(y, y));
    }
  }

  /* The makes for the chosen YEAR only, from the shipped index: a make that
     sold nothing that year is never offered, so the model list that follows
     always has something in it. It used to offer all 64 makes for every
     year, and "2018 Geo" (Geo ended in 1997) went straight to an empty list
     and a "Type the model" box. If the index cannot be had, the full list. */
  function fillMakes(year) {
    var keep = el.mMake.value;
    el.mMake.innerHTML = '';
    el.mMake.add(new Option('Loading\u2026', ''));
    el.mMake.disabled = true;
    return VIN.makesFor(year).then(function (list) {
      if (el.mYear.value !== year) return false;         // year changed again meanwhile
      var makes = (list && list.length) ? list : MAKES;
      el.mMake.innerHTML = '';
      el.mMake.add(new Option('Make', ''));
      makes.forEach(function (m) { el.mMake.add(new Option(m, m)); });
      el.mMake.add(new Option('My make isn\u2019t listed', OTHER));
      el.mMake.disabled = false;
      var still = makes.indexOf(keep) !== -1 || keep === OTHER;
      el.mMake.value = still ? keep : '';
      return still && !!keep;
    });
  }

  /* ---- typing it in, when the lists do not have it ---- */

  function typedOpen(makeToo) {
    el.mMakeText.hidden = !makeToo;
    el.mModel.hidden = !!makeToo || el.mModel.hidden;
    el.mModelText.hidden = false;
    el.mGo.hidden = false;
    syncTyped();
  }

  function typedShut() {
    el.mMakeText.hidden = true;
    el.mModelText.hidden = true;
    el.mGo.hidden = true;
    el.mMakeText.value = '';
    el.mModelText.value = '';
    el.mModel.hidden = false;
  }

  function typedMake() {
    return el.mMake.value === OTHER ? el.mMakeText.value.trim() : el.mMake.value;
  }

  function syncTyped() {
    el.mGo.disabled = !(typedMake().length >= 2 && el.mModelText.value.trim().length >= 1);
  }

  el.mMakeText.addEventListener('input', syncTyped);
  el.mModelText.addEventListener('input', syncTyped);

  function goTyped() {
    if (el.mGo.disabled) return;
    var model = el.mModelText.value.trim();
    settleManual(typedMake(), model, [], null, true);
  }

  el.mGo.addEventListener('click', goTyped);
  [el.mMakeText, el.mModelText].forEach(function (f) {
    f.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); goTyped(); }
    });
  });

  /* One of the two answers now, not a disclosure. It used to toggle, because it
     sat on a screen that also held the field and could be pressed by mistake;
     from the fork it is a choice, and the way back out of a choice is "Start
     over" rather than pressing the same button again. */
  el.noVin.addEventListener('click', function () {
    takeFork();
    openManual(true);
    if (!COARSE) el.mYear.focus();
  });

  el.mYear.addEventListener('change', function () {
    clearModels('Model');
    resetBelow(2);
    var typedMakeOpen = el.mMake.value === OTHER;
    if (!typedMakeOpen) typedShut();
    if (!el.mYear.value) { el.mMake.value = ''; el.mMake.disabled = true; return; }
    fillMakes(el.mYear.value).then(function (kept) {
      /* The same make in the new year: its models for that year, straight
         away, rather than making them choose the make again. */
      if (kept && el.mMake.value !== OTHER) loadModels();
    });
  });

  el.mMake.addEventListener('change', function () {
    resetBelow(2);
    typedShut();
    if (!el.mMake.value) { clearModels('Model'); return; }
    if (el.mMake.value === OTHER) {
      clearModels('Model');
      typedOpen(true);
      el.mMakeText.focus();
      return;
    }
    loadModels();
  });

  function loadModels() {
    clearModels('Loading…');
    el.mModel.disabled = true;

    var make = el.mMake.value, year = el.mYear.value;
    var token = make + year;
    lastLookup = token;

    function fill(models) {
      if (lastLookup !== token) return;
      /* vPIC's list, or ours for the makes it lacks. Never nothing: an empty
         answer opens the typed box instead of a dead dropdown. */
      if (!models.length) {
        models = fallbackModels(make, year).map(function (m) {
          fallbackBody[m.name] = m.body;
          return { name: m.name, types: [] };
        });
      }
      /* Should not happen now the make list follows the year. If it does
         (our own file unreachable AND NHTSA down), the list still opens as a
         normal choice, with "isn't listed" in it, rather than dropping the
         customer into a text box they did not ask for. */
      clearModels('Model');
      modelTypes = Object.create(null);
      models.forEach(function (m) {
        modelTypes[m.name] = m.types;
        if (m.body) fallbackBody[m.name] = m.body;
        el.mModel.add(new Option(m.name, m.name));
      });
      el.mModel.add(new Option('My model isn\u2019t listed', OTHER));
      el.mModel.disabled = false;
    }

    /* A lookup that fails outright (NHTSA down, the phone offline) is treated
       exactly like an empty one: the built-in list, then the typed box. It
       used to say "Couldn't load models" and stop. */
    VIN.modelsFor(make, year).then(fill).catch(function () { fill([]); });
  }

  el.mModel.addEventListener('change', function () {
    if (el.mModel.value === OTHER) {
      resetBelow(2);
      typedOpen(false);
      el.mModelText.focus();
      return;
    }
    typedShut();
    if (!el.mModel.value) { resetBelow(2); return; }
    var name = el.mModel.value;
    settleManual(el.mMake.value, name, modelTypes[name] || [], fallbackBody[name] || null, false);
  });

  /* One place a hand-entered vehicle is made, whichever way it was named. */
  function settleManual(make, model, types, body, typed) {
    // No VIN means no ADAS data, so we have to ask rather than infer.
    undecline();
    vehicle = {
      year: el.mYear.value,
      make: make,
      model: model,
      trim: '', bodyClass: '', doors: '', cab: '', vin: '',
      /* What vPIC filed this model under: car, truck, mpv, or several. Not a
         body style, but enough to stop us asking a stupid question about one. */
      vpicTypes: types,
      /* Worked out, not asked. See bodyFor: the name settles the common
         nameplates and the vPIC bucket covers the rest. A built-in list
         entry carries its own. */
      bodyStyle: body || bodyFor(model, types),
      /* A shape from the checked list (tools/body), not a guess. */
      bodyFromList: !!body,
      adas: { camera: [], mixed: [], elsewhere: [] },
      label: el.mYear.value + ' ' + make + ' ' + model,
      /* Typed by the customer, not picked from a list: the owners should
         know the name was not checked against anything. */
      typedByCustomer: !!typed,
      usable: true
    };
    vehicleSettled(vehicle);
  }

  function clearModels(label) {
    el.mModel.innerHTML = '';
    el.mModel.add(new Option(label, ''));
    el.mModel.disabled = true;
  }

  /* A vehicle Quillin does not do glass on. Says so plainly, and still takes a
     message, because someone on a motorcycle asking about a windshield may well
     have a car too, and a dead end is a worse answer than a person. */
  function declineVehicle(v, r) {
    el.picker.hidden = true;
    el.justTell.hidden = true;
    el.glassLabel.textContent = 'We don’t do ' + r.what + '.';
    el.declineNote.textContent =
      'That VIN is a ' + (v.label || r.label) + ', and glass on ' + r.what +
      ' is not work we take on. If there’s another vehicle we can help with, ' +
      'or you think we have this wrong, leave us a message and we’ll come back to you.';
    el.declineNote.hidden = false;
    show(el.tellus);
  }

  /* Puts the damage step back to normal. Called before every fresh lookup,
     because the customer may correct a motorcycle VIN to a car. */
  function undecline() {
    el.picker.hidden = false;
    el.declineNote.hidden = true;
    el.glassLabel.textContent = 'So… where’s the damage?';
  }

  /* ---------- step 2: the vehicle is settled ---------- */

  /* There WAS a step here, "One more thing", and it is gone entirely on the
     owners' instruction.

     It asked whether the car has a camera behind the rearview mirror, because a
     windshield with one has to be recalibrated to it. First it was asked
     whenever the VIN came back ambiguous; then, on their instruction, only when
     there was no VIN at all; now not at all. Their reasoning held the whole way
     and simply went further than the first cut of it: "Too much information can
     confuse the clients. If we need additional information, that will become
     our responsibility to contact the clients."

     So it is the shop's question to answer, not the customer's. What the VIN
     says still reaches them untouched, in the request's `adas` block and in the
     ADAS line workFor adds for them; the customer never sees either. On the
     no-VIN route there is now no ADAS signal at all, which is the deliberate
     cost of this and is stated plainly in the record that goes to them.

     What the step carried BESIDES its question, and what therefore had to
     survive it: resetBelow(2). It runs on every fresh lookup, because the
     customer may correct a motorcycle VIN to a car, and a new vehicle must not
     inherit the old one's glass. That is the whole of this function now.

     `answers` went with the question. It only ever held this one. */
  function vehicleSettled(v) {
    resetBelow(2);
    askConfirm(v);
  }

  /* vPIC's vehicle types are too coarse on their own: "truck" covers a pickup,
     a panel van, a Suburban and an eighteen wheeler alike, so a Ford F-150 was
     still being asked what shape it is. Nobody needs to be asked that.

     The US market has a small, stable set of nameplates, so matching the model
     name settles the common cases outright. Kept deliberately narrow: these are
     names, not guesses at a pattern, and anything not on a list falls through
     to the question rather than being assumed. A Tahoe must not become a pickup
     just because vPIC files it under truck. */
  var BY_NAME = [
    { body: 'pickup', re: /\b(f-?[1-4]50|super ?duty|silverado|sierra|ram ?[1-5]500|tacoma|tundra|ranger|colorado|canyon|frontier|titan|ridgeline|gladiator|maverick|santa ?cruz|dakota|avalanche|lightning|cybertruck|rivian ?r1t|hummer ?ev ?pickup)\b/i },
    { body: 'van',    re: /\b(transit|sprinter|promaster|express|savana|nv ?[0-9]*|metris|caravan|sienna|odyssey|pacifica|carnival|sedona|econoline|e-?[1-4]50|city ?express|quest|routan|b-?series ?van)\b/i },
    { body: 'heavy',  re: /\b(f-?[678]50|cascadia|columbia|freightliner|kenworth|peterbilt|international|box ?truck|chassis|motorhome|school ?bus|topkick|lcf)\b/i },
    { body: 'suv',    re: /\b(tahoe|suburban|yukon|escalade|expedition|navigator|explorer|traverse|4runner|sequoia|land ?cruiser|wrangler|bronco|durango|armada|pathfinder|telluride|palisade|highlander|pilot|passport|atlas|ascent|grand ?cherokee|cherokee|compass|renegade|edge|escape|equinox|blazer|trailblazer|rav ?4|cr-?v|hr-?v|rogue|murano|kicks|forester|crosstrek|outback|cx-?[0-9]+|tucson|santa ?fe|kona|venue|sorento|sportage|seltos|encore|envision|enclave|acadia|terrain|q[357]|qx[456789]0|x[1-7]\b|gl[abcels]|mdx|rdx|xt[456]|nx|rx|gx|lx|model ?[xy]|id\.?4|mach-?e|ioniq ?5|ev6|ariya|bz4x|eqb|eqe ?suv|i[x4])\b/i },
    { body: 'hatch',  re: /\b(golf|gti|r32|fit|yaris|versa ?note|veloster|soul|leaf|bolt|prius ?c?|impreza|mazda ??3 ?hatch|focus ?hatch|fiesta ?hatch|mini ?cooper|clubman|countryman|civic ?hatch|elantra ?gt|forte5|rio ?5|spark|sonic ?hatch|matrix|vibe|cube|xb|hatchback|wagon|sportwagen|allroad|avant|touring|estate)\b/i },
    { body: 'convertible', re: /\b(miata|mx-?5|boxster|z4|cascada|solstice|sky|s2000|slk|sl[456]00|e[45]0 ?cabrio|convertible|cabriolet|roadster|spyder|spider|targa)\b/i },
    { body: 'coupe',  re: /\b(camaro|mustang|challenger|corvette|supra|brz|gr ?86|frs|fr-?s|370 ?z|350 ?z|400 ?z|nissan ?z|gt-?r|cayman|celica|integra|rsx|tt|m[2348] ?coupe|rc ?[0-9]*|lc ?[0-9]*|q60|genesis ?coupe|veloster ?n|eclipse|monte ?carlo|grand ?prix ?coupe|firebird|trans ?am|viper|challenger|charger ?coupe)\b/i }
  ];

  /* What each vPIC bucket is when the name says nothing. This is the change
     that lets the question go away entirely: a passenger car nobody recognises
     is a saloon, which is what most of them are; an MPV is a crossover; a truck
     is a pickup, the SUV and van names above having already been taken out.

     It is a fallback, so it is sometimes wrong, and being wrong is visible: the
     customer is shown the vehicle and the list of its glass, with the note
     saying it is a body like theirs rather than their exact car, and "Or just
     tell us!" underneath. Wrong and correctable beats interrogating everybody
     to spare the few. */
  var BODY_DEFAULT = { car: 'sedan', mpv: 'suv', truck: 'pickup' };

  function bodyFromName(model) {
    var hits = BY_NAME.filter(function (r) { return r.re.test(model || ''); });
    return hits.length === 1 ? hits[0].body : null;   // ambiguous: fall through
  }

  /* The body style for a vehicle entered by hand, with no question asked.
     Name first, because it is specific; then the bucket vPIC filed it under. */
  function bodyFor(model, types) {
    var byName = bodyFromName(model);
    if (byName) return byName;
    for (var i = 0; i < (types || []).length; i++) {
      if (BODY_DEFAULT[types[i]]) return BODY_DEFAULT[types[i]];
    }
    return 'sedan';
  }

  /* ---------- step 3: confirm ---------- */

  /* Named, not asked about.

     This was a page of its own: "Did we get that right?", the vehicle, and a
     "Yes, that's my vehicle" button. The owners had it removed because people
     found it annoying to confirm a vehicle they had only just chosen, which on
     the year/make/model route is precisely what it was asking them to do.

     So the vehicle is a line at the top of the damage page now. The customer
     still sees what we read, which matters most on the VIN route where they
     typed seventeen characters and never named a car; they just are not asked
     to agree with it before carrying on. If it is wrong, Back is at the foot of
     the page and the review names it again before anything is sent.

     The decline check moved here with it. It used to sit behind the Yes button,
     deliberately, so that a mistyped VIN landing on a motorcycle could be
     corrected at the confirmation rather than dead-ending at the decode. With
     no confirmation left, this is that point: the decline itself shows what the
     VIN read, says why it cannot be quoted and takes a message, and Back still
     returns to the VIN. So it redirects rather than dead ends, which was the
     property worth keeping. */
  /* Called when the vehicle has just been established or changed, so the
     clearing is right: a different car has different glass. Going BACK to the
     VIN page and pressing Continue does NOT come through here, because nothing
     about the vehicle changed and the damage below it must survive. That route
     is plain navigation, and setupGlass below is what makes the page ready. */
  function askConfirm(v) {
    resetBelow(3);
    goTo('step-glass');     // which prepares the page on the way in
  }

  /* Everything the damage page needs before it is looked at, from whichever
     direction it is reached: forwards off the vehicle, or back off the chip
     question. Idempotent, and openPicker already returns early once it has
     built a list, so arriving here repeatedly costs nothing. */
  function setupGlass() {
    var v = vehicle;
    if (!v) return;

    var r = Glass.resolve(v);
    if (r.unsupported) { declineVehicle(v, r); return; }

    /* The year, make and model, and nothing else.

       The confirmation page this replaces also listed the trim, the body style
       and the VIN back at the customer. On a line at the top of the damage page
       that came to three wrapped lines on a phone and 99px of height, on the one
       page in the flow that is already too tall, and every part of it is either
       redundant or already on screen: the VIN was typed two screens ago, the
       body style is what the picker note underneath says out loud, and the trim
       does not change any glass. The full detail is still on the review page.

       No driver assist line either. See buildSummary: anything we infer about
       ADAS from the VIN goes to Quillin, not to the customer. */
    el.onVehicle.innerHTML = '';
    var name = document.createElement('b');
    name.textContent = v.label;
    el.onVehicle.appendChild(name);
    show(el.onVehicle);
    openPicker();
  }

  /* The way forward from a page that normally carries you on by itself.

     Reported by the owners: go Back to "Do you know your VIN?" and there is no
     way to progress. Quite right. Three pages in this flow advance on the
     answer itself rather than on a button, which is smooth going forwards and a
     dead end coming back: the vehicle is already decoded, the camera question
     is already answered, the timing is already chosen, and not one of those
     events is going to fire a second time just because you are looking at the
     page again.

     So each of them has a Continue, disabled until its own question is settled,
     which on the forward pass is a control nobody ever needs to touch. */
  function pageAnswered(id) {
    if (id === 'step-vin') return !!vehicle;
    return true;
  }

  /* ---------- step 4: the picker ---------- */

  /* Loaded once, lazily, next to the picker itself. Kept in a variable rather
     than imported per open so the five model files are only ever fetched once
     per visit however many times an earlier answer is edited. */
  var Vehicles = null;
  import('./vehicles.js?v=6471ac10').then(function (mod) { Vehicles = mod; },
    function (err) { console.error('Vehicle models unavailable:', err); });

  function teardownPicker() {
    if (picker) { picker.dispose(); picker = null; }
    clearChoices(el.pickerList);
    el.pickerStage.innerHTML = '';
    el.picker.classList.remove('picker--nogl');
  }

  /* The vehicle is a body archetype chosen from the VIN, not the customer's exact
     car, and the note says so. What has to be right is the panel set. */
  /* ---------- "Not your shape?" ----------

     The customer's answer to the one thing the picker depends on. Offered on
     every vehicle, VIN or not: a VIN decodes the shape well but not always, and
     a model name is a guess for anything that comes in several bodies. Picking
     one sets vehicle.bodyStyle, which Glass.resolve already ranks above every
     other source, and rebuilds the picker for it. Whatever they had already
     written about the damage is kept. */
  var SHAPES = [
    ['sedan', 'Sedan', 'M4 17h40M8 17l5-6h14l6 6M6 17v3h36v-3'],
    ['coupe', 'Coupe', 'M4 17h40M10 17l7-6h10l8 6M6 17v3h36v-3'],
    ['hatch', 'Hatchback', 'M6 17h36M10 17l5-7h16l6 7M8 17v3h32v-3M31 10v7'],
    ['convertible', 'Convertible', 'M4 17h40M14 17l3-4h4M6 17v3h36v-3M27 13h8'],
    ['suv', 'SUV', 'M4 17h40M7 17l3-8h24l5 8M6 17v3h36v-3'],
    ['pickup', 'Pickup', 'M3 17h42M5 17l3-7h14v7M22 12h20v5M5 17v3h38v-3'],
    ['van', 'Van', 'M5 17h38M7 17V8h26l7 9M7 20h34v-3'],
    ['heavy', 'Big truck', 'M3 17h42M5 17V8h12v9M17 10h26v7M5 20h38v-3']
  ];

  function buildShapes() {
    if (el.shapeRow.children.length) return;
    SHAPES.forEach(function (sh) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'shape__btn';
      b.setAttribute('data-shape', sh[0]);
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = '<svg viewBox="0 0 48 24" aria-hidden="true" focusable="false"><path d="' +
        sh[2] + '"/><circle cx="14" cy="20" r="2.4"/><circle cx="35" cy="20" r="2.4"/></svg>';
      var t = document.createElement('span');
      t.textContent = sh[1];
      b.appendChild(t);
      b.addEventListener('click', function () { chooseShape(sh[0]); });
      el.shapeRow.appendChild(b);
    });
  }

  function markShape(id) {
    Array.prototype.forEach.call(el.shapeRow.children, function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-shape') === id));
    });
  }

  el.shapeAsk.addEventListener('click', function () {
    buildShapes();
    markShape(archetype && archetype.id);
    var open = el.shapeRow.hidden;
    if (open) slideOpen(el.shapeRow); else slideShut(el.shapeRow);
    el.shapeAsk.setAttribute('aria-expanded', String(open));
  });

  function chooseShape(id) {
    if (!vehicle || (archetype && archetype.id === id)) return;
    vehicle.bodyStyle = id;
    vehicle.bodyChosenByCustomer = true;
    /* New shape, new glass: only the picks and the 3D view go. NOT
       resetBelow(4), which also hides this very page (el.glass is
       step-glass) and empties what they wrote about the damage. */
    panels = [];
    windshield = null;
    damageKind = {};
    hide(el.chipQ);
    el.chipDone.innerHTML = '';
    el.chipDone.hidden = true;
    teardownPicker();
    openPicker();
    markShape(id);
    syncNav();
  }

  function openPicker() {
    if (picker || el.pickerList.querySelector('input')) return;
    archetype = Glass.resolve(vehicle);
    /* The shape row closes on a new vehicle; it stays open, marked, when the
       customer is the one who just changed the shape. */
    if (!vehicle.bodyChosenByCustomer) {
      el.shapeRow.hidden = true;
      el.shapeAsk.setAttribute('aria-expanded', 'false');
    }

    /* "an SUV": said "es-you-vee", so it takes "an" like any vowel sound. */
    var an = /^(suv|[aeiou])/i.test(archetype.label) ? 'an ' : 'a ';
    el.pickerNote.textContent = 'This is ' + an + archetype.label +
      ' like yours, not your exact car. Tap the glass that needs work.';

    // Resolved relative to THIS file (js/), not the document base. The leading
    // './' is required; a bare 'picker.js' would be read as a package name.
    // Two-argument then(), not then().catch(): a throw inside the success
    // handler must not be reported as a module load failure.
    import('./picker.js?v=67c8fbb1').then(function (mod) {
      /* The real model is fetched HERE rather than inside the picker, so the
         picker itself stays synchronous. A body style we have no model for, or
         a fetch that fails, resolves to null and the picker falls back to the
         profile generator: a generated vehicle is a far better outcome than a
         step that cannot draw anything. */
      var ready = Vehicles && Vehicles.hasModel(archetype.id)
        ? Vehicles.loadVehicle(archetype.id, archetype.cab, archetype.panels)
            .catch(function (err) {
              console.error('Vehicle model failed, using the generator:', err);
              return null;
            })
        : Promise.resolve(null);

      return ready.then(function (vehicleModel) {
      try {
        picker = mod.createPicker({
          mount: el.pickerStage,
          listMount: el.pickerList,
          archetype: archetype,
          labelFor: Glass.labelFor,
          vehicle: vehicleModel,
          onChange: onPanels
        });
        /* Same reason as __lastRequest below: the picker is reached through a
           dynamic import and held in a closure, so without this there is no way
           to read the camera from a console and every question about the 3D
           view has to be answered by looking at pixels. */
        window.__picker = picker;
      } catch (err) {
        console.error('Glass picker failed to start:', err);
        plainList();
      }
      });
    }, function (err) {
      console.error('Glass picker failed to load:', err);
      plainList();
    });
  }

  /* No WebGL, or the picker broke. The list alone does the job. */
  function plainList() {
    el.picker.classList.add('picker--nogl');
    el.pickerNote.textContent = 'Pick the glass that needs work.';
    clearChoices(el.pickerList);
    buildPlainList();
  }

  /* Checkbox-only fallback, same ids and same shared state as the 3D view. */
  function buildPlainList() {
    archetype.panels.forEach(function (id) {
      var label = document.createElement('label');
      label.className = 'choice choice--compact';
      label.setAttribute('for', 'panel-' + id);

      var input = document.createElement('input');
      input.type = 'checkbox';
      input.id = 'panel-' + id;
      input.value = id;
      input.addEventListener('change', function () {
        var next = archetype.panels.filter(function (p) {
          var box = document.getElementById('panel-' + p);
          return box && box.checked;
        });
        onPanels(next);
      });

      var span = document.createElement('span');
      span.textContent = Glass.labelFor(id);

      label.appendChild(input);
      label.appendChild(span);
      el.pickerList.appendChild(label);
    });
  }

  function onPanels(next) {
    panels = next || [];
    syncChipQuestion();
    afterDamageChange();
  }

  /* Asked only when it can matter. Nobody picking a door glass should be shown
     a question about chips. */
  function chipLabelFor(value) {
    for (var i = 0; i < CHIP.length; i++) if (CHIP[i].value === value) return CHIP[i].label;
    return '';
  }

  function chipShortFor(value) {
    for (var i = 0; i < CHIP.length; i++) if (CHIP[i].value === value) return CHIP[i].short;
    return '';
  }

  /* Which of the chosen panes get asked chip or crack. The WINDSHIELD, and
     nothing else.

     Owner instruction, reversing an earlier decision here to ask per pane.
     Their reasoning is a trade fact worth recording: door glass moves up and
     down, so even where a repair is possible it will not last, and they would
     not recommend it. Asking somebody with a broken door window whether it is a
     chip offers them a repair the shop will not do.

     One function, read by the question, by the gate that says the page is
     finished and by the router that decides the page exists at all, so those
     three cannot drift apart. Still returns a LIST, and the question still
     walks it: the walk costs nothing at length one, and the day a second pane
     earns the question back, this is the only line that changes. */
  function chipPanels() {
    return panels.indexOf('windshield') !== -1 ? ['windshield'] : [];
  }

  /* Walks the glass that gets asked, one piece at a time.

     Each answer collapses to a line above the question and the question moves
     on to the next piece, so the customer is never looking at four identical
     sets of radio buttons and wondering which window they belong to. When the
     last one is answered the question goes away and the photo ask is next. */
  function syncChipQuestion() {
    var ask = chipPanels();

    /* Drop answers for glass that is no longer asked about: deselected, or a
       door answered back when doors were still asked. */
    Object.keys(damageKind).forEach(function (id) {
      if (ask.indexOf(id) === -1) delete damageKind[id];
    });
    windshield = damageKind.windshield || null;   // the rest of the app reads this

    /* The pieces already settled, each one a way back into its own question.

       They used to be plain text. That was fine while this page always had a
       live question under them, but it is reachable by Back now, and arriving
       that way means the question is answered and closed and a list of flat
       text is the only thing on screen: somebody who came back specifically to
       change an answer had no way to do it.

       Now that only the windshield is asked, this list is EMPTY on the way
       forward, because answering the one question carries the customer on
       before it could be drawn. Its whole remaining job is that dead end on the
       way back. Kept rather than deleted for exactly that, and because it is
       the list that would come back to life if a second pane ever earned the
       question again. */
    el.chipDone.innerHTML = '';
    var answered = ask.filter(function (id) { return damageKind[id]; });
    answered.forEach(function (id) {
      var li = document.createElement('li');
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'answered__row';

      var k = document.createElement('b');
      k.textContent = Glass.labelFor(id);
      var v = document.createElement('span');
      v.textContent = chipShortFor(damageKind[id]);
      var act = document.createElement('em');
      act.textContent = 'Change';

      row.appendChild(k); row.appendChild(v); row.appendChild(act);
      row.setAttribute('aria-label',
        'Change: ' + Glass.labelFor(id) + ', currently ' + chipLabelFor(damageKind[id]));
      /* Full wording in the aria-label above, short on screen. Nothing is saved
         by abbreviating for a screen reader, and "Crack" alone is thinner than
         what was actually chosen. */
      row.addEventListener('click', function () {
        delete damageKind[id];
        syncChipQuestion();      // which will now ask about this one again
        syncNav();
      });

      li.appendChild(row);
      el.chipDone.appendChild(li);
    });
    /* Slid both ways. Pressing "Change" on a settled row used to snap the whole
       list away while the question it re-opens slid in beneath it. Both helpers
       return immediately if the element is already where it is being asked to
       go, so calling this on every sync costs nothing. */
    if (answered.length) slideOpen(el.chipDone); else slideShut(el.chipDone);

    // The next one to ask about, in the order the panels are listed.
    var next = null;
    for (var i = 0; i < ask.length; i++) {
      if (!damageKind[ask[i]]) { next = ask[i]; break; }
    }

    if (!next) { slideShut(el.chipQ); return; }

    var name = Glass.labelFor(next);
    var lower = name.charAt(0).toLowerCase() + name.slice(1);
    el.chipLabel.textContent = 'The ' + lower + ': chip or crack?';
    el.chipLegend.textContent = 'Is the ' + lower + ' damage a chip or a crack?';

    /* Rebuilt for each piece rather than reused, because a radio group that
       still holds the previous answer reads as already answered. */
    clearChoices(el.chipChoices);
    CHIP.forEach(function (opt) {
      var id = 'chip-' + opt.value;
      var label = document.createElement('label');
      label.className = 'choice';
      label.setAttribute('for', id);

      var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'chip';
      input.id = id;
      input.value = opt.value;
      input.addEventListener('change', function () {
        damageKind[next] = opt.value;
        syncChipQuestion();      // settles this one and closes the question
        syncNav();

        /* Answering the last piece finishes this page, so it carries on rather
           than leaving a screen that only lists back what was just entered.

           Owner instruction, and the same one that removed the vehicle
           confirmation: if they have already said it, do not stop them to show
           them that they said it. Before this, answering the final pane closed
           the question and left the answered list and a Continue button, which
           is a confirmation page by another name.

           Deliberately NOT done from prepare(). Arriving here by Back means
           everything is already answered, and advancing on that would bounce
           the customer straight forward again and make the page unreachable. */
        if (damageDone()) goNext();
      });

      var span = document.createElement('span');
      span.textContent = opt.label;
      label.appendChild(input);
      label.appendChild(span);
      el.chipChoices.appendChild(label);
    });

    slideOpen(el.chipQ);
  }

  /* ---------- step 4: describe it instead ---------- */

  /* The picker is an aid, never a gate. Plenty of people would rather type one
     sentence than rotate a car, and some will be on a device that cannot. */
  el.justTell.addEventListener('click', function () {
    /* The button and the panel are one gesture. The button used to disappear in
       a frame while the box slid open below it. */
    slideShut(el.justTell);
    slideOpen(el.tellus);
    /* Measured after the panel has a size. Inside slideOpen it is still zero
       height, so scrollHeight reads 0 and the box collapses to its padding. */
    growTellus();
    el.tellText.focus();
  });

  /* The box follows what has been typed into it.

     height:auto first, then scrollHeight. Without the reset, scrollHeight can
     never report LESS than the height already set, so the box would grow with
     every line added and never shrink when one is deleted: a one word answer
     left in a box six lines tall.

     Guarded on being visible, because scrollHeight is 0 for a hidden element
     and that would set the height to the padding alone. */
  function growTellus() {
    var t = el.tellText;
    if (t.offsetParent === null) return;
    t.style.height = 'auto';
    t.style.height = t.scrollHeight + 'px';
  }

  el.tellText.addEventListener('input', function () {
    growTellus();
    var n = el.tellText.value.trim().length;
    if (!n) { hide(el.tellNote); } else {
      el.tellNote.textContent = 'Got it. Describe it however makes sense to you.';
      el.tellNote.className = 'note';
      show(el.tellNote);
    }
    afterDamageChange();
  });

  /* ---------- step 4: photographs ---------- */

  el.addPhotos.addEventListener('click', function () {
    noPhotos = false;
    el.photoInput.click();
  });

  /* An explicit no. The heading asks a question, so it needs a second answer;
     without one the only way past is to ignore the step, which leaves the
     customer unsure whether they have missed something. */
  /* There was a "No images" button beside "Upload images" here, which made two
     ways forward out of one question. Continue is the only way forward now, and
     pressing it with nothing attached IS the answer "no": see the [data-next]
     handler, which sets noPhotos in exactly that case. The request still tells
     the two apart, because "said no" and "never got this far" are different
     things to a shop reading it. */

  el.photoInput.addEventListener('change', function () {
    addPhotos(Array.prototype.slice.call(el.photoInput.files));
    el.photoInput.value = '';   // so picking the same file twice still fires
  });

  function bytes(n) {
    return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB'
                        : Math.round(n / 1024) + ' KB';
  }

  function totalBytes() {
    return photos.reduce(function (n, p) { return n + p.file.size; }, 0);
  }

  function addPhotos(files) {
    var skipped = [];
    files.forEach(function (f) {
      if (photos.length >= PHOTO_MAX) { skipped.push('over ' + PHOTO_MAX); return; }
      if (!/^image\//.test(f.type) && !/\.(hei[cf]|jpe?g|png|webp)$/i.test(f.name)) {
        skipped.push(f.name + ' is not an image'); return;
      }
      if (f.size > PHOTO_MAX_BYTES) { skipped.push(f.name + ' is too large'); return; }
      if (totalBytes() + f.size > PHOTO_TOTAL_BYTES) { skipped.push('total too large'); return; }
      photos.push({ file: f, url: URL.createObjectURL(f) });
    });

    drawPhotos();
    afterDamageChange();

    if (skipped.length) {
      say2(skipped.slice(0, 2).join('. ') + '.', 'warn');
    } else if (photos.length) {
      say2(photos.length + (photos.length === 1 ? ' image' : ' images') +
           ' attached, ' + bytes(totalBytes()) + '.');
    } else {
      say2('');
    }
  }

  /* Anything that counts as telling us what broke. */
  function damageGiven() {
    return panels.length > 0 || photos.length > 0 || el.tellText.value.trim().length > 0;
  }

  /* Called whenever the damage changes: a pane toggled, a photo added or
     dropped, the description edited.

     It deliberately does NOT reset the timing step. Choosing a second broken
     window does not un-answer "when do you need this fixed", and tearing that
     step down and rebuilding it was both wiping their answer and scrolling the
     page away from the car they were still picking from. Only the review below
     is genuinely stale. */
  /* Called whenever the damage changes: a pane toggled, a photo added or
     dropped, the description edited.

     It does NOT advance. Tapping a window on the car is an act of pointing, not
     an act of finishing, and moving the page the moment someone points at
     something takes the car out from under them while they are still deciding
     whether there is a second break. Advancing is its own button.

     It also does not reset the timing step. Choosing a second broken window
     does not un-answer "when do you need this fixed"; only the review below is
     genuinely stale. */
  function afterDamageChange() { advance(); }

  /* ---------- the flow ----------

     What is on screen is DERIVED from what has been answered, rather than
     pushed along by whichever button was pressed last.

     This is the fix for going back. Editing an earlier answer used to call
     resetBelow, which does not just hide the later steps, it CLEARS them: the
     photographs, the timing, all of it. So a customer who went back to add a
     second broken window lost every answer after it and, because nothing
     re-revealed those steps, had no way forward either. Their progress was
     gone and the page just sat there.

     Now nothing is cleared. advance() only decides what is SHOWN, so every
     answer below the edit survives it, and the moment the edit is complete the
     rest of the flow reappears exactly as it was. */

  function damageDone() {
    if (!damageGiven()) return false;
    // Every pane that gets asked chip or crack has to have been answered.
    return chipPanels().every(function (id) { return !!damageKind[id]; });
  }

  function photosDone() { return photos.length > 0 || noPhotos; }

  /* Called whenever an answer changes. It no longer decides what is on screen,
     because the router does that; it decides whether the way OFF the page you
     are standing on is open yet, and it keeps the summary honest.

     The split matters. Deciding what is reachable and deciding where somebody
     is standing were the same function in the old flow, which is why changing
     an answer could move the page out from under you. They are separate now,
     and only a button press moves anybody. */
  function advance() {
    syncNav();

    /* Rebuilt rather than left to go stale. Going Back from the confirmation
       page to change a pane and returning has to show the change, and the
       summary is cheap enough to rebuild on every answer. */
    if (!el.review.hidden) buildSummary();
  }

  function say2(text, kind) {
    if (!text) { hide(el.photoNote); return; }
    el.photoNote.textContent = text;
    el.photoNote.className = 'note' + (kind ? ' note--' + kind : '');
    show(el.photoNote);
  }

  function drawPhotos() {
    el.shots.innerHTML = '';
    photos.forEach(function (p, i) {
      var li = document.createElement('li');
      li.className = 'shot';

      var img = document.createElement('img');
      img.src = p.url;
      img.alt = 'Photo ' + (i + 1) + ' of the damage';
      /* Safari hands us HEIC straight off the camera roll and most browsers
         cannot draw it. The file is still perfectly sendable, so fall back to
         naming it rather than showing a broken image. */
      img.addEventListener('error', function () {
        var name = document.createElement('span');
        name.className = 'shot__name';
        name.textContent = p.file.name;
        img.replaceWith(name);
      });
      li.appendChild(img);

      var drop = document.createElement('button');
      drop.type = 'button';
      drop.className = 'shot__drop';
      drop.innerHTML = '&times;';
      drop.setAttribute('aria-label', 'Remove photo ' + (i + 1));
      drop.addEventListener('click', function () { removePhoto(i); });
      li.appendChild(drop);

      el.shots.appendChild(li);
    });
    if (photos.length) slideOpen(el.shots); else slideShut(el.shots);
    el.addPhotos.textContent = photos.length ? 'Add more images' : 'Upload images';
  }

  function removePhoto(i) {
    URL.revokeObjectURL(photos[i].url);
    photos.splice(i, 1);
    drawPhotos();
    afterDamageChange();
    say2(photos.length ? photos.length + ' attached, ' + bytes(totalBytes()) + '.' : '');
  }

  /* Object URLs are held by the browser until revoked, so a customer who starts
     over twice would otherwise leak every photo they ever picked. */
  function clearPhotos() {
    photos.forEach(function (p) { URL.revokeObjectURL(p.url); });
    photos = [];
    el.shots.innerHTML = '';
    el.shots.hidden = true;
    el.addPhotos.textContent = 'Upload images';
    hide(el.photoNote);
  }

  /* ---------- step 5: timing ---------- */

  function buildWhen() {
    // NB: the fieldset already contains a <legend>, so count inputs, not children.
    if (!el.whenChoices.querySelector('input')) {
      WHEN.forEach(function (opt) {
        var id = 'when-' + opt.value;
        var label = document.createElement('label');
        label.className = 'choice';
        label.setAttribute('for', id);

        var input = document.createElement('input');
        input.type = 'radio';
        input.name = 'when';
        input.id = id;
        input.value = opt.value;
        input.addEventListener('change', function () {
          urgency = opt;
          /* One answer, and choosing it IS finishing this page, so it carries
             the customer on rather than lighting up a button to press next. The
             glass page deliberately does not do this: picking a pane is
             pointing, not finishing, and a second window may still be broken. */
          goTo('step-review');
        });

        var span = document.createElement('span');
        span.textContent = opt.label;

        label.appendChild(input);
        label.appendChild(span);
        el.whenChoices.appendChild(label);
      });
    }
  }

  /* A chip is repaired, not replaced. The customer's summary already said so;
     the owner record did not, and went on listing "Windshield replacement" for
     a job that is a resin fill. One function now, read by both, so the quote
     the customer sees and the work the shop reads can never disagree. */
  function workFor(v) {
    var services = Glass.servicesFor(panels, v);
    if (windshield === 'chip') {
      return services.map(function (x) {
        return x === 'Windshield replacement' ? 'Rock chip repair' : x;
      });
    }
    if (windshield === 'unsure') {
      return services.map(function (x) {
        return x === 'Windshield replacement'
          ? 'Windshield: repair or replace, we will check' : x;
      });
    }
    return services;
  }

  /* ---------- step 5: review ---------- */

  /* Last stop before it leaves their hands. Everything we believe, in plain
     language, so a wrong answer three steps back is caught here and not by a
     technician standing in a driveway with the wrong windshield. */
  function buildSummary() {
    var rows = [];
    var v = vehicle || {};

    rows.push(['Vehicle', v.label || '', 'b']);

    /* vPIC's own wording, "Sport Utility Vehicle [SUV]/Multipurpose Vehicle
       [MPV]", is a database key, not something to show a person. The resolved
       archetype already holds the word people actually use. */
    var about = [];
    if (v.trim) about.push(v.trim);
    if (archetype) about.push(archetype.label.charAt(0).toUpperCase() + archetype.label.slice(1));
    else if (v.bodyClass) about.push(v.bodyClass);
    if (v.doors) about.push(v.doors + '-door');
    if (about.length) rows.push(['Details', about.join(' · ')]);

    if (v.vin) rows.push(['VIN', v.vin, 'vin']);

    var damage = [];
    if (panels.length) damage.push(Glass.labelsFor(panels).join(', '));
    var typed = el.tellText.value.trim();
    if (typed) damage.push(typed);
    /* "Not specified" sitting directly above "3 images attached" reads as a
       gap in the request when it is nothing of the kind. A photograph is a
       description. */
    if (!damage.length && photos.length) damage.push('See the attached photos.');
    rows.push(['Damage', damage.join('. ') || 'Not specified']);

    if (panels.length) {
      /* Customer-facing, so the ADAS line is filtered out of the shared list.
         The owners asked for driver assist to reach them and not the customer,
         because it can flag falsely; see the note below and buildRequest. */
      var services = workFor(v).filter(function (x) {
        return x !== 'ADAS recalibration';
      });
      if (services.length) rows.push(['Work', services.join(', ')]);
    }

    /* Nothing about driver assist appears here, deliberately.

       What the VIN reports is a model-level capability, not a fact about the
       car in the driveway, so it is right often enough to be useful to Quillin
       and wrong often enough to alarm a customer over a recalibration they may
       not need. Telling the owner is useful; telling the customer is a false
       flag with a price attached to it.

       It still travels with the request. See buildRequest. */

    if (photos.length) {
      rows.push(['Photos', photos.length + (photos.length === 1 ? ' image' : ' images') +
                 ' attached · ' + bytes(totalBytes())]);
    }

    if (urgency) {
      rows.push(['Timing', urgency.label, urgency.flag ? 'flag' : '']);
    }

    rows.push(['Service', 'Mobile. We come to you.']);

    el.summary.innerHTML = '';
    rows.forEach(function (r) {
      var dt = document.createElement('dt');
      dt.textContent = r[0];
      var dd = document.createElement('dd');
      if (r[2] === 'b') {
        var b = document.createElement('b');
        b.textContent = r[1];
        dd.appendChild(b);
      } else {
        dd.textContent = r[1];
        if (r[2] === 'vin') dd.className = 'summary__vin';
        if (r[2] === 'flag') dd.className = 'summary__flag';
      }
      el.summary.appendChild(dt);
      el.summary.appendChild(dd);
    });
  }

  /* What Quillin receives, as opposed to what the customer checked over.

     Same job, same vehicle, one difference: this carries everything inferred
     about driver assist, including how confident we are about it and where the
     belief came from. The shop can act on a maybe; a customer cannot. */
  function buildRequest() {
    var v = vehicle || {};
    var state = VIN.adasState(v);

    return {
      /* Who, and where the vehicle is. Both optional: the owners asked for a
         name box because "it helps a lot", and where is how a mobile service
         plans the day. See the location search below for what each source
         means. */
      customer: {
        name: el.custName.value.trim() || null,
        /* Told, not asked about: the owners want to know before they call,
           and nothing in the quote changes either way. */
        insurance: el.insured.checked,
        location: place || (el.custLoc.value.trim()
          ? { label: el.custLoc.value.trim(), source: 'typed' } : null)
      },
      vehicle: {
        label: v.label, year: v.year, make: v.make, model: v.model,
        trim: v.trim, bodyClass: v.bodyClass, doors: v.doors, cab: v.cab,
        vin: v.vin || null,
        identifiedBy: v.vin ? 'vin'
          : v.typedByCustomer ? 'year from the list, make/model TYPED by customer'
          : 'year/make/model chosen by customer'
      },
      archetype: archetype ? archetype.id : null,
      /* Where the shape came from, because the glass list follows from it:
         the owners should know whether it was read, guessed or told. */
      bodySource: v.bodyChosenByCustomer ? 'chosen by customer'
        : v.vin ? 'from the VIN'
        : v.bodyFromList ? 'from our model list' : 'guessed from the model name',
      damage: {
        panels: panels.slice(),
        panelLabels: Glass.labelsFor(panels),
        description: el.tellText.value.trim() || null,
        photos: photos.length,
        /* Distinguishes "said no" from "never engaged with the question", which
           is the difference between a complete request and an abandoned one. */
        photosDeclined: noPhotos,
        // null unless the windshield was chosen
        windshield: windshield,
        /* Chip, crack or not sure, for the glass that gets asked. Windshield
           only, on the owners' instruction, which is why this walks chipPanels
           and not panels: a row per door reading kind: null would say the
           customer was asked about the door and did not answer, and they were
           never asked. The full list of broken glass is panels/panelLabels
           above. This is the difference between a repair and a replacement. */
        kinds: chipPanels().map(function (id) {
          return { panel: id, label: Glass.labelFor(id), kind: damageKind[id] || null };
        })
      },
      work: workFor(v),                        // ADAS included here
      adas: {
        /* null, not 'no', when there is no VIN. adasState reads the decoded
           systems list, and a hand-entered vehicle has an EMPTY one, so it came
           back 'no' for every manual entry: indistinguishable from a VIN that
           genuinely reported no camera.

           That was survivable while the customer was asked the question and
           customerSaid sat next to it. With the question gone this is the only
           driver-assist field on the no-VIN route, and "no" is the one answer
           it must not give: it would send somebody out with a plain windshield
           for a car that needs recalibrating. Absent and known-absent are
           different things, and a record has to be able to say so. */
        fromVin: v.vin ? state : null,         // yes / maybe / no, or null for no VIN
        /* No customerSaid any more. The camera question was removed from the
           flow entirely on the owners' instruction, so this rests on the VIN
           alone, and on the no-VIN route on nothing at all. See the note. */
        recalibrationLikely: state === 'yes',
        /* Broken out by where each sensor sits, so a flag can be judged rather
           than taken on trust. Anything under notGlassRelated was seen and
           deliberately not counted. */
        systems: v.vin ? VIN.adasDetail(v) : null,
        note: v.vin
          ? 'Model-level data from NHTSA vPIC. Only systems that look through ' +
            'the windshield were counted. Verify against the vehicle.'
          : 'No VIN given, and the camera question is no longer asked, so ' +
            'there is NO driver assist information for this vehicle. Worth a ' +
            'call before ordering glass.'
      },
      /* What the decoder made of the VIN itself. A corrected VIN or a year the
         registry did not supply is worth knowing before ordering a part. */
      decode: v.vin ? {
        codes: v.codes || [],
        note: v.errorText || null,
        suggestedVin: v.suggested || null,
        yearFromVinOnly: !!v.yearFromVinOnly,
        source: 'NHTSA vPIC DecodeVinValuesExtended'
      } : null,
      urgency: urgency ? urgency.value : null,
      // How to reach the customer, and on what. The part Quillin cannot work without.
      reach: Object.keys(reach).map(function (k) {
        return { channel: k, at: reach[k] };
      })
    };
  }

  /* "Does this look right?" agreed. The contact question is its own page from
     here, which is the point of splitting it off: it is asked properly rather
     than as the small print under a receipt. */
  el.reviewYes.addEventListener('click', function () {
    goTo('step-reach');
  });

  function buildChannels() {
    // NB: count checkboxes, not children; the fieldset already holds a <legend>.
    if (el.sendWhere.querySelector('input[type=checkbox]')) return;

    CHANNELS.forEach(function (c) {
      var wrap = document.createElement('div');
      wrap.className = 'reach';

      var id = 'reach-' + c.value;
      var label = document.createElement('label');
      label.className = 'choice';
      label.setAttribute('for', id);

      var box = document.createElement('input');
      box.type = 'checkbox';
      box.id = id;
      box.value = c.value;

      var span = document.createElement('span');
      span.textContent = c.label;
      label.appendChild(box);
      label.appendChild(span);

      var field = document.createElement('input');
      field.className = 'reach__input';
      field.type = c.type;
      field.id = id + '-value';
      field.placeholder = c.placeholder;
      field.autocomplete = c.autocomplete;
      field.setAttribute('aria-label', c.label);
      if (c.type === 'tel') field.inputMode = 'tel';
      field.hidden = true;

      /* Slid, not snapped. This was `field.hidden = !box.checked`, which is
         display:none going on and off in a single frame: the one reveal in the
         whole flow that still popped, on the last page the customer sees.
         slideOpen and slideShut are what everything else here already uses.

         focus with preventScroll. Focusing an element mid-slide is the browser's
         cue to scroll it into view, and it does that against a height that is
         still growing, so the page lurches under the very control the customer
         just asked for. The keyboard still lands in the field; only the jump is
         suppressed.

         The value is cleared IMMEDIATELY on unticking rather than when the
         animation lands, because check() runs straight after and decides
         whether "Send My Request" is still allowed to be enabled. Emptying the
         field on a 240ms delay would leave the button live for a quarter of a
         second against a channel the customer has just withdrawn. */
      box.addEventListener('change', function () {
        if (box.checked) {
          slideOpen(field);
          field.focus({ preventScroll: true });
        } else {
          field.value = '';
          slideShut(field);
        }
        check();
      });
      field.addEventListener('input', check);
      field.addEventListener('blur', function () { check(true); });

      /* There was a line of red text under each field here: "That needs to be
         a 10 digit number", "That does not look like an email address". The
         owners had it removed.

         The CHECKING is untouched. A half typed number still does not count as
         a way to reach anybody, so it is still kept out of `reach` and "Send my
         request" stays disabled until at least one channel is properly filled
         in. What has gone is the sentence saying so.

         The rule under the field still turns red, so there is a signal without
         a sentence, and it appears on the same terms the text did: once
         something has been typed or the field has been left, never while
         somebody is still partway through their first few digits. */
      function check(showError) {
        var raw = field.value;
        var good = box.checked && c.ok(raw);
        if (good) reach[c.value] = c.clean(raw); else delete reach[c.value];

        var complain = box.checked && !good && (showError || raw.length > 0);
        field.classList.toggle('reach__input--bad', complain);

        syncSend();
      }

      wrap.appendChild(label);
      wrap.appendChild(field);
      el.sendWhere.appendChild(wrap);
    });
  }

  /* ---------- where the vehicle is ----------

     Owner instruction: a Location box where "it should allow them to input
     cities by search, or request exact location".

     SEARCH is Photon, komoot's public geocoder over OpenStreetMap: no key, and
     it answers cross-origin (Access-Control-Allow-Origin: *, checked). Biased
     to Wylie so "Mur" means Murphy, TX before it means anywhere else, and held
     to the US. Debounced, and an answer that comes back after a newer one was
     asked for is thrown away, or a slow reply to "Pla" would overwrite the
     list for "Plano".

     EXACT asks the phone. Only on https (and localhost); on plain http the
     browser refuses outright, and the note says to type a city instead. The
     coordinates are what the shop needs, so they are kept even if the lookup
     that turns them into an address fails.

     Typing and leaving without choosing is fine too: whatever is in the box
     goes as source 'typed'. Nothing here can stop a request being sent. */
  var GEO = 'https://photon.komoot.io';
  var BIAS = { lat: 33.015, lon: -96.539 };      // Wylie
  /* North Texas and well beyond it: Waco to the Red River, Abilene to
     Texarkana. Biasing alone was not enough: "412 Stone Rd Wylie" put an
     address in West Virginia first. Anything outside this still goes, as
     typed; it just is not suggested. */
  var BBOX = '-99.9,31.2,-94.0,34.1';
  var locItems = [];
  var locActive = -1;
  var locSeq = 0;
  var locTimer = null;

  var PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>';
  var AIM = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';

  var STATES = { Texas: 'TX', Oklahoma: 'OK', Louisiana: 'LA', Arkansas: 'AR', 'New Mexico': 'NM' };

  function placeFrom(f, source) {
    var p = f.properties || {};
    var c = (f.geometry && f.geometry.coordinates) || [];
    var street = p.street ? ((p.housenumber ? p.housenumber + ' ' : '') + p.street) : null;
    var city = p.city || (p.type === 'city' ? p.name : null) || p.town || p.village || null;
    var state = STATES[p.state] || p.state || null;
    var first = street || (p.name && p.name !== city ? p.name : null);
    var parts = [first, city, [state, p.postcode].filter(Boolean).join(' ')].filter(Boolean);
    return {
      label: parts.join(', ') || p.name || '',
      source: source,
      lat: c[1] != null ? +c[1].toFixed(5) : null,
      lon: c[0] != null ? +c[0].toFixed(5) : null,
      street: street, city: city, state: state, postcode: p.postcode || null,
      isStreet: p.osm_key === 'highway', streetName: p.osm_key === 'highway' ? p.name : null
    };
  }

  function renderLoc(results) {
    locItems = [{ here: true }].concat(results || []);
    locActive = -1;
    el.locList.innerHTML = '';
    locItems.forEach(function (it, i) {
      var li = document.createElement('li');
      li.className = 'loc__opt' + (it.here ? ' loc__opt--here' : '');
      li.id = 'loc-opt-' + i;
      li.setAttribute('role', 'option');
      li.innerHTML = it.here ? AIM : PIN;
      var t = document.createElement('span');
      t.textContent = it.here ? 'Use my exact location' : it.label;
      li.appendChild(t);
      /* mousedown, not click: click lands after the field's blur has already
         closed the list. */
      li.addEventListener('mousedown', function (e) { e.preventDefault(); chooseLoc(i); });
      el.locList.appendChild(li);
    });
    el.locList.hidden = false;
    el.custLoc.setAttribute('aria-expanded', 'true');
  }

  function closeLoc() {
    el.locList.hidden = true;
    el.custLoc.setAttribute('aria-expanded', 'false');
    el.custLoc.removeAttribute('aria-activedescendant');
    locActive = -1;
  }

  function markLoc(i) {
    locActive = i;
    Array.prototype.forEach.call(el.locList.children, function (li, j) {
      li.setAttribute('aria-selected', j === i ? 'true' : 'false');
    });
    if (i >= 0) {
      el.custLoc.setAttribute('aria-activedescendant', 'loc-opt-' + i);
      el.locList.children[i].scrollIntoView({ block: 'nearest' });
    }
  }

  function locSay(text) {
    el.locNote.textContent = text;
    if (text) show(el.locNote); else hide(el.locNote);
  }

  function chooseLoc(i) {
    var it = locItems[i];
    closeLoc();
    if (!it) return;
    if (it.here) { useExact(); return; }
    place = it;
    el.custLoc.value = it.label;
    locSay('');
  }

  function searchLoc(q) {
    var seq = ++locSeq;
    /* OpenStreetMap has the street but rarely every house number on it, and a
       number it does not hold sinks the whole match: "412 Stone Rd Wylie"
       found nothing at all, "Stone Rd Wylie" finds the street first. So the
       number is taken off for the search and put back on every STREET that
       comes back, which is the one part of an address a driver cannot guess. */
    var num = q.match(/^\s*(\d+[a-z]?)\s+(.+)$/i);
    var url = GEO + '/api/?limit=8&lang=en&bbox=' + BBOX + '&lat=' + BIAS.lat + '&lon=' + BIAS.lon +
      '&q=' + encodeURIComponent(num ? num[2] : q);
    fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      if (seq !== locSeq) return;                   // a newer search is in flight
      var seen = {};
      var out = (d.features || []).filter(function (f) {
        var p = f.properties || {};
        /* Towns, streets and street addresses. Not every park, cemetery and
           shopping centre that shares a town's name: "Murp" offered Murphy
           Cemetery fourth. */
        return p.countrycode === 'US' &&
          (p.osm_key === 'place' || p.osm_key === 'highway' || !!p.housenumber);
      }).map(function (f) {
        var p = placeFrom(f, 'search');
        if (num && p.isStreet) {
          p.street = num[1] + ' ' + p.streetName;
          p.label = num[1] + ' ' + p.label;
        }
        delete p.isStreet; delete p.streetName;
        return p;
      }).filter(function (p) {
        if (!p.label || seen[p.label]) return false;
        return (seen[p.label] = true);
      }).slice(0, 5);
      if (document.activeElement === el.custLoc) renderLoc(out);
    }).catch(function () {
      /* The search being down must not cost anybody anything: whatever they
         type still goes, as typed. */
      if (seq === locSeq && document.activeElement === el.custLoc) renderLoc([]);
    });
  }

  function useExact() {
    if (!navigator.geolocation || !window.isSecureContext) {
      locSay('This page can’t ask for your location. Type your city instead.');
      el.custLoc.focus();
      return;
    }
    el.custLoc.value = '';
    el.custLoc.placeholder = 'Finding you…';
    locSay('');
    navigator.geolocation.getCurrentPosition(function (pos) {
      var lat = +pos.coords.latitude.toFixed(5), lon = +pos.coords.longitude.toFixed(5);
      var acc = Math.round(pos.coords.accuracy);
      var fallback = { label: 'My location (' + lat + ', ' + lon + ')', source: 'exact',
                       lat: lat, lon: lon, accuracyM: acc };
      place = fallback;
      el.custLoc.value = fallback.label;
      el.custLoc.placeholder = 'Location (Optional, but helps)';
      fetch(GEO + '/reverse?lang=en&lat=' + lat + '&lon=' + lon)
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (place !== fallback || !(d.features || []).length) return;
          var p = placeFrom(d.features[0], 'exact');
          /* The phone's own fix, not the nearest address's centre point. */
          p.lat = lat; p.lon = lon; p.accuracyM = acc;
          place = p;
          el.custLoc.value = p.label;
        }).catch(function () { /* the coordinates alone are enough */ });
    }, function () {
      el.custLoc.placeholder = 'Location (Optional, but helps)';
      locSay('We couldn’t get your location. You can type your city instead.');
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }

  el.custLoc.addEventListener('focus', function () {
    if (!el.custLoc.value.trim()) renderLoc([]);
    /* This is the last field on the page, so its suggestions open off the
       bottom of the screen, and on a phone the keyboard covers the rest.
       Bring it up to where the list has room. */
    var r = el.custLoc.getBoundingClientRect();
    if (r.top > window.innerHeight * 0.4) {
      window.scrollBy({ top: r.top - window.innerHeight * 0.2, behavior: 'smooth' });
    }
  });

  el.custLoc.addEventListener('input', function () {
    place = null;                                   // it is 'typed' until chosen
    locSay('');
    var q = el.custLoc.value.trim();
    clearTimeout(locTimer);
    if (q.length < 2) { renderLoc([]); return; }
    locTimer = setTimeout(function () { searchLoc(q); }, 250);
  });

  el.custLoc.addEventListener('keydown', function (e) {
    if (el.locList.hidden) {
      if (e.key === 'ArrowDown') { renderLoc(locItems.slice(1)); markLoc(0); e.preventDefault(); }
      return;
    }
    var n = locItems.length;
    if (e.key === 'ArrowDown') { markLoc((locActive + 1) % n); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { markLoc((locActive - 1 + n) % n); e.preventDefault(); }
    else if (e.key === 'Enter' && locActive >= 0) { chooseLoc(locActive); e.preventDefault(); }
    else if (e.key === 'Escape') { closeLoc(); }
  });

  el.custLoc.addEventListener('blur', function () { closeLoc(); });

  /* At least one way to reach them, filled in properly. */
  function syncSend() {
    el.send.disabled = Object.keys(reach).length === 0;
    hide(el.sendNote);
  }

  /* ---------- sending ----------

     To worker/quote-relay.js, which emails the owners. The address is in a
     meta tag rather than here so switching from the local test relay to the
     live one is a one line change in the page, not a script edit.

     Photographs are shrunk HERE, before they leave the phone. A phone camera
     makes 3 to 12MB a shot and the flow allows 8; sent as they are that is a
     long wait on mobile data and more than an email can carry. 1600px on the
     long side at quality .82 is plenty to see a chip in, and comes to roughly
     300KB each.

     On failure nothing is lost: the answers stay where they are, the button
     comes back as "Try Again", and the shop's number is right there, because
     somebody who has just spent several minutes on this should never be left
     with "something went wrong". */
  var RELAY = ((document.querySelector('meta[name="quote-relay"]') || {}).content || '').trim();
  var sending = false;
  var sent = false;

  function shrink(file) {
    var LONG = 1600;
    return new Promise(function (resolve) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, LONG / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k);
        c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { resolve(b || file); }, 'image/jpeg', 0.82);
      };
      /* A format this browser cannot draw (HEIC on a desktop, say) goes as it
         is, if it is small enough to be worth sending at all. */
      img.onerror = function () {
        URL.revokeObjectURL(url);
        resolve(file.size <= 6 * 1024 * 1024 ? file : null);
      };
      img.src = url;
    });
  }

  function sayFailed() {
    el.sendNote.innerHTML = '';
    el.sendNote.appendChild(document.createTextNode(
      'That didn’t go through, but your answers are all still here. Try again, or call us at '));
    var a = document.createElement('a');
    a.href = 'tel:+12145867650';
    a.textContent = '(214) 586-7650';
    el.sendNote.appendChild(a);
    el.sendNote.appendChild(document.createTextNode('.'));
    el.sendNote.className = 'note note--err';
    show(el.sendNote);
  }

  function describeSent() {
    var name = el.custName.value.trim().split(/\s+/)[0];
    el.sentLabel.textContent = 'Thank you' + (name ? ', ' + name : '') + '! We’ve got it.';
    var how = [];
    if (reach.text) how.push('by text');
    if (reach.call) how.push('with a call');
    if (reach.email) how.push('by email');
    el.sentBody.textContent = 'Your request is on its way to us. ' +
      'We’ll get back to you ' + (how.length > 1
        ? how.slice(0, -1).join(', ') + ' or ' + how[how.length - 1]
        : how[0] || 'soon') + '.';
  }

  el.send.addEventListener('click', function () {
    if (!Object.keys(reach).length || sending) return;
    lastRequest = buildRequest();

    if (!RELAY) {
      el.sendNote.textContent = 'Nothing was sent. Delivery is not wired up yet.';
      el.sendNote.className = 'note note--warn';
      show(el.sendNote);
      return;
    }

    sending = true;
    el.send.disabled = true;
    el.send.textContent = 'Sending…';
    el.send.classList.add('is-busy');
    hide(el.sendNote);

    Promise.all(photos.map(function (p) { return shrink(p.file); }))
      .then(function (blobs) {
        var fd = new FormData();
        fd.append('request', JSON.stringify(lastRequest));
        fd.append('company', el.hp.value);
        blobs.filter(Boolean).forEach(function (b, i) {
          fd.append('photo', b, 'photo-' + (i + 1) + '.jpg');
        });
        var ctl = window.AbortController ? new AbortController() : null;
        var t = setTimeout(function () { if (ctl) ctl.abort(); }, 60000);
        return fetch(RELAY, { method: 'POST', body: fd, signal: ctl && ctl.signal })
          .then(function (r) {
            clearTimeout(t);
            return r.json().catch(function () { return {}; }).then(function (j) {
              if (!r.ok || !j.ok) throw new Error('relay ' + r.status);
            });
          });
      })
      .then(function () {
        sending = false;
        sent = true;
        el.send.classList.remove('is-busy');
        el.send.textContent = 'Sent';
        describeSent();
        goTo('step-sent');
        el.sentLabel.focus({ preventScroll: true });
      })
      .catch(function () {
        sending = false;
        el.send.classList.remove('is-busy');
        el.send.disabled = false;
        el.send.textContent = 'Try Again';
        sayFailed();
      });
  });

  /* Back to the landing, with the flow emptied behind it, so the next person
     on this device, or this person with a second car, starts clean. */
  el.sentHome.addEventListener('click', function () {
    goHome();
  });


  /* ------------------------------------------------------------------------
     PRESENTATION: only the live step stays open.

     Borrowed from paleleap. Everything already answered folds down to a single
     thin line carrying its answer, so the page only ever shows the question
     being asked plus a record of what came before. Clicking a folded line opens
     it again to change it.

     This is purely how the flow LOOKS. Nothing below touches what it does. */

  /* Folded, a step is a record, not a question. "So... where's the damage?"
     is the right thing to ask and the wrong thing to file under, so each step
     carries its own short noun for the folded state. The VIN row keeps the VIN
     and the confirm row keeps the vehicle, so the two never say the same thing
     twice. */
  /* ---------- the router ----------

     One page on screen at a time, and the page is the question. Owner
     instruction: "it should move page to page depending on what information is
     needed, a smooth workflow and UX, nothing to scroll up and down to."

     What this replaces: every step used to stay on the page, and an answered
     one folded down to a single row you could click to reopen. That is a good
     design for somebody comfortable with a long form, and it is the wrong one
     here. It meant the page grew with every answer, the thing being asked was
     never in the same place twice, and by the timing question you were reading
     the fifth screenful of a document whose first four screens were already
     settled. Folding made it shorter; it did not make it one thing at a time.

     The rule the old flow was built on survives intact, and it is the reason
     this could be swapped underneath it at all: what is on screen is DERIVED
     from what has been answered, and nothing is ever cleared by moving. PAGES
     below is the whole order; pagesFor() drops the ones this request does not
     need; going back and changing an answer re-derives the rest rather than
     destroying it. */

  var PAGES = ['step-vin', 'step-glass',
               'step-chip', 'step-photos', 'step-when', 'step-review',
               'step-reach', 'step-sent'];

  var page = 'step-vin';

  /* Assigned further down, next to the handler that opens it. Declared here so
     goTo can close it without caring where it was built. */
  var overUI = null;

  /* The pages this particular request actually has. TWO of them can drop out:

     Specifics exists when there is something about the vehicle that neither the
     VIN nor the model name could settle, which since the owners' instruction
     means a hand-entered vehicle and nothing else.

     Chip or crack exists when the windshield is among the glass picked.

     So the flow is eight pages at its longest and six at its shortest, and
     nothing may assume a fixed length or a fixed neighbour. Back and Continue
     both walk THIS list, which is the only reason they agree. */
  function pagesFor() {
    return PAGES.filter(function (id) {
      /* Chip or crack is a windshield question only, so the page exists only
         when the windshield is among the glass picked. Somebody with a broken
         door window, or who only described the break in words or sent a
         photograph, skips it in both directions. */
      if (id === 'step-chip') return chipPanels().length > 0;
      /* Only once it has gone. Nothing walks forward onto it; the send does. */
      if (id === 'step-sent') return sent;
      return true;
    });
  }

  /* Whatever a page needs in place before it is looked at.

     This is here rather than spread across the handlers that navigate, because
     a page can be arrived at from more than one direction: the timing page from
     the photos page going forward and from the confirmation page going back,
     and both have to find its choices built. The old flow had the same job
     scattered through advance(), which is how a Back button would have found a
     page half assembled. */
  function prepare(id) {
    /* Nothing in here may navigate. prepare runs from inside goTo, so a goTo
       in a prepare step is straight recursion: setupGlass did exactly that on
       the first attempt at this, and the stack overflow was swallowed whole by
       the catch on the VIN lookup, which then told the customer "we couldn't
       reach the vehicle database". Prepare the page; let the caller decide
       where anybody goes. */
    if (id === 'step-glass') { setupGlass(); setTimeout(growTellus, 0); }
    if (id === 'step-chip') syncChipQuestion();
    if (id === 'step-when') buildWhen();
    if (id === 'step-review') buildSummary();
    if (id === 'step-reach') buildChannels();
  }

  /* "How this works", built once and moved.

     It used to be a fixed strip along the bottom edge of the window, which was
     the right answer while the quote was one long scrolling column: there was
     no reliable "bottom of what you are reading" to attach anything to, so it
     had to be attached to the window instead.

     One page at a time gives us that bottom back. The control now rides at the
     foot of whichever page is showing and travels with the customer, which
     also hands back the 117px of permanent bottom furniture the strip and the
     section bar were costing between them on a small phone.

     An anchor rather than a button element, because it goes somewhere and
     should still go there with the script broken, middle-clicked or opened in
     a new tab. It is dressed as a button, which is what was asked for and what
     the rest of this flow does with anything worth pressing. */
  var helpUI = (function () {
    var wrap = document.createElement('p');
    wrap.className = 'pagehelp';

    var link = document.createElement('a');
    link.className = 'pagehelp__btn';
    link.href = '#help';
    link.setAttribute('data-panel-link', '');
    link.textContent = 'How this works';

    wrap.appendChild(link);
    return wrap;
  })();

  /* Moved rather than rebuilt, so there is only ever one of these in the
     document however many times the customer goes back and forth. */
  function placeHelp(node) {
    if (!node) {
      if (helpUI.parentNode) helpUI.parentNode.removeChild(helpUI);
      return;
    }
    if (helpUI.parentNode !== node) {
      /* On the landing it goes above the footer line, which is the end of the
         page and should read as one. */
      var foot = node.querySelector(':scope > .landfoot');
      if (foot) node.insertBefore(helpUI, foot); else node.appendChild(helpUI);
    }
  }

  function goTo(id) {
    if (PAGES.indexOf(id) === -1) return;

    /* Any move through the flow answers "start over?" by itself, so the prompt
       must not still be sitting there afterwards. Declared further down the
       file, but only ever reached from a click, by which point it exists. */
    if (overUI) overUI.close();

    page = id;

    PAGES.forEach(function (p) {
      var node = $(p);
      if (!node) return;
      var on = (p === id);
      if (on) node.hidden = false; else node.hidden = true;
      node.classList.toggle('is-page', on);
    });

    /* AFTER the swap, not before. openPicker mounts a WebGL canvas and
       slideOpen measures scrollHeight, and both read zero inside an element
       that is still display:none. */
    prepare(id);

    syncNav();

    /* Top of the page, every time. The whole point of this rework is that the
       question is always in the same place, and landing halfway down a page
       because the previous one was taller defeats that. Instant rather than
       smooth: a smooth scroll on a page that has just been swapped underneath
       you reads as the content sliding away. */
    window.scrollTo({ top: 0, behavior: 'auto' });

    /* Announced, because for a screen reader nothing about this looks like
       navigation: the document did not change and focus did not move. */
    var label = $(id).querySelector('.step__label');
    if (label) {
      label.setAttribute('tabindex', '-1');
      label.focus({ preventScroll: true });
    }

    remember(id);
  }

  /* ---------- the phone's own Back button ----------

     Every step used to be one history entry, so the Back button on an Android
     phone, or the browser's, skipped the whole quote in one press: straight
     past every answer to wherever the customer was before, often off the site.
     It is the escape route people use without thinking, and it was the one
     that lost the most.

     Now each step the customer moves forward to is its own entry, and trail
     mirrors them. The page's own Back button goes back through history too
     when it can, so the two can never disagree about where "back" is. Moves
     that come FROM history (fromHistory) are never written back into it.

     Three guards, all learned by walking it:
       - After sending, Back does not reopen the form that sent it. Re-sending
         a quote by accident is worse than a Back button that holds still.
       - An entry for a page this request no longer has (untick the windshield
         and chip-or-crack drops out) is skipped rather than shown.
       - Backing out past the first question returns to the landing with the
         answers kept, exactly as if the quote had not been opened yet. */
  var trail = [];
  var fromHistory = false;

  function remember(id) {
    if (fromHistory) return;
    if (trail[trail.length - 1] === id) return;
    trail.push(id);
    history.pushState({ qstep: id }, '', '#quote');
  }

  window.addEventListener('popstate', function (e) {
    if (!document.body.classList.contains('on-quote')) return;
    var st = e.state || {};
    if (sent) {
      history.pushState({ qstep: 'step-sent' }, '', '#quote');
      return;
    }
    if (!started) {
      /* Back from the landing into a quote the customer went home from:
         straight back to that question. Entries left behind by a quote that
         has since been sent and cleared are skipped. */
      if (st.qstep && resumable() && pagesFor().indexOf(st.qstep) !== -1) {
        resumeAt(st.qstep);
      } else if (st.qstep) {
        history.back();
      }
      return;
    }
    if (!st.qstep) {
      trail = [];
      showLanding();
      return;
    }
    if (pagesFor().indexOf(st.qstep) === -1) { history.back(); return; }
    var at = trail.lastIndexOf(st.qstep);
    trail = at === -1 ? trail.concat(st.qstep) : trail.slice(0, at + 1);
    fromHistory = true;
    try { goTo(st.qstep); } finally { fromHistory = false; }
  });

  function stepFrom(delta) {
    var list = pagesFor();
    var i = list.indexOf(page);
    if (i === -1) return null;
    return list[i + delta] || null;
  }

  function goNext() { var to = stepFrom(1); if (to) goTo(to); }
  function goBack() {
    var to = stepFrom(-1);
    if (!to) return;
    /* Through history when the page before is the entry before, so the
       browser's Back and this one stay in step. */
    if (trail.length > 1 && trail[trail.length - 2] === to &&
        (history.state || {}).qstep === page) {
      history.back();
      return;
    }
    goTo(to);
  }

  /* Every Back button on every page, wired once. They are identical and there
     is nothing page-specific about going back one. */
  Array.prototype.forEach.call(document.querySelectorAll('[data-back]'),
    function (b) { b.addEventListener('click', goBack); });

  Array.prototype.forEach.call(document.querySelectorAll('[data-next]'),
    function (b) { b.addEventListener('click', function () {
      if (b.disabled) return;
      /* Only the button on the page you are actually looking at may move you.
         goNext() works from `page`, so without this a Continue belonging to
         some other, hidden step would advance whatever is on screen instead. */
      var owner = b.closest('.step');
      if (!owner || owner.id !== page) return;
      if (page === 'step-photos' && !photos.length) noPhotos = true;
      goNext();
    }); });

  /* Enables or disables the way forward on whichever page is showing, and puts
     "Start over" where it belongs. It does NOT move anybody: deciding what is
     reachable and deciding where you are standing are two different jobs, and
     conflating them is what made the old flow yank the page around. */
  function syncNav() {
    var node = $(page);
    if (!node) return;

    var next = node.querySelector('[data-next]');
    if (next) next.disabled = !pageDone(page);

    /* The opening fork is two buttons and nothing else, so the VIN page's
       footer stays away until there is actually a vehicle to go forward with,
       which only ever happens on the way back. */
    if (el.vinNav) el.vinNav.hidden = !(page === 'step-vin' && !!vehicle);

    el.send.disabled = Object.keys(reach).length === 0;

    /* On EVERY page, not just the first. Owner instruction. It was held back
       to the VIN step on the grounds that there is nothing to clear on an empty
       first page, which is true of that page and of no other: the further in
       somebody is, the more likely they are to want out. placeReset still
       withholds it on the untaken fork, which is the case that reasoning
       actually covered. */
    placeReset(node);
    placeHelp(node);
  }

  /* Whether the page showing has been answered well enough to leave. Only the
     pages that carry a Continue button need one; the rest either advance on the
     answer itself or carry their own worded button. */
  function pageDone(id) {
    if (id === 'step-vin') return pageAnswered(id);
    /* Something has to have been said about the damage, by any of the three
       routes: a pane tapped, a photograph, or a sentence. */
    if (id === 'step-glass') return damageGiven();
    // the windshield, if it was picked, has to have been asked chip or crack
    if (id === 'step-chip') return damageDone();
    if (id === 'step-photos') return true;     // "no photos" is a valid answer
    if (id === 'step-when') return !!urgency;
    return true;
  }

  /* The greeting used to sit above the flow on every screen and change its
     wording as you went. It is gone the moment the flow starts. On a
     page-at-a-time wizard it was a second heading above the real one,
     restating the name of the thing you were already doing, and it cost the
     top third of a phone screen on every single question. The page's own label
     is the heading now. */

  /* ---------- the gate ----------

     The quote tool does not start until it is asked for. The page opens on the
     company line and one control, and the VIN step is not on screen at all
     until that control is pressed.

     Why: every person the owners put in front of the old landing said the same
     three things, in their words: the text was too small, too faded, and there
     was "too much going on". The last one was not about any single control. It
     was that a heading, a text field, a hint carrying a link, two disclosure
     buttons and a bordered button were all competing before a single question
     had been answered. Behind one button there is exactly one thing to do.

     `started` is also what stops the start button being written over: it lives
     inside the heading the flow replaces. */
  var started = false;

  function startQuote() {
    if (started) return;
    started = true;

    /* The greeting has done its job. From here the page's own question is the
       heading, and the space it was taking is the difference between a question
       fitting on a phone screen and not. */
    /* One flag for the whole switch. The landing is lit like paper and the
       flow is lit like an instrument, and this is what decides which: see the
       note above the landing block in the stylesheet. Set BEFORE the slide, so
       the header changes with the page rather than a beat after it. */
    document.body.classList.add('is-started');
    if (el.home) slideShut(el.home);

    /* Back where they were, if they left a quote part way through by going
       home; the first question otherwise. */
    goTo(resumable() && page !== 'step-sent' ? page : 'step-vin');
    /* Not on a touch screen. Focusing an input there throws a keyboard over the
       bottom half of the page the instant the button is released, which hides
       the very hint that explains what a VIN is. On a pointer device the caret
       lands where it should and nothing is covered. */
    if (!COARSE) el.vin.focus();
  }

  var COARSE = window.matchMedia('(pointer: coarse)').matches;

  PAGES.forEach(function (p) { var node = $(p); if (node) node.hidden = true; });
  if (el.start) el.start.addEventListener('click', startQuote);

  /* The opening screen is not one of the pages, so syncNav never reaches it.
     It is also the screen where "How this works" earns its place most: the
     panel behind it answers "do I have to use this" and "does anything send
     before I say so", which are the questions somebody has BEFORE they press
     anything. From the first press onwards syncNav takes over and carries it
     from page to page. */
  if (el.greeting) placeHelp(el.greeting);

  // Lets the outgoing record be inspected in testing.
  window.__lastRequest = function () { return lastRequest; };

  /* The reverse of startQuote: the flow emptied, every page shut, and the
     landing back exactly as it loads. Used after a request has been sent. */
  function goHome() {
    fromHistory = true;                // none of this is a step to go back to
    try { startOver(); } finally { fromHistory = false; }
    sent = false;
    trail = [];
    history.replaceState(null, '', '#quote');
    showLanding();
  }

  function resumable() { return forkTaken || !!vehicle; }

  /* Home, from the menu or the logo. After a send it is a clean start; mid
     quote it is the landing with the answers kept. */
  document.addEventListener('quote:home', function () {
    if (sent) { goHome(); return; }
    if (!started) { window.scrollTo({ top: 0, behavior: 'auto' }); return; }
    history.pushState(null, '', '#quote');
    showLanding();
  });

  /* "Get your Quote" pressed on another page (About). */
  document.addEventListener('quote:start', function () { startQuote(); });

  /* Back from the landing into a quote left part way through. */
  function resumeAt(id) {
    started = true;
    document.body.classList.add('is-started');
    if (el.home) slideShut(el.home);
    fromHistory = true;
    try { goTo(id); } finally { fromHistory = false; }
  }

  /* The landing back, with whatever has been answered left where it is. */
  function showLanding() {
    started = false;
    if (overUI) overUI.close();
    PAGES.forEach(function (p) {
      var node = $(p);
      if (!node) return;
      node.hidden = true;
      node.classList.remove('is-page');
    });
    placeReset(null);
    if (el.greeting) placeHelp(el.greeting);
    document.body.classList.remove('is-started');
    if (el.home) slideOpen(el.home);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function startOver() {
    sent = false;
    el.custName.value = '';
    vehicle = null;
    lastLookup = '';
    lastRequest = null;
    el.vin.value = '';
    el.field.classList.remove('field--ok');
    undecline();
    /* slideShut, not hide. Starting over with the manual panel open used to
       snap three dropdowns out of existence in a frame while everything else
       on the page animated, which read as the page breaking rather than
       clearing. slideShut returns immediately if it is already closed. */
    slideShut(el.manual);
    slideShut(el.manualNote);
    el.noVin.setAttribute('aria-expanded', 'false');
    say('');
    resetBelow(2);            // cascades through damage, photos, timing, review
    /* Back to the question, not to the branch that was just cleared. Without
       this, starting over from the year/make/model route left those dropdowns
       as the only thing on the step and the VIN route unreachable. */
    resetFork();
    noPhotos = false;
    goTo('step-vin');
  }

  /* ---------- start over ----------

     One control, moved to the bottom of whichever step is live, so it is always
     the last thing in whatever you are currently looking at.

     It asks first. Clearing a VIN, a set of panels, three photographs and a
     phone number is not something to do on a mis-tap, and an accidental reset
     means the customer does the whole job again or gives up. The prompt is
     inline rather than a browser confirm(): a modal dialogue box on a quote form
     reads like an error, and this is not one. */

  var resetUI = (function () {
    var wrap = document.createElement('div');
    wrap.className = 'reset';

    var ask = document.createElement('button');
    ask.type = 'button';
    ask.className = 'plainlink reset__ask';
    ask.textContent = 'Start over';

    var confirmBox = document.createElement('div');
    confirmBox.className = 'reset__confirm';
    confirmBox.hidden = true;

    var msg = document.createElement('span');
    msg.className = 'reset__msg';
    msg.textContent = 'Clear everything and start again?';

    var yes = document.createElement('button');
    yes.type = 'button';
    yes.className = 'btn btn--small reset__yes';
    yes.textContent = 'Yes, start over';

    var no = document.createElement('button');
    no.type = 'button';
    no.className = 'plainlink reset__no';
    no.textContent = 'Keep what I have';

    confirmBox.appendChild(msg);
    confirmBox.appendChild(yes);
    confirmBox.appendChild(no);
    wrap.appendChild(ask);
    wrap.appendChild(confirmBox);

    function close() {
      slideShut(confirmBox);
      slideOpen(ask);
    }

    ask.addEventListener('click', function () {
      slideShut(ask);
      slideOpen(confirmBox);
      no.focus();           // the safe option takes focus, not the destructive one
    });
    no.addEventListener('click', close);
    yes.addEventListener('click', function () {
      close();
      startOver();
    });

    return { wrap: wrap, close: close };
  })();

  /* ---------- pressing "quote" while a quote is already underway ----------

     landing.js says the button was pressed; what it means is decided here,
     because the answers live here. Owner instruction: it should ask "Start
     over?".

     It is genuinely ambiguous. Somebody reading the services page and pressing
     "quote" wants to get back to what they were doing. Somebody on the photos
     page pressing it has most likely decided to begin again. Asking is the only
     honest answer, and the safe option is the one that keeps their work.

     Nothing is asked when there is nothing to lose: the opening fork, or a
     flow that was never started, just goes to the quote like any other link. */
  function quoteUnderway() {
    return started && (forkTaken || !!vehicle || el.vin.value.length > 0);
  }

  overUI = (function () {
    var wrap = document.createElement('div');
    wrap.className = 'startover';
    wrap.hidden = true;

    var msg = document.createElement('p');
    msg.className = 'startover__msg';
    msg.textContent = 'Start over?';

    var sub = document.createElement('p');
    sub.className = 'startover__sub';
    sub.textContent = 'You have a request in progress.';

    var row = document.createElement('p');
    row.className = 'startover__do';

    var no = document.createElement('button');
    no.type = 'button';
    no.className = 'btn';
    no.textContent = 'No, carry on';

    var yes = document.createElement('button');
    yes.type = 'button';
    yes.className = 'btn btn--alt';
    yes.textContent = 'Yes, start over';

    /* Carry on is the filled one, and it is first. The destructive answer to a
       question the customer did not ask for should never be the easy one to
       hit, and this prompt appears in front of somebody who may well have been
       aiming at something else entirely. */
    row.appendChild(no);
    row.appendChild(yes);
    wrap.appendChild(msg);
    wrap.appendChild(sub);
    wrap.appendChild(row);

    /* Opened and closed by the same helper as everything else. It used to fade
       in from a CSS animation on the display flip and then close with no
       animation at all, which is the asymmetry you cannot miss: it arrived
       politely and then vanished. The CSS fadeIn goes with this, because
       slideOpen animates opacity as well as height and keeping both ran two
       fades at once on two curves. */
    function close() { slideShut(wrap); }
    no.addEventListener('click', close);
    yes.addEventListener('click', function () { close(); startOver(); });

    return {
      wrap: wrap,
      open: function () { slideOpen(wrap); no.focus({ preventScroll: true }); },
      close: close
    };
  })();

  document.addEventListener('quote:relaunch', function () {
    /* After a send there is nothing in progress to protect: "quote" means a
       new one, so it gets a clean start rather than a "Start over?" about a
       request that has already gone. */
    if (sent) { startOver(); return; }
    if (!quoteUnderway()) { overUI.close(); return; }
    var node = $(page);
    if (!node) return;
    if (overUI.wrap.parentNode !== node) node.insertBefore(overUI.wrap, node.firstChild);
    overUI.open();
    window.scrollTo({ top: 0, behavior: 'auto' });
  });

  /* Shown on every page of the flow once there is something worth losing. On an
     empty VIN step there is nothing to clear, and offering to clear it is just
     noise; everywhere else there is. */
  function placeReset(live) {
    /* On the fork there is nothing to start over from: no branch has been taken
       and nothing has been answered. The moment one IS taken there is, and this
       is the only way back to the question, so the control appears as soon as
       either button is pressed. */
    if (!live || (live.id === 'step-vin' && !forkTaken) || live.id === 'step-sent') {
      if (resetUI.wrap.parentNode) resetUI.wrap.parentNode.removeChild(resetUI.wrap);
      return;
    }
    if (resetUI.wrap.parentNode !== live) {
      resetUI.close();
      live.appendChild(resetUI.wrap);
    }
  }

})();
