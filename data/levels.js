// Level catalog. Lighting colors are hexadecimal RGB values accepted by
// THREE.Color; null thumbnails can be filled in when selection art is ready.
const DEFAULT_HDRI = './assets/levels/backdrop.hdr';
const DEFAULT_AMBIENT_LIGHT = 0xe2f0ff;
const DEFAULT_SECONDARY_LIGHT = 0xc0dcf5;

export const LEVELS = Object.freeze({
  mobius: Object.freeze({
    id: 'mobius',
    name: 'Mobius',
    description: 'A looping arena wrapped into a continuous track.',
    model: './assets/levels/mobius.glb',
    hdriMap: DEFAULT_HDRI,
    ambientLightColor: DEFAULT_AMBIENT_LIGHT,
    secondaryLightColor: DEFAULT_SECONDARY_LIGHT,
    thumbnailImage: null
  }),
  'test-lvl': Object.freeze({
    id: 'test-lvl',
    name: 'Test Arena',
    description: 'The original blockout arena.',
    model: './assets/levels/test-lvl.glb',
    hdriMap: DEFAULT_HDRI,
    ambientLightColor: DEFAULT_AMBIENT_LIGHT,
    secondaryLightColor: DEFAULT_SECONDARY_LIGHT,
    thumbnailImage: null
  })
});

export const DEFAULT_LEVEL_ID = 'mobius';
