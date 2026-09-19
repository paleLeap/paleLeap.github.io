/* Procedural vehicle archetypes.

   WHY GENERATED AND NOT DOWNLOADED
   The hard requirement of this step is that every piece of glass is its own
   named, separately pickable mesh, positioned correctly for the body style.
   A downloaded car model gives you a nice car and exactly the wrong thing:
   its glass is usually one merged mesh, or baked into the body, and splitting
   it into thirteen correctly identified panels is manual work that has to be
   redone from scratch every time a model is swapped. Generating the geometry
   makes the panel names true by construction, costs no licensing, and keeps
   all eight archetypes in one visual language.

   COORDINATES
   x  length, +x is the front of the vehicle, centred on 0
   y  height, 0 is the ground
   z  width,  -z is the DRIVER side, +z the passenger side (US, driver left)

              Worth deriving rather than trusting: three.js is right handed, so
              with the nose at +x and up at +y, the left hand of someone sitting
              in the car points along (up x forward) = (0,1,0) x (1,0,0) = -z.
              This file used to claim the opposite, and every side panel was
              built mirrored: the driver's door sat on the passenger's side.

   AUTHORING
   Profiles are written in normalised units so one table describes every body
   style. `u` runs 0 at the front bumper to 1 at the rear bumper. `y` is a
   fraction of overall height. Everything is scaled to metres at build time.

   Silhouettes are corner-rounded rather than drawn as straight polygons: every
   vertex becomes a quadratic arc whose radius is `round`, which is what stops
   these reading as boxes. Profiles carry more vertices than strictly needed so
   those arcs have something to follow. */

import * as THREE from '../vendor/three/three.module.js';
import { toCreasedNormals } from '../vendor/three/BufferGeometryUtils.js';
import { LineSegmentsGeometry } from '../vendor/three/LineSegmentsGeometry.js';
import { LineSegments2 } from '../vendor/three/LineSegments2.js';
import { LineMaterial } from '../vendor/three/LineMaterial.js';

/* A side profile is authored once and mirrored, so the table below keys on the
   shared base name. These are the panel ids each base produces, driver first.
   Spelled out rather than concatenated: 'door_f' + '_' + 'l' would give
   'door_f_l', which is not what the taxonomy in glass.js calls that pane, and
   the mismatch silently drops the panel instead of failing loudly. */
const SIDE_IDS = {
  door_f:  ['door_fl',   'door_fr'],
  door_r:  ['door_rl',   'door_rr'],
  quarter: ['quarter_l', 'quarter_r'],
  vent:    ['vent_l',    'vent_r'],
  slider:  ['slider_l',  'slider_r']
};

/* ---------- archetype table ---------- */

const ARCHETYPES = {

  /* Modern saloon: long wheelbase, short overhangs, raked screen, fast tail. */
  sedan: {
    length: 4.92, width: 1.84, height: 1.445, cabinWidth: 0.945,
    round: 0.032, cabinRound: 0.022,
    body: [[0.035,0.14],[0.015,0.30],[0.030,0.44],[0.085,0.53],[0.20,0.59],
           [0.36,0.635],[0.62,0.655],[0.84,0.645],[0.935,0.575],[0.975,0.44],
           [0.965,0.14]],
    cabin: [[0.350,0.600],[0.505,0.990],[0.715,0.990],[0.890,0.625]],
    pillars: { cowl:[0.350,0.600], roofFront:[0.505,0.990], roofRear:[0.715,0.990], deck:[0.890,0.625] },
    wheels: [{u:0.201},{u:0.775}], wheelR: 0.334, tyre: 0.128,
    side: {
      door_f:  [[0.398,0.648],[0.512,0.958],[0.576,0.958],[0.576,0.648]],
      door_r:  [[0.592,0.648],[0.592,0.958],[0.700,0.958],[0.700,0.648]],
      quarter: [[0.716,0.648],[0.716,0.958],[0.778,0.918],[0.764,0.648]]
    }
  },

  /* Coupe: one long door, fast roof, big fixed quarter. */
  coupe: {
    length: 4.75, width: 1.87, height: 1.39, cabinWidth: 0.94,
    round: 0.032, cabinRound: 0.022,
    body: [[0.035,0.14],[0.015,0.30],[0.030,0.44],[0.080,0.53],[0.20,0.59],
           [0.34,0.635],[0.62,0.655],[0.86,0.645],[0.945,0.575],[0.975,0.44],
           [0.965,0.14]],
    cabin: [[0.320,0.600],[0.492,0.990],[0.648,0.990],[0.908,0.630]],
    pillars: { cowl:[0.320,0.600], roofFront:[0.492,0.990], roofRear:[0.648,0.990], deck:[0.908,0.630] },
    wheels: [{u:0.196},{u:0.782}], wheelR: 0.345, tyre: 0.132,
    side: {
      door_f:  [[0.372,0.648],[0.500,0.958],[0.634,0.958],[0.634,0.648]],
      quarter: [[0.650,0.648],[0.650,0.952],[0.778,0.876],[0.756,0.648]]
    }
  },

  convertible: {
    length: 4.60, width: 1.85, height: 1.34, cabinWidth: 0.94,
    round: 0.032, cabinRound: 0.022,
    body: [[0.035,0.14],[0.015,0.30],[0.030,0.44],[0.080,0.53],[0.20,0.59],
           [0.34,0.635],[0.62,0.655],[0.86,0.645],[0.945,0.575],[0.975,0.44],
           [0.965,0.14]],
    cabin: [[0.330,0.625],[0.490,0.945],[0.650,0.945],[0.885,0.650]],
    pillars: { cowl:[0.330,0.625], roofFront:[0.490,0.945], roofRear:[0.650,0.945], deck:[0.885,0.650] },
    wheels: [{u:0.198},{u:0.784}], wheelR: 0.345, tyre: 0.132,
    // No fixed quarter glass on a soft top. Door glass only.
    side: {
      door_f:  [[0.376,0.672],[0.500,0.905],[0.632,0.905],[0.632,0.672]]
    }
  },

  hatch: {
    length: 4.35, width: 1.80, height: 1.47, cabinWidth: 0.945,
    round: 0.032, cabinRound: 0.022,
    body: [[0.035,0.14],[0.015,0.31],[0.032,0.45],[0.090,0.54],[0.21,0.60],
           [0.36,0.635],[0.62,0.655],[0.88,0.655],[0.955,0.600],[0.975,0.46],
           [0.965,0.14]],
    cabin: [[0.345,0.600],[0.492,0.990],[0.778,0.990],[0.936,0.660]],
    pillars: { cowl:[0.345,0.600], roofFront:[0.492,0.990], roofRear:[0.778,0.990], deck:[0.936,0.660] },
    wheels: [{u:0.207},{u:0.795}], wheelR: 0.325, tyre: 0.128,
    side: {
      door_f:  [[0.394,0.648],[0.500,0.958],[0.570,0.958],[0.570,0.648]],
      door_r:  [[0.586,0.648],[0.586,0.958],[0.712,0.958],[0.712,0.648]],
      quarter: [[0.728,0.648],[0.728,0.958],[0.812,0.938],[0.800,0.648]]
    }
  },

  /* Tall glasshouse, near-vertical tailgate: what stops this reading as a
     long saloon. */
  suv: {
    length: 4.70, width: 1.87, height: 1.69, cabinWidth: 0.95,
    round: 0.032, cabinRound: 0.022,
    body: [[0.035,0.12],[0.015,0.28],[0.030,0.40],[0.075,0.47],[0.19,0.51],
           [0.36,0.535],[0.62,0.545],[0.88,0.545],[0.945,0.520],[0.965,0.44],
           [0.960,0.12]],
    cabin: [[0.275,0.525],[0.425,0.985],[0.865,0.985],[0.945,0.570]],
    pillars: { cowl:[0.275,0.525], roofFront:[0.425,0.985], roofRear:[0.865,0.985], deck:[0.945,0.570] },
    wheels: [{u:0.202},{u:0.778}], wheelR: 0.370, tyre: 0.132,
    side: {
      // Upright glasshouse, so a real vent triangle ahead of the front door.
      vent:    [[0.362,0.572],[0.400,0.940],[0.430,0.940],[0.430,0.572]],
      door_f:  [[0.444,0.572],[0.444,0.940],[0.578,0.940],[0.578,0.572]],
      door_r:  [[0.592,0.572],[0.592,0.940],[0.726,0.940],[0.726,0.572]],
      quarter: [[0.740,0.572],[0.740,0.940],[0.856,0.930],[0.848,0.572]]
    }
  },

  pickup: {
    length: 5.89, width: 2.03, height: 1.95, cabinWidth: 0.93,
    round: 0.032, cabinRound: 0.022,
    // index 4 and 5 are the bed wall, rewritten per cab in buildVehicle()
    body: [[0.030,0.13],[0.012,0.29],[0.028,0.42],[0.075,0.50],[0.60,0.545],
           [0.625,0.760],[0.965,0.760],[0.968,0.42],[0.960,0.13]],
    cabin: [[0.265,0.535],[0.395,0.965],[0.600,0.965],[0.600,0.545]],
    pillars: { cowl:[0.265,0.535], roofFront:[0.395,0.965], roofRear:[0.600,0.965], deck:[0.600,0.600] },
    wheels: [{u:0.153},{u:0.780}], wheelR: 0.407, tyre: 0.140,
    side: {
      vent:    [[0.330,0.592],[0.368,0.928],[0.396,0.928],[0.396,0.592]],
      door_f:  [[0.410,0.592],[0.410,0.928],[0.538,0.928],[0.538,0.592]]
    },
    /* Cab length drives everything behind the front door, and the bed wall has
       to begin BEHIND the cab. Left at its regular-cab position it slices
       straight through a crew cab's rear door glass. */
    cabs: {
      regular:  { cabinRear: 0.600, bedStart: 0.625, side: {} },
      extended: { cabinRear: 0.700, bedStart: 0.725, side: {
        quarter: [[0.552,0.592],[0.552,0.928],[0.688,0.928],[0.688,0.592]]
      }},
      crew:     { cabinRear: 0.782, bedStart: 0.805, side: {
        door_r:  [[0.552,0.592],[0.552,0.928],[0.678,0.928],[0.678,0.592]],
        quarter: [[0.692,0.592],[0.692,0.928],[0.766,0.928],[0.766,0.592]]
      }}
    }
  },

  /* One box: short steep nose, tall slab sides, vertical back doors. */
  van: {
    length: 5.17, width: 1.99, height: 1.74, cabinWidth: 0.955,
    round: 0.032, cabinRound: 0.022,
    body: [[0.030,0.11],[0.012,0.26],[0.026,0.37],[0.062,0.44],[0.15,0.475],
           [0.40,0.495],[0.70,0.500],[0.93,0.500],[0.958,0.470],[0.968,0.38],
           [0.960,0.11]],
    cabin: [[0.150,0.480],[0.300,0.985],[0.920,0.985],[0.952,0.545]],
    pillars: { cowl:[0.150,0.480], roofFront:[0.300,0.985], roofRear:[0.920,0.985], deck:[0.952,0.545] },
    wheels: [{u:0.189},{u:0.781}], wheelR: 0.370, tyre: 0.130,
    side: {
      vent:    [[0.272,0.548],[0.304,0.942],[0.332,0.942],[0.332,0.548]],
      door_f:  [[0.346,0.548],[0.346,0.942],[0.470,0.942],[0.470,0.548]],
      slider:  [[0.484,0.548],[0.484,0.942],[0.708,0.942],[0.708,0.548]],
      quarter: [[0.722,0.548],[0.722,0.942],[0.902,0.942],[0.898,0.548]]
    }
  },

  /* Cab over engine: almost everything is glasshouse, very upright. */
  heavy: {
    length: 6.50, width: 2.48, height: 3.30, cabinWidth: 0.95,
    round: 0.032, cabinRound: 0.022,
    body: [[0.025,0.09],[0.012,0.24],[0.028,0.34],[0.055,0.395],[0.30,0.410],
           [0.470,0.415],[0.500,0.630],[0.968,0.630],[0.970,0.34],[0.962,0.09]],
    cabin: [[0.055,0.400],[0.090,0.965],[0.478,0.965],[0.478,0.420]],
    pillars: { cowl:[0.055,0.400], roofFront:[0.090,0.965], roofRear:[0.478,0.965], deck:[0.478,0.470] },
    wheels: [{u:0.140},{u:0.700},{u:0.838}], wheelR: 0.520, tyre: 0.178,
    side: {
      vent:    [[0.126,0.448],[0.146,0.908],[0.182,0.908],[0.182,0.448]],
      door_f:  [[0.196,0.448],[0.196,0.908],[0.428,0.908],[0.428,0.448]]
    }
  }
};

/* ---------- materials ----------
   One accent only. Glass is neutral until it is hovered or picked, then it is
   red: light on hover, dark on select. Nothing else on the vehicle carries a
   colour, so the only thing competing for attention is the answer. */

/* Real car paint, not flat grey. Clearcoat is the property built for exactly
   this: a thin reflective lacquer over a metallic base.

   The colour choice is doing structural work. A pale matte surface shows every
   facet and every wobble in a generated curve. A dark metallic one with a
   clearcoat shows REFLECTIONS instead, and reflections travelling over a slightly
   imperfect surface read as a highlight rolling along a panel rather than as bad
   geometry. Going darker hid more of the jank than any amount of extra polygons.

   One accent only. Glass is neutral until hovered or picked, then red. */
const MAT = {
  /* Fills are unlit near-black. They are not there to be seen; they are there so
     the vehicle occludes itself. Without them you see straight through to the
     far side's glass and cannot tell which door you are about to pick. */
  fill: () => new THREE.MeshBasicMaterial({
    // A shade off the stage, so the body still reads as a mass and not a hole
    color: 0x0c1116, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
  }),
  glass: () => new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.05, toneMapped: false,
    side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
  })
};

/* Line widths are in world-ish screen pixels via LineMaterial, not the GL
   `linewidth` that every desktop driver silently clamps to 1. At a device pixel
   ratio of 2 a clamped line is half a CSS pixel and reads as grey mush, which is
   the opposite of sharp. */
function lineMat(color, width, opacity) {
  return new LineMaterial({
    color, linewidth: width, transparent: opacity < 1, opacity,
    toneMapped: false, dashed: false, alphaToCoverage: false
  });
}

/* EdgesGeometry with a threshold angle is the whole trick for hiding the jank.
   At 1 degree it draws every triangle boundary and a rounded body turns into a
   mesh of noise. At 24 it draws only real creases: the profile, the wheel arches,
   the sills. Smooth curves contribute nothing, so nothing about their
   tessellation can look wrong. */
function edgesOf(geometry, material, threshold) {
  const e = new THREE.EdgesGeometry(geometry, threshold);
  const g = new LineSegmentsGeometry().fromEdgesGeometry(e);
  const seg = new LineSegments2(g, material);
  seg.computeLineDistances();
  e.dispose();
  return seg;
}

/* ---------- helpers ---------- */

/* Normalised (u, y) to world (x, y). u = 0 at the front bumper. */
function place(spec, u, y) {
  return [spec.length * (0.5 - u), y * spec.height];
}

/* Closed silhouette with every corner replaced by a quadratic arc. This is what
   separates a car from a wedge; a straight polygon at this scale always reads
   as folded cardboard. Each arc is clamped to half its shorter edge so tight
   corners degrade to a crease instead of overshooting into a loop. */
function roundedShape(pts, radius) {
  const n = pts.length;
  const at = i => pts[((i % n) + n) % n];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const len = v => Math.hypot(v[0], v[1]) || 1e-6;
  const unit = v => { const l = len(v); return [v[0] / l, v[1] / l]; };

  const shape = new THREE.Shape();
  const first = at(0), second = at(1);
  shape.moveTo((first[0] + second[0]) / 2, (first[1] + second[1]) / 2);

  for (let i = 1; i <= n; i++) {
    const prev = at(i - 1), cur = at(i), next = at(i + 1);
    const vIn = sub(cur, prev), vOut = sub(next, cur);
    const dIn = Math.min(radius, len(vIn) / 2);
    const dOut = Math.min(radius, len(vOut) / 2);
    const uIn = unit(vIn), uOut = unit(vOut);

    shape.lineTo(cur[0] - uIn[0] * dIn, cur[1] - uIn[1] * dIn);
    shape.quadraticCurveTo(cur[0], cur[1],
                           cur[0] + uOut[0] * dOut, cur[1] + uOut[1] * dOut);
  }
  shape.closePath();
  return shape;
}

/* Wheel arches, cut into the underside of the body silhouette.

   Without these the wheels are simply hidden behind a solid flank and read as
   small dark dots below the sill. The arch is what lets a wheel sit IN the body
   instead of behind it, and it is most of what makes the shape look like a car
   rather than a lozenge on castors. */
function archPath(centreX, r, bottomY) {
  const pts = [];
  const STEPS = 14;
  for (let i = 0; i <= STEPS; i++) {
    const t = Math.PI - (Math.PI * i) / STEPS;   // pi -> 0, so x runs rear to front
    pts.push([centreX + r * Math.cos(t), bottomY + r * Math.sin(t)]);
  }
  return pts;
}

function profileShape(spec, pts, radius, closeAtY, arches) {
  const world = pts.map(([u, y]) => place(spec, u, y));

  if (closeAtY !== undefined) {
    const bottomY = closeAtY * spec.height;
    const rearX = world[world.length - 1][0];
    const frontX = world[0][0];
    world.push([rearX, bottomY]);

    // travelling along the underside from rear to front, so increasing x
    (arches || []).slice().sort((a, b) => a.x - b.x).forEach(a => {
      archPath(a.x, a.r, bottomY).forEach(p => world.push(p));
    });

    world.push([frontX, bottomY]);
  }
  return roundedShape(world, radius * spec.height);
}

/* ExtrudeGeometry returns NON-INDEXED geometry, so computeVertexNormals gives
   every triangle its own flat normal and each curve renders as a fan of plates.
   That faceting is the single biggest reason these read as blocky, and no amount
   of extra segments fixes it on its own.

   toCreasedNormals welds the vertices and smooths across them, but only where
   the angle between faces is under the crease threshold. Curves go smooth; the
   shoulder line, the sill and the tailgate stay sharp. */
const CREASE = THREE.MathUtils.degToRad(42);

function extrude(shape, depth, bevel) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    /* ONE bevel segment, not six. Nothing is shaded any more, so a smooth
       rolled edge buys nothing and costs everything: six shallow steps put no
       single angle above the edge threshold, so the body's own profile never
       got drawn and the car had no silhouette. A single chamfer gives two clean
       parallel creases that read as a panel line. */
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel,
    bevelSize: bevel, bevelSegments: 1, curveSegments: 30
  });
  geo.translate(0, 0, -depth / 2);
  return toCreasedNormals(geo, CREASE);
}

/* Pulls a panel's corners toward its own centre so neighbouring panes never
   touch. The dark greenhouse shows through the gap and reads as the pillar
   between them, which is what gives the selection a clean edge. */
function insetQuad(corners, amount) {
  let cx = 0, cy = 0;
  corners.forEach(([x, y]) => { cx += x; cy += y; });
  cx /= corners.length; cy /= corners.length;
  return corners.map(([x, y]) => {
    const dx = cx - x, dy = cy - y;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(amount, d * 0.35);
    return [x + (dx / d) * k, y + (dy / d) * k];
  });
}

/* Sutherland-Hodgman clip of a polygon against a convex one, with every clip
   edge pushed inward by `inset` first.

   This is what stops the glass floating off the car or poking through it. An
   authored pane is a rectangle, but the greenhouse it sits in is a trapezoid
   with a raked A-pillar and a sloped tailgate, so a rectangle's corners hang
   over the edge into thin air. Clipping each pane to the greenhouse outline
   makes the front door glass follow the A-pillar automatically, and guarantees
   no pane can ever extend past the surface it is supposed to lie on. */
function clipToConvex(poly, clip, inset) {
  // winding sign, so "inward" is correct whichever way the clip poly is wound
  let area = 0;
  for (let i = 0; i < clip.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const sign = area >= 0 ? 1 : -1;

  let out = poly;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i], b = clip[(i + 1) % clip.length];
    let nx = -(b[1] - a[1]) * sign, ny = (b[0] - a[0]) * sign;
    const l = Math.hypot(nx, ny) || 1;
    nx /= l; ny /= l;                       // inward normal of this edge
    const px = a[0] + nx * inset, py = a[1] + ny * inset;
    const side = pt => (pt[0] - px) * nx + (pt[1] - py) * ny;

    const next = [];
    for (let j = 0; j < out.length; j++) {
      const cur = out[j], prv = out[(j + out.length - 1) % out.length];
      const dc = side(cur), dp = side(prv);
      if (dc >= 0) {
        if (dp < 0) next.push(lerpTo(prv, cur, dp / (dp - dc)));
        next.push(cur);
      } else if (dp >= 0) {
        next.push(lerpTo(prv, cur, dp / (dp - dc)));
      }
    }
    out = next;
  }
  return out;
}

function lerpTo(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/* Corner radius for a pane, as a fraction of the vehicle's height. Real side
   glass is a rounded shape in an aperture, never a sharp-cornered rectangle, and
   sharp corners are most of what made these read as stickers laid on the body. */
const PANE_ROUND = 0.055;

/* A glass panel from four (u, y) corners, laid on a side plane with its corners
   rounded. */
function sidePanel(spec, quad, z, inset, cabinPoly, edgeInset) {
  let world = insetQuad(quad.map(([u, y]) => place(spec, u, y)), inset);
  world = clipToConvex(world, cabinPoly, edgeInset);
  if (world.length < 3) return null;
  const shape = roundedShape(world, PANE_ROUND * spec.height);
  const geo = new THREE.ShapeGeometry(shape, 8);
  geo.translate(0, 0, z);
  return geo;
}

/* A glass panel spanning the vehicle width, from two profile points.
   Used for the windshield and the back glass, which both follow a pillar line.

   The panel has to be nudged OUT along the pillar's normal, or it lands exactly
   on the greenhouse silhouette and is swallowed by the extrude bevel. Which of
   the two normals points outward is decided by stepping away from the cabin's
   own centroid, so it stays correct for a raked windshield and an upright one. */
function spanPanel(spec, a, b, halfWidth, cabinCentre, out, inset) {
  let [ax, ay] = place(spec, a[0], a[1]);
  let [bx, by] = place(spec, b[0], b[1]);

  let nx = by - ay, ny = -(bx - ax);
  const len = Math.hypot(nx, ny) || 1;
  nx /= len; ny /= len;

  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  if ((mx - cabinCentre[0]) * nx + (my - cabinCentre[1]) * ny < 0) { nx = -nx; ny = -ny; }

  // shorten the pane along the pillar so it stops short of roof and cowl
  const dx = bx - ax, dy = by - ay;
  const dl = Math.hypot(dx, dy) || 1;
  const k = Math.min(inset, dl * 0.2);
  ax += (dx / dl) * k; ay += (dy / dl) * k;
  bx -= (dx / dl) * k; by -= (dy / dl) * k;

  /* Built flat in its own (along-pillar, across-width) plane so the corners can
     be rounded with the same routine as the side glass, then rotated onto the
     pillar line. Doing it this way keeps the windshield and the door glass
     visibly the same kind of object. */
  const L = Math.hypot(bx - ax, by - ay);
  const w = halfWidth - inset;
  const shape = roundedShape(
    [[0, -w], [L, -w], [L, w], [0, w]],
    PANE_ROUND * spec.height
  );
  const geo = new THREE.ShapeGeometry(shape, 8);

  // local +x runs along the pillar, local +y becomes world z (the vehicle width)
  const ux = (bx - ax) / dl, uy = (by - ay) / dl;
  const m = new THREE.Matrix4().set(
    ux, 0, -uy, ax + nx * out,
    uy, 0,  ux, ay + ny * out,
     0, 1,   0, 0,
     0, 0,   0, 1
  );
  geo.applyMatrix4(m);
  geo.computeVertexNormals();
  return geo;
}

function quadGeo(v) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  geo.computeVertexNormals();
  return geo;
}

function glassMesh(geo, panelId) {
  const mat = MAT.glass();
  const m = new THREE.Mesh(geo, mat);
  m.name = panelId;
  m.userData.panel = panelId;   // what the raycaster reports back
  m.userData.glassMat = mat;    // the picker swaps material on hover and select
  /* Its own outline, brighter and heavier than the body, because the windows
     are the thing being chosen and everything else is context. threshold 1 on a
     flat pane returns exactly its boundary. */
  const outlineMat = lineMat(0xffffff, 2.6, 1.0);
  const outline = edgesOf(geo, outlineMat, 1);
  outline.raycast = () => {};
  m.userData.outline = outline;
  m.userData.outlineMat = outlineMat;
  return m;
}

/* ---------- build ---------- */

/* Returns { group, panels } where panels is a map of panel id to mesh.
   `wanted` is the panel list from Glass.resolve, so the model only ever shows
   glass the resolver says this body style actually has. */
export function buildVehicle(archetypeId, cab, wanted) {
  const base = ARCHETYPES[archetypeId] || ARCHETYPES.sedan;
  const spec = Object.assign({}, base);
  const want = new Set(wanted || []);

  // Pickups reshape behind the front door depending on cab.
  let side = Object.assign({}, spec.side);
  let cabin = spec.cabin.map(p => p.slice());
  let pillars = Object.assign({}, spec.pillars);

  if (spec.cabs) {
    const variant = spec.cabs[cab] || spec.cabs.crew;
    side = Object.assign({}, side, variant.side);
    cabin[2] = [variant.cabinRear, cabin[2][1]];
    cabin[3] = [variant.cabinRear, cabin[3][1]];
    pillars = Object.assign({}, pillars, {
      roofRear: [variant.cabinRear, pillars.roofRear[1]],
      deck:     [variant.cabinRear, pillars.deck[1]]
    });
    spec.body = spec.body.map(p => p.slice());
    spec.body[4] = [variant.bedStart - 0.025, spec.body[4][1]];
    spec.body[5] = [variant.bedStart,         spec.body[5][1]];
  }

  const group = new THREE.Group();
  const panels = {};
  // Sits on the skin. Depth separation is handled by polygonOffset, not distance.
  const eps = 0.0015;

  /* An ExtrudeGeometry with a bevel is WIDER than its `depth`: the bevel adds
     bevelThickness at each end. Every surface offset below is computed from
     these true outer half-widths, not from the nominal depth. Getting this
     wrong buries the glass inside the greenhouse, where it is invisible and
     unpickable, and hides the wheels inside the body. */
  /* Keep these small. bevelSize also pushes the silhouette OUTWARD in plane, so
     a generous bevel does not soften the shape, it inflates it, and the car
     turns into a bar of soap. */
  const BEVEL_BODY = spec.width * 0.018;
  const BEVEL_CABIN = spec.width * 0.011;

  const bodyDepth = spec.width - BEVEL_BODY * 2;
  const bodyOuter = bodyDepth / 2 + BEVEL_BODY;

  const cabinDepth = spec.width * spec.cabinWidth - BEVEL_CABIN * 2;
  const cabinOuter = cabinDepth / 2 + BEVEL_CABIN;

  /* One shared material per line weight, so the picker can set `resolution` on
     all of them in one pass when the stage resizes. */
  const lines = {
    frame:  lineMat(0xdfe7ee, 2.0, 0.92),   // the vehicle's own structure
    detail: lineMat(0x8b97a3, 1.4, 0.75)    // wheels, mirrors, lamps
  };
  group.userData.lineMaterials = Object.values(lines);

  /* A solid is a near-black fill for occlusion plus the creases that actually
     describe it. */
  function addSolid(geo, name, mat, threshold, pos) {
    const mesh = new THREE.Mesh(geo, MAT.fill());
    mesh.name = name;
    const seg = edgesOf(geo, mat, threshold);
    seg.name = name + '_edges';
    seg.raycast = () => {};      // lines must never intercept a pick
    if (pos) { mesh.position.set(pos[0], pos[1], pos[2]); seg.position.copy(mesh.position); }
    group.add(mesh);
    group.add(seg);
    return mesh;
  }

  // lower body, with an arch cut under each axle
  const arches = spec.wheels.map(w => ({
    x: place(spec, w.u, 0)[0],
    r: spec.wheelR * 1.16
  }));
  addSolid(
    extrude(profileShape(spec, spec.body, spec.round, 0.13, arches), bodyDepth, BEVEL_BODY),
    'body', lines.frame, 14
  );

  // greenhouse, narrower than the body so the glass reads as inset
  addSolid(
    extrude(profileShape(spec, cabin, spec.cabinRound), cabinDepth, BEVEL_CABIN),
    'cabin', lines.frame, 14
  );

  /* Where the greenhouse skin actually is. Verified by raycasting the built
     mesh rather than read off the docs, because the first reading was backwards
     and buried every pane inside the body.

     For a bevelled ExtrudeGeometry the WALL is the profile pushed OUT by
     bevelSize, and it spans z from -depth/2 to +depth/2. The END CAPS sit
     further out, at depth/2 + bevelThickness, but their outline comes back in
     to the original profile.

     So: windshield and back glass lie on the wall, and must be offset outward by
     bevelSize and kept no wider than depth/2. Side glass lies on a cap, so it is
     offset to depth/2 + bevelThickness and clipped to the original profile. */
  const capHalf = cabinDepth / 2 + BEVEL_CABIN;   // the flat side face
  const capInset = 0;                             // cap outline is the profile
  const wallHalf = cabinDepth / 2;                // widest point of the wall
  const wallOut = BEVEL_CABIN;                    // how far the wall bulges

  const cabinPoly = cabin.map(([u, y]) => place(spec, u, y));

  // centre of the greenhouse in profile space, for outward normals
  const cabinCentre = (() => {
    let sx = 0, sy = 0;
    cabin.forEach(([u, y]) => { const [x, wy] = place(spec, u, y); sx += x; sy += wy; });
    return [sx / cabin.length, sy / cabin.length];
  })();

  // wheels
  const tyreW = spec.width * (spec.tyre || 0.11);
  const tyreGeo = new THREE.CylinderGeometry(spec.wheelR, spec.wheelR, tyreW, 48);
  tyreGeo.rotateX(Math.PI / 2);
  // A bright rim disc set inside the tyre. Without it a wheel is a black blob.
  const rimGeo = new THREE.CylinderGeometry(spec.wheelR * 0.64, spec.wheelR * 0.64, tyreW * 0.92, 40);
  rimGeo.rotateX(Math.PI / 2);

  spec.wheels.forEach(w => {
    [1, -1].forEach(sign => {
      const [x] = place(spec, w.u, 0);
      // Flush with the body side, not buried inside it.
      const z = sign * (bodyOuter - tyreW * 0.42);

      addSolid(tyreGeo, 'wheel', lines.detail, 18, [x, spec.wheelR, z]);
      addSolid(rimGeo, 'rim', lines.detail, 18, [x, spec.wheelR, z + sign * tyreW * 0.06]);
    });
  });

  const add = (id, geo) => {
    if (!want.has(id)) return;
    const mesh = glassMesh(geo, id);
    panels[id] = mesh;
    group.add(mesh);
    group.add(mesh.userData.outline);
    group.userData.lineMaterials.push(mesh.userData.outlineMat);
  };

  // gap between neighbouring panes, in metres
  const GAP = spec.height * 0.022;
  const OUT = wallOut + eps;

  // windshield and back glass follow the pillar lines
  add('windshield', spanPanel(spec, pillars.cowl, pillars.roofFront, wallHalf, cabinCentre, OUT, GAP));
  add('back_glass', spanPanel(spec, pillars.roofRear, pillars.deck, wallHalf, cabinCentre, OUT, GAP));

  // sunroof, a flat pane let into the roof
  if (want.has('sunroof')) {
    const rf = pillars.roofFront[0], rr = pillars.roofRear[0];
    const u0 = rf + (rr - rf) * 0.14, u1 = rf + (rr - rf) * 0.60;
    const [x0] = place(spec, u0, 0), [x1] = place(spec, u1, 0);
    const y = spec.height * pillars.roofFront[1] + wallOut + eps;
    const w = wallHalf * 0.62;
    const roof = new THREE.ShapeGeometry(
      roundedShape([[x0, -w], [x1, -w], [x1, w], [x0, w]], PANE_ROUND * spec.height), 8
    );
    roof.rotateX(-Math.PI / 2);
    roof.translate(0, y, 0);
    add('sunroof', roof);
  }

  // side glass, mirrored to both sides
  const SIDES = [
    { slot: 0, sign: -1 },   // driver, US left, which is -z. See COORDINATES.
    { slot: 1, sign:  1 }    // passenger
  ];
  Object.keys(side).forEach(key => {
    const ids = SIDE_IDS[key];
    if (!ids) return;
    SIDES.forEach(({ slot, sign }) => {
      const id = ids[slot];
      if (!want.has(id)) return;
      const z = sign * (capHalf + eps);
      const quad = sign > 0 ? side[key] : side[key].slice().reverse();
      const geo = sidePanel(spec, quad, z, GAP, cabinPoly, capInset + GAP * 0.5);
      if (!geo) return;
      const mesh = glassMesh(geo, id);
      panels[id] = mesh;
      group.add(mesh);
      group.add(mesh.userData.outline);
      group.userData.lineMaterials.push(mesh.userData.outlineMat);
    });
  });

  /* ---- the details that stop this reading as a block ----
     Mirrors especially. Every road vehicle has them, they break the silhouette
     at exactly the height the eye checks, and their absence is one of the
     loudest "this is a toy" signals there is. */

  const noseX = place(spec, 0.02, 0)[0];
  const tailX = place(spec, 0.98, 0)[0];
  const beltY = spec.height * (spec.side.door_f ? spec.side.door_f[0][1] : 0.62);

  // wing mirrors, just ahead of the front door glass
  const mirrorU = (spec.side.door_f ? spec.side.door_f[0][0] : 0.40) - 0.012;
  const [mirrorX] = place(spec, mirrorU, 0);
  const mBody = new THREE.BoxGeometry(spec.length * 0.038, spec.height * 0.052, spec.width * 0.085);
  const mArm = new THREE.BoxGeometry(spec.length * 0.012, spec.height * 0.022, spec.width * 0.045);
  [1, -1].forEach(sign => {
    addSolid(mArm, 'mirror_arm', lines.detail, 18,
             [mirrorX, beltY + spec.height * 0.012, sign * (bodyOuter * 0.97)]);
    addSolid(mBody, 'mirror', lines.detail, 18,
             [mirrorX, beltY + spec.height * 0.018, sign * (bodyOuter * 1.04)]);
  });

  // head and tail lamps, tucked into the corners of each end
  const lampH = spec.height * 0.075;
  const lampW = spec.width * 0.26;
  const lampD = spec.length * 0.02;
  const headGeo = new THREE.BoxGeometry(lampD, lampH, lampW);
  const headY = spec.height * (archetypeId === 'heavy' ? 0.26 : 0.40);
  [1, -1].forEach(sign => {
    addSolid(headGeo, 'headlamp', lines.detail, 18, [noseX, headY, sign * (bodyOuter * 0.60)]);
    addSolid(headGeo, 'taillamp', lines.detail, 18, [tailX, spec.height * 0.46, sign * (bodyOuter * 0.60)]);
  });

  // grille, low and central at the nose
  if (archetypeId !== 'van') {
    addSolid(
      new THREE.BoxGeometry(spec.length * 0.016, spec.height * 0.10, spec.width * 0.52),
      'grille', lines.detail, 18, [noseX, spec.height * 0.26, 0]
    );
  }

  group.userData.spec = spec;
  group.userData.size = new THREE.Vector3(spec.length, spec.height, spec.width);
  return { group, panels };
}

export function archetypeIds() {
  return Object.keys(ARCHETYPES);
}

/* Shared with vehicles.js, which builds the same look from a GLB instead of
   from a profile table. Both paths must produce identical materials and line
   weights or the two halves of the fleet would not look like one fleet. */
export { ARCHETYPES, MAT, lineMat, edgesOf, glassMesh };
