// Level catalog. Adjectives are comma-separated so the selector can render
// them as individual tags without storing presentation markup in the data.
const DEFAULT_HDRI = './assets/levels/backdrop.hdr';
const ASTEROID_HDRI = './assets/levels/Asteroid/assets/hdrs/gas-giant-low-or_313dc6a9-7900-4735-b9d8-a5839e141c5c/gas-giant-low-orbit_2K_12505460-9c3a-492b-a595-755b165dbbb9.exr';
const DEFAULT_AMBIENT_LIGHT = 0xe2f0ff;
const DEFAULT_SECONDARY_LIGHT = 0xc0dcf5;

export const LEVELS = Object.freeze({
  cube: Object.freeze({
    id: 'cube',
    name: 'Concrete Jungle',
    description: 'A towering concrete arena wrapped around a giant cylindrical core.',
    adjectives: 'Enclosed, Close Quarters, Urban',
    model: './assets/levels/cube/cuber.glb',
    hdriMap: DEFAULT_HDRI,
    ambientLightColor: DEFAULT_AMBIENT_LIGHT,
    secondaryLightColor: DEFAULT_SECONDARY_LIGHT,
    thumbnailImage: './assets/levels/cube/level-01.webp'
  }),
  asteroid: Object.freeze({
    id: 'asteroid',
    name: 'ASTEROID COWBOY',
    description: 'Battle as you fly through space',
    adjectives: 'UNENCLOSED, Flight-Heavy',
    model: './assets/levels/Asteroid/Asteroid.glb',
    hdriMap: ASTEROID_HDRI,
    ambientLightColor: DEFAULT_AMBIENT_LIGHT,
    secondaryLightColor: DEFAULT_SECONDARY_LIGHT,
    thumbnailImage: './assets/levels/Asteroid/asteroid-preview.webp'
  }),
});

export const DEFAULT_LEVEL_ID = 'cube';
