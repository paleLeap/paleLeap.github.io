/* VIN validation and decoding.
   Decoding runs against NHTSA vPIC: free, no API key, CORS open.
   https://vpic.nhtsa.dot.gov/api/ */

(function (global) {
  'use strict';

  var API = 'https://vpic.nhtsa.dot.gov/api/vehicles';

  // I, O and Q are never used in a VIN; they read as 1 and 0.
  var VALID = /^[A-HJ-NPR-Z0-9]{17}$/;

  var TRANSLIT = {
    A:1, B:2, C:3, D:4, E:5, F:6, G:7, H:8,
    J:1, K:2, L:3, M:4, N:5,       P:7,       R:9,
    S:2, T:3, U:4, V:5, W:6, X:7, Y:8, Z:9
  };

  var WEIGHTS = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];

  function clean(raw) {
    return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  /* Position 9 is a check digit derived from the other 16.
     Lets us catch a typo instantly, with no network call. */
  function checkDigitOk(vin) {
    var sum = 0;
    for (var i = 0; i < 17; i++) {
      var c = vin.charAt(i);
      var v = (c >= '0' && c <= '9') ? +c : TRANSLIT[c];
      if (v === undefined) return false;
      sum += v * WEIGHTS[i];
    }
    var expected = sum % 11;
    return vin.charAt(8) === (expected === 10 ? 'X' : String(expected));
  }

  /* Returns {state, vin}. State is one of:
       short    - still being typed
       chars    - contains a character no VIN can contain
       checksum - well formed but the check digit disagrees (soft: still decodable,
                  some imports and grey-market vehicles legitimately fail it)
       ok       - looks right */
  function inspect(raw) {
    var vin = clean(raw);
    if (vin.length < 17) return { state: 'short', vin: vin };
    if (!VALID.test(vin)) return { state: 'chars', vin: vin };
    if (!checkDigitOk(vin)) return { state: 'checksum', vin: vin };
    return { state: 'ok', vin: vin };
  }

  /* A request that cannot hang and gets one second chance.

     Without a timeout a stalled connection leaves "Looking that up…" on screen
     for as long as the browser is willing to wait, which on a phone with one
     bar is minutes. Better to give up at eight seconds, try once more, and then
     offer the manual path. The retry is worth having because the failure this
     guards against is usually a single dropped request rather than an outage. */
  var TIMEOUT_MS = 8000;

  function json(url, attempt) {
    attempt = attempt || 0;
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, TIMEOUT_MS);

    return fetch(url, ctl ? { signal: ctl.signal } : undefined)
      .then(function (r) {
        if (!r.ok) throw new Error('vpic ' + r.status);
        return r.json();
      })
      .then(function (d) { clearTimeout(timer); return d; },
            function (err) {
              clearTimeout(timer);
              if (attempt < 1) return json(url, attempt + 1);
              throw err;
            });
  }

  /* Model year from position 10, used only when vPIC returns none of its own.

     The code repeats every 30 years, and position 7 is the tie break: on a
     vehicle built 2010 or later it holds a letter, and before that a digit.
     This is never allowed to override a decoded year; it is a floor, not a
     second opinion. */
  var YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789';

  function yearFromVin(vin) {
    var at = YEAR_CODES.indexOf(vin.charAt(9));
    if (at === -1) return '';
    var seventh = vin.charAt(6);
    var modern = /[A-Z]/.test(seventh);
    var year = 1980 + at + (modern ? 30 : 0);
    // A model year more than one ahead of now is a misread, not a new vehicle.
    var ceiling = new Date().getFullYear() + 1;
    if (year > ceiling) year -= 30;
    return String(year);
  }

  /* vPIC answers with a comma separated list of codes rather than an HTTP
     status: "0" alone means a clean decode. The ones worth acting on are 1 and
     4, which say the check digit is wrong and, sometimes, what the VIN should
     have been. */
  function codesOf(r) {
    return String(r.ErrorCode || '').split(',')
      .map(function (c) { return c.trim(); })
      .filter(Boolean);
  }

  /* Driver assist, split by WHERE THE SENSOR LIVES rather than by what the
     feature is called. This is the whole point of the grouping: only a system
     that looks through the windshield is affected by replacing it.

     CAMERA systems ride on the bracket behind the rearview mirror, essentially
     without exception, so glass work means recalibration.

     MIXED systems can be camera, radar, or both fused together depending on
     make, model and year. Forward collision warning on a 2016 economy car is
     often radar alone, behind the grille, and nothing to do with the glass.
     These raise a "maybe", never a "yes".

     ELSEWHERE is listed so the record shows the system was seen and ruled out
     rather than missed. Adaptive cruise is the one that matters here: it is
     radar in the grille on most vehicles, it used to sit in the group that
     drove this flag, and it was a standing source of the false positives the
     owners reported. */
  var ADAS_CAMERA = {
    LaneDepartureWarning: 'Lane departure warning',
    LaneKeepSystem: 'Lane keeping assist',
    LaneCenteringAssistance: 'Lane centering',
    AdaptiveDrivingBeam: 'Adaptive high beam'
  };

  var ADAS_MIXED = {
    ForwardCollisionWarning: 'Forward collision warning',
    CIB: 'Crash imminent braking',
    DynamicBrakeSupport: 'Dynamic brake support',
    PedestrianAutomaticEmergencyBraking: 'Pedestrian emergency braking'
  };

  var ADAS_ELSEWHERE = {
    AdaptiveCruiseControl: 'Adaptive cruise control (usually grille radar)',
    BlindSpotMon: 'Blind spot monitor (rear quarter radar)',
    RearCrossTrafficAlert: 'Rear cross traffic alert (rear radar)',
    ParkAssist: 'Park assist (ultrasonic)',
    RearVisibilitySystem: 'Backup camera'
  };

  function fitments(r, group) {
    var out = [];
    Object.keys(group).forEach(function (field) {
      var fitted = String(r[field] || '').trim();
      // vPIC writes "Standard", "Optional", or leaves it blank / "Not Applicable".
      if (fitted === 'Standard' || fitted === 'Optional') {
        out.push({ field: field, label: group[field], fitted: fitted });
      }
    });
    return out;
  }

  /* One decoded vehicle, reduced to the fields that bear on glass. */
  function shape(r, entered) {
    var vin = r.VIN || entered || '';
    var year = r.ModelYear || (vin.length === 17 ? yearFromVin(vin) : '');
    var make = titleCase(r.Make || '');
    var model = r.Model || '';
    var codes = codesOf(r);

    // Only worth showing if it actually differs from what was typed.
    var suggested = String(r.SuggestedVIN || '').trim();
    if (!suggested || suggested === vin) suggested = '';

    return {
      vin: vin,
      year: year,
      make: make,
      model: model,
      // Series carries the body variant on several makes where Trim is blank.
      trim: r.Trim || r.Series || '',
      bodyClass: r.BodyClass || '',
      doors: r.Doors || '',
      cab: r.BodyCabType || '',
      vehicleType: r.VehicleType || '',
      driveType: r.DriveType || '',
      plant: [r.PlantCity, r.PlantCountry].filter(Boolean).join(', '),

      adas: {
        camera: fitments(r, ADAS_CAMERA),
        mixed: fitments(r, ADAS_MIXED),
        elsewhere: fitments(r, ADAS_ELSEWHERE)
      },

      // What vPIC thought of the VIN itself, kept for the owner record.
      codes: codes,
      errorText: String(r.ErrorText || '').replace(/^\d+\s*-\s*/, ''),
      suggested: suggested,
      yearFromVinOnly: !r.ModelYear && !!year,

      label: [year, make, model].filter(Boolean).join(' '),
      usable: !!(year && make && model)
    };
  }

  /* vPIC writes makes in capitals. Title casing them reads better for the
     customer, except where the name IS an initialism, and "Bmw" or "Gmc" on a
     confirmation screen is the sort of thing that makes a quote look automated
     and careless. Hyphens are already word boundaries, so Mercedes-Benz and
     Rolls-Royce come out right without help. */
  var KEEP_CAPS = {
    BMW: 1, GMC: 1, RAM: 1, MINI: 1, FIAT: 1, MG: 1, DS: 1, KTM: 1, BYD: 1,
    AM: 1, INEOS: 0
  };

  function titleCase(s) {
    var word = String(s || '').trim();
    if (KEEP_CAPS[word.toUpperCase()]) return word.toUpperCase();
    return word.toLowerCase().replace(/\b[a-z]/g, function (m) { return m.toUpperCase(); });
  }

  /* DecodeVinValuesExtended, not DecodeVinValues. Same request cost, same shape
     of answer, but it carries the full driver assist block and the body detail
     the archetype picker leans on. There is no reason to ask for less.

     vPIC is the decoder here because it is the registry US manufacturers file
     into, it is free, and it needs no key. A key would have to be shipped in
     this page, where anyone could read it, so a paid decoder is not an option
     until there is a server to hide one behind. */
  var cache = Object.create(null);

  function decode(vin) {
    if (cache[vin]) return Promise.resolve(cache[vin]);

    return json(API + '/DecodeVinValuesExtended/' + encodeURIComponent(vin) + '?format=json')
      .then(function (d) {
        var r = (d.Results && d.Results[0]) || {};
        var v = shape(r, vin);
        // Only a usable answer is worth keeping; a failure should be retried.
        if (v.usable) cache[vin] = v;
        return v;
      });
  }

  /* Fallback path for customers without a VIN in reach.
     vehicletype filters out the motorcycles and trailers vPIC otherwise returns. */
  /* Returns [{ name, types }]. The TYPES are the point, and they were being
     thrown away: this already asks vPIC three separate questions, one per
     vehicle type, and then merged the answers into a flat list of names. Which
     list a model came back in is vPIC telling us what kind of thing it is. An
     Elantra comes back under 'car' and never under 'truck', so there is no
     reason to ask a customer whether their Elantra is a pickup. */
  /* ---- the model list, shipped with the site first ----

     Built by tools/build-models.py from vPIC (and NHTSA's recall index where
     vPIC has gaps, like Scion), one small file per make. Asking vPIC live
     from the customer's phone is what failed: it has no Scion at all, and it
     answers bursts with a 403. The live lookup below is now only what happens
     if the shipped file is missing or has nothing for that year.

     DATA_V is stamped by bump.sh from the folder's contents, because this
     path is built here and nothing in index.html names it. */
  var DATA_V = '?v=f1c4c319';
  var TYPE_OF = { c: 'car', t: 'truck', m: 'mpv' };

  function slug(make) {
    return String(make).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  /* Which makes sold something in a given year, from the shipped index.
     Fetched once; null when it cannot be had, and the caller falls back to
     its full list. */
  var makesIndex = null;
  function makesFor(year) {
    if (!makesIndex) {
      makesIndex = fetch('assets/data/models/index.json' + DATA_V)
        .then(function (r) { if (!r.ok) throw new Error('no index'); return r.json(); })
        .catch(function () { makesIndex = null; return null; });
    }
    return makesIndex.then(function (idx) { return idx ? (idx[String(year)] || []) : null; });
  }

  function modelsFor(make, year) {
    return fetch('assets/data/models/' + slug(make) + '.json' + DATA_V)
      .then(function (r) { if (!r.ok) throw new Error('no list'); return r.json(); })
      .then(function (d) {
        var rows = (d.years || {})[String(year)];
        if (!rows || !rows.length) throw new Error('no year');
        return rows.map(function (row) {
          return { name: row[0], body: row[2] || null,
                   types: String(row[1] || '').split('').map(function (c) {
            return TYPE_OF[c];
          }).filter(Boolean) };
        });
      })
      .catch(function () { return modelsLive(make, year); });
  }

  function modelsLive(make, year) {
    var types = ['car', 'truck', 'mpv'];
    return Promise.all(types.map(function (t) {
      return json(API + '/GetModelsForMakeYear/make/' + encodeURIComponent(make) +
                  '/modelyear/' + encodeURIComponent(year) +
                  '/vehicletype/' + t + '?format=json')
        .then(function (d) { return { type: t, rows: d.Results || [] }; })
        .catch(function () { return { type: t, rows: [] }; });
    })).then(function (sets) {
      var seen = Object.create(null);
      sets.forEach(function (s) {
        s.rows.forEach(function (m) {
          var n = m.Model_Name;
          if (!n) return;
          /* vPIC matches the make by SUBSTRING: "Geo" also answers for
             Peugeot. Only this make's own rows. */
          var mk = String(m.Make_Name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          if (mk && mk !== String(make).toLowerCase().replace(/[^a-z0-9]/g, '')) return;
          if (!seen[n]) seen[n] = { name: n, types: [] };
          if (seen[n].types.indexOf(s.type) === -1) seen[n].types.push(s.type);
        });
      });
      return Object.keys(seen).sort().map(function (n) { return seen[n]; });
    });
  }

  /* ADAS presence, collapsed to one of: yes / maybe / no.

     Only the camera group can produce a "yes". Everything else is at most a
     "maybe", because the sensor may well be nowhere near the glass. "Standard"
     means the vehicle was built with it; "Optional" means this model could have
     been, which is a question for the customer and not a fact about their car. */
  /* No windshield camera existed on anything a customer is likely to bring in
     before about 2010: lane departure arrived on a handful of luxury cars in
     2008 and spread from there. Asking the owner of a 1994 Camaro whether there
     is a camera behind the mirror makes the site look like it is guessing,
     because it is. */
  var ADAS_FROM = 2010;

  function tooOldForAdas(v) {
    var y = parseInt((v && v.year) || '', 10);
    return !isNaN(y) && y < ADAS_FROM;
  }

  function adasState(v) {
    if (tooOldForAdas(v)) return 'no';
    var a = (v && v.adas) || {};
    var camera = a.camera || [];
    var mixed = a.mixed || [];

    function has(list, fitted) {
      return list.some(function (x) { return x.fitted === fitted; });
    }

    if (has(camera, 'Standard')) return 'yes';
    if (has(camera, 'Optional') || mixed.length) return 'maybe';
    return 'no';
  }

  /* The same finding, written out for the owners. They see the systems and
     where each one sits, so a flag can be judged rather than taken on trust. */
  function adasDetail(v) {
    var a = (v && v.adas) || {};
    var say = function (x) { return x.label + ': ' + x.fitted; };
    return {
      state: adasState(v),
      throughTheWindshield: (a.camera || []).map(say),
      couldBeEitherWay: (a.mixed || []).map(say),
      notGlassRelated: (a.elsewhere || []).map(say)
    };
  }

  global.VIN = {
    clean: clean,
    inspect: inspect,
    decode: decode,
    modelsFor: modelsFor,
    makesFor: makesFor,
    adasState: adasState,
    adasDetail: adasDetail,
    tooOldForAdas: tooOldForAdas,
    yearFromVin: yearFromVin
  };

})(window);
