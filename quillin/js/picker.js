/* The glass picker: a rotatable vehicle archetype whose glass panels are
   individually selectable.

   The 3D view is an aid, never a gate. Every panel is mirrored by a real
   checkbox in a list beside it, so the whole step works with a keyboard, with a
   screen reader, and on a device that cannot give us WebGL. Selection is shared
   state between the two; clicking glass ticks the box and vice versa. */

import * as THREE from '../vendor/three/three.module.js';
import { OrbitControls } from '../vendor/three/OrbitControls.js';
import { buildVehicle } from './model.js';

/* One accent, red, and nothing else. Light on hover, dark on select, so the two
   states are told apart by value and not only by hue. */
const COLOR = {
  hover:  0xe8615e,    // light red
  picked: 0x8c1d1a     // dark red
};

/* Hover and select are UNLIT, and deliberately so.

   Tinting the physical glass material does not work. Measured: an albedo of
   #8c1d1a rendered as #ce5f5c, and darkening it all the way to #3a0b09 still
   rendered #704e4e, a muddy pink. A white specular lobe from the clearcoat and
   the environment sits on top of the pane and does not scale with base colour,
   so darkening the albedo only desaturates it.

   A selection marker is interface, not a material, so it opts out of lighting
   and out of tone mapping. What is authored is exactly what appears, at every
   camera angle and under any later change to the lighting. */
function markerMaterial(hex, opacity) {
  return new THREE.MeshBasicMaterial({
    color: hex, transparent: true, opacity,
    toneMapped: false, side: THREE.DoubleSide,
    // same depth bias as the glass it replaces, or a marked pane vanishes
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
  });
}

/* The calibration platter the vehicle stands on.

   It is doing a job beyond decoration. A vehicle floating on a blank page has no
   ground and no sense of scale, and the orbit reads as the object spinning
   rather than the viewer walking around it. Fixed radial spokes and concentric
   rings give the rotation something to move against, which is what makes the
   step feel like a measuring instrument instead of a toy.

   Drawn to a canvas rather than built from line geometry: lines would need
   hundreds of segments to stay smooth, would alias badly at a shallow angle, and
   could not fade out at the rim. A texture does all three for one draw call. */
function platterTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const cx = S / 2, cy = S / 2, R = (S / 2) * 0.97;
  const ink = '235, 242, 248';   // white grid, for a black stage

  g.lineCap = 'butt';

  // radial spokes, every 5 degrees, with every 30th running the full radius
  for (let i = 0; i < 72; i++) {
    const a = (i * Math.PI) / 36;
    const major = i % 6 === 0;
    const r0 = major ? R * 0.10 : R * 0.74;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    g.strokeStyle = 'rgba(' + ink + ',' + (major ? 0.46 : 0.22) + ')';
    g.lineWidth = major ? 2.2 : 1.1;
    g.stroke();
  }

  // concentric rings, the outermost heavier so the platter has a rim
  const rings = [0.16, 0.32, 0.48, 0.64, 0.80, 0.97];
  rings.forEach((t, i) => {
    const outer = i === rings.length - 1;
    g.beginPath();
    g.arc(cx, cy, R * t, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(' + ink + ',' + (outer ? 0.55 : 0.26) + ')';
    g.lineWidth = outer ? 2.6 : 1.2;
    g.stroke();
  });

  // crosshair through the middle, where the vehicle sits
  g.beginPath();
  g.moveTo(cx - R * 0.10, cy); g.lineTo(cx + R * 0.10, cy);
  g.moveTo(cx, cy - R * 0.10); g.lineTo(cx, cy + R * 0.10);
  g.strokeStyle = 'rgba(' + ink + ',0.55)';
  g.lineWidth = 1.8;
  g.stroke();

  // fade to nothing at the rim so it sits on any page background
  g.globalCompositeOperation = 'destination-in';
  const fade = g.createRadialGradient(cx, cy, R * 0.15, cx, cy, R);
  fade.addColorStop(0.00, 'rgba(0,0,0,1)');
  fade.addColorStop(0.66, 'rgba(0,0,0,0.95)');
  fade.addColorStop(0.90, 'rgba(0,0,0,0.42)');
  fade.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, S, S);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* Soft elliptical blob, opaque under the vehicle and transparent at the rim. */
function contactShadowTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0.00, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0.28)');
  grad.addColorStop(0.75, 'rgba(0,0,0,0.07)');
  grad.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createPicker(opts) {
  const {
    mount,            // element the canvas goes into
    listMount,        // element the checkbox list goes into
    archetype,        // { id, label, panels, cab }
    labelFor,         // panel id -> human label
    onChange          // (selectedPanelIds) => void
  } = opts;

  const selected = new Set();
  const inputs = {};
  let hovered = null;
  let disposed = false;

  /* ---------- scene ---------- */

  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  /* Capped harder on touch. A phone GPU rendering a live loop at 3x while the
     customer stands outside on battery is a cost with no visible return; the
     model is line work on a flat ground and holds up fine at 2x. */
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 2 : 2));
  renderer.shadowMap.enabled = false;
  /* Filmic tone mapping instead of raw clamped output. Without it the clearcoat
     highlights blow out to flat white and the paint looks like plastic again. */

  mount.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';


  /* No lights, no environment, no tone mapping. Every material here is unlit by
     design. Shading is what exposed the imperfections in generated curves, so
     the cleanest way to hide them was to stop shading altogether and draw the
     vehicle as structure: near-black fills for occlusion, bright creases on top.
     Nothing is left that can catch a highlight wrong. */

  const { group, panels } = buildVehicle(archetype.id, archetype.cab, archetype.panels);
  scene.add(group);

  const size = group.userData.size;

  /* No contact shadow. A dark blob under a dark vehicle on a black stage is
     invisible at best and muddies the grid at worst; the grid passing under the
     car already does the job of putting it on the ground. */

  const platterTex = platterTexture();
  const platter = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: platterTex, transparent: true, opacity: 0.85,
      depthWrite: false, toneMapped: false
    })
  );
  platter.rotation.x = -Math.PI / 2;
  // Wide enough that the vehicle sits well inside the instrument rather than
  // filling it, which is what reads as a measuring rig.
  const platterR = Math.max(size.x, size.z) * 2.35;
  platter.scale.set(platterR, platterR, 1);
  platter.position.y = 0.001;
  platter.renderOrder = -2;
  platter.raycast = () => {};
  scene.add(platter);

  /* ---------- camera and controls ---------- */

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;

  /* TOUCH: one finger rotates, two fingers zoom, and the page still scrolls.

     OrbitControls sets touch-action:none on the canvas so it can own every
     gesture. On a phone that is a trap: the stage is most of the screen, so a
     finger dragged upward to scroll past it rotates the car instead and the
     customer cannot get off the step. pan-y hands vertical swipes back to the
     browser and keeps horizontal ones, which is the axis that matters here
     anyway since the vehicle turns about its vertical axis. */
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
  /* The touch-action itself is forced from the stylesheet. OrbitControls writes
     `touch-action: none` as an INLINE style inside connect(), and an inline
     style beats anything set here, so setting it in JS looked correct and
     measured as `none` every time. See .picker__stage canvas in style.css. */
  controls.minPolarAngle = 0.18;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;   // never go under the floor
  controls.target.set(0, size.y * 0.45, 0);

  /* Three-quarter front view: the windshield and the driver's side at once,
     which is what most damage reports involve. The distance is computed to fit
     the vehicle rather than guessed, so a 6.4 m truck-tractor and a 4.3 m hatch
     are both framed properly, and it is recomputed whenever the stage resizes. */
  const DIR = new THREE.Vector3(0.82, 0.52, 1.0).normalize();

  function fit() {
    // Deliberately measured from the VEHICLE, not the scene: the platter is
    // wider than the car and framing to it would push the car into the distance.
    const box = new THREE.Box3().setFromObject(group);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const dist = Math.max(
      sphere.radius / Math.sin(vFov / 2),
      sphere.radius / Math.sin(hFov / 2)
    ) * 0.82;          // 0.82 crops the empty air a bounding sphere leaves
    controls.target.copy(sphere.center);
    camera.position.copy(sphere.center).addScaledVector(DIR, dist);
    controls.minDistance = dist * 0.55;
    controls.maxDistance = dist * 2.2;
    controls.update();
  }

  /* ---------- picking ---------- */

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const glassMeshes = Object.keys(panels).map(k => panels[k]);

  // 0.68 measured as #a54a49 against the near-black cabin behind it, too dark to
  // read as the light half of the pair. Raised until it renders close to target.
  const hoverMat = markerMaterial(COLOR.hover, 0.30);
  const pickMat = markerMaterial(COLOR.picked, 0.62);

  function paint(mesh) {
    const id = mesh.userData.panel;
    const isPicked = selected.has(id);
    const isHover = hovered === id;

    mesh.material = isPicked ? pickMat : isHover ? hoverMat : mesh.userData.glassMat;

    // the outline carries the state too, so a pane reads at any size
    const om = mesh.userData.outlineMat;
    if (om) {
      om.color.setHex(isPicked ? COLOR.picked : isHover ? COLOR.hover : 0xffffff);
      om.linewidth = isPicked ? 3.4 : isHover ? 3.0 : 2.2;
      om.opacity = isPicked || isHover ? 1.0 : 0.85;
      om.needsUpdate = true;
    }
  }

  function repaint() { glassMeshes.forEach(paint); }

  function hit(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(glassMeshes, false);
    return hits.length ? hits[0].object.userData.panel : null;
  }

  function setHover(id) {
    if (hovered === id) return;
    hovered = id;
    renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
    repaint();
  }

  renderer.domElement.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    setHover(hit(e));
  });
  renderer.domElement.addEventListener('pointerleave', () => setHover(null));

  // A drag that rotates the car must not also select a panel.
  let downAt = null;
  renderer.domElement.addEventListener('pointerdown', e => {
    downAt = { x: e.clientX, y: e.clientY };
  });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    if (moved > 6) return;
    const id = hit(e);
    if (id) toggle(id);
  });

  /* ---------- shared selection ---------- */

  function toggle(id, force) {
    const on = force === undefined ? !selected.has(id) : force;
    if (on) selected.add(id); else selected.delete(id);
    if (inputs[id]) inputs[id].checked = on;
    repaint();
    if (onChange) onChange(list());
  }

  function list() {
    // Stable order, so the summary never reshuffles between reviews.
    return archetype.panels.filter(p => selected.has(p));
  }

  /* ---------- the list beside the canvas ---------- */

  archetype.panels.forEach(id => {
    const label = document.createElement('label');
    label.className = 'choice choice--compact';
    label.setAttribute('for', 'panel-' + id);

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = 'panel-' + id;
    input.value = id;
    input.addEventListener('change', () => toggle(id, input.checked));
    input.addEventListener('focus', () => setHover(id));
    input.addEventListener('blur', () => setHover(null));

    const span = document.createElement('span');
    span.textContent = labelFor(id);

    label.appendChild(input);
    label.appendChild(span);
    label.addEventListener('mouseenter', () => setHover(id));
    label.addEventListener('mouseleave', () => setHover(null));

    listMount.appendChild(label);
    inputs[id] = input;
  });

  /* ---------- loop ---------- */

  function resize() {
    const w = mount.clientWidth;
    const h = mount.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // LineMaterial sizes its strokes in pixels, so it has to be told the canvas
    (group.userData.lineMaterials || []).forEach(m => m.resolution.set(w, h));
    fit();
  }

  const ro = new ResizeObserver(resize);
  ro.observe(mount);
  resize();

  function tick() {
    if (disposed) return;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  repaint();
  tick();

  return {
    selected: list,
    reset() { selected.clear(); Object.keys(inputs).forEach(k => { inputs[k].checked = false; }); repaint(); },
    dispose() {
      disposed = true;
      ro.disconnect();
      controls.dispose();
      hoverMat.dispose();
      pickMat.dispose();
      platterTex.dispose();
      renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    },
    // exposed for the offscreen check
    _internals: { scene, camera, renderer, panels, group }
  };
}
