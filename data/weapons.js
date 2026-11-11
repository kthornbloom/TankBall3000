// Shared weapon catalog. Runtime behavior lives in the game; this file owns
// tunable values and presentation metadata.
export const WEAPONS = Object.freeze({
  cannon: Object.freeze({
    id: 'cannon',
    name: 'Main Cannon',
    description: 'A heavy shell with a slow firing rate and splash damage.',
    shotsPerSecond: 1 / 1.25,
    damagePerShot: 100,
    range: 250,
    shotSpeed: 105,
    splashDamageRange: 4.5,
    splashDamageAmount: 45,
    behavior: 'projectile',
    triggerMode: 'single',
    audio: './assets/audio/primary-shot.flac'
  }),
  minigun: Object.freeze({
    id: 'minigun',
    name: 'Minigun',
    description: 'A fast stream of light projectiles.',
    shotsPerSecond: 1 / 0.085,
    damagePerShot: 12,
    range: 250,
    shotSpeed: 190,
    splashDamageRange: 0,
    splashDamageAmount: 0,
    behavior: 'projectile',
    triggerMode: 'automatic',
    audio: './assets/audio/minigun.mp3'
  }),
  emp: Object.freeze({
    id: 'emp',
    name: 'EMP Pulse',
    description: 'Expands a disruptive pulse that disables nearby tanks.',
    shotsPerSecond: 1 / 8,
    damagePerShot: 0,
    range: 32,
    shotSpeed: 0,
    splashDamageRange: 0,
    splashDamageAmount: 0,
    disableDuration: 4,
    behavior: 'emp',
    triggerMode: 'single',
    audio: './assets/audio/emp.mp3'
  })
});
