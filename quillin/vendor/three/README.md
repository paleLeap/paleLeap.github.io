# Vendored three.js

three.js r186, MIT. Files copied from the npm package `three@0.186.0`:

    build/three.module.js                        -> three.module.js
    build/three.core.js                          -> three.core.js
    examples/jsm/controls/OrbitControls.js       -> OrbitControls.js
    examples/jsm/utils/BufferGeometryUtils.js    -> BufferGeometryUtils.js
    examples/jsm/lines/LineSegmentsGeometry.js   -> LineSegmentsGeometry.js
    examples/jsm/lines/LineSegments2.js          -> LineSegments2.js
    examples/jsm/loaders/GLTFLoader.js           -> GLTFLoader.js
    examples/jsm/utils/SkeletonUtils.js          -> SkeletonUtils.js

GLTFLoader pulls in BufferGeometryUtils and SkeletonUtils by '../utils/...',
which does not exist in this flat directory; both specifiers are patched to
'./'. SkeletonUtils is only reached for skinned meshes, which these vehicles do
not have, but an unresolvable import fails the whole module graph regardless.
    examples/jsm/lines/LineMaterial.js           -> LineMaterial.js
    LICENSE                                      -> LICENSE

The `lines` trio is here because GL's own `linewidth` is silently clamped to 1
by essentially every desktop driver. At a device pixel ratio of 2 that is half a
CSS pixel, which reads as grey mush rather than a crisp line. LineMaterial draws
strokes as camera-facing quads instead, so widths are real. It does have to be
told the canvas size: set `material.resolution` on every resize or the widths go
wrong.

(RoomEnvironment was vendored for image based lighting and then removed when the
picker became an unlit wireframe. Nothing is shaded any more.)

## One local patch, applied to each vendored file

`OrbitControls.js`, `BufferGeometryUtils.js` and the three `lines` files each
ship with a bare import:

    } from 'three';

Bare specifiers need an import map, and import maps only reached Safari in 16.4.
This site has to work on older phones, so the line is repointed instead:

    } from './three.module.js';

**If you upgrade three.js, reapply this.** Without it the picker silently falls
back to its checkbox list and nobody notices the 3D view is gone.
