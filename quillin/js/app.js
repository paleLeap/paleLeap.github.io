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
    photos:    $('step-photos'),
    addPhotos: $('add-photos'),
    noPhotos:  $('no-photos'),
    photoInput: $('photo-input'),
    shots:     $('shots'),
    photoNote: $('photo-note'),
    submit:    $('submit-damage'),
    review:    $('step-review'),
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
  var lastLookup = '';     // guards against out-of-order responses

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
      teardownPicker();
      hide(el.photos);
      noPhotos = false;
      clearPhotos();
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
    lastLookup = vin;
    say('Looking that up…');

    VIN.decode(vin).then(function (v) {
      if (lastLookup !== vin) return;   // a newer edit already superseded this
      if (!v.usable) {
        say('We couldn’t identify that VIN. Check it, or enter your vehicle below.', 'err');
        openManual();
        return;
      }
      say(doubtful ? 'That VIN’s check digit looks off, but here’s what we found.' : '',
          doubtful ? 'warn' : '');
      vehicle = v;
      askSpecifics(v);
    }).catch(function () {
      if (lastLookup !== vin) return;
      say('We couldn’t reach the vehicle database. Enter your vehicle below instead.', 'err');
      openManual();
    });
  }

  /* ---------- step 1b: no-VIN fallback ---------- */

  function openManual() {
    if (!el.manual.hidden) return;
    el.noVin.hidden = true;
    /* Populated BEFORE opening. scrollHeight is measured as the animation
       starts, so filling the dropdowns afterwards would animate to the height
       of an empty box and then jump to the real one. */
    fillManual();
    slideOpen(el.manual);
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
    openManual();
    el.mYear.focus();
    say('');
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
      models.forEach(function (m) { el.mModel.add(new Option(m, m)); });
      el.mModel.disabled = false;
    }).catch(function () {
      if (lastLookup === token) clearModels('Couldn’t load models');
    });
  });

  el.mModel.addEventListener('change', function () {
    if (!el.mModel.value) { resetBelow(2); return; }
    // No VIN means no ADAS data, so we have to ask rather than infer.
    vehicle = {
      year: el.mYear.value,
      make: el.mMake.value,
      model: el.mModel.value,
      trim: '', bodyClass: '', doors: '', cab: '', vin: '',
      adas: { lane: '', collision: '', cruise: '' },
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

  /* ---------- step 2: specifics ---------- */

  /* Only ask what the VIN could not settle. If it settled everything, this step
     never appears and we go straight to confirm. */
  function askSpecifics(v, noVin) {
    resetBelow(2);
    var questions = [];
    var state = VIN.adasState(v);

    if (state === 'maybe' || noVin) {
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

    if (!questions.length) { askConfirm(v); return; }

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
    reveal(el.glass);
    openPicker();
    /* Shown at the same time as the picker, not gated behind it. Photographs are
       the most useful thing a customer can send, so the ask sits in plain view
       from the start rather than appearing only after they have done something
       else, and anyone who would rather send a picture than rotate a car can do
       exactly that. */
    show(el.photos);
  });

  /* ---------- step 4: the picker ---------- */

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
    import('./picker.js').then(function (mod) {
      try {
        picker = mod.createPicker({
          mount: el.pickerStage,
          listMount: el.pickerList,
          archetype: archetype,
          labelFor: Glass.labelFor,
          onChange: onPanels
        });
      } catch (err) {
        console.error('Glass picker failed to start:', err);
        plainList();
      }
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
    afterDamageChange();
    restack();
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
    restack();
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
  function afterDamageChange() {
    if (!damageGiven()) { resetBelow(5); restack(); return; }
    resetBelow(6);
    askWhen();            // no-op when it is already showing
    restack();
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
      // Customer-facing, so the ADAS line is filtered out. See below.
      var services = Glass.servicesFor(panels, v).filter(function (x) {
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
        description: el.tellText.value.trim() || null,
        photos: photos.length,
        /* Distinguishes "said no" from "never engaged with the question", which
           is the difference between a complete request and an abandoned one. */
        photosDeclined: noPhotos
      },
      work: Glass.servicesFor(panels, v),      // ADAS included here
      adas: {
        fromVin: state,                        // yes / maybe / no
        customerSaid: answers.adas || null,    // yes / no / unsure, when asked
        recalibrationLikely: state === 'yes' || answers.adas === 'yes',
        note: v.vin
          ? 'Model-level data from NHTSA vPIC. Verify against the vehicle.'
          : 'No VIN given, so this rests on the customer\'s answer alone.'
      },
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
      if (panels.length) bits.push(Glass.labelsFor(panels).join(', '));
      var typed = el.tellText.value.trim();
      if (typed) bits.push(typed.length > 54 ? typed.slice(0, 51) + '\u2026' : typed);
      return bits.join('. ');
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
    line.appendChild(k);
    line.appendChild(val);
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

    steps.forEach(function (s) {
      var d = DIGEST[s.id];
      var answered = !!(d && d.value());
      var fold = answered && s !== last && !s.classList.contains('is-editing');
      if (fold) foldLine(s);
      s.classList.toggle('is-folded', fold);
      if (s === last) s.classList.remove('is-editing');
      s.classList.toggle('is-live', !fold);
    });

    var open = steps.filter(function (x) { return !x.classList.contains('is-folded'); });
    placeReset(open[open.length - 1]);
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
    hide(el.manual);
    el.noVin.hidden = false;
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
    if (!live || live.id === 'step-vin') {
      if (resetUI.wrap.parentNode) resetUI.wrap.parentNode.removeChild(resetUI.wrap);
      return;
    }
    if (resetUI.wrap.parentNode !== live) {
      resetUI.close();
      live.appendChild(resetUI.wrap);
    }
  }

})();
