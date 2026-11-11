// Tank catalog. Health is split into the requested turret and ball pools;
// current combat uses their sum until the separate damage model is added.
export const TANKS = Object.freeze({
  '1': Object.freeze({
    id: '1',
    name: 'W.A.S.A.B.I.',
    description: 'Weapon And Stabilization And Ball Interface',
    model: './assets/tanks/primary-tank.glb',
    turretHealth: 100,
    ballHealth: 100,
    primaryWeapon: 'cannon',
    secondaryWeapon: 'minigun',
    tertiaryWeapon: 'emp',
    muzzleOffset: Object.freeze({ forward: 3, up: 1.3, right: 0 }),
    boostStrength: 8,
    boostTime: 1,
    thrustStrength: 15,
    thrustTime: 4,
    thumbnailImage: null
  }),
  'gold-tank': Object.freeze({
    id: '2',
    name: 'Goldie',
    description: 'Gilded war machine.',
    model: './assets/tanks/gold-tank.glb',
    turretHealth: 150,
    ballHealth: 150,
    primaryWeapon: 'cannon',
    secondaryWeapon: 'minigun',
    tertiaryWeapon: 'emp',
    muzzleOffset: Object.freeze({ forward: 0.9, up: 1.7, right: 0 }),
    boostStrength: 6,
    boostTime: 1,
    thrustStrength: 10,
    thrustTime: 3,
    thumbnailImage: null
  }),
  scorpion: Object.freeze({
    id: '3',
    name: 'Scorpion',
    description: 'A sharp, lightweight experimental tank chassis.',
    model: './assets/tanks/scorp-tank.glb',
    turretHealth: 90,
    ballHealth: 90,
    primaryWeapon: 'cannon',
    secondaryWeapon: 'minigun',
    tertiaryWeapon: 'emp',
    muzzleOffset: Object.freeze({ forward: 0.9, up: 1.6, right: 0 }),
    boostStrength: 8,
    boostTime: 2,
    thrustStrength: 11,
    thrustTime: 2,
    thumbnailImage: null
  })
});

export const DEFAULT_TANK_ID = '1';
