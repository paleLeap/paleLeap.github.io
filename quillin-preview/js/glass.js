/* Glass taxonomy, body archetypes, and the mapping from a picked panel to the
   service Quillin actually performs.

   There is no affordable source of accurate 3D models for every vehicle, so the
   picker shows a body archetype chosen from the VIN and says so plainly. What has
   to be exactly right is the PANEL SET: a coupe genuinely has no rear door glass,
   a regular cab pickup has no rear doors, a convertible has no quarter glass.
   Getting that right per body style is the whole point of the step. */

(function (global) {
  'use strict';

  /* ---------- panels ----------
     Sides are named the way a customer and a shop both talk: driver and
     passenger, not left and right. US market, so driver is left. */

  var PANELS = {
    windshield:  { label: 'Windshield',                    service: 'windshield' },
    back_glass:  { label: 'Back glass',                    service: 'back' },
    door_fl:     { label: 'Driver front door',             service: 'door' },
    door_fr:     { label: 'Passenger front door',          service: 'door' },
    door_rl:     { label: 'Driver rear door',              service: 'door' },
    door_rr:     { label: 'Passenger rear door',           service: 'door' },
    slider_l:    { label: 'Driver sliding door',           service: 'door' },
    slider_r:    { label: 'Passenger sliding door',        service: 'door' },
    quarter_l:   { label: 'Driver quarter glass',          service: 'specialty' },
    quarter_r:   { label: 'Passenger quarter glass',       service: 'specialty' },
    vent_l:      { label: 'Driver vent glass',             service: 'specialty' },
    vent_r:      { label: 'Passenger vent glass',          service: 'specialty' },
    sunroof:     { label: 'Sunroof',                       service: 'specialty' }
  };

  /* Quillin's own service names, from their site. */
  var SERVICES = {
    windshield: 'Windshield replacement',
    back:       'Back glass replacement',
    door:       'Door glass replacement',
    specialty:  'Specialty glass'
  };

  /* ---------- archetypes ---------- */

  var P = {
    front:   ['windshield', 'door_fl', 'door_fr'],
    rearDoors: ['door_rl', 'door_rr'],
    quarters:  ['quarter_l', 'quarter_r'],
    vents:     ['vent_l', 'vent_r']
  };

  function set() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) {
      out = out.concat(arguments[i]);
    }
    return out;
  }

  var ARCHETYPES = {
    sedan: {
      label: 'sedan',
      panels: set(P.front, ['back_glass'], P.rearDoors, P.quarters, ['sunroof'])
    },
    coupe: {
      label: 'coupe',
      // No rear doors. The quarter glass is large and is a common break-in target.
      panels: set(P.front, ['back_glass'], P.quarters, ['sunroof'])
    },
    convertible: {
      label: 'convertible',
      // Soft tops carry a rear window that is still a real glass job, but there
      // is no fixed quarter glass to break.
      panels: set(P.front, ['back_glass'])
    },
    hatch: {
      label: 'hatchback',
      // Back glass here is the liftgate glass.
      panels: set(P.front, ['back_glass'], P.rearDoors, P.quarters, ['sunroof'])
    },
    suv: {
      label: 'SUV',
      panels: set(P.front, ['back_glass'], P.rearDoors, P.quarters, P.vents, ['sunroof'])
    },
    pickup: {
      label: 'pickup',
      // Rear doors depend on cab; resolved below. Back glass is the cab window.
      panels: set(P.front, ['back_glass'], P.vents)
    },
    van: {
      label: 'van',
      panels: set(P.front, ['back_glass'], ['slider_l', 'slider_r'], P.quarters, P.vents)
    },
    heavy: {
      label: 'truck',
      panels: set(P.front, ['back_glass'], P.vents)
    }
  };

  /* ---------- resolution ----------
     Matching is keyword based on purpose. vPIC writes "[SUV]" in its variable
     registry but returns "(SUV)" from a decode, and the strings drift between
     model years, so exact-match tables rot. Substrings on a normalised string
     survive that. */

  function norm(s) {
    return String(s || '').toLowerCase();
  }

  function has(hay, needle) {
    return norm(hay).indexOf(needle) !== -1;
  }

  /* Things with no automotive glass on them. Checked BEFORE the body rules,
     because nothing below matches a motorcycle and the fallback would then
     guess from the door count and draw a saloon. That is not a cosmetic
     failure: a customer on a Harley was being shown a four door car with a
     back window and asked which of its panes was broken.

     vPIC reports these in VehicleType ("MOTORCYCLE") and again in BodyClass
     ("Motorcycle - Touring/Sport Touring"), so both are tested. */
  var UNSUPPORTED = [
    { kind: 'motorcycle',
      what: 'motorcycles',
      test: function (b, t) {
        return has(t, 'motorcycle') || has(b, 'motorcycle') ||
               has(b, 'moped') || has(b, 'scooter');
      } },
    { kind: 'offroad',
      what: 'ATVs and off road vehicles',
      test: function (b, t) {
        return has(b, 'all-terrain') || has(b, 'atv') || has(b, 'snowmobile') ||
               has(t, 'off road') || has(t, 'offroad');
      } },
    { kind: 'trailer',
      what: 'trailers',
      test: function (b, t) { return has(t, 'trailer') || has(b, 'trailer'); } }
  ];

  /* Ordered. First hit wins, so the specific sits above the general:
     "Sport Utility Truck" must beat "truck", "minivan" must beat "van". */
  var RULES = [
    { id: 'heavy',       test: function (b, t) { return has(b, 'truck-tractor') || has(b, 'tractor') || has(t, 'truck ') && has(b, 'incomplete'); } },
    { id: 'heavy',       test: function (b) { return has(b, 'chassis cab') || has(b, 'motorhome') || has(b, 'step van') || has(b, 'walk-in'); } },
    { id: 'suv',         test: function (b) { return has(b, 'sport utility truck') || has(b, '[sut]') || has(b, '(sut)'); } },
    { id: 'pickup',      test: function (b) { return has(b, 'pickup'); } },
    { id: 'suv',         test: function (b) { return has(b, 'sport utility') || has(b, 'suv') || has(b, 'crossover') || has(b, 'cuv') || has(b, 'mpv') || has(b, 'multipurpose') || has(b, 'multi-purpose'); } },
    { id: 'van',         test: function (b) { return has(b, 'van'); } },
    { id: 'convertible', test: function (b) { return has(b, 'convertible') || has(b, 'cabriolet') || has(b, 'roadster'); } },
    { id: 'hatch',       test: function (b) { return has(b, 'hatchback') || has(b, 'liftback') || has(b, 'notchback') || has(b, 'wagon'); } },
    { id: 'coupe',       test: function (b) { return has(b, 'coupe'); } },
    { id: 'sedan',       test: function (b) { return has(b, 'sedan') || has(b, 'saloon') || has(b, 'limousine'); } },
    { id: 'heavy',       test: function (b) { return has(b, 'truck'); } }
  ];

  /* Regular and extended cabs have no rear door glass. Crew cabs do.
     vPIC's cab strings: "Regular", "Extra/Super/Quad/Double/King/Extended",
     "Crew/Super Crew/Crew Max", "Mega", and the MDHD: family for big rigs. */
  function cabKind(cab, doors) {
    var c = norm(cab);
    if (has(c, 'crew') || has(c, 'mega')) return 'crew';
    if (has(c, 'extra') || has(c, 'super') || has(c, 'quad') ||
        has(c, 'double') || has(c, 'king') || has(c, 'extended')) return 'extended';
    if (has(c, 'regular')) return 'regular';
    // No cab string. Door count is the next best signal.
    if (doors >= 4) return 'crew';
    if (doors === 2) return 'regular';

    /* Nothing at all, which is every pickup entered by hand: there is no cab
       string and no door count either. Assume a crew cab.

       Not a coin toss. Crew cabs are most of what is sold, and the two
       mistakes are not equal: offering rear door glass to someone whose truck
       has none costs them a glance, while withholding it from someone whose
       rear window is the broken one leaves them unable to say so at all. The
       caller marks this as not confident, so the flow still knows it guessed. */
    return 'crew';
  }

  /* Returns { id, label, panels, cab, confident, why }.
     `confident` false means we guessed, and the UI should offer a way out. */
  function resolve(vehicle) {
    var v = vehicle || {};
    var body = v.bodyClass || '';
    var type = v.vehicleType || '';
    var doors = parseInt(v.doors, 10);
    if (isNaN(doors)) doors = 0;

    for (var u = 0; u < UNSUPPORTED.length; u++) {
      if (UNSUPPORTED[u].test(body, type)) {
        return {
          id: null, unsupported: true,
          kind: UNSUPPORTED[u].kind, what: UNSUPPORTED[u].what,
          label: body || type || 'that vehicle',
          panels: [], cab: '', confident: true, why: body || type
        };
      }
    }

    /* The customer's own answer outranks everything. It is the only source here
       that has actually seen the vehicle. */
    if (v.bodyStyle && ARCHETYPES[v.bodyStyle]) {
      var chosen = ARCHETYPES[v.bodyStyle];
      return finish(v.bodyStyle, chosen, doors, v, true, 'told us');
    }

    var id = null;
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i].test(body, type)) { id = RULES[i].id; break; }
    }

    var confident = !!id;
    var why = body || '';

    if (!id) {
      /* Nothing matched, and nothing here has seen the car. Rather than draw a
         saloon and hope, say so: the caller asks the customer which body style
         it is, and their answer comes back through v.bodyStyle above. Guessing
         from the door count was silently wrong for every pickup and van that
         arrived through the no-VIN path, where there is no door count either. */
      return {
        id: null, needsBody: true,
        label: 'vehicle', panels: [], cab: '', confident: false,
        why: doors ? doors + '-door, body style unknown' : 'no body style'
      };
    }

    // A 4-door "coupe" is a data error somewhere. Trust the door count.
    if (id === 'coupe' && doors >= 4) { id = 'sedan'; confident = false; }
    if (id === 'sedan' && doors === 2) { id = 'coupe'; }

    return finish(id, ARCHETYPES[id], doors, v, confident, why);
  }

  /* The panel set, once the body style is settled, from whichever route settled
     it. Shared so a style the customer told us gets exactly the same treatment
     as one the VIN gave us, cab handling included. */
  function finish(id, arch, doors, v, confident, why) {
    var panels = arch.panels.slice();
    var cab = '';

    if (id === 'pickup') {
      var toldCab = !!(v.cab || doors);
      cab = cabKind(v.cab, doors);
      if (cab === 'crew') panels = panels.concat(P.rearDoors);
      if (cab === 'extended') panels = panels.concat(P.quarters);
      if (!toldCab) confident = false;   // crew was assumed, not established
    }

    if (id === 'heavy') cab = cabKind(v.cab, doors);

    return {
      id: id,
      label: arch.label,
      panels: panels,
      cab: cab,
      confident: confident,
      why: why
    };
  }

  /* ---------- panel -> service ----------
     What Quillin would actually do about the glass the customer picked. */

  function servicesFor(panelIds, vehicle) {
    var kinds = {};
    (panelIds || []).forEach(function (p) {
      if (PANELS[p]) kinds[PANELS[p].service] = true;
    });

    var out = [];
    ['windshield', 'back', 'door', 'specialty'].forEach(function (k) {
      if (kinds[k]) out.push(SERVICES[k]);
    });

    // ADAS rides along with the windshield, never on its own.
    if (kinds.windshield && vehicle && global.VIN &&
        global.VIN.adasState(vehicle) === 'yes') {
      out.push('ADAS recalibration');
    }
    return out;
  }

  function labelFor(panelId) {
    return PANELS[panelId] ? PANELS[panelId].label : panelId;
  }

  function labelsFor(panelIds) {
    return (panelIds || []).map(labelFor);
  }

  global.Glass = {
    PANELS: PANELS,
    SERVICES: SERVICES,
    ARCHETYPES: ARCHETYPES,
    resolve: resolve,
    servicesFor: servicesFor,
    labelFor: labelFor,
    labelsFor: labelsFor
  };

})(window);
