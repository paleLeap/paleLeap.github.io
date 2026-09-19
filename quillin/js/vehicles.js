/* Real vehicle models, for the body styles we have one for.

   These are Quaternius models, CC0, converted by tools/convert-vehicle.py into
   this project's axes with their glass split into individually named panels.
   See assets/models/CREDITS.md.

   The procedural generator in model.js stays, and is still the path for pickup,
   van and heavy: those come from a Quaternius pack that uses a single texture
   atlas with no glass material, so there is nothing to separate into panels. A
   generated pickup is better than a real one whose windows cannot be clicked.

   Both paths hand back the same thing, { group, panels }, wearing the same
   materials and line weights, so the picker does not know or care which built
   the vehicle in front of it. */

import * as THREE from '../vendor/three/three.module.js';
import { GLTFLoader } from '../vendor/three/GLTFLoader.js';
import { MAT, lineMat, edgesOf } from './model.js?v=0b4ff2a8';

/* Which archetypes have a real model, and which file.

   convertible takes the second coupe rather than the first: both are closed
   cars, so neither is right, but the flatter of the two reads less wrong with
   no roof glass on it. hatch takes the second saloon for the same kind of
   reason. Anything absent here falls through to the generator. */
const FILE = {
  sedan: 'sedan',
  coupe: 'coupe',
  suv: 'suv',
  hatch: 'sedan2',
  convertible: 'coupe2'
};

export function hasModel(archetypeId) {
  return Object.prototype.hasOwnProperty.call(FILE, archetypeId);
}

/* One loader, and one cache keyed by file. The picker is rebuilt every time the
   customer edits an earlier answer, and refetching 42 KB to redraw the same
   saloon is waste the customer pays for in latency. */
const loader = new GLTFLoader();
const cache = Object.create(null);

function load(name) {
  if (!cache[name]) {
    cache[name] = new Promise((resolve, reject) => {
      loader.load('assets/models/' + name + '.glb',
        gltf => resolve(gltf.scene), undefined, reject);
    }).catch(err => { delete cache[name]; throw err; });
  }
  return cache[name];
}

/* The panel ids the converter writes, as `panel_<id>` object names. */
function panelIdOf(obj) {
  return obj.name.indexOf('panel_') === 0 ? obj.name.slice(6) : null;
}

/* EdgesGeometry threshold for the body. Lower than the generator's 14 because
   these bodies are authored by hand at about 3,000 triangles: their creases are
   real edges the modeller put there, not artefacts of an extrusion, so there is
   less noise to filter and more shape worth drawing. */
const BODY_CREASE = 20;

export function loadVehicle(archetypeId, cab, wanted) {
  const name = FILE[archetypeId];
  if (!name) return Promise.reject(new Error('no model for ' + archetypeId));

  const want = new Set(wanted || []);

  return load(name).then(scene => {
    const group = new THREE.Group();
    const panels = {};
    const lines = {
      frame: lineMat(0xdfe7ee, 2.0, 0.92),
      detail: lineMat(0x8b97a3, 1.4, 0.75)
    };
    group.userData.lineMaterials = [lines.frame, lines.detail];

    /* Cloned, because the cache hands back the same scene every time and the
       picker disposes what it is given when the step is edited. Mutating the
       cached copy would leave the next build with a vehicle already stripped of
       its panels. */
    scene.clone(true).traverse(obj => {
      if (!obj.isMesh) return;
      const geo = obj.geometry.clone();
      geo.applyMatrix4(obj.matrixWorld);

      const pid = panelIdOf(obj);

      if (pid) {
        // Glass the resolver says this body style does not have is dropped
        // rather than hidden, so nothing invisible can intercept a click.
        if (!want.has(pid)) { geo.dispose(); return; }
        const mat = MAT.glass();
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = pid;
        mesh.userData.panel = pid;
        mesh.userData.glassMat = mat;
        const outlineMat = lineMat(0xffffff, 2.6, 1.0);
        /* threshold 1, the same as the generated panes: on a pane this shallow
           every triangle boundary IS part of its outline. */
        const outline = edgesOf(geo, outlineMat, 1);
        outline.raycast = () => {};
        mesh.userData.outline = outline;
        mesh.userData.outlineMat = outlineMat;
        panels[pid] = mesh;
        group.add(mesh);
        group.add(outline);
        group.userData.lineMaterials.push(outlineMat);
        return;
      }

      const fill = new THREE.Mesh(geo, MAT.fill());
      fill.name = obj.name || 'body';
      const seg = edgesOf(geo, lines.frame, BODY_CREASE);
      seg.raycast = () => {};       // lines must never intercept a pick
      group.add(fill);
      group.add(seg);
    });

    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);
    group.userData.size = size;

    return { group, panels };
  });
}
