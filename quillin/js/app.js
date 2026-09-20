/* Step flow: VIN -> specifics -> confirm -> glass.
   Each step reveals the next below it. Nothing above ever disappears, so the
   customer can always scroll up and change an earlier answer. */

(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var el = {
    field:     $('vin-field'),
    vin:       $('vin'),
    helpBtn:   $('vin-help-btn'),
    help:      $('vin-help'),
    note:      $('vin-note'),
    noVin:     $('no-vin'),
    manual:    $('manual'),
    mYear:     $('m-year'),
    mMake:     $('m-make'),
    mModel:    $('m-model'),
    specifics: $('step-specifics'),
    specHint:  $('spec-hint'),
    specChoices: $('spec-choices'),
    confirm:   $('step-confirm'),
    cVehicle:  $('confirm-vehicle'),
    cDetail:   $('confirm-detail'),
    cYes:      $('confirm-yes'),
    cNo:       $('confirm-no'),
    glass:     $('step-glass'),
    glassLabel: $('glass-label'),
    declineNote: $('decline-note'),
    chipQ:     $('chipq'),
    chipChoices: $('chip-choices'),
    chipLabel: $('chip-label'),
    chipLegend: $('chip-legend'),
    chipDone: $('chip-done'),
    thatIt:    $('thatit'),
    thatItWrap: $('thatit-wrap'),
    picker:    $('picker'),
    pickerStage: $('picker-stage'),
    pickerNote:  $('picker-note'),
    pickerList:  $('picker-list'),
    justTell:  $('just-tell'),
    tellus:    $('tellus'),
    tellText:  $('tellus-text'),
    tellNote:  $('tellus-note'),
    when:      $('step-when'),
    whenChoices: $('when-choices'),
    cause:     $('step-cause'),
    causeSel:  $('cause'),
    photos:    $('step-photos'),
    addPhotos: $('add-photos'),
    noPhotos:  $('no-photos'),
    photoInput: $('photo-input'),
    shots:     $('shots'),
    photoNote: $('photo-note'),
    submit:    $('submit-damage'),
    review:    $('step-review'),
    greeting:  document.querySelector('.greeting h1'),
    summary:   $('summary'),
    sendWhere: $('send-where'),
    send:      $('send-request'),
    sendNote:  $('send-note')
  };

  var MAKES = [
    'Acura','Alfa Romeo','Audi','BMW','Buick','Cadillac','Chevrolet','Chrysler',
    'Dodge','Fiat','Ford','Freightliner','Genesis','GMC','Honda','Hyundai',
    'Infiniti','Jaguar','Jeep','Kenworth','Kia','Land Rover','Lexus','Lincoln',
    'Mack','Maserati','Mazda','Mercedes-Benz','Mercury','Mini','Mitsubishi',
    'Nissan','Peterbilt','Pontiac','Porsche','Ram','Rivian','Saturn','Scion',
    'Subaru','Tesla','Toyota','Volkswagen','Volvo'
  ];

  var vehicle = null;      // the decoded vehicle
  var answers = {};        // step 2 answers
  var panels = [];         // glass panels picked in the picker
  var picker = null;       // the live picker instance, if WebGL is available
  var archetype = null;    // resolved body style for this vehicle
  var windshield = null;   // 'chip' | 'crack' | 'unsure', when a windshield is picked

  /* panel id -> 'chip' | 'crack' | 'unsure'. Asked once per piece of glass the
     customer picked rather than only for the windshield: a shop needs to know
     which of three broken windows is a chip before it can price any of them. */
  var damageKind = {};

  /* Sized the way the trade sizes it, and the way a customer can actually
     check: a quarter and a dollar bill are in everyone's pocket. */
  var CHIP = [
    { value: 'chip',   label: 'A chip, smaller than a quarter' },
    { value: 'crack',  label: 'A crack, or bigger than that' },
    { value: 'unsure', label: 'I am not sure' }
  ];

  var urgency = null;      // step 5
  var reach = {};          // step 6, channel value -> what the customer typed
  var lastRequest = null;  // the record Quillin would receive
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
  var CHANNELS = [
    {
      value: 'text', label: 'Text message', type: 'tel',
      placeholder: '(214) 555 0142', autocomplete: 'tel',
      clean: function (v) { return v.replace(/[^\d]/g, ''); },
      ok: function (v) {
        var d = v.replace(/[^\d]/g, '');
        return d.length === 10 || (d.length === 11 && d.charAt(0) === '1');
      },
      error: 'That needs to be a 10 digit number.'
    },
    {
      value: 'email', label: 'Email', type: 'email',
      placeholder: 'you@example.com', autocomplete: 'email',
      clean: function (v) { return v.trim(); },
      ok: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
      error: 'That does not look like an email address.'
    },
    {
      value: 'instagram', label: 'Instagram', type: 'text',
      placeholder: '@yourhandle', autocomplete: 'off',
      clean: function (v) { return v.trim().replace(/^@+/, ''); },
      ok: function (v) { return /^[\w.]{1,30}$/.test(v.trim().replace(/^@+/, '')); },
      error: 'Add your Instagram handle.'
    },
    {
      value: 'facebook', label: 'Facebook', type: 'text',
      placeholder: 'Your name on Facebook', autocomplete: 'off',
      clean: function (v) { return v.trim(); },
      ok: function (v) { return v.trim().length >= 2; },
      error: 'Add the name on your Facebook account.'
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

  function slideOpen(node) {
    if (!node || !node.hidden) return;
    node.hidden = false;
    if (!MOTION_OK) return;

    if (node._anim) { node._anim.cancel(); node._anim = null; }
    var h = node.scrollHeight;
    if (!h) return;

    node.style.overflow = 'hidden';
    node._anim = node.animate(
      [{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }],
      { duration: 340, easing: EASE }
    );
    node._anim.onfinish = function () {
      node.style.overflow = '';
      node._anim = null;
    };
  }

  function slideShut(node) {
    if (!node || node.hidden) return;
    if (!MOTION_OK) { node.hidden = true; return; }

    if (node._anim) { node._anim.cancel(); node._anim = null; }
    var h = node.scrollHeight;

    node.style.overflow = 'hidden';
    node._anim = node.animate(
      [{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }],
      { duration: 240, easing: EASE }
    );
    node._anim.onfinish = function () {
      node.hidden = true;
      node.style.overflow = '';
      node._anim = null;
    };
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
    if (step <= 2) { hide(el.specifics); clearChoices(el.specChoices); answers = {}; }
    if (step <= 3) hide(el.confirm);
    if (step <= 4) {
      hide(el.glass);
      hide(el.tellus);
      el.justTell.hidden = false;
      el.tellText.value = '';
      hide(el.tellNote);
      panels = [];
      windshield = null;
      damageKind = {};
      hide(el.chipQ);
      el.chipDone.innerHTML = '';
      el.chipDone.hidden = true;
      teardownPicker();
      hide(el.cause);
      el.causeSel.value = '';
      answers.cause = null;
      hide(el.photos);
      noPhotos = false;
      clearPhotos();
      el.thatItWrap.hidden = true;
      el.thatIt.disabled = true;
    }
    if (step <= 5) {
      hide(el.when);
      urgency = null;
      el.submit.disabled = true;
      Array.prototype.forEach.call(
        el.whenChoices.querySelectorAll('input'),
        function (i) { i.checked = false; }
      );
    }
    if (step <= 6) {
      hide(el.review);
      el.summary.innerHTML = '';
      hide(el.sendNote);
      reach = {};
      el.send.disabled = true;
      el.send.textContent = 'Looks right, send it';
      Array.prototype.forEach.call(
        el.sendWhere.querySelectorAll('input'),
        function (i) { if (i.type === 'checkbox') i.checked = false; else i.value = ''; }
      );
      Array.prototype.forEach.call(
        el.sendWhere.querySelectorAll('.reach__input, .reach__error'),
        function (n) { n.hidden = true; n.classList.remove('reach__input--bad'); }
      );
    }
  }

  /* ---------- step 1: VIN ---------- */

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
      askSpecifics(v);
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
    if (announce) say('No problem! Let\u2019s continue like this\u2026');
    /* Populated BEFORE opening. scrollHeight is measured as the animation
       starts, so filling the dropdowns afterwards would animate to the height
       of an empty box and then jump to the real one. */
    fillManual();
    slideOpen(el.manual);
    el.noVin.setAttribute('aria-expanded', 'true');
    restack();
  }

  function shutManual() {
    if (el.manual.hidden) return;
    slideShut(el.manual);
    el.noVin.setAttribute('aria-expanded', 'false');

    /* Unlike the help panel, this one holds an ANSWER: which vehicle this is.
       Putting it away has to take the answer with it, or a year and make nobody
       can see any more would go on driving every step below. */
    el.mYear.value = '';
    el.mMake.value = '';
    el.mMake.disabled = true;
    clearModels('Model');
    el.mModel.disabled = true;
    vehicle = null;
    resetBelow(2);
    restack();
  }

  function fillManual() {
    if (el.mYear.options.length > 1) return;

    var now = new Date().getFullYear() + 1;
    for (var y = now; y >= 1981; y--) {          // vPIC coverage starts at 1981
      el.mYear.add(new Option(y, y));
    }
    MAKES.forEach(function (m) { el.mMake.add(new Option(m, m)); });
  }

  el.noVin.addEventListener('click', function () {
    if (el.manual.hidden) {
      openManual(true);
      el.mYear.focus();
    } else {
      shutManual();
    }
  });

  el.mYear.addEventListener('change', function () {
    el.mMake.disabled = !el.mYear.value;
    clearModels('Model');
    resetBelow(2);
  });

  el.mMake.addEventListener('change', function () {
    resetBelow(2);
    if (!el.mMake.value) { clearModels('Model'); return; }
    clearModels('Loading…');
    el.mModel.disabled = true;

    var token = el.mMake.value + el.mYear.value;
    lastLookup = token;

    VIN.modelsFor(el.mMake.value, el.mYear.value).then(function (models) {
      if (lastLookup !== token) return;
      if (!models.length) { clearModels('No models found'); return; }
      clearModels('Model');
      modelTypes = Object.create(null);
      models.forEach(function (m) {
        modelTypes[m.name] = m.types;
        el.mModel.add(new Option(m.name, m.name));
      });
      el.mModel.disabled = false;
    }).catch(function () {
      if (lastLookup === token) clearModels('Couldn’t load models');
    });
  });

  el.mModel.addEventListener('change', function () {
    if (!el.mModel.value) { resetBelow(2); return; }
    // No VIN means no ADAS data, so we have to ask rather than infer.
    undecline();
    vehicle = {
      year: el.mYear.value,
      make: el.mMake.value,
      model: el.mModel.value,
      trim: '', bodyClass: '', doors: '', cab: '', vin: '',
      /* What vPIC filed this model under: car, truck, mpv, or several. Not a
         body style, but enough to stop us asking a stupid question about one. */
      vpicTypes: modelTypes[el.mModel.value] || [],
      adas: { camera: [], mixed: [], elsewhere: [] },
      label: el.mYear.value + ' ' + el.mMake.value + ' ' + el.mModel.value,
      usable: true
    };
    askSpecifics(vehicle, true);
  });

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
    reveal(el.glass);
    show(el.tellus);
    show(el.photos);
    restack();
  }

  /* Puts the damage step back to normal. Called before every fresh lookup,
     because the customer may correct a motorcycle VIN to a car. */
  function undecline() {
    el.picker.hidden = false;
    el.declineNote.hidden = true;
    el.glassLabel.textContent = 'So… where’s the damage?';
  }

  /* ---------- step 2: specifics ---------- */

  /* Only ask what the VIN could not settle. If it settled everything, this step
     never appears and we go straight to confirm. */
  function askSpecifics(v, noVin) {
    resetBelow(2);
    var questions = questionsFor(v, noVin);
    if (!questions.length) { askConfirm(v); return; }
    renderQuestion(v, noVin, questions);
  }

  /* The body styles a vehicle could plausibly be, given what vPIC filed the
     model under. Asking whether a Hyundai Elantra is a rig makes the site look
     like it knows nothing about cars, and vPIC already answered that: an
     Elantra comes back under 'car' and never under 'truck'.

     A model can land in more than one bucket, a Ford Transit is both truck and
     mpv, so the lists are unioned rather than picked between. With nothing to
     go on the full list stands, which is the old behaviour. */
  var BODY_BY_TYPE = {
    car:   ['sedan', 'coupe', 'hatch', 'convertible'],
    mpv:   ['suv', 'van', 'hatch'],
    truck: ['pickup', 'van', 'suv', 'heavy']
  };

  var BODY_LABEL = {
    sedan:       'Sedan, four doors',
    coupe:       'Coupe, two doors',
    hatch:       'Hatchback or wagon',
    suv:         'SUV or crossover',
    pickup:      'Pickup truck',
    van:         'Van or minivan',
    convertible: 'Convertible',
    heavy:       'Rig, box truck or motorhome'
  };

  var BODY_ORDER = ['sedan', 'coupe', 'hatch', 'suv', 'pickup', 'van',
                    'convertible', 'heavy'];

  /* vPIC's vehicle types are too coarse on their own: "truck" covers a pickup,
     a panel van, a Suburban and an eighteen wheeler alike, so a Ford F-150 was
     still being asked what shape it is. Nobody needs to be asked that.

     The US market has a small, stable set of nameplates, so matching the model
     name settles the common cases outright. Kept deliberately narrow: these are
     names, not guesses at a pattern, and anything not on a list falls through
     to the question rather than being assumed. A Tahoe must not become a pickup
     just because vPIC files it under truck. */
  var BY_NAME = [
    { body: 'pickup', re: /\b(f-?[1-4]50|super ?duty|silverado|sierra|ram ?[1-5]500|tacoma|tundra|ranger|colorado|canyon|frontier|titan|ridgeline|gladiator|maverick|santa ?cruz|dakota|avalanche|ridgelin)\b/i },
    { body: 'van',    re: /\b(transit|sprinter|promaster|express|savana|nv ?[0-9]*|metris|caravan|sienna|odyssey|pacifica|carnival|sedona|econoline|e-?[1-4]50|city ?express)\b/i },
    { body: 'heavy',  re: /\b(f-?[678]50|cascadia|columbia|freightliner|kenworth|peterbilt|international|box ?truck|chassis|motorhome|school ?bus)\b/i },
    { body: 'suv',    re: /\b(tahoe|suburban|yukon|escalade|expedition|navigator|explorer|traverse|4runner|sequoia|land ?cruiser|wrangler|bronco|durango|armada|pathfinder|telluride|palisade|highlander|pilot|atlas|ascent|grand ?cherokee|cherokee|edge|escape|equinox|rav ?4|cr-?v|rogue|forester|outback|cx-?[0-9]|tucson|santa ?fe|sorento|sportage)\b/i }
  ];

  function bodyFromName(model) {
    var hits = BY_NAME.filter(function (r) { return r.re.test(model || ''); });
    return hits.length === 1 ? hits[0].body : null;   // ambiguous stays a question
  }

  function bodyChoicesFor(v) {
    var known = bodyFromName(v && v.model);
    if (known) return [{ value: known, label: BODY_LABEL[known] }];

    var types = (v && v.vpicTypes) || [];
    var allowed = Object.create(null);

    types.forEach(function (t) {
      (BODY_BY_TYPE[t] || []).forEach(function (b) { allowed[b] = true; });
    });

    /* Passenger car wins outright when it is one of the buckets. vPIC's older
       data is loose enough that a 1994 Camaro comes back under 'mpv' as well as
       'car', and unioning them offered SUV and van as answers for a Camaro.
       Nothing that vPIC calls a passenger car is a van. */
    if (types.indexOf('car') !== -1) {
      allowed = Object.create(null);
      BODY_BY_TYPE.car.forEach(function (b) { allowed[b] = true; });
    }

    var ids = Object.keys(allowed);
    if (!ids.length) ids = BODY_ORDER.slice();      // nothing known, ask it all

    return BODY_ORDER.filter(function (b) { return ids.indexOf(b) !== -1; })
      .map(function (b) { return { value: b, label: BODY_LABEL[b] }; });
  }

  /* What still needs asking, in the order it should be asked. One list, read by
     both the step that shows a question and the handler that answers one, so
     the two can never disagree about whether anything is left. */
  function questionsFor(v, noVin) {
    var questions = [];
    var state = VIN.adasState(v);

    /* Asked whenever nothing that has seen the vehicle can say what shape it
       is: every no-VIN entry, and any VIN whose body class vPIC does not carry.
       It used to guess from the door count, which on the no-VIN path is also
       unknown, so every manually entered pickup and van was drawn as a saloon
       and the customer was asked to pick panes it does not have. */
    if (!answers.bodyStyle && Glass.resolve(v).needsBody) {
      var choices = bodyChoicesFor(v);
      if (choices.length === 1) {
        /* Only one thing it can be, so do not ask. vPIC filed this model under
           exactly one vehicle type and that type maps to one body style. */
        v.bodyStyle = choices[0].value;
      } else {
        questions.push({
          key: 'bodyStyle',
          hint: 'What shape is your ' +
                [v.year, v.make, v.model].filter(Boolean).join(' ') + '?',
          options: choices
        });
      }
    }

    /* The year gate applies to the no-VIN path too. Without it the `noVin` flag
       forced the question on everything, so the owner of a 1994 Camaro was
       asked whether there is a camera behind the mirror. There is not; there
       was no such thing. */
    if (!answers.adas && !VIN.tooOldForAdas(v) && (state === 'maybe' || noVin)) {
      questions.push({
        key: 'adas',
        hint: 'Some ' + [v.year, v.make, v.model].filter(Boolean).join(' ') +
              ' models have a camera behind the rearview mirror. If yours does, ' +
              'a new windshield has to be recalibrated to it.',
        options: [
          { value: 'yes',  label: 'Yes, there’s a camera or sensor behind my mirror' },
          { value: 'no',   label: 'No, nothing behind the mirror' },
          { value: 'unsure', label: 'I’m not sure' }
        ]
      });
    }

    return questions;
  }

  function renderQuestion(v, noVin, questions) {
    var q = questions[0];
    el.specHint.textContent = q.hint;
    clearChoices(el.specChoices);

    q.options.forEach(function (opt) {
      var id = 'spec-' + q.key + '-' + opt.value;
      var label = document.createElement('label');
      label.className = 'choice';
      label.setAttribute('for', id);

      var input = document.createElement('input');
      input.type = 'radio';
      input.name = q.key;
      input.id = id;
      input.value = opt.value;
      input.addEventListener('change', function () {
        answers[q.key] = opt.value;
        /* The body style the customer gives is what the resolver, the picker
           and the panel list all read from here on. */
        if (q.key === 'bodyStyle') v.bodyStyle = opt.value;
        /* Only one question is on screen at a time, so re-ask rather than
           confirm: body style first, then anything still outstanding. */
        if (questionsFor(v, noVin).length) { askSpecifics(v, noVin); return; }
        askConfirm(v);
        restack();
      });

      var span = document.createElement('span');
      span.textContent = opt.label;

      label.appendChild(input);
      label.appendChild(span);
      el.specChoices.appendChild(label);
    });

    reveal(el.specifics);
  }

  /* ---------- step 3: confirm ---------- */

  function askConfirm(v) {
    resetBelow(3);
    el.cVehicle.textContent = 'So, you need repairs to a ' + v.label + '?';

    var bits = [];
    if (v.trim) bits.push(v.trim);
    if (v.bodyClass) bits.push(Glass.resolve(v).label.replace(/^./, function (c) {
      return c.toUpperCase();
    }));
    if (v.vin) bits.push('VIN ' + v.vin);

    /* No driver assist line here. See buildSummary: anything we infer about ADAS
       from the VIN goes to Quillin, not to the customer. */
    el.cDetail.textContent = bits.join(' · ');
    reveal(el.confirm);
  }

  el.cYes.addEventListener('click', function () {
    /* Checked here rather than at decode, so a mistyped VIN that lands on a
       motorcycle can still be corrected at the confirm step instead of dead
       ending before the customer has been shown what we read. */
    var r = Glass.resolve(vehicle);
    if (r.unsupported) { declineVehicle(vehicle, r); return; }

    reveal(el.glass);
    openPicker();
    show(el.cause);
    /* Shown at the same time as the picker, not gated behind it. Photographs are
       the most useful thing a customer can send, so the ask sits in plain view
       from the start rather than appearing only after they have done something
       else, and anyone who would rather send a picture than rotate a car can do
       exactly that. */
    show(el.photos);
  });

  /* ---------- step 4: the picker ---------- */

  /* Loaded once, lazily, next to the picker itself. Kept in a variable rather
     than imported per open so the five model files are only ever fetched once
     per visit however many times an earlier answer is edited. */
  var Vehicles = null;
  import('./vehicles.js?v=8506a6fa').then(function (mod) { Vehicles = mod; },
    function (err) { console.error('Vehicle models unavailable:', err); });

  function teardownPicker() {
    if (picker) { picker.dispose(); picker = null; }
    clearChoices(el.pickerList);
    el.pickerStage.innerHTML = '';
    el.picker.classList.remove('picker--nogl');
  }

  /* The vehicle is a body archetype chosen from the VIN, not the customer's exact
     car, and the note says so. What has to be right is the panel set. */
  function openPicker() {
    if (picker || el.pickerList.querySelector('input')) return;
    archetype = Glass.resolve(vehicle);

    el.pickerNote.textContent = 'This is a ' + archetype.label +
      ' like yours, not your exact car. Tap the glass that needs work.';

    // Resolved relative to THIS file (js/), not the document base. The leading
    // './' is required; a bare 'picker.js' would be read as a package name.
    // Two-argument then(), not then().catch(): a throw inside the success
    // handler must not be reported as a module load failure.
    import('./picker.js?v=fbc19470').then(function (mod) {
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
    restack();
  }

  /* Asked only when it can matter. Nobody picking a door glass should be shown
     a question about chips. */
  function chipLabelFor(value) {
    for (var i = 0; i < CHIP.length; i++) if (CHIP[i].value === value) return CHIP[i].label;
    return '';
  }

  /* Walks the chosen glass, asking about one piece at a time.

     Each answer collapses to a line above the question and the question moves
     on to the next piece, so the customer is never looking at four identical
     sets of radio buttons and wondering which window they belong to. When the
     last one is answered the question goes away and the photo ask is next. */
  function syncChipQuestion() {
    // Drop answers for glass that is no longer selected.
    Object.keys(damageKind).forEach(function (id) {
      if (panels.indexOf(id) === -1) delete damageKind[id];
    });
    windshield = damageKind.windshield || null;   // the rest of the app reads this

    // The lines already settled.
    el.chipDone.innerHTML = '';
    var answered = panels.filter(function (id) { return damageKind[id]; });
    answered.forEach(function (id) {
      var li = document.createElement('li');
      var k = document.createElement('b');
      k.textContent = Glass.labelFor(id);
      var v = document.createElement('span');
      v.textContent = chipLabelFor(damageKind[id]);
      li.appendChild(k); li.appendChild(v);
      el.chipDone.appendChild(li);
    });
    el.chipDone.hidden = !answered.length;

    // The next one to ask about, in the order the panels are listed.
    var next = null;
    for (var i = 0; i < panels.length; i++) {
      if (!damageKind[panels[i]]) { next = panels[i]; break; }
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
        resetBelow(6);
        syncChipQuestion();      // straight on to the next piece of glass
        syncThatIt();
        restack();
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
    el.justTell.hidden = true;
    slideOpen(el.tellus);
    el.tellText.focus();
  });

  el.tellText.addEventListener('input', function () {
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
  el.noPhotos.addEventListener('click', function () {
    noPhotos = true;
    clearPhotos();
    afterDamageChange();
    say2(damageGiven()
      ? 'No problem! Let\'s continue...'
      : 'No problem. Tell us which glass is damaged above and we can carry on.');
  });

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
    restack();

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
  function afterDamageChange() {
    if (!damageGiven()) { resetBelow(5); syncThatIt(); restack(); return; }
    resetBelow(6);
    syncThatIt();
    restack();
  }

  /* Offered once there is something to move on from, and retired once they
     have moved on. */
  function syncThatIt() {
    // Every chosen piece of glass has to have been asked about, not just the
    // windshield: the answers are what separate a repair from a replacement.
    var allAsked = panels.every(function (id) { return !!damageKind[id]; });
    var ready = damageGiven() && allAsked;
    el.thatIt.disabled = !ready;
    el.thatItWrap.hidden = !ready || !el.when.hidden;
  }

  el.causeSel.addEventListener('change', function () {
    answers.cause = el.causeSel.value || null;
    syncThatIt();
    restack();
  });

  el.thatIt.addEventListener('click', function () {
    askWhen();
    syncThatIt();
    restack();
  });

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
    // "No images" makes no sense once there are images
    el.noPhotos.hidden = photos.length > 0;
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
    el.noPhotos.hidden = false;
    hide(el.photoNote);
  }

  /* ---------- step 5: timing ---------- */

  function askWhen() {
    if (!el.when.hidden) return;
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
          resetBelow(6);
          el.submit.disabled = false;
          restack();
        });

        var span = document.createElement('span');
        span.textContent = opt.label;

        label.appendChild(input);
        label.appendChild(span);
        el.whenChoices.appendChild(label);
      });
    }
    reveal(el.when);
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

    if (answers.cause) rows.push(['Cause', CAUSE_LABEL[answers.cause]]);

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
      vehicle: {
        label: v.label, year: v.year, make: v.make, model: v.model,
        trim: v.trim, bodyClass: v.bodyClass, doors: v.doors, cab: v.cab,
        vin: v.vin || null,
        identifiedBy: v.vin ? 'vin' : 'year/make/model chosen by customer'
      },
      archetype: archetype ? archetype.id : null,
      damage: {
        panels: panels.slice(),
        panelLabels: Glass.labelsFor(panels),
        /* What the customer says happened. Changes the job, not just the part:
           a chip is a repair, a break-in is a replacement plus clearing the
           fragments out of the door, a regulator fault is not glass at all. */
        cause: answers.cause || null,
        causeLabel: CAUSE_LABEL[answers.cause] || null,
        description: el.tellText.value.trim() || null,
        photos: photos.length,
        /* Distinguishes "said no" from "never engaged with the question", which
           is the difference between a complete request and an abandoned one. */
        photosDeclined: noPhotos,
        // null unless the windshield was chosen
        windshield: windshield,
        /* Chip, crack or not sure, for every piece of glass chosen. This is the
           difference between a repair and a replacement, per pane. */
        kinds: panels.map(function (id) {
          return { panel: id, label: Glass.labelFor(id), kind: damageKind[id] || null };
        })
      },
      work: workFor(v),                        // ADAS included here
      adas: {
        fromVin: state,                        // yes / maybe / no
        customerSaid: answers.adas || null,    // yes / no / unsure, when asked
        recalibrationLikely: state === 'yes' || answers.adas === 'yes',
        /* Broken out by where each sensor sits, so a flag can be judged rather
           than taken on trust. Anything under notGlassRelated was seen and
           deliberately not counted. */
        systems: v.vin ? VIN.adasDetail(v) : null,
        note: v.vin
          ? 'Model-level data from NHTSA vPIC. Only systems that look through ' +
            'the windshield were counted. Verify against the vehicle.'
          : 'No VIN given, so this rests on the customer\'s answer alone.'
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

  el.submit.addEventListener('click', function () {
    resetBelow(6);
    buildSummary();
    buildChannels();
    reveal(el.review);
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

      var err = document.createElement('p');
      err.className = 'reach__error';
      err.hidden = true;

      box.addEventListener('change', function () {
        field.hidden = !box.checked;
        if (box.checked) field.focus(); else field.value = '';
        check();
      });
      field.addEventListener('input', check);
      field.addEventListener('blur', function () { check(true); });

      function check(showError) {
        var raw = field.value;
        var good = box.checked && c.ok(raw);
        if (good) reach[c.value] = c.clean(raw); else delete reach[c.value];

        // Only complain once they have typed something or left the field.
        var complain = box.checked && !good && (showError || raw.length > 0);
        err.textContent = complain ? c.error : '';
        err.hidden = !complain;
        field.classList.toggle('reach__input--bad', complain);

        syncSend();
      }

      wrap.appendChild(label);
      wrap.appendChild(field);
      wrap.appendChild(err);
      el.sendWhere.appendChild(wrap);
    });
  }

  /* At least one way to reach them, filled in properly. */
  function syncSend() {
    el.send.disabled = Object.keys(reach).length === 0;
    hide(el.sendNote);
  }

  el.send.addEventListener('click', function () {
    // TODO: delivery is not wired up. The request now carries a way to reach the
    // customer, so what is missing is only the pipe to Quillin. Nothing is sent.
    if (!Object.keys(reach).length) return;
    /* The payload is assembled here rather than at send time so the shape is
       exercised on every run, not only once delivery exists. */
    lastRequest = buildRequest();
    el.send.disabled = true;
    el.send.textContent = 'Sent';
    el.sendNote.textContent = 'Nothing was sent. Delivery is not wired up yet' +
      (photos.length ? ', and the images have not left this device.' : '.');
    el.sendNote.className = 'note note--warn';
    show(el.sendNote);
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
  /* Kept next to the markup's own wording so the folded line, the review and the
     record all say the same thing the customer picked. */
  var CAUSE_LABEL = {
    'rock-chip': 'Rock chip or star break',
    'crack': 'Crack, or a chip that spread',
    'break-in': 'Break-in or vandalism',
    'accident': 'Accident or collision',
    'hail': 'Hail or storm damage',
    'road-debris': 'Road debris',
    'scratched': 'Scratched or pitted glass',
    'leak': 'Leaking, wind noise or bad seal',
    'regulator': 'Window will not go up or down',
    'unknown': 'Not sure, or something else'
  };

  var DIGEST = {
    'step-vin': { name: 'VIN', value: function () {
      if (vehicle && !vehicle.vin) return 'Entered by hand';
      return el.vin.value || '';
    } },
    'step-specifics': { name: 'Mirror', value: function () {
      return { yes: 'Camera fitted', no: 'No camera', unsure: 'Not sure' }[answers.adas] || '';
    } },
    'step-confirm': { name: 'Vehicle', value: function () {
      return vehicle ? vehicle.label : '';
    } },
    'step-glass': { name: 'Damage', value: function () {
      var bits = [];
      if (panels.length) {
        var names = Glass.labelsFor(panels);
        if (windshield === 'chip') names[panels.indexOf('windshield')] = 'Windshield chip';
        bits.push(names.join(', '));
      }
      var typed = el.tellText.value.trim();
      if (typed) bits.push(typed.length > 54 ? typed.slice(0, 51) + '\u2026' : typed);
      return bits.join('. ');
    } },
    'step-cause': { name: 'Cause', value: function () {
      return CAUSE_LABEL[answers.cause] || '';
    } },
    'step-photos': { name: 'Photos', value: function () {
      if (photos.length) return photos.length + (photos.length === 1 ? ' image' : ' images');
      return noPhotos ? 'None' : '';
    } },
    'step-when': { name: 'Timing', value: function () {
      return urgency ? urgency.label.replace(/\.$/, '') : '';
    } },
    'step-review': { name: 'Review', value: function () { return ''; } }
  };

  function foldLine(step) {
    var line = step.querySelector('.step__folded');
    if (!line) {
      line = document.createElement('button');
      line.type = 'button';
      line.className = 'step__folded';
      line.addEventListener('click', function () {
        var editing = step.classList.toggle('is-editing');
        restack();
        if (editing) step.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      step.insertBefore(line, step.firstChild);
    }

    /* The way back out. Opening a folded answer used to be a one way door:
       nothing on screen closed it again, and it stayed open until some later
       answer happened to fold it. Built alongside the folded line because only
       a step that has folded can ever be reopened. */
    if (!step.querySelector('.step__collapse')) {
      var shut = document.createElement('button');
      shut.type = 'button';
      shut.className = 'step__collapse';
      shut.textContent = 'Close';
      shut.addEventListener('click', function () {
        step.classList.remove('is-editing');
        restack();
        /* Put the eye back on whatever is now the live question, but only if
           it is off screen; the same rule reveal() uses, for the same reason. */
        var open = Array.prototype.filter.call(
          document.querySelectorAll('.step'),
          function (x) { return !x.hidden && !x.classList.contains('is-folded'); });
        var live = open[open.length - 1];
        if (live) {
          var r = live.getBoundingClientRect();
          var vh = window.innerHeight || document.documentElement.clientHeight;
          if (r.top < 0 || r.bottom > vh) {
            live.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      });
      step.insertBefore(shut, step.firstChild);
    }

    var d = DIGEST[step.id] || { name: '', value: function () { return ''; } };
    var name = d.name;
    var value = d.value();

    line.innerHTML = '';
    var k = document.createElement('span');
    k.className = 'step__folded-name';
    k.textContent = name;
    var val = document.createElement('span');
    val.className = 'step__folded-value';
    val.textContent = value;
    /* Third column: what you can do about it. Without it the row read as a
       receipt and nothing suggested the answer was still yours to change. */
    var act = document.createElement('span');
    act.className = 'step__folded-do';
    act.textContent = 'Change';
    line.appendChild(k);
    line.appendChild(val);
    line.appendChild(act);
    line.setAttribute('aria-label', 'Change: ' + name +
      (value ? ', currently ' + value : ''));
  }

  /* A step folds when it has been ANSWERED and something later is open.

     Not "everything except the last visible step": the picker and the photo
     question are revealed together, and that rule folded the picker the instant
     it appeared, so the 3D model was never seen at all. An unanswered step is
     still a question and stays open no matter what is below it. */
  function restack() {
    var steps = Array.prototype.filter.call(
      document.querySelectorAll('.step'), function (s) { return !s.hidden; });
    var last = steps[steps.length - 1];

    /* The damage and photo steps are peers, revealed together, and neither is
       finished until the customer presses "That it?". Without this they folded
       the instant a pane was picked, which took the car off the screen mid
       decision: the same complaint as auto-advancing, by another route. */
    var stillChoosing = el.when.hidden;

    steps.forEach(function (s) {
      var d = DIGEST[s.id];
      var answered = !!(d && d.value());
      var held = stillChoosing && (s === el.glass || s === el.photos);
      var fold = answered && !held && s !== last && !s.classList.contains('is-editing');
      if (fold) foldLine(s);
      s.classList.toggle('is-folded', fold);
      if (s === last) s.classList.remove('is-editing');
      s.classList.toggle('is-live', !fold);
    });

    var open = steps.filter(function (x) { return !x.classList.contains('is-folded'); });
    placeReset(open[open.length - 1]);
    greet();
  }

  /* The heading follows the flow. Once the review is on screen there is nothing
     left to get; what is in front of you is the thing itself, waiting to be
     checked. Driven from restack rather than from the reveal, so every way back
     out of the review, start over, reopening an earlier step, puts the original
     wording back without any of those having to know about it. */
  var GREETINGS = { get: 'Get your quote.', review: 'Review your quote.' };

  function greet() {
    if (!el.greeting) return;
    var want = el.review.hidden ? GREETINGS.get : GREETINGS.review;
    if (el.greeting.textContent === want) return;   // restack runs constantly

    if (!MOTION_OK) { el.greeting.textContent = want; return; }

    /* Swapped at the dip rather than on the spot: at this size a word changing
       under you mid-scroll catches the eye harder than the review appearing. */
    if (el.greeting._swap) el.greeting._swap.cancel();
    el.greeting._swap = el.greeting.animate(
      [{ opacity: 1 }, { opacity: 0 }, { opacity: 0 }, { opacity: 1 }],
      { duration: 460, easing: 'ease-in-out' }
    );
    setTimeout(function () { el.greeting.textContent = want; }, 170);
  }

  /* Catches every reveal and every reset without those having to know about
     any of this. Value changes are pushed in by the handlers that make them. */
  new MutationObserver(restack).observe(document.querySelector('.flow'), {
    attributes: true, attributeFilter: ['hidden'], subtree: true
  });

  // Temporary, until a channel is wired: lets the outgoing record be inspected.
  window.__lastRequest = function () { return lastRequest; };

  function startOver() {
    vehicle = null;
    answers = {};
    lastLookup = '';
    lastRequest = null;
    el.vin.value = '';
    el.field.classList.remove('field--ok');
    undecline();
    answers = {};
    /* slideShut, not hide. Starting over with the manual panel open used to
       snap three dropdowns out of existence in a frame while everything else
       on the page animated, which read as the page breaking rather than
       clearing. slideShut returns immediately if it is already closed. */
    slideShut(el.manual);
    el.noVin.setAttribute('aria-expanded', 'false');
    say('');
    resetBelow(2);            // cascades through damage, photos, timing, review
    restack();
    el.vin.focus();
    window.scrollTo({ top: 0, behavior: MOTION_OK ? 'smooth' : 'auto' });
  }

  el.cNo.addEventListener('click', startOver);

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
      ask.hidden = false;
    }

    ask.addEventListener('click', function () {
      ask.hidden = true;
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

  /* Shown once there is something worth losing. On an empty VIN step there is
     nothing to clear, and offering to clear it is just noise. */
  function placeReset(live) {
    /* Normally there is nothing to start over from on a bare VIN step. With the
       manual panel open there is: three dropdowns, and whatever has been chosen
       in them. So the VIN step keeps the button in that one case. */
    if (!live || (live.id === 'step-vin' && el.manual.hidden)) {
      if (resetUI.wrap.parentNode) resetUI.wrap.parentNode.removeChild(resetUI.wrap);
      return;
    }
    if (resetUI.wrap.parentNode !== live) {
      resetUI.close();
      live.appendChild(resetUI.wrap);
    }
  }

})();
