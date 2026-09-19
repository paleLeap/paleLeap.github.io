# Vehicle models

Source: Quaternius (https://quaternius.com), via https://poly.pizza
Licence: CC0 1.0 Universal (public domain). No attribution required.

Chosen from one family so every archetype carries the same visual weight and a
comparable triangle budget: 2,892 to 3,222 body triangles.

Each was converted by ../../tools/convert-vehicle.py, which:
  - rotates from the source axes (front -Y, up +Z, left +X) into ours
    (front +x, up +y, driver -z) with a determinant +1 rotation, never a mirror
  - scales to the real length of the archetype and sits it on the ground
  - separates the `Windows` material and splits it into individually named
    panels: windshield, back_glass, door_fl/fr, door_rl/rr, quarter_l/r
  - welds vertices and exports Draco compressed

Deliberately NOT used: models of identifiable real vehicles. Several were
available, but a commercial site for a real business should not carry another
manufacturer's trademarked bodywork.
