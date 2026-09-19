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

  function json(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('vpic ' + r.status);
      return r.json();
    });
  }

  /* One decoded vehicle, reduced to the fields that bear on glass. */
  function shape(r) {
    var year = r.ModelYear || '';
    var make = titleCase(r.Make || '');
    var model = r.Model || '';

    return {
      vin: r.VIN || '',
      year: year,
      make: make,
      model: model,
      trim: r.Trim || r.Series || '',
      bodyClass: r.BodyClass || '',
      doors: r.Doors || '',
      cab: r.BodyCabType || '',
      vehicleType: r.VehicleType || '',
      // Standard means the vehicle has it. Optional means it might, which is a
      // question for the customer. Either way it drives ADAS recalibration.
      adas: {
        lane: r.LaneDepartureWarning || '',
        collision: r.ForwardCollisionWarning || '',
        cruise: r.AdaptiveCruiseControl || ''
      },
      label: [year, make, model].filter(Boolean).join(' '),
      usable: !!(year && make && model)
    };
  }

  function titleCase(s) {
    return s.toLowerCase().replace(/\b[a-z]/g, function (m) { return m.toUpperCase(); });
  }

  function decode(vin) {
    return json(API + '/DecodeVinValues/' + encodeURIComponent(vin) + '?format=json')
      .then(function (d) {
        var r = (d.Results && d.Results[0]) || {};
        return shape(r);
      });
  }

  /* Fallback path for customers without a VIN in reach.
     vehicletype filters out the motorcycles and trailers vPIC otherwise returns. */
  function modelsFor(make, year) {
    var types = ['car', 'truck', 'mpv'];
    return Promise.all(types.map(function (t) {
      return json(API + '/GetModelsForMakeYear/make/' + encodeURIComponent(make) +
                  '/modelyear/' + encodeURIComponent(year) +
                  '/vehicletype/' + t + '?format=json')
        .catch(function () { return { Results: [] }; });
    })).then(function (sets) {
      var seen = Object.create(null);
      sets.forEach(function (s) {
        (s.Results || []).forEach(function (m) { seen[m.Model_Name] = true; });
      });
      return Object.keys(seen).sort();
    });
  }

  /* ADAS presence, collapsed to one of: yes / maybe / no.
     A windshield replacement on a "yes" vehicle needs recalibration. */
  function adasState(v) {
    var flags = [v.adas.lane, v.adas.collision, v.adas.cruise];
    if (flags.indexOf('Standard') !== -1) return 'yes';
    if (flags.indexOf('Optional') !== -1) return 'maybe';
    return 'no';
  }

  global.VIN = {
    clean: clean,
    inspect: inspect,
    decode: decode,
    modelsFor: modelsFor,
    adasState: adasState
  };

})(window);
