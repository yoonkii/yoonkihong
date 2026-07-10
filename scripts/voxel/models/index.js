/* ============================================================================
   YOONKI WORLD 3D — model registry index
   Import your model group and register it here (one line per group).
   Importing this module populates the shared registry used by viewer.html
   and the game. See docs/VOXEL_FORMAT.md §3.
   ========================================================================== */

import { registerModels } from '../voxel.js';

import samples from './samples.js';
registerModels(samples);

import buildings from './buildings.js';
registerModels(buildings);

import terrain from './terrain.js';
registerModels(terrain);

import characters from './characters.js';
registerModels(characters);

import interior from './interior.js';
registerModels(interior);

// import nature from './nature.js';         registerModels(nature);
