/* Real vehicle models, for the body styles we have one for.

   These are Quaternius models, CC0, converted by tools/convert-vehicle.py into
   this project's axes with their glass split into individually named panels.
   See assets/models/CREDITS.md.

   Five are downloaded (Quaternius, CC0) and three are built here, because
   nothing free carries a modern pickup, van or tractor unit whose glass can be
   separated into panes. The generator in model.js stays as the fallback for
   anything with no model at all, and for a browser that cannot run WebGL.

   Both paths hand back the same thing, { group, panels }, wearing the same
   materials and line weights, so the picker does not know or care which built
   the vehicle in front of it. */

import * as THREE from '../vendor/three/three.module.js';
import { GLTFLoader } from '../vendor/three/GLTFLoader.js';
import { MAT, lineMat, edgesOf, boundaryOf, LINE } from './model.js?v=2e687300';

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
  convertible: 'coupe2',
  /* Built rather than downloaded. Nothing free carries a modern pickup, van or
     tractor unit with glass that can be separated into panes, so these three
     are modelled from real dimensions by tools/build/*.py. See the notes. */
  pickup: 'pickup',
  van: 'van',
  heavy: 'heavy'
};

export function hasModel(archetypeId) {
  return Object.prototype.hasOwnProperty.call(FILE, archetypeId);
}

/* One loader, and one cache keyed by file. The picker is rebuilt every time the
   customer edits an earlier answer, and refetching 42 KB to redraw the same
   saloon is waste the customer pays for in latency. */
/* Stamped by bump.sh from the contents of assets/models. The GLBs are fetched
   by a path built at runtime, so nothing in index.html points at them and
   nothing was busting them: a re-converted model stayed cached and the fixes
   never reached anyone. Found it when the live site kept serving a hatch whose
   quarter glass was still 1.23m after that had been fixed and deployed. */
const MODELS_V = '?v=d0ce834e';

const loader = new GLTFLoader();
const cache = Object.create(null);

function load(name) {
  if (!cache[name]) {
    cache[name] = new Promise((resolve, reject) => {
      loader.load('assets/models/' + name + '.glb' + MODELS_V,
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
      frame: lineMat(LINE.frame, 2.0, 0.92),
      detail: lineMat(LINE.detail, 1.4, 0.75)
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
        const outlineMat = lineMat(LINE.pane, 2.6, 1.0);
        /* The boundary ring, not EdgesGeometry. A windshield here is sixteen
           triangles, and drawing every triangle boundary cross-hatched the
           glass into something a customer reasonably called a roll cage. */
        const outline = boundaryOf(geo, outlineMat);
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

    /* THE CABIN LINER, and the reason these read as hollow without it.

       The converter splits glass off the body, so what is left of the
       greenhouse is a frame with holes in it. Looking through a tinted pane you
       therefore saw the INSIDE of the far shell and the far panes' outlines,
       and the car read as an empty husk with windows floating on it. No amount
       of opacity fixes that; the problem is that there is nothing in there.

       The generated vehicles never had this because their greenhouse is a solid
       extrusion with the glass laid on its surface. So: give these one. Each
       pane is copied, pulled in toward the middle of the cabin, and drawn
       opaque. From outside, every pane now has a solid dark surface directly
       behind it. The seams between liner panes sit under the pillars, which are
       part of the body and already solid. */
    const glassMeshes = Object.keys(panels).map(k => panels[k]);
    if (glassMeshes.length) {
      const cabin = new THREE.Box3();
      glassMeshes.forEach(m => cabin.expandByObject(m));
      const mid = cabin.getCenter(new THREE.Vector3());

      /* Moved straight back along the pane's OWN NORMAL, at full size.

         Two wrong turns before this one. Scaling the pane toward the middle of
         the cabin shrinks it as well as moving it, so each liner sat short of
         its glass and left a rim of daylight all the way round. Translating
         toward the middle of the cabin keeps the size but picks the wrong
         direction: a windshield is raked, so "toward the middle" is mostly
         backwards along the glass rather than behind it, and the liner slid out
         from under the pane it was meant to back. Half the see-through pixels
         survived both attempts.

         The normal is computed from the triangles, since these files carry no
         normals of their own, and flipped to point away from the cabin so that
         subtracting it always goes inward. 40mm: clear of the glass at every
         angle the orbit allows, nowhere near deep enough to surface through the
         far side of the body. */
      const BACK = 0.04;

      /* DoubleSide, unlike the body fill it is cloned from: these panes do not
         all agree on winding, and a liner facing away from the camera would be
         culled and show nothing.

         Kept honest: I first blamed culling for a see-through "floor" of about
         3,800 pixels that would not move whatever angle the car was seen from.
         It was not culling, and it was not the car. It was the translucent
         ground platter, which is supposed to be translucent, sitting inside the
         frame and being counted. Measured with the platter excluded, the liner
         closes 99.7% of the see-through: 4,717 pixels down to 15. */
      const liner = MAT.fill();
      liner.side = THREE.DoubleSide;

      glassMeshes.forEach(m => {
        const g = m.geometry.clone();
        const pos = g.attributes.position;
        const idx = g.index;
        const n = new THREE.Vector3();
        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
        const ab = new THREE.Vector3(), ac = new THREE.Vector3(), f = new THREE.Vector3();
        const count = idx ? idx.count : pos.count;
        for (let i = 0; i < count; i += 3) {
          const i0 = idx ? idx.getX(i) : i;
          const i1 = idx ? idx.getX(i + 1) : i + 1;
          const i2 = idx ? idx.getX(i + 2) : i + 2;
          a.fromBufferAttribute(pos, i0);
          b.fromBufferAttribute(pos, i1);
          c.fromBufferAttribute(pos, i2);
          ab.subVectors(b, a); ac.subVectors(c, a);
          n.add(f.crossVectors(ab, ac));      // area weighted, so big faces win
        }
        if (n.lengthSq() < 1e-12) n.set(0, 1, 0);
        n.normalize();

        // Point it outward, then step the liner the other way.
        const centre = new THREE.Box3().setFromBufferAttribute(pos)
          .getCenter(new THREE.Vector3());
        if (n.dot(centre.clone().sub(mid)) < 0) n.negate();
        n.multiplyScalar(-BACK);
        g.translate(n.x, n.y, n.z);
        const shell = new THREE.Mesh(g, liner);
        shell.name = 'cabin_liner';
        shell.raycast = () => {};      // never intercept a pick
        shell.renderOrder = -1;        // behind the transparent panes
        group.add(shell);
      });
    }

    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);
    group.userData.size = size;

    return { group, panels };
  });
}
