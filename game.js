import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import Peer from 'peerjs';
import { WEAPONS } from './data/weapons.js';
import { TANKS, DEFAULT_TANK_ID as CATALOG_DEFAULT_TANK_ID } from './data/tanks.js';
import { LEVELS, DEFAULT_LEVEL_ID as CATALOG_DEFAULT_LEVEL_ID } from './data/levels.js';

const GAME_SELECTION = window.tankGameSelection || {};
const DEFAULT_TANK_ID = GAME_SELECTION.tankId || CATALOG_DEFAULT_TANK_ID;
const DEFAULT_LEVEL_ID = GAME_SELECTION.levelId || CATALOG_DEFAULT_LEVEL_ID;
// ============================================================
// SETTINGS
// ============================================================

const DEFAULT_TANK = TANKS[DEFAULT_TANK_ID] || TANKS[CATALOG_DEFAULT_TANK_ID];
const DEFAULT_LEVEL = LEVELS[DEFAULT_LEVEL_ID] || LEVELS[CATALOG_DEFAULT_LEVEL_ID];
const LEVEL_URL = DEFAULT_LEVEL.model;
const TANK_URL = DEFAULT_TANK.model;

const MODEL_SCALE = 1;
const MODEL_FORWARD_NEGATIVE_Z = true;

const BALL_CLEARANCE = 0.08;

const MAX_SPEED = 11;
const MAX_REVERSE_SPEED = 5;
const GROUND_BOOST_MAX_SPEED = 40;

const DRIVE_ACCEL = 7.5;
const STRAFE_ACCEL = 6.5;
const DRAG = 2.0;

const MOUSE_SENSITIVITY = 0.0025;
const MAX_AIM_PITCH = Math.PI / 2; // Aim vertically up or down
const FLIGHT_AIM_RESPONSE = 7;
const FLIGHT_CAMERA_RESPONSE = 5;
const FLIGHT_ROLL_RATE = 1.8;

const TURN_RATE = 2.7;
const TURN_RESPONSE = 5;

const CAMERA_DISTANCE = 8.5;
const CAMERA_HEIGHT = 5.0;
const CAMERA_MIN_DISTANCE = 4.5;
const CAMERA_MAX_DISTANCE = 20;
const CAMERA_DISTANCE_STEP = 0.9;
const CAMERA_TANK_FADE_START = 3.2;
const CAMERA_TANK_FADE_END = 1.1;
const CAMERA_ZOOM_FOV = 42;

const SURFACE_RESPONSE = 16;

const BODY_ACCEL_LEAN = 0.018;
const BODY_TURN_LEAN = 0.11;
const BODY_LEAN_RESPONSE = 7;

const GROUND_BOOST_DURATION = DEFAULT_TANK.boostTime;
const GROUND_BOOST_IMPULSE = DEFAULT_TANK.boostStrength;
const GROUND_BOOST_WOBBLE_RATE = 19;
const GROUND_BOOST_AIM_WOBBLE = 0.035;

// Add these files to ./assets/audio/ (or change the paths here).
const CANNON_AUDIO_URL = WEAPONS.cannon.audio;
const MINIGUN_AUDIO_URL = WEAPONS.minigun.audio;
const COLLISION_AUDIO_URL = './assets/audio/thud.mp3';
const FLIGHT_CLUNK_AUDIO_URL = './assets/audio/thud.mp3';
const MAGNET_AUDIO_URL = './assets/audio/emp.mp3';
const EXPLOSION_AUDIO_URL = './assets/audio/explode.mp3';
const MUSIC_TRACKS = [
  './assets/audio/music/Neon%20Afterimage.mp3',
  './assets/audio/music/Neon%20Pixel%20Dreams.mp3'
];
const ENGINE_AUDIO_URL = './assets/audio/engine.ogg';
const THRUST_AUDIO_URL = './assets/audio/boost.mp3';
const RELOAD_AUDIO_URL = './assets/audio/reload.mp3';

const DRIVE_COLLISION_THRESHOLD = 3.5;
const COLLISION_COOLDOWN = 0.3;
const COLLISION_SPARK_COUNT = 16;

const MAX_PLAYER_HEALTH = DEFAULT_TANK.turretHealth + DEFAULT_TANK.ballHealth;
const TARGET_STARTING_HEALTH = 100;
const PRACTICE_TANK_RESPAWN_DELAY = 8.8;

const THRUST_DURATION = DEFAULT_TANK.thrustTime;
const THRUST_RECHARGE_DELAY_AFTER_USE = 2;
const THRUST_EMPTY_PENALTY_DELAY = 4;
const THRUST_RECHARGE_FULL_DURATION = 6;
const REATTACH_ORIENT_DURATION = 1.5;
const REATTACH_CONTROL_RESUME_PROGRESS = 0.92;
const FLIGHT_PUSH_OFF = 8;
const FLIGHT_INITIAL_SPEED = 3.5;
const THRUST_ACCELERATION = DEFAULT_TANK.thrustStrength;
const FLIGHT_DRAG = 0.12;
const REATTACH_ACCEL = 42;
const REATTACH_DRAG = 2.2;

// ============================================================
// THREE.JS SETUP
// ============================================================

const scene = new THREE.Scene();
const BLACK_LIGHT_COLOR = new THREE.Color(0, 0, 0);
scene.background = new THREE.Color(0x101722);

// Keep the weapon flash objects in the scene from startup so the first shot
// does not introduce a new light or material shader variant.
// Keep a tiny nonzero intensity so Three.js keeps this light in its shader
// light list between shots instead of compiling a new program on first fire.
const muzzleFlashLight = new THREE.PointLight(0xffb347, 0.001, 9, 2);
muzzleFlashLight.castShadow = false;
scene.add(muzzleFlashLight);
const muzzleFlash = new THREE.Mesh(
  new THREE.SphereGeometry(0.22, 10, 7),
  new THREE.MeshBasicMaterial({
    color: 0xffc45c,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  })
);
scene.add(muzzleFlash);
const muzzleFlashRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.28, 0.035, 6, 24),
  new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
);
muzzleFlashRing.visible = false;
scene.add(muzzleFlashRing);
const muzzleFlame = new THREE.Group();
for (const [radius, length, color, opacity] of [
  [0.48, 1.05, 0xff3a12, 0.48],
  [0.31, 0.82, 0xff982c, 0.72],
  [0.17, 0.58, 0xfff1bc, 0.92]
]) {
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(radius, length, 10),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, userData: { baseOpacity: opacity } })
  );
  flame.position.y = length * 0.42;
  muzzleFlame.add(flame);
}
muzzleFlame.visible = false;
scene.add(muzzleFlame);
let bulletHoleTexture = null;
let primaryReticleFlashTimer = null;
let muzzleFlashLife = 0;
let muzzleFlashDuration = 0.1;
let muzzleFlashPeakIntensity = 20;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const speedLineCount = 36;
const speedLinePositions = new Float32Array(speedLineCount * 6);
const speedLineGeometry = new THREE.BufferGeometry();
const speedLinePositionAttribute = new THREE.BufferAttribute(speedLinePositions, 3);
speedLinePositionAttribute.setUsage(THREE.DynamicDrawUsage);
speedLineGeometry.setAttribute('position', speedLinePositionAttribute);
const speedLineMaterial = new THREE.LineBasicMaterial({
  color: 0xbdeeff, transparent: true, opacity: 0, depthWrite: false
});
const speedLines = new THREE.LineSegments(speedLineGeometry, speedLineMaterial);
speedLines.frustumCulled = false;
speedLines.visible = false;
scene.add(speedLines);
const speedLineParticles = Array.from({ length: speedLineCount }, () => ({
  along: (Math.random() - 0.5) * 18,
  side: (Math.random() - 0.5) * 9,
  up: (Math.random() - 0.5) * 9,
  length: 1.4 + Math.random() * 1.8
}));
const speedLineAxis = new THREE.Vector3();
const speedLineSide = new THREE.Vector3();
const speedLineUp = new THREE.Vector3();
const speedLineCenter = new THREE.Vector3();
const speedLineReference = new THREE.Vector3();

function updateSpeedLines(dt, inFlight, worldVelocity) {
  const speed = worldVelocity.length();
  speedLines.visible = inFlight && speed > 0.1;
  if (!speedLines.visible) {
    speedLineMaterial.opacity = 0;
    return;
  }

  speedLineAxis.copy(worldVelocity).multiplyScalar(1 / speed);
  speedLineReference.set(Math.abs(speedLineAxis.y) > 0.92 ? 1 : 0,
    Math.abs(speedLineAxis.y) > 0.92 ? 0 : 1, 0);
  speedLineSide.crossVectors(speedLineAxis, speedLineReference).normalize();
  speedLineUp.crossVectors(speedLineAxis, speedLineSide).normalize();
  speedLineMaterial.opacity = THREE.MathUtils.clamp(speed / 30, 0.08, 0.88);

  for (let i = 0; i < speedLineCount; i++) {
    const particle = speedLineParticles[i];
    particle.along -= speed * dt;
    if (particle.along < -9) {
      particle.along += 18;
      particle.side = (Math.random() - 0.5) * 9;
      particle.up = (Math.random() - 0.5) * 9;
      particle.length = 1.4 + Math.random() * 1.8;
    }

    speedLineCenter.copy(position)
      .addScaledVector(speedLineAxis, particle.along)
      .addScaledVector(speedLineSide, particle.side)
      .addScaledVector(speedLineUp, particle.up);
    const lineLength = particle.length * (0.7 + speed / 32);
    const halfLength = lineLength * 0.5;
    const offset = i * 6;
    speedLinePositions[offset] = speedLineCenter.x - speedLineAxis.x * halfLength;
    speedLinePositions[offset + 1] = speedLineCenter.y - speedLineAxis.y * halfLength;
    speedLinePositions[offset + 2] = speedLineCenter.z - speedLineAxis.z * halfLength;
    speedLinePositions[offset + 3] = speedLineCenter.x + speedLineAxis.x * halfLength;
    speedLinePositions[offset + 4] = speedLineCenter.y + speedLineAxis.y * halfLength;
    speedLinePositions[offset + 5] = speedLineCenter.z + speedLineAxis.z * halfLength;
  }
  speedLineGeometry.attributes.position.needsUpdate = true;
}

const camera = new THREE.PerspectiveCamera(
  65, innerWidth / innerHeight, 0.05, 1500
);

// 2. Load HDRI Environment Map using modern imports
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

const environmentLoader = DEFAULT_LEVEL.hdriMap.toLowerCase().endsWith('.exr')
  ? new EXRLoader()
  : new RGBELoader();

environmentLoader.load(DEFAULT_LEVEL.hdriMap, texture => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  const envMap = pmremGenerator.fromEquirectangular(texture).texture;

  scene.environment = envMap;
  scene.background = envMap;

  texture.dispose();
  pmremGenerator.dispose();
  environmentReady = true;
  updateLoadingStatus();
  maybeFinishGameStartup();
}, undefined, error => {
  console.error('Environment loading failed:', error);
  pmremGenerator.dispose();
  environmentReady = true;
  updateLoadingStatus();
  maybeFinishGameStartup();
});

// Brighter cool fill lifts the darkest surfaces while leaving direct shadows visible.
const ambientLight = new THREE.HemisphereLight(
  DEFAULT_LEVEL.ambientLightColor,
  0x2b3940,
  1.35
);
scene.add(ambientLight);

// This broad fill does not cast a second shadow, so the central light keeps its definition.
const directionalFill = new THREE.DirectionalLight(DEFAULT_LEVEL.secondaryLightColor, 1.1);
directionalFill.position.set(-15, 10, -10);
scene.add(directionalFill);

// Central white point light
const centerLight = new THREE.PointLight(
  0xffffff,
  650,
  250,
  2
);

centerLight.position.set(0, 0, 0);
centerLight.castShadow = true;

centerLight.shadow.mapSize.set(2048, 2048);
centerLight.shadow.camera.near = 1;
centerLight.shadow.camera.far = 250;

centerLight.shadow.bias = -0.0001;
centerLight.shadow.normalBias = 0.015;

// Softer shadow edges
centerLight.shadow.radius = 3;

scene.add(centerLight);

// Enable soft shadow filtering
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const levelRoot = new THREE.Group();
const tankRoot = new THREE.Group();

scene.add(levelRoot, tankRoot);

const loader = new GLTFLoader();
const raycaster = new THREE.Raycaster();
const surfaceNormalMatrix = new THREE.Matrix3();
const clock = new THREE.Clock();

const V = () => new THREE.Vector3();

const position = new THREE.Vector3();
const normal = new THREE.Vector3(0, 1, 0);
const heading = new THREE.Vector3(0, 0, -1);
const aimDirection = new THREE.Vector3(0, 0, -1);
const flightAimTargetDirection = new THREE.Vector3(0, 0, -1);
const flightAimDirection = new THREE.Vector3(0, 0, -1);
const flightAimUp = new THREE.Vector3(0, 1, 0);
const flightAimTargetUp = new THREE.Vector3(0, 1, 0);

let ballMesh = null;
let bodyGroup = null;
let tankModelTemplate = null;
let localTankFadeMaterials = [];
const remoteTankTemplates = new Map();
const remoteTanks = new Map();
const playerTankIds = new Map();
const playerHealthBars = new Map();
let multiplayerPeer = null;
let multiplayerSessionId = null;
let multiplayerHost = false;
let localPlayerName = GAME_SELECTION.playerName || 'Player';
const playerNames = new Map();
const playerTeams = new Map();
const teamScores = { red: 0, blue: 0 };
let matchOver = false;
let hostConnection = null;
const peerConnections = new Map();
const multiplayerPoses = new Map();
let multiplayerSendAccumulator = 0;
let multiplayerPoseSequence = 0;
let multiplayerShotSequence = 0;
let multiplayerContactSequence = 0;
let localTankHealth = MAX_PLAYER_HEALTH;
let gameStarted = false;
let gamePaused = false;
let pauseMenuOpen = false;
let environmentReady = false;
let levelReady = false;
let tankReady = false;
let startupRequested = false;
let startupFinishing = false;
const startupMode = GAME_SELECTION.mode || 'freeplay';
let menuOrbitElapsed = 0;
const playerHealth = new Map();
const playerContactTimes = new Map();
const hostContactTimes = new Map();
const remoteMinigunPlayers = new Set();
const tankDestructions = new Map();
const tankFragments = [];
let localRespawnTimeout = null;

let levelMeshes = [];
let levelSpawnMarkers = [];
const mapBoundaryCenter = new THREE.Vector3();
let mapWarningRadius = 0;
let mapDeathRadius = 0;
let outsideWarningBoundary = false;
let boundaryWarningTimer = null;
let levelAnimationMixer = null;
const cometFogTextures = new Map();
const COMET_FOG_SCROLL_CYCLES_PER_SECOND = 1 / 24;
let cometFogScrollTime = 0;
let ballRadius = 1;

let forwardSpeed = 0;
let strafeSpeed = 0;

let aimPitch = 0;
let flightRoll = 0;
let bodyPitchLean = 0;
let bodySideLean = 0;

let previousForwardSpeed = 0;
let previousStrafeSpeed = 0;

let firstPerson = false;
let thirdPersonDistance = CAMERA_DISTANCE;
let mouseCaptured = false;
let rightMouseHeld = false;
let magnetsElement = null;
let magnetsActive = true;

let groundBoostRemaining = 0;
let groundBoostClock = 0;
let groundBoostWobbleYaw = 0;
let groundBoostWobblePitch = 0;

const keys = {};
const projectiles = [];
const targets = [];

let selectedWeapon = DEFAULT_TANK.primaryWeapon;
let fireHeld = false;
let minigunAccumulator = 0;
const weaponCooldowns = new Map();
let minigunHeat = 0;
let minigunOverheated = false;
let empDisabledRemaining = 0;
let flightState = 'attached'; // attached, flying, orienting, reattaching
let thrustRemaining = THRUST_DURATION;
let thrustRechargeDelayRemaining = 0;
let flightSpaceHeld = false;
let reattachElapsed = 0;
let reattachPlayClank = true;
let unsupportedSurfaceTime = 0;
let reattachStartDistance = 1;
let reattachOrientProgress = 0;
const cameraLookTarget = new THREE.Vector3();
const flightVelocity = new THREE.Vector3();
const reattachVelocity = new THREE.Vector3();
const reattachTarget = new THREE.Vector3();
const reattachNormal = new THREE.Vector3(0, 1, 0);
const reattachFromNormal = new THREE.Vector3(0, 1, 0);
const reattachFromHeading = new THREE.Vector3(0, 0, -1);
const reattachFromAim = new THREE.Vector3(0, 0, -1);
const reattachOrientQuat = new THREE.Quaternion();
let thrusterMesh = null;
let thrusterBaseQuaternion = null;
let thrusterBasePosition = null;
let thrusterBaseScale = null;
let thrusterLights = [];
let thrusterVisualMaterials = [];
let thrusterEffectsActive = false;

const cannonAudio = new Audio(CANNON_AUDIO_URL);
cannonAudio.preload = 'auto';
cannonAudio.volume = 0.8;
const reloadAudio = new Audio(RELOAD_AUDIO_URL);
reloadAudio.preload = 'auto';
reloadAudio.volume = 0.62;
const minigunAudio = new Audio(MINIGUN_AUDIO_URL);
minigunAudio.preload = 'auto';
minigunAudio.loop = true;
minigunAudio.volume = 0.55;
const collisionAudio = new Audio(COLLISION_AUDIO_URL);
collisionAudio.preload = 'auto';
collisionAudio.volume = 0.8;
const explosionAudio = new Audio(EXPLOSION_AUDIO_URL);
explosionAudio.preload = 'auto';
explosionAudio.volume = 0.8;
const musicAudio = new Audio();
musicAudio.preload = 'none';
musicAudio.volume = 0.05;
let musicTrackIndex = Math.floor(Math.random() * MUSIC_TRACKS.length);
let musicStarted = false;
const flightClunkAudio = new Audio(FLIGHT_CLUNK_AUDIO_URL);
flightClunkAudio.preload = 'auto';
flightClunkAudio.volume = 0.8;
const magnetAudio = new Audio(MAGNET_AUDIO_URL);
magnetAudio.preload = 'auto';
magnetAudio.volume = 0.28;
const engineAudio = new Audio(ENGINE_AUDIO_URL);
engineAudio.preload = 'auto';
engineAudio.loop = false; // Web Audio handles the engine loop without media-element loop gaps.
engineAudio.volume = 0;
const EngineAudioContext = window.AudioContext || window.webkitAudioContext;
const engineAudioContext = EngineAudioContext ? new EngineAudioContext() : null;
const engineGain = engineAudioContext ? engineAudioContext.createGain() : null;
if (engineGain) {
  engineGain.gain.value = 0;
  engineGain.connect(engineAudioContext.destination);
}
let engineBuffer = null;
let engineSource = null;
if (engineAudioContext) fetch(ENGINE_AUDIO_URL)
  .then(response => response.arrayBuffer())
  .then(data => engineAudioContext.decodeAudioData(data))
  .then(buffer => {
    engineBuffer = buffer;
    if (engineAudioUnlocked) startEngineAudio();
  })
  .catch(() => {});
const thrustAudio = new Audio(THRUST_AUDIO_URL);
thrustAudio.preload = 'auto';
thrustAudio.loop = true;
thrustAudio.volume = 0.55;

const collisionSparks = [];
let lastCollisionTime = -Infinity;
let engineAudioUnlocked = false;

const el = id => document.getElementById(id);
el('weapon').textContent = `${WEAPONS[DEFAULT_TANK.primaryWeapon].name} [1]`;
document.querySelector('[data-weapon-slot="1"]').classList.add('is-active');

// ============================================================
// ASSET LOADING
// ============================================================

function configureImportedLights(root) {
  root.traverse(obj => {
    if (!obj.isLight) return;

    if (obj.isPointLight || obj.isSpotLight) {
      obj.decay = 2;
    }

    console.log(
      'Imported light:',
      obj.name || obj.type,
      'intensity',
      obj.intensity.toFixed(3)
    );
  });
}

function configureThrusterEffects(root) {
  thrusterLights = [];
  thrusterVisualMaterials = [];
  root.traverse(obj => {
    if (obj.isLight) {
      thrusterLights.push({
        light: obj,
        intensity: obj.intensity,
        color: obj.color?.clone() || null
      });
      obj.visible = true;
      // Keep the light in Three.js's active light list while idle. A zero
      // intensity light is omitted from the shader parameters, so changing it
      // to a positive intensity on first thrust can compile a new program.
      // Black preserves the off appearance while keeping the shader stable.
      if (obj.color) obj.color.setRGB(0, 0, 0);
    }

    if (!obj.isMesh || !obj.material) return;
    const originalMaterials = Array.isArray(obj.material) ? obj.material : [obj.material];
    const clonedMaterials = originalMaterials.map(material => {
      if (!material) return material;
      const clone = material.clone();
      thrusterVisualMaterials.push({
        material: clone,
        colorWrite: clone.colorWrite,
        depthWrite: clone.depthWrite
      });
      clone.colorWrite = false;
      clone.depthWrite = false;
      return clone;
    });
    obj.castShadow = false;
    obj.receiveShadow = false;
    obj.material = Array.isArray(obj.material) ? clonedMaterials : clonedMaterials[0];
  });
}

function setThrusterEffectsActive(active) {
  if (thrusterEffectsActive === active) return;
  thrusterEffectsActive = active;
  for (const entry of thrusterLights) {
    entry.light.visible = true;
    entry.light.intensity = entry.intensity;
    if (entry.color && entry.light.color) {
      entry.light.color.copy(active ? entry.color : BLACK_LIGHT_COLOR);
    }
  }
  for (const entry of thrusterVisualMaterials) {
    entry.material.colorWrite = active ? entry.colorWrite : false;
    entry.material.depthWrite = active ? entry.depthWrite : false;
  }
}

function collectMeshes(root) {
  const meshes = [];

  root.traverse(obj => {
    if (!obj.isMesh) return;

    obj.castShadow = true;
    obj.receiveShadow = true;

    const materials = Array.isArray(obj.material)
      ? obj.material : [obj.material];

    materials.forEach(mat => {
      if (!mat) return;

      mat.side = THREE.DoubleSide;

    });

    meshes.push(obj);
  });

  return meshes;
}

function configureCometFogFlow(root) {
  cometFogTextures.clear();
  cometFogScrollTime = 0;

  root.traverse(object => {
    if (!object.isMesh) return;

    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material?.name?.toLowerCase().includes('comet tail')) continue;

      // glTF carries the static fog image; scrolling its UV transform here keeps
      // the exported asset portable while giving the comet a continuous flow.
      for (const texture of [material.map, material.alphaMap]) {
        if (!texture || cometFogTextures.has(texture)) continue;
        texture.wrapT = THREE.RepeatWrapping;
        texture.needsUpdate = true;
        cometFogTextures.set(texture, texture.offset.y);
      }
    }
  });

  if (cometFogTextures.size) {
    console.info(`Animated ${cometFogTextures.size} comet fog texture(s).`);
  }
}

function updateCometFogFlow(dt) {
  if (!cometFogTextures.size) return;

  cometFogScrollTime = (cometFogScrollTime + dt * COMET_FOG_SCROLL_CYCLES_PER_SECOND) % 1;
  for (const [texture, baseOffsetY] of cometFogTextures) {
    // Decreasing the UV offset makes the texture pattern travel toward UV Y+.
    texture.offset.y = baseOffsetY - cometFogScrollTime;
  }
}

function collectCollisionMeshes(root) {
  const collidableMeshes = [];
  root.traverse(object => {
    if (object.isMesh) {
      if ((object.name || '').trim().toLowerCase().startsWith('col-')) {
        collidableMeshes.push(object);
      }
    }
  });
  console.info(`Registered ${collidableMeshes.length} collision mesh(es) with the col- prefix.`);
  return collidableMeshes;
}

function registerTargets(root) {
  targets.length = 0;

  root.traverse(obj => {
    if (obj.name?.toLowerCase().startsWith('target')) registerTargetObject(obj);
  });

  updateTargetHud();
  console.info(`Registered ${targets.length} target(s). Name level objects with target prefix.`);
}

function registerTargetObject(root, { health = TARGET_STARTING_HEALTH, addToCollision = false, enemyTint = false, practiceTarget = false } = {}) {
  const meshes = [];
  root.traverse(child => {
    if (child.isMesh) meshes.push(child);
  });
  if (!meshes.length) return null;

  const record = {
    name: root.name, root, meshes, health, maxHealth: health, destroyed: false,
    practiceTarget,
    surfaceNormal: normal.clone(),
    homeQuaternion: root.quaternion.clone(),
    knockbackVelocity: new THREE.Vector3(),
    rockAxis: new THREE.Vector3(0, 0, 1),
    rockAngle: 0,
    rockVelocity: 0,
    respawnRemaining: 0,
    healthBar: null
  };
  meshes.forEach(mesh => {
    mesh.userData.targetRecord = record;
    // Clone materials so damage tinting never changes unrelated level pieces.
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(mat => mat ? mat.clone() : mat);
    } else if (mesh.material) {
      mesh.material = mesh.material.clone();
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach(material => {
      if (!material?.color) return;
      if (enemyTint) material.color.lerp(new THREE.Color(0xc53535), 0.28);
    });
    if (addToCollision && !levelMeshes.includes(mesh)) levelMeshes.push(mesh);
  });
  targets.push(record);
  return record;
}

function createFreeplayEnemy() {
  if (startupMode !== 'freeplay' || !tankModelTemplate || scene.getObjectByName('Target_PracticeTank')) return;
  const root = new THREE.Group();
  root.name = 'Target_PracticeTank';
  const model = tankModelTemplate.clone(true);
  model.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  root.add(model);
  root.position.copy(position).addScaledVector(heading, 24);
  root.quaternion.copy(tankRoot.quaternion);
  scene.add(root);
  const record = registerTargetObject(root, {
    health: 200,
    addToCollision: true,
    enemyTint: true,
    practiceTarget: true
  });
  if (record) {
    const element = document.createElement('div');
    element.className = 'player-health-bar training-health-bar';
    const label = document.createElement('span');
    label.className = 'player-health-label';
    label.textContent = 'PRACTICE TANK';
    const track = document.createElement('div');
    track.className = 'player-health-track';
    const fill = document.createElement('div');
    fill.className = 'player-health-fill';
    track.appendChild(fill);
    element.append(label, track);
    el('player-health-bars').appendChild(element);
    record.healthBar = { element, fill };
    updateTargetHud();
  }
}

function updatePracticeTargets(dt) {
  camera.updateMatrixWorld(true);
  for (const target of targets) {
    if (!target.practiceTarget) continue;
    if (target.destroyed) {
      if (gameStarted && !gamePaused) {
        target.respawnRemaining = Math.max(0, target.respawnRemaining - dt);
        if (target.respawnRemaining === 0) respawnPracticeTank(target);
      }
      if (target.destroyed) {
        if (target.healthBar) target.healthBar.element.hidden = true;
        continue;
      }
    }
    target.knockbackVelocity.multiplyScalar(Math.exp(-3 * dt));
    target.knockbackVelocity.projectOnPlane(target.surfaceNormal);
    target.root.position.addScaledVector(target.knockbackVelocity, dt);
    target.rockVelocity += -target.rockAngle * 20 * dt;
    target.rockVelocity *= Math.exp(-5.2 * dt);
    target.rockAngle = THREE.MathUtils.clamp(target.rockAngle + target.rockVelocity * dt, -0.9, 0.9);
    target.root.quaternion.copy(target.homeQuaternion).premultiply(
      new THREE.Quaternion().setFromAxisAngle(target.rockAxis, target.rockAngle)
    );

    const bar = target.healthBar;
    if (!bar) continue;
    const worldPosition = target.root.position.clone()
      .addScaledVector(target.surfaceNormal, ballRadius * 3.2);
    const screenPosition = worldPosition.project(camera);
    const onScreen = gameStarted && !target.destroyed && screenPosition.z >= -1 && screenPosition.z <= 1 &&
      Math.abs(screenPosition.x) <= 1.12 && Math.abs(screenPosition.y) <= 1.12;
    bar.element.hidden = !onScreen;
    if (!onScreen) continue;
    bar.element.style.left = `${(screenPosition.x * 0.5 + 0.5) * innerWidth}px`;
    bar.element.style.top = `${(-screenPosition.y * 0.5 + 0.5) * innerHeight}px`;
    const ratio = THREE.MathUtils.clamp(target.health / target.maxHealth, 0, 1);
    bar.fill.style.width = `${ratio * 100}%`;
    bar.fill.style.backgroundColor = ratio > 0.5 ? '#55e585' : ratio > 0.25 ? '#ffd447' : '#ff514d';
    bar.element.title = `${Math.ceil(target.health)} / ${target.maxHealth}`;
  }
}

function respawnPracticeTank(target) {
  clearTankDestruction('practice-target');
  target.health = target.maxHealth;
  target.destroyed = false;
  target.respawnRemaining = 0;
  target.root.visible = true;
  target.root.position.copy(target.homePosition);
  target.root.quaternion.copy(target.homeQuaternion);
  target.root.updateWorldMatrix(true, true);
  target.knockbackVelocity.set(0, 0, 0);
  target.rockAngle = 0;
  target.rockVelocity = 0;
  target.meshes.forEach(mesh => {
    mesh.visible = true;
    mesh.userData.targetRecord = target;
    mesh.updateWorldMatrix(true, false);
    if (!levelMeshes.includes(mesh)) levelMeshes.push(mesh);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach(material => {
      if (!material?.color || !material.userData.originalTargetColor) return;
      material.color.copy(material.userData.originalTargetColor);
      if (material.emissive) material.emissive.setHex(0x000000);
      if ('emissiveIntensity' in material) material.emissiveIntensity = 0;
    });
  });
  if (target.healthBar) target.healthBar.element.hidden = false;
  updateTargetHud(target);
  showMessage('PRACTICE TANK RESPAWNED');
}

function applyPracticeTankKnockback(target, shot) {
  if (!target?.practiceTarget || shot.weapon !== 'cannon') return;
  const direction = shot.velocity.clone().projectOnPlane(target.surfaceNormal);
  if (direction.lengthSq() < 0.0001) return;
  direction.normalize();
  target.knockbackVelocity.addScaledVector(direction, 8.5);
  const torqueAxis = new THREE.Vector3().crossVectors(target.surfaceNormal, direction);
  if (torqueAxis.lengthSq() > 0.0001) {
    target.rockAxis.copy(torqueAxis.normalize());
    target.rockVelocity += 7.2;
  }
}

function spawnTankHitEffect(point, surfaceNormal, weapon, wreckId = null) {
  const cannon = weapon === 'cannon';
  if (!cannon) {
    const plume = new THREE.Group();
    const outer = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xff9d36, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, userData: { baseOpacity: 0.82 } })
    );
    outer.scale.set(1, 0.72, 1);
    plume.add(outer);
    const hotCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff2c2, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, userData: { baseOpacity: 0.95 } })
    );
    plume.add(hotCore);
    plume.position.copy(point).addScaledVector(surfaceNormal, 0.08);
    scene.add(plume);
    projectiles.push({ kind: 'effect', mesh: plume, life: 0.18, maxLife: 0.18, wreckId });
  }

  const sparkCount = wreckId ? 2 : cannon ? 18 : 5;
  for (let i = 0; i < sparkCount; i++) {
    const sparkLife = (cannon ? 0.3 : 0.16) + Math.random() * (cannon ? 0.28 : 0.12);
    const sparkSize = cannon ? 0.035 + Math.random() * 0.025 : 0.018 + Math.random() * 0.014;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(sparkSize, 5, 4),
      new THREE.MeshBasicMaterial({ color: Math.random() > 0.35 ? 0xffa13a : 0xffe6a3, transparent: true, opacity: 1, toneMapped: false, depthWrite: false })
    );
    mesh.position.copy(point);
    scene.add(mesh);
    const direction = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
      .addScaledVector(surfaceNormal, 0.75).normalize();
    collisionSparks.push({
      mesh,
      velocity: direction.multiplyScalar((cannon ? 8 : 3) + Math.random() * (cannon ? 7 : 2)),
      life: sparkLife,
      maxLife: sparkLife,
      wreckId
    });
  }
}

function spawnWreckSmoke(point, up, wreckId) {
  const life = 1.15 + Math.random() * 0.5;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.24 + Math.random() * 0.18, 7, 6),
    new THREE.MeshBasicMaterial({
      color: 0x302b27,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      toneMapped: false,
      userData: { baseOpacity: 0.48 }
    })
  );
  mesh.position.copy(point);
  mesh.scale.setScalar(0.45);
  scene.add(mesh);
  const velocity = up.clone().multiplyScalar(0.8 + Math.random() * 0.7);
  velocity.add(new THREE.Vector3((Math.random() - 0.5) * 0.45, 0, (Math.random() - 0.5) * 0.45));
  projectiles.push({ kind: 'smoke', mesh, life, maxLife: life, velocity, wreckId });
}

function updateTargetHud(lastTarget = null) {
  const destroyed = targets.filter(target => target.destroyed).length;
  let label = `${destroyed} / ${targets.length} destroyed`;
  if (lastTarget && !lastTarget.destroyed) {
    label += ` · ${lastTarget.name}: ${Math.ceil(lastTarget.health)} HP`;
  } else if (lastTarget && lastTarget.destroyed) {
    label += ` · ${lastTarget.name} destroyed`;
  }
  el('targets').textContent = label;
}

function findTargetRecord(object) {
  let current = object;
  while (current) {
    if (current.userData && current.userData.targetRecord) {
      return current.userData.targetRecord;
    }
    current = current.parent;
  }
  return null;
}

function damageTarget(object, amount) {
  const target = findTargetRecord(object);
  if (!target || target.destroyed) return;

  target.health = Math.max(0, target.health - amount);
  const ratio = target.health / target.maxHealth;

  target.meshes.forEach(mesh => {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach(mat => {
      if (!mat || !mat.color) return;
      if (!mat.userData.originalTargetColor) {
        mat.userData.originalTargetColor = mat.color.clone();
      }
      mat.color.copy(mat.userData.originalTargetColor).lerp(
        new THREE.Color(0xff2418), 1 - ratio
      );
      if (mat.emissive) {
        mat.emissive.setHex(0x4a0800);
        mat.emissiveIntensity = (1 - ratio) * 0.65;
      }
    });
  });

  if (target.health <= 0) {
    target.destroyed = true;
    target.meshes.forEach(mesh => {
      const index = levelMeshes.indexOf(mesh);
      if (index >= 0) levelMeshes.splice(index, 1);
    });
    if (target.practiceTarget) createTankDestruction('practice-target', target.root);
    else target.meshes.forEach(mesh => { mesh.visible = false; });
    if (target.practiceTarget) target.respawnRemaining = PRACTICE_TANK_RESPAWN_DELAY;
    if (target.healthBar) target.healthBar.element.hidden = true;
    showMessage(`${target.name} destroyed!`);
  }

  updateTargetHud(target);
}

function spawn() {
  const marker = levelSpawnMarkers.length
    ? levelSpawnMarkers[Math.floor(Math.random() * levelSpawnMarkers.length)]
    : null;

  if (marker) {
    levelRoot.updateMatrixWorld(true);
    marker.getWorldPosition(position);
    const markerRotation = marker.getWorldQuaternion(new THREE.Quaternion());
    const markerUp = new THREE.Vector3(0, 1, 0).applyQuaternion(markerRotation).normalize();
    const markerForward = new THREE.Vector3(0, 0, -1).applyQuaternion(markerRotation).normalize();
    normal.copy(markerUp);

    // Start empties can be placed in open space. Find the nearest arena face
    // and magnetically seat the ball against it before activating the player.
    const nearest = findNearestSurface();
    if (nearest) {
      position.copy(nearest.point).addScaledVector(
        nearest.normal,
        ballRadius + BALL_CLEARANCE
      );
      normal.copy(nearest.normal);
    }

    heading.copy(markerForward).projectOnPlane(normal).normalize();
    if (heading.lengthSq() < 0.001) {
      heading.set(0, 0, -1).projectOnPlane(normal).normalize();
    }
    if (heading.lengthSq() < 0.001) {
      heading.set(1, 0, 0).projectOnPlane(normal).normalize();
    }
  } else {
    const bounds = new THREE.Box3().setFromObject(levelRoot);
    position.set(
      (bounds.min.x + bounds.max.x) / 2,
      bounds.min.y + ballRadius + BALL_CLEARANCE + 0.15,
      (bounds.min.z + bounds.max.z) / 2
    );
    normal.set(0, 1, 0);
    heading.set(0, 0, -1);
    snapToSurface(0);
  }

  aimDirection.copy(heading);

  updateTankTransform();

  camera.position.copy(position)
    .addScaledVector(normal, CAMERA_HEIGHT)
    .addScaledVector(heading, -CAMERA_DISTANCE);

  camera.lookAt(position);
  cameraLookTarget.copy(position);
}

function configureMapBoundary(root) {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  if (bounds.isEmpty()) return;
  const mapSphere = bounds.getBoundingSphere(new THREE.Sphere());
  mapBoundaryCenter.copy(mapSphere.center);
  // Keep the boundary outside every map corner, with room for players to fly.
  mapWarningRadius = Math.max(mapSphere.radius * 1.45, ballRadius * 30);
  mapDeathRadius = Math.max(mapSphere.radius * 1.8, mapWarningRadius + ballRadius * 20);
  outsideWarningBoundary = false;
}

function updateMapBoundary() {
  if (mapDeathRadius <= 0 || localTankHealth <= 0) return;
  const distance = position.distanceTo(mapBoundaryCenter);
  if (distance >= mapDeathRadius) {
    if (multiplayerPeer && !multiplayerHost) {
      sendToHost({ type: 'boundary-destroyed' });
      updateTankHealth(multiplayerSessionId, 0);
    } else if (multiplayerHost && multiplayerSessionId) {
      updateTankHealth(multiplayerSessionId, 0);
      broadcastTankDestroyed(multiplayerSessionId);
    } else {
      // Solo sessions have no multiplayerSessionId, so updateTankHealth's
      // session routing does not apply. Drive the local destruction directly.
      localTankHealth = 0;
      el('tank-health').textContent = '0%';
      el('hud-health-fill').style.width = '0%';
      destroyLocalPlayer();
    }
    showMessage('NEUTRALIZING DEFECTOR', 'boundary-death');
    return;
  }

  if (distance >= mapWarningRadius && !outsideWarningBoundary) {
    outsideWarningBoundary = true;
    showMessage('RETURN TO ENGAGEMENT ZONE', 'boundary-warning');
  } else if (distance < mapWarningRadius - ballRadius * 2) {
    outsideWarningBoundary = false;
  }
}

function updateMenuCamera(dt) {
  menuOrbitElapsed += dt;
  const angle = menuOrbitElapsed * 0.12;
  const radius = CAMERA_DISTANCE * 0.78;
  camera.up.set(0, 1, 0);
  camera.position.set(
    position.x + Math.sin(angle) * radius,
    position.y + CAMERA_HEIGHT * 0.72,
    position.z + Math.cos(angle) * radius
  );
  camera.lookAt(position.clone().addScaledVector(normal, ballRadius * 0.75));
}

function startGame(mode) {
  if (gameStarted) return;
  gameStarted = true;
  document.body.classList.add('game-started');
  el('start-screen').hidden = true;
  el('level-screen').hidden = true;
  el('tank-screen').hidden = true;
  el('game-loading').hidden = true;
  el('multiplayer-panel').hidden = true;
  engineAudioUnlocked = true;
  startEngineAudio();
  startGameMusic();
  if (mode && mode !== 'freeplay') setNetworkStatus(mode === 'host' ? 'Starting host…' : 'Joining match…');
  showMessage('Click to capture mouse');
}

function openGameMenu() {
  if (!gameStarted || pauseMenuOpen) return;
  pauseMenuOpen = true;
  gamePaused = false;
  el('pause-menu-status').textContent = gamePaused
    ? 'Game paused'
    : 'Online match continues while this menu is open';
  el('pause-menu').hidden = false;

  Object.keys(keys).forEach(key => { keys[key] = false; });
  fireHeld = false;
  minigunAccumulator = 0;
  stopMinigunAudio();
  announceWeaponAudio(false);
  setZoom(false);
  if (flightState === 'flying') {
    flightState = 'drifting';
    flightSpaceHeld = false;
    if (thrustRemaining > 0) {
      thrustRechargeDelayRemaining = THRUST_RECHARGE_DELAY_AFTER_USE;
    }
    stopThrustAudio();
  }
  if (document.pointerLockElement) document.exitPointerLock();
  if (engineGain) engineGain.gain.value = 0;
  else engineAudio.volume = 0;
}

function closeGameMenu() {
  pauseMenuOpen = false;
  gamePaused = false;
  el('pause-menu').hidden = true;
  showMessage('Click to capture mouse');
}

el('pause-resume').addEventListener('click', closeGameMenu);
el('pause-respawn').addEventListener('click', () => {
  respawnLocalPlayer();
  closeGameMenu();
});
el('pause-main-menu').addEventListener('click', () => window.location.reload());

function updateLoadingStatus() {
  const status = el('game-loading-status');
  if (!status) return;
  if (!environmentReady) status.textContent = 'Loading world lighting…';
  else if (!levelReady) status.textContent = 'Loading arena…';
  else if (!tankReady) status.textContent = 'Loading tank…';
  else status.textContent = 'Preparing graphics…';
  const progress = (environmentReady ? 34 : 8) + (levelReady ? 33 : 0) + (tankReady ? 25 : 0);
  window.updateGameLoading?.(progress, status.textContent);
}

async function maybeFinishGameStartup() {
  if (
    !startupRequested || startupFinishing ||
    !environmentReady || !levelReady || !tankReady
  ) return;

  startupFinishing = true;
  updateLoadingStatus();
  spawn();
  updateTankTransform();
  createFreeplayEnemy();
  scene.updateMatrixWorld(true);

  // Compile both thruster states and the muzzle flash light before gameplay.
  // A newly active light can otherwise force a shader rebuild on the first shot.
  setThrusterEffectsActive(true);
  muzzleFlashLight.intensity = 17;
  try {
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
    renderer.render(scene, camera);

    setThrusterEffectsActive(false);
    muzzleFlashLight.intensity = 0.001;
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
    renderer.render(scene, camera);
  } catch (error) {
    console.warn('Graphics warm-up did not complete:', error);
  } finally {
    setThrusterEffectsActive(false);
    muzzleFlashLight.intensity = 0.001;
  }

  startGame(startupMode);
  window.updateGameLoading?.(100, 'Ready');
  if (startupMode === 'host') hostMultiplayerGame();
  if (startupMode === 'join') joinMultiplayerGame();
}

function playGameMusicTrack() {
  musicAudio.src = MUSIC_TRACKS[musicTrackIndex];
  musicAudio.currentTime = 0;
  const promise = musicAudio.play();
  if (promise?.catch) promise.catch(() => { musicStarted = false; });
}

function startGameMusic() {
  if (musicStarted) return;
  musicStarted = true;
  playGameMusicTrack();
}

musicAudio.addEventListener('ended', () => {
  musicTrackIndex = (musicTrackIndex + 1) % MUSIC_TRACKS.length;
  playGameMusicTrack();
});

loader.load(LEVEL_URL, gltf => {
  levelRoot.add(gltf.scene);
  gltf.scene.updateMatrixWorld(true);
  configureCometFogFlow(gltf.scene);
  if (gltf.animations.length) {
    levelAnimationMixer = new THREE.AnimationMixer(gltf.scene);
    for (const clip of gltf.animations) {
      levelAnimationMixer.clipAction(clip).play();
      console.info(`Playing level animation: ${clip.name || 'unnamed'}`);
    }
  }
  configureImportedLights(gltf.scene);
  collectMeshes(gltf.scene); // Configure shadows and materials for every visible level mesh.
  levelMeshes = collectCollisionMeshes(gltf.scene);
  levelSpawnMarkers = [];
  gltf.scene.traverse(object => {
    if (object.name && object.name.toLowerCase().startsWith('start')) {
      levelSpawnMarkers.push(object);
    }
  });
  console.info(`Found ${levelSpawnMarkers.length} start marker(s).`);
  configureMapBoundary(levelRoot);
  registerTargets(gltf.scene);
  el('surface').textContent = 'Level loaded';
  levelReady = true;
  updateLoadingStatus();
  maybeFinishGameStartup();

}, undefined, error => {
  console.error('Level loading failed:', error);

  // Fallback interior cube for testing.
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(70, 70, 70, 12, 12, 12),
    new THREE.MeshStandardMaterial({
      color: 0x293b4c,
      side: THREE.BackSide
    })
  );

  levelRoot.add(cube);
  configureMapBoundary(levelRoot);
  levelMeshes = [cube];
  levelSpawnMarkers = [];
  registerTargets(cube);
  levelReady = true;
  updateLoadingStatus();
  maybeFinishGameStartup();
});

loader.load(TANK_URL, gltf => {

  const model = gltf.scene;
  model.scale.setScalar(MODEL_SCALE);
  configureImportedLights(model);
  tankModelTemplate = model.clone(true);
  remoteTankTemplates.set(DEFAULT_TANK_ID, tankModelTemplate);
  tankRoot.add(model);
  tankRoot.visible = !firstPerson;

  model.traverse(obj => {
    if (obj.isMesh) {
        // Keep the local player's fade independent from remote tank materials.
        obj.material = Array.isArray(obj.material)
          ? obj.material.map(material => material?.clone() || material)
          : obj.material?.clone() || obj.material;
        obj.castShadow = true;
        obj.receiveShadow = true;
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const material of materials) {
          if (!material) continue;
          localTankFadeMaterials.push({
            material,
            opacity: material.opacity,
            transparent: material.transparent,
            depthWrite: material.depthWrite
          });
        }
    }
    if (obj.name === 'Ball') ballMesh = obj;
    if (obj.name === 'Body') bodyGroup = obj;
    if (obj.name && obj.name.toLowerCase() === 'magnets') {
      magnetsElement = obj;
      magnetsElement.visible = magnetsActive;
    }

    if (obj.name && obj.name.toLowerCase() === 'thruster') {
      thrusterMesh = obj;
      thrusterBaseQuaternion = obj.quaternion.clone();
      thrusterBasePosition = obj.position.clone();
      thrusterBaseScale = obj.scale.clone();
      obj.visible = true;
      console.log('Thruster found:', obj.name);
    }
    
  });
  if (thrusterMesh) configureThrusterEffects(thrusterMesh);
  if (!ballMesh) console.warn('Missing Ball mesh');
  if (!bodyGroup) console.warn('Missing Body group');
  if (!magnetsElement) console.warn('Missing magnets element');

  if (ballMesh) {
    const bounds = new THREE.Box3().setFromObject(ballMesh);
    const size = bounds.getSize(V());
    ballRadius = Math.max(size.x, size.y, size.z) / 2;
  }

  for (const [sessionId, remote] of remoteTanks) {
    attachRemoteModel(remote);
    if (remote.health <= 0 && remote.hasPose) createTankDestruction(sessionId, remote.root);
  }

  tankReady = true;
  updateLoadingStatus();
  maybeFinishGameStartup();

}, undefined, error => {
  console.error('Tank loading failed:', error);
  el('message').textContent = 'Could not load tank.glb';
  tankReady = true;
  updateLoadingStatus();
  maybeFinishGameStartup();
});

// ============================================================
// SURFACE FOLLOWING
// ============================================================

function snapToSurface(maxDistance = 2.5, dt = 0) {
  if (!levelMeshes.length) return false;

  const offset = Math.max(4, ballRadius + 2);

  const origin = position.clone().addScaledVector(normal, offset);

  raycaster.set(origin, normal.clone().negate());
  raycaster.far = maxDistance + offset;

  const hits = raycaster.intersectObjects(levelMeshes, true);

  if (!hits.length) return false;

  const hit = hits[0];

  // A ray can see a lower platform through a gap. Only accept it as magnetic
  // support when its point remains close to the tank's ball.
  if (hit.point.distanceTo(position) > ballRadius + BALL_CLEARANCE + 0.75) return false;

  const targetNormal = getWorldHitNormal(hit);

  if (targetNormal.dot(normal) < 0) {
    targetNormal.negate();
  }

  const nextNormal = dt > 0
    ? normal.clone().lerp(targetNormal, 1 - Math.exp(-SURFACE_RESPONSE * dt)).normalize()
    : targetNormal;
  const snappedPosition = hit.point.clone()
    .addScaledVector(nextNormal, ballRadius + BALL_CLEARANCE);
  if (snappedPosition.distanceTo(position) > ballRadius * 1.25 + 0.2) return false;

  normal.copy(nextNormal);
  position.copy(snappedPosition);

  return true;
}

function getWorldHitNormal(hit) {
  const normal = hit.normal ? hit.normal.clone() : hit.face.normal.clone();
  surfaceNormalMatrix.getNormalMatrix(hit.object.matrixWorld);
  return normal.applyMatrix3(surfaceNormalMatrix).normalize();
}

// ============================================================
// AIMING
// ============================================================

function getAimDirection() {
  if (flightState === 'flying' || flightState === 'drifting') {
    return flightAimDirection.clone().normalize();
  }

  const yawed = aimDirection.clone()
    .applyAxisAngle(normal, groundBoostWobbleYaw);

  const pitch = THREE.MathUtils.clamp(
  aimPitch + groundBoostWobblePitch,
    -MAX_AIM_PITCH,
    MAX_AIM_PITCH
  );

  return yawed.multiplyScalar(Math.cos(pitch))
    .addScaledVector(normal, Math.sin(pitch))
    .normalize();
}

function updateFlightAimFromSurfaceAngles() {
  const pitch = aimPitch;
  flightAimDirection.copy(aimDirection)
    .multiplyScalar(Math.cos(pitch))
    .addScaledVector(normal, Math.sin(pitch))
    .normalize();

  // This tangent stays continuous as aim passes either pole, unlike a
  // projection that becomes zero at vertical aim and has to choose a new up.
  flightAimUp.copy(aimDirection)
    .multiplyScalar(-Math.sin(pitch))
    .addScaledVector(normal, Math.cos(pitch))
    .normalize();
}

function aimFrameQuaternion(direction, up) {
  const forward = direction.clone().normalize();
  const right = new THREE.Vector3().crossVectors(forward, up).normalize();
  const correctedUp = new THREE.Vector3().crossVectors(right, forward).normalize();
  const frame = new THREE.Matrix4().makeBasis(
    right,
    correctedUp,
    forward.clone().negate()
  );
  return new THREE.Quaternion().setFromRotationMatrix(frame);
}

function getFlightUp() {
  return flightAimUp.clone().applyAxisAngle(flightAimDirection, flightRoll).normalize();
}

function updateFlightAim(dt) {
  const rollInput = (keys.KeyE ? 1 : 0) - (keys.KeyQ ? 1 : 0);
  flightRoll += rollInput * FLIGHT_ROLL_RATE * dt;
  while (flightRoll > Math.PI) flightRoll -= Math.PI * 2;
  while (flightRoll < -Math.PI) flightRoll += Math.PI * 2;

  const response = 1 - Math.exp(-FLIGHT_AIM_RESPONSE * dt);
  const currentFrame = aimFrameQuaternion(flightAimDirection, flightAimUp);
  const targetFrame = aimFrameQuaternion(flightAimTargetDirection, flightAimTargetUp);
  const frameDifference = targetFrame.multiply(currentFrame.clone().invert());
  if (frameDifference.w < 0) {
    frameDifference.set(
      -frameDifference.x,
      -frameDifference.y,
      -frameDifference.z,
      -frameDifference.w
    );
  }
  const frameStep = new THREE.Quaternion().slerp(frameDifference, response);
  flightAimDirection.applyQuaternion(frameStep).normalize();
  flightAimUp.applyQuaternion(frameStep).normalize();

  const tangent = flightAimDirection.clone().projectOnPlane(normal);
  if (tangent.lengthSq() > 0.0001) aimDirection.copy(tangent.normalize());
  aimPitch = Math.asin(THREE.MathUtils.clamp(flightAimDirection.dot(normal), -1, 1));
}

function updateTankTransform() {

  tankRoot.position.copy(position);

  const f = heading.clone().projectOnPlane(normal).normalize();
  const right = new THREE.Vector3().crossVectors(f, normal).normalize();
  const back = f.clone().negate();

  const basis = new THREE.Matrix4().makeBasis(right, normal, back);

  tankRoot.quaternion.setFromRotationMatrix(basis);
  if (flightState === 'flying' || flightState === 'drifting') {
    const roll = new THREE.Quaternion().setFromAxisAngle(getAimDirection(), flightRoll);
    tankRoot.quaternion.premultiply(roll);
  }

  if (bodyGroup) {
    const visualAim = getAimDirection();
    const airborneAim = flightState === 'flying' || flightState === 'drifting';
    if (airborneAim) {
      const forward = visualAim;
      const up = getFlightUp();
      const worldOrientation = aimFrameQuaternion(forward, up);
      const parentOrientation = new THREE.Quaternion();
      tankRoot.updateMatrixWorld(true);
      bodyGroup.parent.getWorldQuaternion(parentOrientation);
      bodyGroup.quaternion.copy(parentOrientation.invert().multiply(worldOrientation));
      return;
    }

    bodyGroup.rotation.order = 'YXZ';
    const tangentAim = airborneAim
      ? aimDirection.clone().projectOnPlane(normal)
      : visualAim.clone().projectOnPlane(normal);
    if (tangentAim.lengthSq() < 0.001) tangentAim.copy(aimDirection).projectOnPlane(normal);
    if (tangentAim.lengthSq() < 0.001) tangentAim.copy(heading).projectOnPlane(normal);
    tangentAim.normalize();

    const yaw = Math.atan2(
      heading.clone().cross(tangentAim).dot(normal),
      heading.dot(tangentAim)
    );

    const pitch = Math.asin(THREE.MathUtils.clamp(visualAim.dot(normal), -1, 1));

    bodyGroup.rotation.y =
      MODEL_FORWARD_NEGATIVE_Z ? yaw : -yaw;

    bodyGroup.rotation.x =
      (MODEL_FORWARD_NEGATIVE_Z ? pitch : -pitch) + bodyPitchLean;

    bodyGroup.rotation.z = bodySideLean;
  }
}

// Remote tanks are visual replicas. Each player still simulates movement locally;
// the room host relays poses between peers over WebRTC.
function attachRemoteModel(remote) {
  const tankId = remote.tankId || DEFAULT_TANK_ID;
  if (remote.modelTankId === tankId || remote.loadingTankId === tankId) return;
  if (remote.model) remote.root.remove(remote.model);
  remote.model = null;
  remote.modelTankId = null;
  remote.body = null;
  remote.magnets = null;

  const addModel = template => {
    if (remoteTanks.get(remote.sessionId) !== remote || remote.tankId !== tankId) return;
    const model = template.clone(true);
    remote.body = null;
    model.traverse(object => {
      if (object.name === 'Body') remote.body = object;
      if (object.name && object.name.toLowerCase() === 'magnets') {
        remote.magnets = object;
        object.visible = remote.magnetsActive;
      }
    });
    remote.model = model;
    remote.modelTankId = tankId;
    remote.root.add(model);
  };

  const template = remoteTankTemplates.get(tankId);
  if (template) {
    addModel(template);
    return;
  }

  const tank = TANKS[tankId] || DEFAULT_TANK;
  remote.loadingTankId = tankId;
  loader.load(tank.model, gltf => {
    const loaded = gltf.scene;
    loaded.scale.setScalar(MODEL_SCALE);
    configureImportedLights(loaded);
    const loadedTemplate = loaded.clone(true);
    remoteTankTemplates.set(tankId, loadedTemplate);
    if (remote.loadingTankId === tankId) remote.loadingTankId = null;
    addModel(loadedTemplate);
  }, undefined, error => {
    if (remote.loadingTankId === tankId) remote.loadingTankId = null;
    console.error(`Could not load remote ${tank.name} model:`, error);
  });
}

function ensureRemoteTank(sessionId) {
  if (sessionId === multiplayerSessionId) return null;
  let remote = remoteTanks.get(sessionId);
  if (!remote) {
    const root = new THREE.Group();
    scene.add(root);
    remote = {
      sessionId,
      root,
      tankId: playerTankIds.get(sessionId) || DEFAULT_TANK_ID,
      model: null,
      modelTankId: null,
      loadingTankId: null,
      body: null,
      magnets: null,
      magnetsActive: true,
      targetPosition: new THREE.Vector3(),
      visualPosition: new THREE.Vector3(),
      targetRotation: new THREE.Quaternion(),
      visualRotation: new THREE.Quaternion(),
      targetBodyRotation: null,
      hitVelocity: new THREE.Vector3(),
      hitOffset: new THREE.Vector3(),
      hitRockAxis: new THREE.Vector3(0, 0, 1),
      hitRockAngle: 0,
      hitRockVelocity: 0,
      lastSequence: -1,
      latestPose: null,
      health: MAX_PLAYER_HEALTH,
      hasPose: false
    };
    remoteTanks.set(sessionId, remote);
    attachRemoteModel(remote);
  }
  return remote;
}

function setRemoteTankType(sessionId, tankId) {
  if (typeof sessionId !== 'string' || !Object.hasOwn(TANKS, tankId)) return;
  playerTankIds.set(sessionId, tankId);
  if (sessionId === multiplayerSessionId) return;
  const remote = ensureRemoteTank(sessionId);
  if (!remote) return;
  remote.tankId = tankId;
  attachRemoteModel(remote);
}

function applyRemotePose(sessionId, pose, sequence = 0) {
  if (!pose || !Array.isArray(pose.position) || !Array.isArray(pose.rotation)) return;
  if (![...pose.position, ...pose.rotation].every(Number.isFinite)) return;
  const remote = ensureRemoteTank(sessionId);
  if (!remote) return;
  if (sequence <= remote.lastSequence) return;
  remote.lastSequence = sequence;
  remote.latestPose = pose;
  remote.targetPosition.fromArray(pose.position);
  remote.targetRotation.fromArray(pose.rotation).normalize();
  if (Array.isArray(pose.bodyRotation) && pose.bodyRotation.every(Number.isFinite)) {
    remote.targetBodyRotation = pose.bodyRotation;
  }
  if (typeof pose.magnetsActive === 'boolean') {
    remote.magnetsActive = pose.magnetsActive;
    if (remote.magnets) remote.magnets.visible = pose.magnetsActive;
  }
  if (!remote.hasPose) {
    remote.root.position.copy(remote.targetPosition);
    remote.root.quaternion.copy(remote.targetRotation);
    remote.visualPosition.copy(remote.targetPosition);
    remote.visualRotation.copy(remote.targetRotation);
    remote.hasPose = true;
  }
  if (playerHealth.get(sessionId) === 0 && !tankDestructions.has(sessionId)) {
    remote.health = 0;
    createTankDestruction(sessionId, remote.root);
  }
}

function showRemoteTankDestruction(message) {
  if (typeof message.sessionId !== 'string' || message.sessionId === multiplayerSessionId) return;
  const remote = ensureRemoteTank(message.sessionId);
  if (!remote) return;
  const pose = message.pose;
  if (!remote.hasPose && pose && Array.isArray(pose.position) && Array.isArray(pose.rotation) &&
      [...pose.position, ...pose.rotation].every(Number.isFinite)) {
    remote.root.position.fromArray(pose.position);
    remote.root.quaternion.fromArray(pose.rotation).normalize();
    remote.targetPosition.copy(remote.root.position);
    remote.targetRotation.copy(remote.root.quaternion);
    remote.visualPosition.copy(remote.root.position);
    remote.visualRotation.copy(remote.root.quaternion);
    remote.hasPose = true;
  }
  remote.health = 0;
  playerHealth.set(message.sessionId, 0);
  if (remote.hasPose) createTankDestruction(message.sessionId, remote.root);
}

function updateRemoteTanks(dt) {
  for (const remote of remoteTanks.values()) {
    if (remote.empDisabledRemaining > 0) {
      remote.empDisabledRemaining = Math.max(0, remote.empDisabledRemaining - dt);
      if (!remote.empDisabledRemaining && remote.root.userData.empAura) remote.root.userData.empAura.visible = false;
      if (remote.root.userData.empAura) remote.root.userData.empAura.rotation.y += dt * 2.4;
    }
    if (!remote.hasPose || remote.health <= 0) continue;
    const blend = 1 - Math.exp(-14 * dt);
    remote.hitOffset.addScaledVector(remote.hitVelocity, dt);
    remote.hitVelocity.multiplyScalar(Math.exp(-3.2 * dt));
    remote.hitOffset.multiplyScalar(Math.exp(-0.18 * dt));
    remote.hitRockVelocity += -remote.hitRockAngle * 20 * dt;
    remote.hitRockVelocity *= Math.exp(-5.2 * dt);
    remote.hitRockAngle = THREE.MathUtils.clamp(remote.hitRockAngle + remote.hitRockVelocity * dt, -0.8, 0.8);
    remote.visualPosition.lerp(remote.targetPosition, blend);
    remote.root.position.copy(remote.visualPosition).add(remote.hitOffset);
    remote.visualRotation.slerp(remote.targetRotation, blend);
    remote.root.quaternion.copy(remote.visualRotation).premultiply(
      new THREE.Quaternion().setFromAxisAngle(remote.hitRockAxis, remote.hitRockAngle)
    );
    if (remote.body && remote.targetBodyRotation) {
      remote.body.rotation.order = 'YXZ';
      remote.body.rotation.x += (remote.targetBodyRotation[0] - remote.body.rotation.x) * blend;
      remote.body.rotation.y += (remote.targetBodyRotation[1] - remote.body.rotation.y) * blend;
      remote.body.rotation.z += (remote.targetBodyRotation[2] - remote.body.rotation.z) * blend;
    }
  }
}

function applyRemoteTankImpact(sessionId, hitDirection) {
  const remote = remoteTanks.get(sessionId);
  if (!remote || !Array.isArray(hitDirection) || !hitDirection.every(Number.isFinite)) return;
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(remote.root.quaternion).normalize();
  const direction = new THREE.Vector3().fromArray(hitDirection).projectOnPlane(up);
  if (direction.lengthSq() < 0.0001) return;
  direction.normalize();
  remote.hitVelocity.addScaledVector(direction, 8.5);
  const axis = new THREE.Vector3().crossVectors(up, direction);
  if (axis.lengthSq() > 0.0001) {
    remote.hitRockAxis.copy(axis.normalize());
    remote.hitRockVelocity += 6.2;
  }
}

function applyLocalTankImpact(hitDirection) {
  if (!Array.isArray(hitDirection) || !hitDirection.every(Number.isFinite) || localTankHealth <= 0) return;
  const direction = new THREE.Vector3().fromArray(hitDirection);
  const up = flightState === 'attached'
    ? normal.clone().normalize()
    : new THREE.Vector3(0, 1, 0).applyQuaternion(tankRoot.quaternion).normalize();
  direction.projectOnPlane(up);
  if (direction.lengthSq() < 0.0001) direction.set(...hitDirection);
  direction.normalize();

  if (flightState === 'attached') {
    const right = new THREE.Vector3().crossVectors(heading, normal).normalize();
    forwardSpeed += direction.dot(heading) * 8.5;
    strafeSpeed += direction.dot(right) * 8.5;
  } else if (flightState === 'flying' || flightState === 'drifting') {
    flightVelocity.addScaledVector(direction, 8.5);
  } else {
    reattachVelocity.addScaledVector(direction, 8.5);
  }
}

function getPlayerHealthBar(sessionId) {
  let bar = playerHealthBars.get(sessionId);
  if (bar) return bar;

  const element = document.createElement('div');
  element.className = 'player-health-bar';
  const label = document.createElement('span');
  label.className = 'player-health-label';
  label.textContent = sessionId === '__local__' ? localPlayerName : playerLabel(sessionId);
  const track = document.createElement('div');
  track.className = 'player-health-track';
  const fill = document.createElement('div');
  fill.className = 'player-health-fill';
  track.appendChild(fill);
  element.append(label, track);
  el('player-health-bars').appendChild(element);
  bar = { element, fill };
  playerHealthBars.set(sessionId, bar);
  return bar;
}

function updatePlayerHealthBars() {
  if (!gameStarted || !multiplayerPeer || !camera) {
    for (const bar of playerHealthBars.values()) bar.element.hidden = true;
    return;
  }

  camera.updateMatrixWorld(true);
  const activeBars = new Set();
  const placeBar = (sessionId, root, up, health, isLocal = false) => {
    if (health <= 0 || !root.visible || (isLocal && firstPerson)) return;
    const bar = getPlayerHealthBar(sessionId);
    bar.element.querySelector('.player-health-label').textContent = sessionId === '__local__' ? localPlayerName : playerLabel(sessionId);
    bar.element.dataset.team = playerTeams.get(sessionId) || '';
    bar.element.setAttribute('aria-label', `${playerLabel(sessionId)} (${playerTeams.get(sessionId) || 'unassigned'})`);
    activeBars.add(sessionId);
    const worldPosition = root.position.clone().addScaledVector(up, ballRadius * 3.1);
    const screenPosition = worldPosition.project(camera);
    const onScreen = screenPosition.z >= -1 && screenPosition.z <= 1 &&
      Math.abs(screenPosition.x) <= 1.12 && Math.abs(screenPosition.y) <= 1.12;
    bar.element.hidden = !onScreen;
    if (!onScreen) return;

    bar.element.style.left = `${(screenPosition.x * 0.5 + 0.5) * innerWidth}px`;
    bar.element.style.top = `${(-screenPosition.y * 0.5 + 0.5) * innerHeight}px`;
    const ratio = THREE.MathUtils.clamp(health / MAX_PLAYER_HEALTH, 0, 1);
    bar.fill.style.width = `${ratio * 100}%`;
    bar.fill.style.backgroundColor = ratio > 0.5 ? '#55e585' : ratio > 0.25 ? '#ffd447' : '#ff514d';
    bar.element.title = `${Math.ceil(health)} / ${MAX_PLAYER_HEALTH}`;
  };

  placeBar('__local__', tankRoot, normal, localTankHealth, true);
  for (const [sessionId, remote] of remoteTanks) {
    if (!remote.hasPose || remote.health <= 0) continue;
    const remoteUp = new THREE.Vector3(0, 1, 0).applyQuaternion(remote.root.quaternion).normalize();
    placeBar(sessionId, remote.root, remoteUp, remote.health);
  }

  for (const [sessionId, bar] of playerHealthBars) {
    if (!activeBars.has(sessionId)) bar.element.hidden = true;
  }
}

function updateBodyCrosshair() {
  const marker = el('body-crosshair');
  const connector = el('reticle-link');
  if (!gameStarted || !bodyGroup || localTankHealth <= 0) {
    marker.hidden = true;
    connector.hidden = true;
    return;
  }

  tankRoot.updateMatrixWorld(true);
  bodyGroup.updateWorldMatrix(true, false);
  camera.updateMatrixWorld(true);

  const bodyOrientation = new THREE.Quaternion();
  bodyGroup.getWorldQuaternion(bodyOrientation);
  const bodyForward = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(bodyOrientation)
    .normalize();
  const lookDirection = new THREE.Vector3();
  camera.getWorldDirection(lookDirection);
  const cameraForward = bodyForward.dot(lookDirection);
  if (cameraForward <= 0.02) {
    marker.hidden = true;
    connector.hidden = true;
    return;
  }

  // Offset outward from the main, screen-centered reticle by the body axis's
  // angular difference in camera space. This aligns exactly when both axes do.
  const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  const viewX = bodyForward.dot(cameraRight) / (cameraForward * tanHalfFov * camera.aspect);
  let viewY = bodyForward.dot(cameraUp) / (cameraForward * tanHalfFov);
  if (!firstPerson) {
    // The third-person camera is deliberately raised above the tank and aimed
    // back toward it. Remove that steady mount angle so aligned aim sits at
    // screen center; body/camera rotation differences remain visible.
    const cameraHeight = CAMERA_HEIGHT * thirdPersonDistance / CAMERA_DISTANCE;
    const targetDistance = thirdPersonDistance + 20;
    viewY -= cameraHeight / (targetDistance * tanHalfFov);
  }
  const edgeX = THREE.MathUtils.clamp(-viewX, -0.94, 0.94);
  const edgeY = THREE.MathUtils.clamp(-viewY, -0.94, 0.94);
  const markerX = (edgeX * 0.5 + 0.5) * innerWidth;
  const markerY = (-edgeY * 0.5 + 0.5) * innerHeight;
  marker.style.left = `${markerX}px`;
  marker.style.top = `${markerY}px`;
  marker.hidden = false;

  const deltaX = markerX - innerWidth * 0.5;
  const deltaY = markerY - innerHeight * 0.5;
  const distance = Math.hypot(deltaX, deltaY);
  const maxDistance = Math.hypot(innerWidth * 0.47, innerHeight * 0.47);
  const opacity = THREE.MathUtils.clamp(distance / maxDistance, 0, 1);
  marker.style.opacity = opacity.toFixed(3);
  connector.style.opacity = opacity.toFixed(3);
  connector.style.width = `${Math.max(0, distance - 7)}px`;
  connector.style.transform = `translateY(-50%) rotate(${Math.atan2(deltaY, deltaX)}rad)`;
  connector.hidden = distance <= 7;
}

function resolveTankContacts() {
  if (!multiplayerPeer || localTankHealth <= 0) return;
  const now = clock.elapsedTime;
  for (const [sessionId, remote] of remoteTanks) {
    if (!remote.hasPose) continue;
    const delta = position.clone().sub(remote.root.position);
    const minimum = ballRadius * 1.9;
    const distance = delta.length();
    if (distance >= minimum) continue;
    const contactNormal = distance > 0.001 ? delta.normalize() : heading.clone();
    const penetration = minimum - distance;
    position.addScaledVector(contactNormal, penetration + 0.01);
    if (flightState === 'flying' || flightState === 'drifting') {
      const inward = flightVelocity.dot(contactNormal);
      if (inward < 0) flightVelocity.addScaledVector(contactNormal, -inward * 1.25);
    } else {
      const inward = heading.clone().multiplyScalar(forwardSpeed)
        .addScaledVector(new THREE.Vector3().crossVectors(heading, normal).normalize(), strafeSpeed)
        .dot(contactNormal);
      if (inward < 0) {
        forwardSpeed *= 0.55;
        strafeSpeed *= 0.55;
      }
    }
    updateTankTransform();
    const pair = [multiplayerSessionId, sessionId].sort().join(':');
    const impactSpeed = Math.max(0, getTankWorldVelocity().length());
    if (impactSpeed > 1.5 && now - (playerContactTimes.get(pair) ?? -Infinity) > 0.35) {
      playerContactTimes.set(pair, now);
      const point = remote.root.position.clone().addScaledVector(contactNormal, ballRadius);
      const contactId = `${multiplayerSessionId}:${++multiplayerContactSequence}`;
      spawnCollisionSparks(point, contactNormal, impactSpeed, false);
      playOneShot(collisionAudio);
      const event = { type: 'contact', otherId: sessionId, contactId, point: point.toArray(), normal: contactNormal.toArray(), impactSpeed };
      if (multiplayerHost) broadcastToPeers({ ...event, type: 'player-contact', sessionId: multiplayerSessionId });
      else sendToHost(event);
    }
  }
}

function localTankPose() {
  return {
    position: position.toArray(),
    rotation: tankRoot.quaternion.toArray(),
    magnetsActive,
    bodyRotation: bodyGroup
      ? [bodyGroup.rotation.x, bodyGroup.rotation.y, bodyGroup.rotation.z]
      : [0, 0, 0]
  };
}

function setNetworkStatus(message) {
  const status = el('network-status');
  status.textContent = message;
  status.classList.add('visible');
}

function playerLabel(id) { return playerNames.get(id) || (id === multiplayerSessionId ? localPlayerName : 'Player'); }
function renderMatchScore() {
  el('red-score').textContent = teamScores.red;
  el('blue-score').textContent = teamScores.blue;
}
function addMatchEvent(text) {
  const list = el('match-events');
  if (!list) return;
  const item = document.createElement('li');
  item.textContent = text;
  list.prepend(item);
  while (list.children.length > 6) list.lastElementChild.remove();
}
function assignTeam(id) {
  if (!playerTeams.has(id)) {
    const reds = [...playerTeams.values()].filter(team => team === 'red').length;
    const blues = [...playerTeams.values()].filter(team => team === 'blue').length;
    playerTeams.set(id, reds <= blues ? 'red' : 'blue');
  }
  return playerTeams.get(id);
}
function applyMatchState(state) {
  if (!state) return;
  if (state.names) for (const [id, name] of Object.entries(state.names)) playerNames.set(id, name);
  if (state.teams) for (const [id, team] of Object.entries(state.teams)) playerTeams.set(id, team);
  if (state.scores) { teamScores.red = state.scores.red || 0; teamScores.blue = state.scores.blue || 0; }
  renderMatchScore();
  if (multiplayerSessionId && playerTeams.has(multiplayerSessionId)) {
    el('player-callsign').textContent = `${playerLabel(multiplayerSessionId)} · ${playerTeams.get(multiplayerSessionId).toUpperCase()} TEAM`;
    el('player-callsign').hidden = false;
    el('match-hud').hidden = false;
  }
}
function matchState() { return { names: Object.fromEntries(playerNames), teams: Object.fromEntries(playerTeams), scores: { ...teamScores } }; }
function handlePlayerKill(killerId, victimId) {
  if (!multiplayerHost || matchOver || !victimId || killerId === victimId) return;
  const killerTeam = playerTeams.get(killerId);
  if (!killerTeam) return;
  teamScores[killerTeam]++;
  const event = { type: 'match-event', text: `${playerLabel(killerId)} destroyed ${playerLabel(victimId)}`, state: matchState() };
  addMatchEvent(event.text);
  renderMatchScore();
  broadcastToPeers(event);
  if (teamScores[killerTeam] >= 10) {
    matchOver = true;
    const won = { type: 'match-event', text: `${killerTeam.toUpperCase()} TEAM WINS!`, state: matchState(), won: true };
    addMatchEvent(won.text);
    broadcastToPeers(won);
  }
}

function updatePeerCount() {
  const count = multiplayerHost ? peerConnections.size + 1 : null;
  if (count !== null) {
    for (const connection of peerConnections.values()) {
      if (connection.open) connection.send({ type: 'room-count', count, state: matchState() });
    }
  }
}

function removeRemoteTank(sessionId) {
  clearTankDestruction(sessionId);
  const remote = remoteTanks.get(sessionId);
  if (remote) {
    const aura = remote.root.userData.empAura;
    if (aura) {
      remote.root.remove(aura);
      aura.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) object.material.dispose();
      });
    }
    scene.remove(remote.root);
  }
  remoteTanks.delete(sessionId);
  multiplayerPoses.delete(sessionId);
  playerHealth.delete(sessionId);
  playerTankIds.delete(sessionId);
  remoteMinigunPlayers.delete(sessionId);
  if (!remoteMinigunPlayers.size && !fireHeld) stopMinigunAudio();
}

function broadcastToPeers(message, exceptPeerId = null) {
  for (const [peerId, connection] of peerConnections) {
    if (peerId !== exceptPeerId && connection.open) connection.send(message);
  }
}

function sendToHost(message) {
  if (multiplayerHost) broadcastToPeers(message);
  else if (hostConnection?.open) hostConnection.send(message);
}

function broadcastTankDestroyed(sessionId) {
  if (!multiplayerHost) return;
  const pose = sessionId === multiplayerSessionId
    ? localTankPose()
    : multiplayerPoses.get(sessionId)?.pose;
  broadcastToPeers({ type: 'tank-destroyed', sessionId, pose: pose || null });
}

function updateTankHealth(sessionId, health) {
  const previous = playerHealth.get(sessionId) ?? MAX_PLAYER_HEALTH;
  const safeHealth = THREE.MathUtils.clamp(Number(health) || 0, 0, MAX_PLAYER_HEALTH);
  playerHealth.set(sessionId, safeHealth);
  if (sessionId === multiplayerSessionId) {
    localTankHealth = safeHealth;
    el('tank-health').textContent = `${Math.ceil(safeHealth / MAX_PLAYER_HEALTH * 100)}%`;
    el('hud-health-fill').style.width = `${safeHealth / MAX_PLAYER_HEALTH * 100}%`;
    if (safeHealth <= 0 && previous > 0) destroyLocalPlayer();
  } else {
    const remote = remoteTanks.get(sessionId);
    if (remote) {
      remote.health = safeHealth;
      if (safeHealth <= 0 && previous > 0 && remote.hasPose) createTankDestruction(sessionId, remote.root);
      else if (safeHealth > 0 && tankDestructions.has(sessionId)) clearTankDestruction(sessionId);
    }
  }
}

function clearAttachedBulletHoles(root) {
  const attachedDecals = [];
  root.traverse(object => {
    if (object.userData?.bulletHole) attachedDecals.push(object);
  });
  for (const mesh of attachedDecals) {
    mesh.parent?.remove(mesh);
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach(material => material?.dispose());
    const index = projectiles.findIndex(effect => effect.kind === 'decal' && effect.mesh === mesh);
    if (index >= 0) projectiles.splice(index, 1);
  }
}

function charTankHull(root) {
  const originalMaterials = [];
  const lights = [];
  root.traverse(object => {
    if (object.isLight) {
      lights.push({ object, visible: object.visible });
      object.visible = false;
    }
    if (!object.isMesh) return;
    originalMaterials.push({ object, material: object.material });
    const charred = material => {
      if (!material) return material;
      const replacement = material.clone();
      if (replacement.color) replacement.color.setHex(0x1a1713);
      if ('roughness' in replacement) replacement.roughness = 0.98;
      if ('metalness' in replacement) replacement.metalness = 0.06;
      if (replacement.emissive) replacement.emissive.setHex(0x000000);
      if ('emissiveIntensity' in replacement) replacement.emissiveIntensity = 0;
      replacement.needsUpdate = true;
      return replacement;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(charred)
      : charred(object.material);
  });
  return { originalMaterials, lights };
}

function emitWreckFire(destruction) {
  const { root, sessionId } = destruction;
  if (!root.visible) return;
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(root);
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion())).normalize();
  const spread = Math.max(0.35, size.length() * 0.16);
  const tangent = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
    .projectOnPlane(up).normalize().multiplyScalar((Math.random() - 0.5) * spread * 1.5);
  const point = center.addScaledVector(up, spread * 0.35).add(tangent);
  spawnTankHitEffect(point, up, 'minigun', sessionId);
  if (Math.random() > 0.35) spawnWreckSmoke(point, up, sessionId);
}

function clearWreckTransientEffects(sessionId) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    if (projectiles[i].wreckId !== sessionId) continue;
    removeProjectile(projectiles[i]);
    projectiles.splice(i, 1);
  }
  for (let i = collisionSparks.length - 1; i >= 0; i--) {
    if (collisionSparks[i].wreckId !== sessionId) continue;
    const spark = collisionSparks[i];
    scene.remove(spark.mesh);
    spark.mesh.geometry.dispose();
    spark.mesh.material.dispose();
    collisionSparks.splice(i, 1);
  }
}

function spawnBrightTankExplosion(root, wreckId) {
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(root);
  const center = bounds.isEmpty() ? root.getWorldPosition(new THREE.Vector3()) : bounds.getCenter(new THREE.Vector3());
  const size = bounds.isEmpty() ? 1.5 : Math.max(1.5, bounds.getSize(new THREE.Vector3()).length() * 0.26);
  const burst = new THREE.Group();
  const layers = [
    { scale: 1.55, color: 0xff451b, opacity: 0.78 },
    { scale: 1.08, color: 0xffa333, opacity: 0.9 },
    { scale: 0.58, color: 0xfff4ca, opacity: 1 }
  ];
  for (const layer of layers) {
    const material = new THREE.MeshBasicMaterial({
      color: layer.color,
      transparent: true,
      opacity: layer.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
      userData: { baseOpacity: layer.opacity }
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), material);
    sphere.scale.setScalar(size * layer.scale);
    burst.add(sphere);
  }
  burst.position.copy(center);
  scene.add(burst);
  projectiles.push({ kind: 'effect', mesh: burst, life: 0.62, maxLife: 0.62, wreckId, explosion: true });

  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion())).normalize();
  const shockwave = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.045, 7, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffefc8,
      transparent: true,
      opacity: 0.94,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    })
  );
  shockwave.position.copy(center);
  shockwave.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
  shockwave.scale.setScalar(size * 0.25);
  scene.add(shockwave);
  projectiles.push({ kind: 'shockwave', mesh: shockwave, life: 0.34, maxLife: 0.34, size, wreckId });
}

function explodeTankWreck(destruction) {
  if (destruction.phase !== 'burning') return;
  const { root, sessionId } = destruction;
  clearWreckTransientEffects(sessionId);
  root.updateWorldMatrix(true, true);
  const fragments = [];
  root.traverse(object => {
    if (!object.isMesh || !object.visible) return;
    const worldPosition = new THREE.Vector3();
    const worldRotation = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    object.matrixWorld.decompose(worldPosition, worldRotation, worldScale);
    const materials = (Array.isArray(object.material) ? object.material : [object.material]).filter(Boolean).map(material => {
      const fragmentMaterial = material.clone();
      fragmentMaterial.transparent = true;
      fragmentMaterial.depthWrite = false;
      return { material: fragmentMaterial, opacity: material.opacity };
    });
    if (!materials.length) return;
    const fragment = new THREE.Mesh(
      object.geometry,
      materials.length > 1 ? materials.map(item => item.material) : materials[0].material
    );
    fragment.position.copy(worldPosition);
    fragment.quaternion.copy(worldRotation);
    fragment.scale.copy(worldScale);
    scene.add(fragment);
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 11,
      Math.random() * 8 + 1.5,
      (Math.random() - 0.5) * 11
    );
    const spin = new THREE.Vector3(
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 12
    );
    const item = { sessionId, mesh: fragment, materials, velocity, spin, scale: worldScale, age: 0, life: 3.6 };
    fragments.push(item);
    tankFragments.push(item);
  });
  root.visible = false;
  destruction.phase = 'fragments';
  destruction.fragments = fragments;
}

function createTankDestruction(sessionId, root) {
  if (tankDestructions.has(sessionId)) return;
  clearAttachedBulletHoles(root);
  root.updateWorldMatrix(true, true);
  const originalRootVisible = root.visible;
  const hullState = charTankHull(root);
  root.visible = true;
  const destruction = {
    sessionId,
    root,
    phase: 'burning',
    burnElapsed: 0,
    nextFire: 0,
    burnDuration: 5,
    originalRootVisible,
    ...hullState
  };
  tankDestructions.set(sessionId, destruction);
  spawnBrightTankExplosion(root, sessionId);
  playOneShot(explosionAudio);
}

function clearTankDestruction(sessionId) {
  const destruction = tankDestructions.get(sessionId);
  if (!destruction) return;
  for (let i = tankFragments.length - 1; i >= 0; i--) {
    const fragment = tankFragments[i];
    if (fragment.sessionId !== sessionId) continue;
    scene.remove(fragment.mesh);
    for (const item of fragment.materials) item.material.dispose();
    tankFragments.splice(i, 1);
  }
  clearWreckTransientEffects(sessionId);
  for (const { object, material } of destruction.originalMaterials) {
    const charredMaterials = Array.isArray(object.material) ? object.material : [object.material];
    charredMaterials.forEach(item => item?.dispose());
    object.material = material;
  }
  for (const light of destruction.lights) light.object.visible = light.visible;
  destruction.root.visible = destruction.originalRootVisible;
  tankDestructions.delete(sessionId);
}

function updateDestructionEffects(dt) {
  for (const destruction of tankDestructions.values()) {
    if (destruction.phase !== 'burning') continue;
    destruction.burnElapsed += dt;
    destruction.nextFire -= dt;
    if (destruction.nextFire <= 0) {
      emitWreckFire(destruction);
      destruction.nextFire = 0.42 + Math.random() * 0.18;
    }
    if (destruction.burnElapsed >= destruction.burnDuration) explodeTankWreck(destruction);
  }

  for (let i = tankFragments.length - 1; i >= 0; i--) {
    const fragment = tankFragments[i];
    fragment.age += dt;
    fragment.velocity.y -= 5.5 * dt;
    fragment.mesh.position.addScaledVector(fragment.velocity, dt);
    fragment.mesh.rotation.x += fragment.spin.x * dt;
    fragment.mesh.rotation.y += fragment.spin.y * dt;
    fragment.mesh.rotation.z += fragment.spin.z * dt;
    const fade = THREE.MathUtils.clamp(1 - fragment.age / fragment.life, 0, 1);
    fragment.mesh.scale.copy(fragment.scale).multiplyScalar(fade);
    for (const item of fragment.materials) item.material.opacity = item.opacity * fade;
    if (fragment.age >= fragment.life) {
      scene.remove(fragment.mesh);
      for (const item of fragment.materials) item.material.dispose();
      tankFragments.splice(i, 1);
    }
  }
}

function destroyLocalPlayer() {
  createTankDestruction(multiplayerSessionId || 'local-player', tankRoot);
  Object.keys(keys).forEach(key => keys[key] = false);
  fireHeld = false;
  if (document.pointerLockElement) document.exitPointerLock();
  announceWeaponAudio(false);
  stopMinigunAudio();
  stopThrustAudio();
  const outOfBounds = mapDeathRadius > 0 && position.distanceTo(mapBoundaryCenter) >= mapDeathRadius;
  showMessage(outOfBounds ? 'NEUTRALIZING DEFECTOR' : 'TANK DESTROYED',
    outOfBounds ? 'boundary-death' : 'default');
  if (localRespawnTimeout !== null) clearTimeout(localRespawnTimeout);
  localRespawnTimeout = setTimeout(() => {
    localRespawnTimeout = null;
    respawnLocalPlayer();
  }, 8800);
}

function respawnLocalPlayer() {
  if (localRespawnTimeout !== null) {
    clearTimeout(localRespawnTimeout);
    localRespawnTimeout = null;
  }
  const sessionId = multiplayerSessionId || 'local-player';
  forwardSpeed = 0;
  strafeSpeed = 0;
  previousForwardSpeed = 0;
  previousStrafeSpeed = 0;
  groundBoostRemaining = 0;
  groundBoostClock = 0;
  unsupportedSurfaceTime = 0;
  flightSpaceHeld = false;
  freeFallStarted = false;
  flightVelocity.set(0, 0, 0);
  reattachVelocity.set(0, 0, 0);
  aimPitch = 0;
  flightState = 'attached';
  setMagnetsActive(true);
  thrustRemaining = THRUST_DURATION;
  thrustRechargeDelayRemaining = 0;
  normal.set(0, 1, 0);
  heading.set(0, 0, -1);
  aimDirection.copy(heading);
  spawn();
  clearTankDestruction(sessionId);
  tankRoot.visible = !firstPerson;
  localTankHealth = MAX_PLAYER_HEALTH;
  playerHealth.set(sessionId, MAX_PLAYER_HEALTH);
  el('tank-health').textContent = '100%';
  el('hud-health-fill').style.width = '100%';
  if (multiplayerPeer) {
    if (multiplayerHost) broadcastToPeers({ type: 'tank-health', sessionId, health: MAX_PLAYER_HEALTH });
    else if (hostConnection?.open) hostConnection.send({ type: 'respawn' });
  }
  showMessage('TANK RESPAWNED');
  if (pauseMenuOpen) closeGameMenu();
}

function setRemoteMinigunAudio(sessionId, active) {
  if (active) {
    remoteMinigunPlayers.add(sessionId);
    startMinigunAudio();
  } else {
    remoteMinigunPlayers.delete(sessionId);
    if (!remoteMinigunPlayers.size && !fireHeld) stopMinigunAudio();
  }
}

function announceWeaponAudio(active) {
  if (!multiplayerPeer || !multiplayerSessionId) return;
  sendToHost({ type: 'weapon-audio', active });
}

function handleRemoteContact(message) {
  if (message.sessionId === multiplayerSessionId || !Array.isArray(message.point) || !Array.isArray(message.normal)) return;
  if (![...message.point, ...message.normal, message.impactSpeed].every(Number.isFinite)) return;
  const key = message.contactId;
  for (const [entry, time] of hostContactTimes) if (entry.startsWith('seen:') && clock.elapsedTime - time > 5) hostContactTimes.delete(entry);
  if (typeof key === 'string' && hostContactTimes.has(`seen:${key}`)) return;
  if (typeof key === 'string') hostContactTimes.set(`seen:${key}`, clock.elapsedTime);
  const point = new THREE.Vector3().fromArray(message.point);
  const contactNormal = new THREE.Vector3().fromArray(message.normal).normalize();
  spawnCollisionSparks(point, contactNormal, message.impactSpeed, false);
  playOneShot(collisionAudio);
}

function handlePeerMessage(connection, message) {
  if (!message || typeof message !== 'object') return;

  if (message.type === 'room-info-request' && multiplayerHost) {
    connection.send({ type: 'room-config', levelId: DEFAULT_LEVEL_ID });
    return;
  }

  if (message.type === 'tank-selected' && typeof message.sessionId === 'string') {
    setRemoteTankType(message.sessionId, message.tankId);
    return;
  }

  if (message.type === 'boundary-destroyed' && multiplayerHost) {
    const remote = remoteTanks.get(connection.peer);
    if (!remote || remote.health <= 0) return;
    updateTankHealth(connection.peer, 0);
    broadcastToPeers({ type: 'tank-health', sessionId: connection.peer, health: 0 });
    broadcastTankDestroyed(connection.peer);
    return;
  }

  if (message.type === 'fire' && multiplayerHost) {
    acceptRemoteShot(connection.peer, message);
    return;
  }

  if (message.type === 'weapon-shot' && multiplayerHost) {
    if (message.weapon === 'cannon') {
      broadcastToPeers({ type: 'weapon-shot', sessionId: connection.peer, weapon: 'cannon' }, connection.peer);
    }
    return;
  }

  if (message.type === 'weapon-audio' && multiplayerHost) {
    setRemoteMinigunAudio(connection.peer, message.active === true);
    broadcastToPeers({
      type: 'weapon-audio', sessionId: connection.peer, active: message.active === true
    }, connection.peer);
    return;
  }

  if (message.type === 'contact' && multiplayerHost) {
    relayRemoteContact(connection.peer, message);
    return;
  }

  if (message.type === 'pose' && multiplayerHost) {
    const sequence = Number.isFinite(message.sequence) ? message.sequence : 0;
    applyRemotePose(connection.peer, message.pose, sequence);
    multiplayerPoses.set(connection.peer, { pose: message.pose, sequence });
    for (const [peerId, recipient] of peerConnections) {
      if (peerId !== connection.peer && recipient.open) {
        recipient.send({
          type: 'pose',
          sessionId: connection.peer,
          pose: message.pose,
          sequence
        });
      }
    }
    return;
  }

  if (message.type === 'pose' && typeof message.sessionId === 'string') {
    const sequence = Number.isFinite(message.sequence) ? message.sequence : 0;
    applyRemotePose(message.sessionId, message.pose, sequence);
    return;
  }

  if (message.type === 'projectile-start') {
    if (message.shot?.ownerId !== multiplayerSessionId) {
      createProjectile(message.shot, false);
    }
    return;
  }

  if (message.type === 'emp-pulse') {
    if (message.shot?.ownerId !== multiplayerSessionId) createEmpPulse(message.shot, false);
    return;
  }

  if (message.type === 'emp-disable') {
    if (message.sessionId === multiplayerSessionId && Number.isFinite(message.duration)) {
      empDisabledRemaining = Math.max(empDisabledRemaining, THREE.MathUtils.clamp(message.duration, 0, 10));
      forwardSpeed = 0;
      strafeSpeed = 0;
      flightVelocity.set(0, 0, 0);
      fireHeld = false;
      flightSpaceHeld = false;
      for (const key of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight', 'Space', 'ControlLeft']) keys[key] = false;
      stopThrustAudio();
      stopMinigunAudio();
      announceWeaponAudio(false);
      ensureEmpAura(tankRoot).visible = true;
      showMessage('EMP DISABLED');
    }
    const remote = typeof message.sessionId === 'string' ? remoteTanks.get(message.sessionId) : null;
    if (remote && Number.isFinite(message.duration)) {
      remote.empDisabledRemaining = Math.max(remote.empDisabledRemaining || 0, THREE.MathUtils.clamp(message.duration, 0, 10));
      ensureEmpAura(remote.root).visible = true;
    }
    return;
  }

  if (message.type === 'weapon-shot') {
    if (message.sessionId !== multiplayerSessionId && message.weapon === 'cannon') playOneShot(cannonAudio);
    return;
  }

  if (message.type === 'tank-destroyed') {
    showRemoteTankDestruction(message);
    return;
  }
  if (message.type === 'match-event') {
    applyMatchState(message.state);
    addMatchEvent(message.text);
    if (message.won) matchOver = true;
    return;
  }
  if (message.type === 'match-state') { applyMatchState(message.state); return; }

  if (message.type === 'projectile-end') {
    finishRemoteProjectile(message);
    return;
  }

  if (message.type === 'tank-health') {
    updateTankHealth(message.sessionId, message.health);
    return;
  }

  if (message.type === 'weapon-audio') {
    setRemoteMinigunAudio(message.sessionId, message.active === true);
    return;
  }

  if (message.type === 'player-contact') {
    handleRemoteContact(message);
    return;
  }

  if (message.type === 'room-count') {
    applyMatchState(message.state);
  } else if (message.type === 'player-left' && typeof message.sessionId === 'string') {
    removeRemoteTank(message.sessionId);
  } else if (message.type === 'room-full') {
    setNetworkStatus('That host is full (4/4 players)');
    connection.close();
    multiplayerPeer?.destroy();
    multiplayerPeer = null;
    multiplayerSessionId = null;
  } else if (message.type === 'respawn' && multiplayerHost) {
    updateTankHealth(connection.peer, MAX_PLAYER_HEALTH);
    broadcastToPeers({ type: 'tank-health', sessionId: connection.peer, health: MAX_PLAYER_HEALTH });
  } else if (message.type === 'hello' && multiplayerHost) {
    playerNames.set(connection.peer, (typeof message.name === 'string' && message.name.trim().slice(0, 18)) || 'Player');
    const team = assignTeam(connection.peer);
    const tankId = Object.hasOwn(TANKS, message.tankId) ? message.tankId : DEFAULT_TANK_ID;
    setRemoteTankType(connection.peer, tankId);
    broadcastToPeers({ type: 'tank-selected', sessionId: connection.peer, tankId }, connection.peer);
    connection.send({ type: 'room-config', levelId: DEFAULT_LEVEL_ID });
    addMatchEvent(`${playerLabel(connection.peer)} joined ${team.toUpperCase()} team`);
    connection.send({ type: 'match-event', text: `${playerLabel(connection.peer)} joined ${team.toUpperCase()} team`, state: matchState() });
    broadcastToPeers({ type: 'match-event', text: `${playerLabel(connection.peer)} joined ${team.toUpperCase()} team`, state: matchState() }, connection.peer);
    connection.send({ type: 'match-state', state: matchState() });
    for (const [sessionId, health] of playerHealth) {
      connection.send({ type: 'tank-health', sessionId, health });
    }
    for (const [sessionId, selectedTankId] of playerTankIds) {
      connection.send({ type: 'tank-selected', sessionId, tankId: selectedTankId });
    }
    for (const [sessionId, state] of multiplayerPoses) {
      connection.send({
        type: 'pose',
        sessionId,
        pose: state.pose,
        sequence: state.sequence
      });
    }
    updatePeerCount();
  }
}

function attachPeerConnection(connection, incoming = false) {
  if (connection.tankBallAttached) return;
  connection.tankBallAttached = true;
  if (incoming && peerConnections.size >= 3) {
    connection.on('open', () => {
      connection.send({ type: 'room-full' });
      connection.close();
    });
    return;
  }

  if (incoming) peerConnections.set(connection.peer, connection);
  connection.on('data', message => handlePeerMessage(connection, message));
  const onOpen = () => {
    if (connection.tankBallOpenHandled) return;
    connection.tankBallOpenHandled = true;
    peerConnections.set(connection.peer, connection);
    if (multiplayerHost) {
      playerNames.set(multiplayerSessionId, localPlayerName);
      playerNames.set(connection.peer, playerNames.get(connection.peer) || 'Player');
      assignTeam(multiplayerSessionId);
      assignTeam(connection.peer);
      connection.send({ type: 'match-state', state: matchState() });
      connection.send({ type: 'room-config', levelId: DEFAULT_LEVEL_ID });
      playerHealth.set(connection.peer, MAX_PLAYER_HEALTH);
      connection.send({ type: 'tank-health', sessionId: connection.peer, health: MAX_PLAYER_HEALTH });
      connection.send({ type: 'tank-health', sessionId: multiplayerSessionId, health: localTankHealth });
      for (const [peerId, health] of playerHealth) {
        if (peerId !== connection.peer) connection.send({ type: 'tank-health', sessionId: peerId, health });
      }
      multiplayerPoses.set(multiplayerSessionId, {
        pose: localTankPose(), sequence: multiplayerPoseSequence
      });
      for (const [sessionId, state] of multiplayerPoses) {
        connection.send({
          type: 'pose', sessionId, pose: state.pose, sequence: state.sequence
        });
      }
      for (const [sessionId, tankId] of playerTankIds) {
        connection.send({ type: 'tank-selected', sessionId, tankId });
      }
      updatePeerCount();
    } else {
      hostConnection = connection;
      playerNames.set(multiplayerSessionId, localPlayerName);
      connection.send({ type: 'hello', tankId: GAME_SELECTION.tankId || DEFAULT_TANK_ID, name: localPlayerName });
    }
  };
  connection.on('open', onOpen);
  if (connection.open) onOpen();
  connection.on('close', () => {
    peerConnections.delete(connection.peer);
    if (!multiplayerSessionId) return;
    removeRemoteTank(connection.peer);
    if (multiplayerHost) {
      for (const recipient of peerConnections.values()) {
        if (recipient.open) recipient.send({ type: 'player-left', sessionId: connection.peer });
      }
      updatePeerCount();
    } else {
      hostConnection = null;
      for (const sessionId of [...remoteTanks.keys()]) removeRemoteTank(sessionId);
      addMatchEvent('Host disconnected');
    }
  });
  connection.on('error', error => {
    console.error('Peer connection error:', error);
    setNetworkStatus('Connection trouble · try rejoining');
  });
}

function generateRoomCode() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const values = new Uint8Array(6);
  crypto.getRandomValues(values);
  return [...values].map(value => alphabet[value % alphabet.length]).join('');
}

async function createPeer(id) {
  const { Peer } = await import('peerjs');
  return new Peer(id, {
    config: {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    }
  });
}

async function hostMultiplayerGame() {
  if (multiplayerPeer) return;
  setNetworkStatus('Starting host…');
  try {
    const roomCode = generateRoomCode();
    const peer = await createPeer(roomCode);
    multiplayerPeer = peer;
    multiplayerHost = true;
    peer.on('open', id => {
      multiplayerSessionId = id;
      localPlayerName = GAME_SELECTION.playerName || 'Player';
      playerNames.set(id, localPlayerName);
      playerTeams.set(id, 'red');
      el('player-callsign').textContent = `${localPlayerName} · RED TEAM`;
      el('player-callsign').hidden = false;
      el('match-hud').hidden = false;
      addMatchEvent(`${localPlayerName} joined RED team`);
      playerHealth.set(id, localTankHealth);
      playerTankIds.set(id, DEFAULT_TANK_ID);
      el('host-room-code').textContent = id;
      el('multiplayer-panel').hidden = false;
      multiplayerPoses.set(id, { pose: localTankPose(), sequence: 0 });
    });
    peer.on('connection', connection => attachPeerConnection(connection, true));
    peer.on('error', error => {
      console.error('PeerJS error:', error);
      setNetworkStatus(`Could not host: ${error.type || error.message}`);
      peer.destroy();
      multiplayerPeer = null;
      multiplayerSessionId = null;
    });
  } catch (error) {
    console.error('Could not start PeerJS:', error);
    setNetworkStatus('Could not load the free WebRTC connection service');
  }
}

async function joinMultiplayerGame() {
  if (multiplayerPeer) return;
  const roomCode = (GAME_SELECTION.roomCode || el('room-code').value).trim().toUpperCase();
  if (!roomCode) {
    setNetworkStatus('Enter the host code first');
    el('room-code').focus();
    return;
  }
  startGame('join');
  setNetworkStatus('Connecting to host…');
  try {
    if (GAME_SELECTION.peer && GAME_SELECTION.hostConnection) {
      multiplayerPeer = GAME_SELECTION.peer;
      multiplayerHost = false;
      multiplayerSessionId = multiplayerPeer.id;
      attachPeerConnection(GAME_SELECTION.hostConnection);
      return;
    }
    const peer = await createPeer();
    multiplayerPeer = peer;
    multiplayerHost = false;
    peer.on('open', id => {
      multiplayerSessionId = id;
      const connection = peer.connect(roomCode, {
        reliable: true,
        serialization: 'json'
      });
      attachPeerConnection(connection);
    });
    peer.on('error', error => {
      console.error('PeerJS error:', error);
      setNetworkStatus(`Could not join: ${error.type || error.message}`);
      peer.destroy();
      multiplayerPeer = null;
      multiplayerSessionId = null;
    });
  } catch (error) {
    console.error('Could not join PeerJS room:', error);
    setNetworkStatus('Could not load the free WebRTC connection service');
  }
}

el('copy-room-code').addEventListener('click', async () => {
  const code = multiplayerSessionId || '';
  try {
    await navigator.clipboard.writeText(code);
    setNetworkStatus('Host code copied · send it to your friends');
  } catch {
    setNetworkStatus(`Copy this host code: ${code}`);
  }
});

window.addEventListener('beforeunload', () => multiplayerPeer?.destroy());

// ============================================================
// CAMERA OCCLUSION
// ============================================================

function resolveCameraCollision(cameraAnchor, desiredCamera) {
  const direction = desiredCamera.clone().sub(cameraAnchor);
  const distance = direction.length();
  if (distance < 0.001 || !levelMeshes.length) return desiredCamera.clone();

  direction.normalize();
  raycaster.set(cameraAnchor, direction);
  raycaster.far = distance;

  const hits = raycaster.intersectObjects(levelMeshes, true);
  if (!hits.length) return desiredCamera.clone();

  // Keep the near clipping plane clear of the wall, with a little extra room
  // for the camera body. This is applied to the interpolated position too, so
  // follow lag can never leave the camera on the opposite side of geometry.
  const safeDistance = Math.max(0, hits[0].distance - 0.6);
  return cameraAnchor.clone().addScaledVector(direction, safeDistance);
}

function updateLocalTankCameraFade() {
  if (!localTankFadeMaterials.length) return;

  const distance = camera.position.distanceTo(position);
  const t = THREE.MathUtils.clamp(
    (distance - CAMERA_TANK_FADE_END) / (CAMERA_TANK_FADE_START - CAMERA_TANK_FADE_END),
    0,
    1
  );
  const opacityScale = t * t * (3 - 2 * t);

  for (const entry of localTankFadeMaterials) {
    const material = entry.material;
    const opacity = entry.opacity * opacityScale;
    const transparent = opacityScale < 0.999 || entry.transparent;
    if (material.opacity !== opacity || material.transparent !== transparent) {
      material.opacity = opacity;
      material.transparent = transparent;
      material.depthWrite = opacityScale < 0.999 ? false : entry.depthWrite;
      material.needsUpdate = true;
    }
  }
}

// ============================================================
// WEAPONS / PROJECTILES / TARGET DAMAGE
// ============================================================

function setWeapon(weapon) {
  const definition = WEAPONS[weapon];
  if (!definition) return;
  selectedWeapon = weapon;
  const slot = weapon === DEFAULT_TANK.primaryWeapon ? 1
    : weapon === DEFAULT_TANK.secondaryWeapon ? 2 : 3;
  el('weapon').textContent = `${definition.name} [${slot}]`;
  document.querySelectorAll('[data-weapon-slot]').forEach(node => {
    node.classList.toggle('is-active', Number(node.dataset.weaponSlot) === slot);
  });
  minigunAccumulator = 0;
  stopMinigunAudio();
  showMessage(`${definition.name} selected`);
}

function playOneShot(audio) {
  try {
    audio.currentTime = 0;
    const promise = audio.play();
    if (promise && promise.catch) promise.catch(() => {});
  } catch (_) {}
}

function setMagnetsActive(active, playSound = true) {
  if (magnetsActive === active) return;
  magnetsActive = active;
  el('mag-status').textContent = active ? 'ONLINE' : 'OFFLINE';
  el('mag-indicator').classList.toggle('is-offline', !active);
  el('mag-status').closest('.hud-mag').classList.toggle('is-offline', !active);
  if (magnetsElement) magnetsElement.visible = active;
  if (playSound) playOneShot(magnetAudio);
}

function startMinigunAudio() {
  if (minigunAudio.paused) {
    const promise = minigunAudio.play();
    if (promise && promise.catch) promise.catch(() => {});
  }
}

function stopMinigunAudio() {
  if (remoteMinigunPlayers.size && !fireHeld) return;
  minigunAudio.pause();
  try { minigunAudio.currentTime = 0; } catch (_) {}
}

function startThrustAudio() {
  if (thrustAudio.paused) {
    const promise = thrustAudio.play();
    if (promise && promise.catch) promise.catch(() => {});
  }
}

function stopThrustAudio() {
  thrustAudio.pause();
  try { thrustAudio.currentTime = 0; } catch (_) {}
}

function startEngineAudio() {
  if (!engineAudioContext) {
    if (engineAudio.paused) {
      const promise = engineAudio.play();
      if (promise && promise.catch) promise.catch(() => {});
    }
    return;
  }
  if (engineSource || !engineBuffer) return;
  engineAudioContext.resume().catch(() => {});
  engineSource = engineAudioContext.createBufferSource();
  engineSource.buffer = engineBuffer;
  engineSource.loop = true;
  engineSource.playbackRate.value = engineAudio.playbackRate;
  engineSource.connect(engineGain);
  engineSource.start();
}

function updateEngineAudio(dt) {
  const attached = flightState === 'attached';
  const speed = attached ? Math.hypot(forwardSpeed, strafeSpeed) : 0;
  const normalized = THREE.MathUtils.clamp(speed / GROUND_BOOST_MAX_SPEED, 0, 1);
  const targetRate = 0.75 + normalized * 0.9;
  const targetVolume = attached ? 0.14 + normalized * 0.42 : 0;
  const blend = 1 - Math.exp(-3.5 * dt);

  const nextRate = engineAudio.playbackRate + (targetRate - engineAudio.playbackRate) * blend;
  const currentVolume = engineGain ? engineGain.gain.value : engineAudio.volume;
  const nextVolume = currentVolume + (targetVolume - currentVolume) * (1 - Math.exp(-4 * dt));
  engineAudio.playbackRate = nextRate;
  if (engineGain) engineGain.gain.value = nextVolume;
  else engineAudio.volume = nextVolume;
  if (engineSource) engineSource.playbackRate.value = nextRate;

  if (attached && engineAudioUnlocked && !engineSource && (engineBuffer || !engineAudioContext)) startEngineAudio();
}

function spawnCollisionSparks(point, surfaceNormal, impactSpeed, flight = false) {
  const count = flight
    ? 22
    : Math.min(COLLISION_SPARK_COUNT + Math.floor(impactSpeed * 1.5), 28);

  for (let i = 0; i < count; i++) {
    const life = 0.22 + Math.random() * 0.28;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.022 + Math.random() * 0.018, 5, 4),
      new THREE.MeshBasicMaterial({
        color: Math.random() > 0.35 ? 0xffa13a : 0xffe6a3,
        transparent: true,
        opacity: 1,
        toneMapped: false,
        depthWrite: false
      })
    );
    mesh.position.copy(point);
    scene.add(mesh);

    const direction = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5
    );
    direction.addScaledVector(surfaceNormal, 1.1).normalize();

    collisionSparks.push({
      mesh,
      velocity: direction.multiplyScalar((2 + Math.random() * 4) * (flight ? 1.35 : 1)),
      life,
      maxLife: life
    });
  }
}

function updateCollisionSparks(dt) {
  for (let i = collisionSparks.length - 1; i >= 0; i--) {
    const spark = collisionSparks[i];
    spark.life -= dt;
    spark.velocity.y -= 10 * dt;
    spark.mesh.position.addScaledVector(spark.velocity, dt);
    spark.mesh.material.opacity = Math.max(0, spark.life / spark.maxLife);

    if (spark.life <= 0) {
      scene.remove(spark.mesh);
      spark.mesh.geometry.dispose();
      spark.mesh.material.dispose();
      collisionSparks.splice(i, 1);
    }
  }
}

function handleCollisionImpact(point, surfaceNormal, impactSpeed, flight = false) {
  if (!flight && impactSpeed < DRIVE_COLLISION_THRESHOLD) return;
  if (clock.elapsedTime - lastCollisionTime < COLLISION_COOLDOWN) return;

  lastCollisionTime = clock.elapsedTime;
  spawnCollisionSparks(point, surfaceNormal, impactSpeed, flight);
  playOneShot(flight ? flightClunkAudio : collisionAudio);
}

function getMuzzleWorldPosition() {
  tankRoot.updateMatrixWorld(true);
  if (bodyGroup) bodyGroup.updateWorldMatrix(true, false);

  // Muzzle offsets are authored per tank in right/up/forward axes. Rotate the
  // offset with the tank body so the shot origin always follows its aim frame.
  const offset = DEFAULT_TANK.muzzleOffset || {};
  const localOffset = new THREE.Vector3(
    Number.isFinite(offset.right) ? offset.right : 0,
    Number.isFinite(offset.up) ? offset.up : 1.8,
    -(Number.isFinite(offset.forward) ? offset.forward : 0.8)
  );
  const bodyOrientation = new THREE.Quaternion();
  if (bodyGroup) bodyGroup.getWorldQuaternion(bodyOrientation);
  else bodyOrientation.copy(tankRoot.quaternion);

  return position.clone().add(localOffset.applyQuaternion(bodyOrientation));
}

function getShotMuzzleAndDirection() {
  camera.updateMatrixWorld(true);
  updateTankTransform();

  const cameraRay = new THREE.Raycaster();
  cameraRay.setFromCamera(new THREE.Vector2(0, 0), camera);
  cameraRay.far = WEAPONS[selectedWeapon].range;

  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);

  // Ignore anything between the camera and the far side of the tank.
  const tankDepth = position.clone()
    .sub(camera.position)
    .dot(cameraDirection);

  const ignoreDistance = tankDepth + ballRadius * 1.2;

  const aimHits = cameraRay
    .intersectObjects(levelMeshes, true)
    .filter(hit => hit.distance > ignoreDistance);

  const aimPoint = aimHits.length
    ? aimHits[0].point.clone()
    : camera.position.clone().addScaledVector(
      cameraDirection,
      WEAPONS[selectedWeapon].range
    );

  const muzzle = getMuzzleWorldPosition();
  const direction = aimPoint.clone().sub(muzzle).normalize();

  return { muzzle, direction };
}

function getTankWorldVelocity() {
  if (flightState === 'flying' || flightState === 'drifting') {
    return flightVelocity.clone();
  }

  if (flightState === 'reattaching') {
    return reattachVelocity.clone();
  }

  // Normal driving velocity while magnetically attached.
  const right = new THREE.Vector3()
    .crossVectors(heading, normal)
    .normalize();

  return heading.clone()
    .multiplyScalar(forwardSpeed)
    .addScaledVector(right, strafeSpeed);
}

function fireShot() {
  if (flightState === 'reattaching' || localTankHealth <= 0 || empDisabledRemaining > 0) return;
  if (selectedWeapon === 'minigun' && minigunOverheated) return;
  const weaponDefinition = WEAPONS[selectedWeapon];
  if (weaponDefinition.triggerMode === 'single' && (weaponCooldowns.get(selectedWeapon) || 0) > 0) return;

  const { muzzle, direction } = getShotMuzzleAndDirection();
  if (weaponDefinition.behavior === 'emp') {
    const center = position.clone();
    const shot = {
      shotId: multiplayerPeer ? `${multiplayerSessionId}:${++multiplayerShotSequence}` : null,
      ownerId: multiplayerSessionId || 'solo',
      weapon: selectedWeapon,
      muzzle: center.toArray(),
      up: normal.toArray(),
      velocity: [0, 0, 0]
    };
    createEmpPulse(shot, !multiplayerPeer || multiplayerHost);
    if (multiplayerPeer) {
      if (multiplayerHost) broadcastToPeers({ type: 'emp-pulse', shot });
      else sendToHost({ type: 'fire', shot });
    }
    weaponCooldowns.set(selectedWeapon, 1 / weaponDefinition.shotsPerSecond);
    playOneShot(magnetAudio);
    return;
  }
  const isCannon = selectedWeapon === 'cannon';
  const speed = WEAPONS[selectedWeapon].shotSpeed;
  const projectileVelocity = direction
  .multiplyScalar(speed)
  .add(getTankWorldVelocity());
  const shot = {
    shotId: multiplayerPeer ? `${multiplayerSessionId}:${++multiplayerShotSequence}` : null,
    ownerId: multiplayerSessionId || 'solo',
    weapon: selectedWeapon,
    muzzle: muzzle.toArray(),
    velocity: projectileVelocity.toArray()
  };
  const authoritative = !multiplayerPeer || multiplayerHost;
  createProjectile(shot, authoritative);

  if (multiplayerPeer) {
    if (multiplayerHost) {
      broadcastToPeers({ type: 'projectile-start', shot });
      if (isCannon) broadcastToPeers({ type: 'weapon-shot', sessionId: multiplayerSessionId, weapon: 'cannon' });
    } else {
      sendToHost({ type: 'fire', shot });
      if (isCannon) sendToHost({ type: 'weapon-shot', weapon: 'cannon' });
    }
  }

  if (weaponDefinition.triggerMode === 'single') {
    weaponCooldowns.set(selectedWeapon, 1 / weaponDefinition.shotsPerSecond);
    playOneShot(cannonAudio);
    if (selectedWeapon === 'cannon') window.setTimeout(() => playOneShot(reloadAudio), 170);
  }
  if (selectedWeapon === 'minigun') {
    minigunHeat = Math.min(1, minigunHeat + 0.055);
    if (minigunHeat >= 1) {
      minigunOverheated = true;
      fireHeld = false;
      stopMinigunAudio();
      announceWeaponAudio(false);
    }
  }
}

function showMuzzleFlash(muzzle, direction, weapon) {
  const isCannon = weapon === 'cannon';
  muzzleFlashDuration = isCannon ? 0.13 : 0.075;
  muzzleFlashPeakIntensity = isCannon ? 34 : 17;
  muzzleFlashLife = muzzleFlashDuration;
  muzzleFlash.position.copy(muzzle);
  muzzleFlash.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  muzzleFlash.scale.set(isCannon ? 1.25 : 0.72, isCannon ? 1.8 : 1.25, isCannon ? 1.25 : 0.72);
  const flashColor = isCannon ? 0xff8838 : 0x55dbff;
  muzzleFlash.material.color.setHex(flashColor);
  muzzleFlash.material.opacity = 0.95;
  muzzleFlashLight.position.copy(muzzle);
  muzzleFlashLight.color.setHex(flashColor);
  muzzleFlashLight.intensity = muzzleFlashPeakIntensity;
  muzzleFlash.visible = true;
  muzzleFlashRing.position.copy(muzzle);
  muzzleFlashRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
  muzzleFlashRing.material.color.setHex(isCannon ? 0xffc365 : 0xa5f8ff);
  muzzleFlashRing.material.opacity = 0.9;
  muzzleFlashRing.scale.setScalar(isCannon ? 1.9 : 1.15);
  muzzleFlashRing.visible = true;
  muzzleFlame.position.copy(muzzle).addScaledVector(direction, 0.18);
  muzzleFlame.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  muzzleFlame.scale.setScalar(isCannon ? 1 : 0.01);
  muzzleFlame.visible = isCannon;
}

function createProjectile(shot, authoritative = false) {
  if (!shot || !Array.isArray(shot.muzzle) || !Array.isArray(shot.velocity) ||
      ![...shot.muzzle, ...shot.velocity].every(Number.isFinite)) return null;
  const weaponDefinition = WEAPONS[shot.weapon];
  if (!weaponDefinition || weaponDefinition.behavior !== 'projectile') return null;
  const weapon = weaponDefinition.id;
  const muzzle = new THREE.Vector3().fromArray(shot.muzzle);
  const projectileVelocity = new THREE.Vector3().fromArray(shot.velocity);
  if (projectileVelocity.lengthSq() < 1) return null;
  const isCannon = weapon === 'cannon';
  showMuzzleFlash(muzzle, projectileVelocity.clone().normalize(), weapon);
  const radius = isCannon ? 0.17 : 0.045;
  const color = isCannon ? 0xfff4d6 : 0x32ceff;
  const projectileMesh = new THREE.Group();
  const coreMaterial = new THREE.MeshBasicMaterial({ color: isCannon ? 0xffffff : 0xd7fcff, toneMapped: false });
  const casingMaterial = new THREE.MeshBasicMaterial({ color: 0x0877a8, toneMapped: false });
  const glowMaterial = new THREE.MeshBasicMaterial({ color: isCannon ? 0xffb64d : 0x27bfff, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  if (isCannon) {
    const envelope = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 9), glowMaterial);
    envelope.scale.set(0.85, 2.0, 0.85);
    projectileMesh.add(envelope);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 9), coreMaterial);
    core.scale.set(0.9, 2.35, 0.9);
    projectileMesh.add(core);
  } else {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.075, 0.64, 7), casingMaterial);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.3, 7), coreMaterial);
    nose.position.y = 0.47;
    projectileMesh.add(body, nose);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 9), coreMaterial);
    core.scale.set(0.9, 3.7, 0.9);
    projectileMesh.add(core);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 9), glowMaterial);
    glow.scale.set(1, 4.8, 1);
    projectileMesh.add(glow);
  }
  const tailLength = isCannon ? 4.2 : 1.35;
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(isCannon ? 0.31 : 0.11, tailLength, isCannon ? 12 : 7),
    new THREE.MeshBasicMaterial({ color: isCannon ? 0xff9c38 : 0x38d7ff, transparent: true, opacity: isCannon ? 0.58 : 0.52, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })
  );
  tail.position.y = -tailLength / 2;
  projectileMesh.add(tail);
  if (isCannon) {
    const hotStreak = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 3.5, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })
    );
    hotStreak.position.y = -1.72;
    projectileMesh.add(hotStreak);
  }
  projectileMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), projectileVelocity.clone().normalize());
  projectileMesh.position.copy(muzzle);
  scene.add(projectileMesh);

  const trailMaterial = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: isCannon ? 0.72 : 0.62,
    depthWrite: false
  });
  const trailGeometry = new THREE.BufferGeometry().setFromPoints([muzzle, muzzle]);
  const trail = new THREE.Line(trailGeometry, trailMaterial);
  scene.add(trail);

  projectiles.push({
    kind: 'projectile',
    weapon,
    shotId: shot.shotId || null,
    ownerId: shot.ownerId || 'unknown',
    authoritative,
    networked: !!shot.shotId,
    mesh: projectileMesh,
    trail,
    start: muzzle.clone(),
    position: muzzle.clone(),
    velocity: projectileVelocity,
    damage: weaponDefinition.damagePerShot,
    life: weaponDefinition.range / Math.max(projectileVelocity.length(), 1) + 1,
    radius
  });
  return projectiles[projectiles.length - 1];
}

function createEmpPulse(shot, authoritative = false) {
  if (!shot || !Array.isArray(shot.muzzle) || !shot.muzzle.every(Number.isFinite)) return null;
  if (shot.shotId && projectiles.some(effect => effect.shotId === shot.shotId)) return null;
  const definition = WEAPONS.emp;
  const center = new THREE.Vector3().fromArray(shot.muzzle);
  const group = new THREE.Group();
  group.position.copy(center);
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(1, 28, 20),
    new THREE.MeshBasicMaterial({ color: 0x26bfff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })
  );
  group.add(shell);
  const shellWire = new THREE.Mesh(
    new THREE.SphereGeometry(0.99, 18, 12),
    new THREE.MeshBasicMaterial({ color: 0x57dcff, wireframe: true, transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  );
  group.add(shellWire);
  const crackleMaterial = new THREE.LineBasicMaterial({ color: 0x8df5ff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const cracklePoints = [];
  for (let i = 0; i < 80; i++) {
    const start = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    const tangent = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    tangent.addScaledVector(start, -tangent.dot(start)).normalize();
    const end = start.clone().addScaledVector(tangent, (Math.random() - 0.5) * 0.42).normalize();
    const kink = start.clone().lerp(end, 0.5)
      .add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(0.08))
      .normalize();
    cracklePoints.push(start, kink, kink, end);
  }
  const crackles = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cracklePoints), crackleMaterial);
  group.add(crackles);
  scene.add(group);
  const pulse = {
    kind: 'empPulse', shotId: shot.shotId || null, ownerId: shot.ownerId || 'unknown',
    authoritative, mesh: group, life: 0.9, maxLife: 0.9, radius: definition.range,
    center, disableDuration: definition.disableDuration
  };
  projectiles.push(pulse);
  if (authoritative) disablePlayersInEmpRange(pulse);
  return pulse;
}

function disablePlayersInEmpRange(pulse) {
  const disable = sessionId => {
    if (!sessionId || sessionId === pulse.ownerId) return;
    const remote = remoteTanks.get(sessionId);
    if (sessionId !== multiplayerSessionId && (!remote?.hasPose || remote.health <= 0)) return;
    const targetPosition = sessionId === multiplayerSessionId ? position : remote.root.position;
    if (!targetPosition || targetPosition.distanceTo(pulse.center) > pulse.radius) return;
    if (sessionId === multiplayerSessionId) {
      empDisabledRemaining = Math.max(empDisabledRemaining, pulse.disableDuration);
      forwardSpeed = 0;
      strafeSpeed = 0;
      flightVelocity.set(0, 0, 0);
      fireHeld = false;
      flightSpaceHeld = false;
      for (const key of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight', 'Space', 'ControlLeft']) keys[key] = false;
      stopThrustAudio();
      stopMinigunAudio();
      announceWeaponAudio(false);
      ensureEmpAura(tankRoot).visible = true;
    } else if (remote) {
      remote.empDisabledRemaining = Math.max(remote.empDisabledRemaining || 0, pulse.disableDuration);
      ensureEmpAura(remote.root).visible = true;
    }
    if (multiplayerHost) broadcastToPeers({ type: 'emp-disable', sessionId, duration: pulse.disableDuration });
  };
  if (multiplayerHost) {
    for (const sessionId of remoteTanks.keys()) disable(sessionId);
  }
  if (multiplayerSessionId) disable(multiplayerSessionId);
}

function ensureEmpAura(root) {
  if (root.userData.empAura) return root.userData.empAura;
  const aura = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(ballRadius * 1.65, 1),
    new THREE.MeshBasicMaterial({ color: 0x43dfff, wireframe: true, transparent: true, opacity: 0.48, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  );
  shell.position.y = ballRadius * 0.4;
  aura.add(shell);
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(ballRadius * 1.18, 0.045, 5, 40),
    new THREE.MeshBasicMaterial({ color: 0x9ff8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  );
  band.position.y = ballRadius * 0.75;
  band.rotation.x = Math.PI / 2;
  aura.add(band);
  aura.visible = false;
  root.add(aura);
  root.userData.empAura = aura;
  return aura;
}

function removeEffectGroup(group) {
  scene.remove(group);
  group.traverse(object => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => material.dispose());
    }
  });
}

function acceptRemoteShot(sessionId, message) {
  const shot = message.shot;
  if (!shot || typeof shot.shotId !== 'string' || !shot.shotId.startsWith(`${sessionId}:`)) return;
  if (projectiles.some(projectile => projectile.shotId === shot.shotId)) return;
  shot.ownerId = sessionId;
  if (WEAPONS[shot.weapon]?.behavior === 'emp') {
    const pulse = createEmpPulse(shot, true);
    if (pulse) broadcastToPeers({ type: 'emp-pulse', shot }, sessionId);
    return;
  }
  const projectile = createProjectile(shot, true);
  if (!projectile) return;
  broadcastToPeers({ type: 'projectile-start', shot }, sessionId);
}

function finishRemoteProjectile(message) {
  const shotIndex = projectiles.findIndex(projectile => projectile.kind === 'projectile' && projectile.shotId === message.shotId);
  const shot = shotIndex >= 0 ? projectiles[shotIndex] : null;
  if (message.weapon === 'cannon' && message.health > 0) {
    if (message.targetId === multiplayerSessionId) applyLocalTankImpact(message.hitDirection);
    else applyRemoteTankImpact(message.targetId, message.hitDirection);
  }
  if (shot?.ownerId === multiplayerSessionId && message.targetId && message.weapon === 'cannon') {
    flashPrimaryReticle();
  }
  if (shotIndex >= 0) {
    removeProjectile(projectiles[shotIndex]);
    projectiles.splice(shotIndex, 1);
  }
  if (typeof message.targetId === 'string' && Number.isFinite(message.health)) {
    updateTankHealth(message.targetId, message.health);
    if (message.health <= 0) {
      showRemoteTankDestruction({ sessionId: message.targetId, pose: message.targetPose });
    } else if (message.targetId === multiplayerSessionId && localTankHealth > 0) {
      showMessage('TANK HIT');
    }
  }
  if (!message.targetId && Array.isArray(message.point) && message.point.every(Number.isFinite) &&
      Array.isArray(message.normal) && message.normal.every(Number.isFinite)) {
    spawnBulletHole(
      new THREE.Vector3().fromArray(message.point),
      new THREE.Vector3().fromArray(message.normal),
      message.weapon === 'cannon' ? 0.54 : 0.19
    );
  }
}

function relayRemoteContact(sessionId, message) {
  if (typeof message.otherId !== 'string' || !Array.isArray(message.point) || !Array.isArray(message.normal) ||
      ![...message.point, ...message.normal, message.impactSpeed].every(Number.isFinite)) return;
  const now = clock.elapsedTime;
  for (const [key, time] of hostContactTimes) if (now - time > 5) hostContactTimes.delete(key);
  const pair = [sessionId, message.otherId].sort().join(':');
  if (now - (hostContactTimes.get(pair) ?? -Infinity) < 0.35) return;
  hostContactTimes.set(pair, now);
  const event = { ...message, sessionId, contactId: `${sessionId}:${message.contactId || now}` };
  handleRemoteContact(event);
  broadcastToPeers({ ...event, type: 'player-contact' }, sessionId);
}

function flashPrimaryReticle() {
  const reticle = el('crosshair');
  reticle.classList.remove('is-hit');
  // Restart the flash cleanly when hits land in quick succession.
  void reticle.offsetWidth;
  reticle.classList.add('is-hit');
  if (primaryReticleFlashTimer) clearTimeout(primaryReticleFlashTimer);
  primaryReticleFlashTimer = setTimeout(() => {
    reticle.classList.remove('is-hit');
    primaryReticleFlashTimer = null;
  }, 170);
}

function getBulletHoleTexture() {
  if (bulletHoleTexture) return bulletHoleTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  const crater = context.createRadialGradient(64, 64, 5, 64, 64, 58);
  crater.addColorStop(0, 'rgba(8, 9, 10, 0.98)');
  crater.addColorStop(0.22, 'rgba(18, 18, 17, 0.96)');
  crater.addColorStop(0.34, 'rgba(42, 40, 36, 0.83)');
  crater.addColorStop(0.46, 'rgba(22, 22, 21, 0.42)');
  crater.addColorStop(0.7, 'rgba(10, 10, 10, 0.12)');
  crater.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = crater;
  context.fillRect(0, 0, 128, 128);
  context.strokeStyle = 'rgba(110, 105, 95, 0.48)';
  context.lineWidth = 3;
  context.beginPath();
  context.arc(64, 64, 35, 0, Math.PI * 2);
  context.stroke();
  for (let i = 0; i < 18; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = 25 + Math.random() * 27;
    context.fillStyle = `rgba(14, 14, 13, ${0.25 + Math.random() * 0.5})`;
    context.beginPath();
    context.arc(64 + Math.cos(angle) * distance, 64 + Math.sin(angle) * distance, 1 + Math.random() * 2, 0, Math.PI * 2);
    context.fill();
  }
  bulletHoleTexture = new THREE.CanvasTexture(canvas);
  bulletHoleTexture.colorSpace = THREE.SRGBColorSpace;
  return bulletHoleTexture;
}

function spawnBulletHole(point, normal, size = 0.24, surface = null, attachRoot = null) {
  if (!normal || normal.lengthSq() < 0.0001) return null;
  const oldestDecalIndex = projectiles.findIndex(effect => effect.kind === 'decal');
  const activeDecals = projectiles.reduce((count, effect) => count + (effect.kind === 'decal' ? 1 : 0), 0);
  if (activeDecals >= 120 && oldestDecalIndex >= 0) {
    removeProjectile(projectiles[oldestDecalIndex]);
    projectiles.splice(oldestDecalIndex, 1);
  }
  const surfaceNormal = normal.clone().normalize();
  const projectorPosition = point.clone().addScaledVector(surfaceNormal, 0.025);
  const orientation = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), surfaceNormal)
  );
  const decalSize = new THREE.Vector3(size, size, Math.max(0.06, size * 0.22));
  let geometry;
  if (surface?.isMesh) {
    surface.updateWorldMatrix(true, false);
    geometry = new DecalGeometry(surface, projectorPosition, orientation, decalSize);
  } else {
    // Remote clients receive the hit location and normal, so a tiny plane keeps
    // the same decal visible even when the specific level mesh is unavailable.
    geometry = new THREE.PlaneGeometry(size, size);
    const rotation = new THREE.Quaternion().setFromEuler(orientation);
    geometry.applyQuaternion(rotation);
    geometry.translate(projectorPosition.x, projectorPosition.y, projectorPosition.z);
  }
  if (attachRoot) {
    attachRoot.updateWorldMatrix(true, false);
    geometry.applyMatrix4(attachRoot.matrixWorld.clone().invert());
  }
  if (!geometry.attributes.position?.count) {
    geometry.dispose();
    return null;
  }
  const material = new THREE.MeshBasicMaterial({
    map: getBulletHoleTexture(),
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    side: THREE.DoubleSide,
    toneMapped: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.bulletHole = true;
  mesh.renderOrder = 2;
  (attachRoot || scene).add(mesh);
  projectiles.push({ kind: 'decal', mesh, life: 12, maxLife: 12, fadeDuration: 4 });
  return mesh;
}

function removeProjectile(projectile) {
  if (projectile.kind === 'empPulse') {
    removeEffectGroup(projectile.mesh);
    return;
  }
  projectile.mesh.parent?.remove(projectile.mesh);
  projectile.mesh.traverse(object => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => material.dispose());
    }
  });
  if (projectile.trail) {
    scene.remove(projectile.trail);
    projectile.trail.geometry.dispose();
    projectile.trail.material.dispose();
  }
}

function updateShots(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const shot = projectiles[i];
    shot.life -= dt;

    if (shot.kind === 'effect') {
      const progress = Math.max(0, shot.life / shot.maxLife);
      shot.mesh.scale.setScalar(0.3 + (1 - progress) * 1.15);
      shot.mesh.traverse(object => {
        if (object.material) object.material.opacity = object.material.userData.baseOpacity * progress;
        if (object.isLight) object.intensity = object.userData.baseIntensity * progress;
      });
    } else if (shot.kind === 'shockwave') {
      const progress = Math.max(0, shot.life / shot.maxLife);
      shot.mesh.scale.setScalar(shot.size * (0.25 + (1 - progress) * 2.35));
      shot.mesh.material.opacity = progress * 0.94;
    } else if (shot.kind === 'smoke') {
      const progress = Math.max(0, shot.life / shot.maxLife);
      shot.mesh.position.addScaledVector(shot.velocity, dt);
      shot.mesh.scale.setScalar(0.45 + (1 - progress) * 2.6);
      shot.mesh.material.opacity = shot.mesh.material.userData.baseOpacity * progress;
    } else if (shot.kind === 'decal') {
      shot.mesh.material.opacity = Math.min(0.92, shot.life / shot.fadeDuration * 0.92);
    } else if (shot.kind === 'empPulse') {
      const progress = 1 - shot.life / shot.maxLife;
      const radius = Math.max(0.1, progress * shot.radius);
      shot.mesh.scale.setScalar(radius);
      shot.mesh.children.forEach(child => {
        if (child.material) child.material.opacity = Math.max(0, (1 - progress) * (child === shot.mesh.children[0] ? 0.42 : 0.9));
      });
    } else {
      const previous = shot.position.clone();
      shot.position.addScaledVector(shot.velocity, dt);
      const segment = shot.position.clone().sub(previous);
      const segmentLength = segment.length();

      if (shot.authoritative && segmentLength > 0.0001) {
        raycaster.set(previous, segment.normalize());
        raycaster.far = segmentLength + shot.radius;
        let tankHit = null;
        if (multiplayerHost) {
          if (localTankHealth > 0 && shot.ownerId !== multiplayerSessionId && position.distanceTo(previous) <= ballRadius * 2 + segmentLength) {
            const toTank = position.clone().sub(previous);
            const along = THREE.MathUtils.clamp(toTank.dot(raycaster.ray.direction), 0, raycaster.far);
            const closest = previous.clone().addScaledVector(raycaster.ray.direction, along);
            if (closest.distanceTo(position) < ballRadius + shot.radius) tankHit = { distance: along, point: closest, targetId: multiplayerSessionId };
          }
          for (const [sessionId, remote] of remoteTanks) {
            if (sessionId === shot.ownerId || !remote.hasPose || remote.health <= 0) continue;
            const hits = raycaster.intersectObjects(remote.root.children, true);
            if (hits.length && (!tankHit || hits[0].distance < tankHit.distance)) {
              tankHit = { ...hits[0], targetId: sessionId };
            }
          }
        }
        const hits = raycaster.intersectObjects(levelMeshes, true);
        let worldHit = hits.length ? hits[0] : null;
        const practiceMeshes = targets
          .filter(target => target.practiceTarget && !target.destroyed && target.root.visible)
          .flatMap(target => target.meshes.filter(mesh => mesh.visible));
        const practiceHit = practiceMeshes.length
          ? raycaster.intersectObjects(practiceMeshes, false)[0]
          : null;
        if (practiceHit && (!worldHit || practiceHit.distance < worldHit.distance)) worldHit = practiceHit;

        if (tankHit && (!worldHit || tankHit.distance < worldHit.distance)) {
          const health = Math.max(0, (playerHealth.get(tankHit.targetId) ?? MAX_PLAYER_HEALTH) - shot.damage);
          const wasAlive = (playerHealth.get(tankHit.targetId) ?? MAX_PLAYER_HEALTH) > 0;
          updateTankHealth(tankHit.targetId, health);
          if (multiplayerHost) broadcastToPeers({ type: 'tank-health', sessionId: tankHit.targetId, health });
          if (health <= 0) {
            broadcastTankDestroyed(tankHit.targetId);
            if (wasAlive) handlePlayerKill(shot.ownerId, tankHit.targetId);
          }
          if (shot.weapon === 'cannon' && health > 0) {
            if (tankHit.targetId === multiplayerSessionId) applyLocalTankImpact(shot.velocity.toArray());
            else applyRemoteTankImpact(tankHit.targetId, shot.velocity.toArray());
          }
          if (shot.ownerId === multiplayerSessionId && tankHit.targetId !== multiplayerSessionId && shot.weapon === 'cannon') {
            flashPrimaryReticle();
          }
          if (shot.networked && multiplayerHost) {
            const targetPose = tankHit.targetId === multiplayerSessionId
              ? localTankPose()
              : multiplayerPoses.get(tankHit.targetId)?.pose || null;
            broadcastToPeers({
              type: 'projectile-end', shotId: shot.shotId, weapon: shot.weapon,
              targetId: tankHit.targetId, health, targetPose, point: tankHit.point.toArray(),
              hitDirection: shot.weapon === 'cannon' ? shot.velocity.toArray() : null
            });
          }
          removeProjectile(shot);
          projectiles.splice(i, 1);
          continue;
        }

        if (worldHit) {
          const hit = worldHit;
          const target = findTargetRecord(hit.object);
          const hitNormal = getWorldHitNormal(hit);
          const isPracticeTank = target?.practiceTarget;
          if (isPracticeTank) {
            applyPracticeTankKnockback(target, shot);
            spawnTankHitEffect(hit.point, hitNormal, shot.weapon, 'practice-target');
            if (shot.weapon === 'cannon' && (!multiplayerPeer || shot.ownerId === multiplayerSessionId)) {
              flashPrimaryReticle();
            }
          }
          spawnBulletHole(
            hit.point,
            hitNormal,
            shot.weapon === 'cannon' ? 0.78 : 0.3,
            hit.object,
            isPracticeTank ? target.root : null
          );
          if (shot.ownerId === multiplayerSessionId || !multiplayerHost) damageTarget(hit.object, shot.damage);

          const weaponDefinition = WEAPONS[shot.weapon];
          if (weaponDefinition.splashDamageRange > 0 &&
              (shot.ownerId === multiplayerSessionId || !multiplayerHost)) {
            // Splash values are content data; custom weapon behaviors can
            // implement their own impact rules in this branch.
            targets.forEach(target => {
              if (target.destroyed || target.health <= 0) return;
              const center = new THREE.Box3().setFromObject(target.root).getCenter(new THREE.Vector3());
              const distance = center.distanceTo(hit.point);
              if (distance > 0 && distance < weaponDefinition.splashDamageRange && target !== findTargetRecord(hit.object)) {
                const splash = Math.round(
                  weaponDefinition.splashDamageAmount * (1 - distance / weaponDefinition.splashDamageRange)
                );
                if (target.meshes.length) damageTarget(target.meshes[0], splash);
              }
            });
          }

          if (shot.networked && multiplayerHost) broadcastToPeers({
            type: 'projectile-end', shotId: shot.shotId, weapon: shot.weapon,
            point: hit.point.toArray(), normal: hitNormal.toArray()
          });

          removeProjectile(shot);
          projectiles.splice(i, 1);
          continue;
        }
      }

      shot.mesh.position.copy(shot.position);
      shot.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), shot.velocity.clone().normalize());
      // A short streak reads as a fast tracer without leaving a long beam
      // across the whole flight path.
      const tracerLength = shot.weapon === 'cannon' ? 4.2 : 2.4;
      const trailStart = shot.position.clone().addScaledVector(
        shot.velocity.clone().normalize(),
        -Math.min(tracerLength, shot.position.distanceTo(shot.start))
      );
      shot.trail.geometry.setFromPoints([trailStart, shot.position]);
      shot.trail.material.opacity = shot.weapon === 'cannon' ? 0.58 : 0.52;
    }

    if (shot.life <= 0) {
      if (shot.kind === 'projectile' && shot.networked && shot.authoritative && multiplayerHost) {
        broadcastToPeers({ type: 'projectile-end', shotId: shot.shotId, weapon: shot.weapon });
      }
      removeProjectile(shot);
      projectiles.splice(i, 1);
    }
  }
  if (muzzleFlashLife > 0) {
    muzzleFlashLife = Math.max(0, muzzleFlashLife - dt);
    const progress = muzzleFlashLife / muzzleFlashDuration;
    muzzleFlash.material.opacity = progress * progress * 0.95;
    muzzleFlash.scale.multiplyScalar(1 + dt * 8);
    muzzleFlashRing.material.opacity = progress * 0.9;
    muzzleFlashRing.scale.multiplyScalar(1 + dt * 13);
    muzzleFlashLight.intensity = progress * muzzleFlashPeakIntensity;
    muzzleFlame.scale.setScalar(0.65 + (1 - progress) * 0.9);
    for (const flame of muzzleFlame.children) flame.material.opacity = flame.material.userData.baseOpacity * progress;
  } else {
    muzzleFlash.material.opacity = 0;
    muzzleFlashRing.material.opacity = 0;
    muzzleFlashRing.visible = false;
    muzzleFlame.visible = false;
    for (const flame of muzzleFlame.children) flame.material.opacity = flame.material.userData.baseOpacity;
    muzzleFlashLight.intensity = 0.001;
  }
}

// ============================================================
// MAGNETIC DETACH / FREE FLIGHT / REATTACH
// ============================================================
let freeFallStarted = false;
let freeFallElapsed = 0;
let freeFallPreviousEase = 0;

const driftTargetNormal = new THREE.Vector3(0, 1, 0);

const FREE_FALL_DURATION = 3.5;
const FREE_FALL_ACCEL = 14;
function beginFreeFall() {
  if (freeFallStarted) return;

  freeFallStarted = true;
  freeFallElapsed = 0;
  freeFallPreviousEase = 0;

  const nearest = findNearestSurface();

  if (nearest) {
    driftTargetNormal.copy(nearest.normal);
  } else {
    driftTargetNormal.copy(normal);
  }

  showMessage('THRUST EMPTY — FALLING — PRESS LEFT CTRL TO RE-ENGAGE');
}

function updateFreeFall(dt) {
  freeFallElapsed += dt;

  const progress = THREE.MathUtils.clamp(
    freeFallElapsed / FREE_FALL_DURATION,
    0,
    1
  );

  // Ease-in: starts gently and progressively picks up speed.
  const eased = progress * progress;
  const easeStep = eased - freeFallPreviousEase;
  freeFallPreviousEase = eased;

  // Gradually rotate the underside toward the target surface.
  const oldNormal = normal.clone();

  normal.lerp(driftTargetNormal, easeStep).normalize();

  const transport = new THREE.Quaternion()
    .setFromUnitVectors(oldNormal, normal);

  heading.applyQuaternion(transport)
    .projectOnPlane(normal).normalize();

  aimDirection.applyQuaternion(transport)
    .projectOnPlane(normal).normalize();

  // Build gravitational pull gradually.
  flightVelocity.addScaledVector(
    driftTargetNormal,
    -FREE_FALL_ACCEL * eased * dt
  );

  // A little air resistance, without killing momentum.
  flightVelocity.multiplyScalar(Math.exp(-0.08 * dt));

  moveFlightWithCollision(dt);
}

function startFlight() {
  if (empDisabledRemaining > 0) return false;
  // The reserve must recharge before thrust can be engaged again.
  if (thrustRemaining <= 0) return false;

  // Already thrusting.
  if (flightState === 'flying') {
    flightSpaceHeld = true;
    return true;
  }

  if (flightState === 'attached') {
    freeFallStarted = false;
    flightRoll = 0;

    const initialDirection = getAimDirection();
    flightAimDirection.copy(initialDirection).normalize();
    updateFlightAimFromSurfaceAngles();
    flightAimTargetDirection.copy(flightAimDirection);
    flightAimTargetUp.copy(flightAimUp);

    flightVelocity.copy(normal)
      .multiplyScalar(FLIGHT_PUSH_OFF)
      .addScaledVector(initialDirection, FLIGHT_INITIAL_SPEED);

    forwardSpeed = 0;
    strafeSpeed = 0;
    previousForwardSpeed = 0;
    previousStrafeSpeed = 0;
  } else if (flightState !== 'drifting' || freeFallStarted) {
    return false;
  }

  // Resume thrust without resetting the remaining fuel.
  flightState = 'flying';
  setMagnetsActive(false);
  flightSpaceHeld = true;
  showMessage(`THRUST ENGAGED — ${thrustRemaining.toFixed(1)}s REMAINING`);
  return true;
}

function updateThrustRecharge(dt) {
  if (flightState === 'flying' || thrustRemaining >= THRUST_DURATION) return;
  if (thrustRechargeDelayRemaining > 0) {
    thrustRechargeDelayRemaining = Math.max(0, thrustRechargeDelayRemaining - dt);
    return;
  }

  thrustRemaining = Math.min(
    THRUST_DURATION,
    thrustRemaining + dt * THRUST_DURATION / THRUST_RECHARGE_FULL_DURATION
  );
}


function beginReattach(playClank = true) {
  if (flightState !== 'drifting' && flightState !== 'flying') return;

  const nearest = findNearestSurface();

  if (!nearest) {
    showMessage('No surface in range — still drifting');
    return;
  }

  flightState = 'reattaching';
  setMagnetsActive(true);
  flightSpaceHeld = false;
  reattachPlayClank = playClank;

  stopThrustAudio();

  // The re-engagement sound belongs to contact, so play it when the
  // reattachment animation actually reaches its target.

  reattachNormal.copy(nearest.normal);

  reattachTarget.copy(nearest.point)
    .addScaledVector(reattachNormal, ballRadius + BALL_CLEARANCE);

  reattachFromNormal.copy(normal);
  reattachFromHeading.copy(heading);
  reattachFromAim.copy(flightAimDirection);

  reattachOrientQuat.setFromUnitVectors(
    reattachFromNormal,
    reattachNormal
  );

  reattachVelocity.copy(flightVelocity);

  reattachElapsed = 0;
  reattachOrientProgress = 0;

  reattachStartDistance = Math.max(
    position.distanceTo(reattachTarget),
    0.01
  );

  showMessage('MAGNETS ENGAGING — RETURNING TO SURFACE');
}
function findNearestSurface() {
  const directions = [];
  for (const x of [-1, 0, 1]) {
    for (const y of [-1, 0, 1]) {
      for (const z of [-1, 0, 1]) {
        if (x === 0 && y === 0 && z === 0) continue;
        directions.push(new THREE.Vector3(x, y, z).normalize());
      }
    }
  }

  let best = null;
  for (const direction of directions) {
    raycaster.set(position, direction);
    raycaster.near = 0.05;
    raycaster.far = 2000;
    const hits = raycaster.intersectObjects(levelMeshes, true);
    if (!hits.length) continue;

    const hit = hits[0];
    if (!best || hit.distance < best.distance) {
      const surfaceNormal = getWorldHitNormal(hit);
      // On the inside of the level, the attachment normal points from the wall toward us.
      if (surfaceNormal.dot(position.clone().sub(hit.point)) < 0) surfaceNormal.negate();
      best = {
        distance: hit.distance,
        point: hit.point.clone(),
        normal: surfaceNormal
      };
    }
  }
  return best;
}

function moveAttachedWithCollision(movement, dt) {
  const displacement = movement.clone().multiplyScalar(dt);
  const distance = displacement.length();
  if (distance < 0.00001) return null;

  const direction = displacement.clone().normalize();
  raycaster.set(position, direction);
  raycaster.near = 0;
  raycaster.far = distance + ballRadius + BALL_CLEARANCE;

  const hits = raycaster.intersectObjects(levelMeshes, true);
  if (!hits.length) {
    position.add(displacement);
    return null;
  }

  const hit = hits[0];
  const contactNormal = getWorldHitNormal(hit);

  if (contactNormal.dot(direction) > 0) contactNormal.negate();

  position.copy(hit.point).addScaledVector(
    contactNormal,
    ballRadius + BALL_CLEARANCE
  );

  // Remove only the component pushing into the obstacle; keep tangential motion.
  const intoSurface = movement.dot(contactNormal);
  const impactSpeed = Math.max(0, -intoSurface);
  const slideVelocity = movement.clone();
  if (intoSurface < 0) {
    slideVelocity.addScaledVector(contactNormal, -intoSurface);
  }

  const right = new THREE.Vector3().crossVectors(heading, normal).normalize();
  forwardSpeed = slideVelocity.dot(heading);
  strafeSpeed = slideVelocity.dot(right);

  handleCollisionImpact(hit.point, contactNormal, impactSpeed, false);
  return { normal: contactNormal, point: hit.point.clone(), impactSpeed };
}

function moveFlightWithCollision(dt) {
  const displacement = flightVelocity.clone().multiplyScalar(dt);
  const distance = displacement.length();

  if (distance < 0.00001) return false;

  const direction = displacement.clone().normalize();

  raycaster.set(position, direction);
  raycaster.near = 0;
  raycaster.far = distance + ballRadius + BALL_CLEARANCE;

  const hits = raycaster.intersectObjects(levelMeshes, true);

  if (!hits.length) {
    position.add(displacement);
    return false;
  }

  const hit = hits[0];

  const contactNormal = getWorldHitNormal(hit);

  if (contactNormal.dot(direction) > 0) {
    contactNormal.negate();
  }

  position.copy(hit.point).addScaledVector(
    contactNormal,
    ballRadius + BALL_CLEARANCE
  );

  const intoSurface = flightVelocity.dot(contactNormal);
  const impactSpeed = Math.max(0, -intoSurface);

  // Remove velocity pushing into the wall, but preserve sliding momentum.
  if (intoSurface < 0) {
    flightVelocity.addScaledVector(
      contactNormal,
      -intoSurface * 1.2
    );
  }

  handleCollisionImpact(hit.point, contactNormal, impactSpeed, true);

  // Still have thrust? Continue flying.
  if (flightState === 'flying' && flightSpaceHeld && thrustRemaining > 0) {
    return true;
  }

  // Thrust expired during this collision. Reattach immediately.
  if (flightState === 'flying' && thrustRemaining <= 0) {
    flightState = 'drifting';
    flightSpaceHeld = false;
    stopThrustAudio();
    beginReattach(false);
    return true;
  }

  // Released thrust and collided: automatically reattach.
  beginReattach(false);
  return true;
}

function makeSurfaceDirection(direction, fallback, surfaceNormal) {
  direction.projectOnPlane(surfaceNormal);

  if (direction.lengthSq() < 0.001 && fallback) {
    direction.copy(fallback).projectOnPlane(surfaceNormal);
  }

  if (direction.lengthSq() < 0.001) {
    const reference = Math.abs(surfaceNormal.y) < 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0);

    direction.crossVectors(reference, surfaceNormal);
  }

  return direction.normalize();
}

function updateReattachment(dt) {
  const toTarget = reattachTarget.clone().sub(position);
  const distance = toTarget.length();

  reattachElapsed += dt;

  // Orientation is now controlled by elapsed time, not travel distance.
  const timeT = THREE.MathUtils.clamp(
    reattachElapsed / REATTACH_ORIENT_DURATION,
    0,
    1
  );

  reattachOrientProgress = timeT;

  // Smooth ease-in/ease-out rotation.
  const orientT = timeT * timeT * (3 - 2 * timeT);

  const transport = new THREE.Quaternion().slerpQuaternions(
    new THREE.Quaternion(),
    reattachOrientQuat,
    orientT
  );

  normal.copy(reattachFromNormal)
  .applyQuaternion(transport)
  .normalize();

heading.copy(reattachFromHeading)
  .applyQuaternion(transport);

makeSurfaceDirection(
  heading,
  reattachFromAim.clone().applyQuaternion(transport),
  normal
);

aimDirection.copy(reattachFromAim)
  .applyQuaternion(transport);

makeSurfaceDirection(aimDirection, heading, normal);

aimPitch *= Math.exp(-8 * dt);

  // Movement toward the attachment point.
  if (distance > 0.001) {
    const direction = toTarget.normalize();
    const close = 1 - THREE.MathUtils.clamp(distance / 2.4, 0, 1);
    const pullT = THREE.MathUtils.clamp(reattachElapsed / 1.15, 0, 1);
    const pullEase = pullT * pullT;

    if (close > 0.45) {
      position.lerp(
        reattachTarget,
        1 - Math.exp(-(10 + 22 * close) * dt)
      );

      reattachVelocity.multiplyScalar(
        Math.exp(-(12 + 18 * close) * dt)
      );
    } else {
      const accel = 4 + REATTACH_ACCEL * pullEase + 28 * pullEase * pullEase;

      reattachVelocity.addScaledVector(direction, accel * dt);

      const along = reattachVelocity.dot(direction);
      const lateral = reattachVelocity.clone()
        .addScaledVector(direction, -along);

      reattachVelocity.addScaledVector(
        lateral,
        -Math.min(1, 16 * dt)
      );

      if (along < 0) {
        reattachVelocity.addScaledVector(
          direction,
          -along * Math.min(1, 8 * dt)
        );
      }

      const maxSpeed = 9 + 36 * pullEase;

      if (reattachVelocity.length() > maxSpeed) {
        reattachVelocity.setLength(maxSpeed);
      }

      const step = reattachVelocity.clone().multiplyScalar(dt);

      if (step.length() >= distance) {
        position.copy(reattachTarget);
        reattachVelocity.set(0, 0, 0);
      } else {
        position.add(step);
      }
    }
  }

  // Return control near the end of the orientation animation. This keeps its
  // current rotation pace while trimming the small final wait to drive again.
  const aligned = orientT >= REATTACH_CONTROL_RESUME_PROGRESS;

  if (aligned) {
    position.copy(reattachTarget);
    reattachVelocity.set(0, 0, 0);
  }

  if (aligned) {
    // Keep the orientation transported throughout the reattachment animation.
    // The saved pre-flight directions belong to the old surface; copying them
    // here would undo the rotation and can leave the controls pointed the wrong way.
    normal.copy(reattachNormal).normalize();

    makeSurfaceDirection(heading, aimDirection, normal);
    makeSurfaceDirection(aimDirection, heading, normal);

    // Guard against a degenerate tangent if the target surface is unusual.
    if (
      !Number.isFinite(heading.x) ||
      !Number.isFinite(heading.y) ||
      !Number.isFinite(heading.z) ||
      heading.lengthSq() < 0.001
    ) {
      heading.set(0, 0, -1);
      makeSurfaceDirection(heading, null, normal);
    }

    if (
      !Number.isFinite(aimDirection.x) ||
      !Number.isFinite(aimDirection.y) ||
      !Number.isFinite(aimDirection.z) ||
      aimDirection.lengthSq() < 0.001
    ) {
      aimDirection.copy(heading);
    }

  aimPitch = 0;

  flightVelocity.set(0, 0, 0);
  reattachVelocity.set(0, 0, 0);

  forwardSpeed = 0;
  strafeSpeed = 0;
  previousForwardSpeed = 0;
  previousStrafeSpeed = 0;

  flightSpaceHeld = false;
  flightState = 'attached';

  freeFallStarted = false;
    if (reattachPlayClank) playOneShot(flightClunkAudio);

  // The initial collision/engagement clunk already played. Do not play a
  // second clunk when the control state switches back to attached.
  showMessage('Magnets reattached');
}
}

// ============================================================
// MOVEMENT AND PHYSICS
// ============================================================

function damp(value, amount, dt) {
  return value * Math.exp(-amount * dt);
}

function update(dt) {
  if (!ballMesh) return;

  if (!gameStarted) {
    updateMenuCamera(dt);
    updateDestructionEffects(dt);
    return;
  }
  if (gamePaused) return;
  if (localTankHealth <= 0) {
    el('flight-boost-meter').hidden = true;
    el('mag-drive-hint').hidden = true;
    updateDestructionEffects(dt);
    updateShots(dt);
    updateCollisionSparks(dt);
    updateEngineAudio(dt);
    return;
  }

  updateThrustRecharge(dt);
  if (flightState === 'flying' || flightState === 'drifting') updateFlightAim(dt);
  for (const [weapon, cooldown] of weaponCooldowns) {
    const remaining = Math.max(0, cooldown - dt);
    if (remaining === 0) weaponCooldowns.delete(weapon);
    else weaponCooldowns.set(weapon, remaining);
  }
  if (!fireHeld || selectedWeapon !== 'minigun') minigunHeat = Math.max(0, minigunHeat - dt * (minigunOverheated ? 0.22 : 0.09));
  if (minigunOverheated && minigunHeat <= 0) minigunOverheated = false;
  const selectedCooldown = weaponCooldowns.get(selectedWeapon) || 0;
  const selectedReload = 1 / (WEAPONS[selectedWeapon]?.shotsPerSecond || 1);
  const reloadBar = el('reload-progress');
  const showMinigunHeat = selectedWeapon === 'minigun' && minigunHeat > 0;
  const showReload = selectedCooldown > 0;
  const track = el('reload-progress-track');
  track.hidden = !showReload && !showMinigunHeat;
  if (showMinigunHeat) {
    reloadBar.style.width = `${minigunHeat * 100}%`;
    reloadBar.classList.toggle('is-overheated', minigunOverheated);
  } else {
    reloadBar.style.width = `${showReload ? (1 - selectedCooldown / selectedReload) * 100 : 0}%`;
    reloadBar.classList.remove('is-overheated');
  }
  empDisabledRemaining = Math.max(0, empDisabledRemaining - dt);
  if (tankRoot.userData.empAura) {
    tankRoot.userData.empAura.visible = empDisabledRemaining > 0;
    tankRoot.userData.empAura.rotation.y += dt * 2.4;
  }

  // Existing one-second boost is only available while magnetically attached.
  if (groundBoostRemaining > 0 && flightState === 'attached') {
    groundBoostRemaining = Math.max(0, groundBoostRemaining - dt);
    groundBoostClock += dt;
    const fade = groundBoostRemaining / GROUND_BOOST_DURATION;
    groundBoostWobbleYaw = Math.sin(groundBoostClock * GROUND_BOOST_WOBBLE_RATE) * GROUND_BOOST_AIM_WOBBLE * fade;
    groundBoostWobblePitch = Math.sin(groundBoostClock * GROUND_BOOST_WOBBLE_RATE * 1.37 + 0.8) * GROUND_BOOST_AIM_WOBBLE * 0.75 * fade;
  } else {
    groundBoostRemaining = 0;
    groundBoostWobbleYaw = 0;
    groundBoostWobblePitch = 0;
  }

  const groundBoosting = groundBoostRemaining > 0;

  if (flightState === 'attached') {
    // Keep the movement and steering basis valid after every attachment.
    normal.normalize();
    makeSurfaceDirection(heading, aimDirection, normal);
    makeSurfaceDirection(aimDirection, heading, normal);

    const controlsDisabled = empDisabledRemaining > 0;
    const drive = controlsDisabled ? 0 : (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const strafe = controlsDisabled ? 0 : (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);

    forwardSpeed += drive * DRIVE_ACCEL * (groundBoosting ? 1.8 : 1) * dt;
    strafeSpeed += strafe * STRAFE_ACCEL * (groundBoosting ? 1.5 : 1) * dt;
    forwardSpeed = damp(forwardSpeed, drive ? 0.35 : DRAG, dt);
    strafeSpeed = damp(strafeSpeed, strafe ? 0.45 : DRAG * 1.15, dt);

    const forwardLimit = groundBoosting ? GROUND_BOOST_MAX_SPEED : Math.max(MAX_SPEED, forwardSpeed);
    forwardSpeed = THREE.MathUtils.clamp(forwardSpeed, -MAX_REVERSE_SPEED, forwardLimit);
    strafeSpeed = THREE.MathUtils.clamp(strafeSpeed, -MAX_SPEED * 0.7, MAX_SPEED * 0.7);

    const angleToAim = Math.atan2(
      heading.clone().cross(aimDirection).dot(normal),
      THREE.MathUtils.clamp(heading.dot(aimDirection), -1, 1)
    );
    const maxTurn = TURN_RATE * dt;
    const turn = THREE.MathUtils.clamp(
      angleToAim * (1 - Math.exp(-TURN_RESPONSE * dt)), -maxTurn, maxTurn
    );
    heading.applyAxisAngle(normal, turn).projectOnPlane(normal).normalize();

    const forwardAccel = (forwardSpeed - previousForwardSpeed) / Math.max(dt, 0.0001);
    const strafeAccel = (strafeSpeed - previousStrafeSpeed) / Math.max(dt, 0.0001);
    previousForwardSpeed = forwardSpeed;
    previousStrafeSpeed = strafeSpeed;

    const desiredPitchLean = THREE.MathUtils.clamp(-forwardAccel * BODY_ACCEL_LEAN, -0.10, 0.10);
    const desiredSideLean = THREE.MathUtils.clamp(
      -turn / Math.max(dt, 0.0001) * BODY_TURN_LEAN - strafeAccel * BODY_ACCEL_LEAN * 0.65,
      -0.16, 0.16
    );
    const blend = 1 - Math.exp(-BODY_LEAN_RESPONSE * dt);
    const groundBoostFade = groundBoostRemaining / GROUND_BOOST_DURATION;
    const groundBoostLeanPitch = groundBoosting
      ? Math.sin(groundBoostClock * GROUND_BOOST_WOBBLE_RATE * 1.37) * 0.075 * groundBoostFade : 0;
    const groundBoostLeanSide = groundBoosting
      ? Math.sin(groundBoostClock * GROUND_BOOST_WOBBLE_RATE) * 0.11 * groundBoostFade : 0;
    bodyPitchLean += (desiredPitchLean + groundBoostLeanPitch - bodyPitchLean) * blend;
    bodySideLean += (desiredSideLean + groundBoostLeanSide - bodySideLean) * blend;

    const right = new THREE.Vector3().crossVectors(heading, normal).normalize();
    const movement = heading.clone().multiplyScalar(forwardSpeed)
      .addScaledVector(right, strafeSpeed);
    const distance = movement.length() * dt;

    if (distance > 0.00001) {
      const oldNormal = normal.clone();
      const startPosition = position.clone();
      const collision = moveAttachedWithCollision(movement, dt);
      const collided = collision !== null;
      const blocksSurfaceTransition = collision && collision.normal.dot(oldNormal) < 0.15;

      // A steep face should stop the tank. Snapping support on that same frame
      // can select a nearby floor and move the tank across the corner.
      if (blocksSurfaceTransition) {
        unsupportedSurfaceTime = 0;
      } else if (snapToSurface(12, dt)) {
        unsupportedSurfaceTime = 0;
        const transport = new THREE.Quaternion().setFromUnitVectors(oldNormal, normal);
        heading.applyQuaternion(transport).projectOnPlane(normal).normalize();
        aimDirection.applyQuaternion(transport).projectOnPlane(normal).normalize();

        const actualDistance = position.distanceTo(startPosition);
        if (!collided && actualDistance > 0.0001) {
          const travelDirection = movement.clone().normalize();
          const rollAxis = new THREE.Vector3().crossVectors(normal, travelDirection).normalize();
          if (rollAxis.lengthSq() > 0.000001) {
            const parentQuaternion = new THREE.Quaternion();
            ballMesh.parent.getWorldQuaternion(parentQuaternion);
            const localAxis = rollAxis.clone().applyQuaternion(parentQuaternion.invert()).normalize();
            const rollQuaternion = new THREE.Quaternion().setFromAxisAngle(
              localAxis, actualDistance / Math.max(ballRadius, 0.1)
            );
            ballMesh.quaternion.premultiply(rollQuaternion);
          }
        }
      } else if (!collided && levelMeshes.length) {
        // Allow a brief support gap over seams, but fall once the tank has
        // clearly left the platform. Keep the ground movement basis stable
        // during this grace interval.
        unsupportedSurfaceTime += dt;
        if (unsupportedSurfaceTime >= 0.12) {
          flightVelocity.copy(movement);
          aimDirection.copy(movement).projectOnPlane(normal).normalize();
          if (aimDirection.lengthSq() < 0.001) aimDirection.copy(heading);
          aimPitch = 0;
          updateFlightAimFromSurfaceAngles();
          flightAimTargetDirection.copy(flightAimDirection);
          flightAimTargetUp.copy(flightAimUp);
          flightState = 'drifting';
          freeFallStarted = false;
          showMessage('FREE FLOAT — SPACE TO THRUST — PRESS LEFT CTRL TO RE-ENGAGE');
        }
      }
    }
} else if (flightState === 'flying') {
  // Fuel is consumed ONLY while Space is held.
  const thrustBeforeDrain = thrustRemaining;
  thrustRemaining = Math.max(0, thrustRemaining - dt);
  if (thrustBeforeDrain > 0 && thrustRemaining <= 0) {
    thrustRechargeDelayRemaining = THRUST_EMPTY_PENALTY_DELAY;
  }

  const thrustDirection = getAimDirection();

  flightVelocity.addScaledVector(
    thrustDirection,
    THRUST_ACCELERATION * dt
  );

  flightVelocity.multiplyScalar(Math.exp(-FLIGHT_DRAG * dt));

  const collided = moveFlightWithCollision(dt);

  if (!collided) {
    const tangentHeading = thrustDirection.clone().projectOnPlane(normal);
    if (tangentHeading.lengthSq() > 0.001) {
      heading.copy(tangentHeading.normalize());
    }
  }

  if (thrustRemaining <= 0) {
    flightState = 'drifting';
    flightSpaceHeld = false;
    stopThrustAudio();
    //beginFreeFall();
  }

} else if (flightState === 'drifting') {
  if (thrustRemaining <= 0) {
    //updateFreeFall(dt);
    stopThrustAudio();
    flightVelocity.multiplyScalar(Math.exp(-0.08 * dt));
    moveFlightWithCollision(dt);
  } else {
    // Released Space with fuel remaining: coast on existing momentum.
    flightVelocity.multiplyScalar(Math.exp(-0.08 * dt));
    moveFlightWithCollision(dt);
  }

} else if (flightState === 'reattaching') {
  updateReattachment(dt);
}

  updateTankTransform();
  updateMapBoundary();
  resolveTankContacts();

  // CAMERA: the camera tracks the current aiming vector in every movement mode.
  const viewDirection = getAimDirection();
  const airborneLook = flightState === 'flying' || flightState === 'drifting';
  if (airborneLook) camera.up.copy(getFlightUp());
  else if (flightState === 'reattaching') camera.up.lerp(normal, 1 - Math.exp(-18 * dt));

  if (firstPerson) {
    if (!airborneLook) camera.up.lerp(normal, 1 - Math.exp(-16 * dt));
    const fpPosition = position.clone().addScaledVector(normal, ballRadius * 1.65);
    const fpCameraTarget = camera.position.clone().lerp(fpPosition, 1 - Math.exp(-16 * dt));
    camera.position.copy(resolveCameraCollision(position, fpCameraTarget));
    const fpLookTarget = camera.position.clone().addScaledVector(viewDirection, 20);
    cameraLookTarget.lerp(fpLookTarget, 1 - Math.exp(-16 * dt));
    camera.lookAt(cameraLookTarget);
  } else if (airborneLook) {
    // Lock the third-person camera to the turret's aim frame. Position and
    // viewing direction rotate together, with a little follow-through.
    const cameraAnchor = position.clone()
      .addScaledVector(getFlightUp(), CAMERA_HEIGHT * thirdPersonDistance / CAMERA_DISTANCE);
    const desiredCamera = cameraAnchor.clone()
      .addScaledVector(viewDirection, -thirdPersonDistance);
    const desiredLookTarget = position.clone().addScaledVector(viewDirection, 20);
    const cameraFollow = 1 - Math.exp(-FLIGHT_CAMERA_RESPONSE * dt);
    // The elevated camera anchor can sweep through the room during a 180°
    // reattachment turn. Cast from the tank itself so the anchor never starts
    // beyond the wall and accidentally places the camera outside the level.
    const cameraTarget = resolveCameraCollision(position, desiredCamera);
    const followedPosition = camera.position.clone().lerp(cameraTarget, cameraFollow);
    camera.position.copy(resolveCameraCollision(position, followedPosition));
    cameraLookTarget.lerp(desiredLookTarget, cameraFollow);
    camera.lookAt(cameraLookTarget);
  } else {
    // Track the turret in the same aim-relative frame in both drive and flight.
    // Drive pitch stays constrained by the current surface normal.
    const cameraPitch = THREE.MathUtils.clamp(
      aimPitch + groundBoostWobblePitch,
      -MAX_AIM_PITCH,
      MAX_AIM_PITCH
    );
    const cameraYawDirection = aimDirection.clone()
      .applyAxisAngle(normal, groundBoostWobbleYaw)
      .projectOnPlane(normal).normalize();
    const driveCameraUp = cameraYawDirection.clone()
      .multiplyScalar(-Math.sin(cameraPitch))
      .addScaledVector(normal, Math.cos(cameraPitch))
      .normalize();
    const cameraFollow = 1 - Math.exp(-FLIGHT_CAMERA_RESPONSE * dt);
    camera.up.lerp(driveCameraUp, cameraFollow).normalize();
    const cameraAnchor = position.clone()
      .addScaledVector(normal, CAMERA_HEIGHT * thirdPersonDistance / CAMERA_DISTANCE);
    const desiredCamera = cameraAnchor.clone()
      .addScaledVector(viewDirection, -thirdPersonDistance);
    const desiredLookTarget = position.clone().addScaledVector(viewDirection, 20);
    const cameraTarget = resolveCameraCollision(position, desiredCamera);
    const followedPosition = camera.position.clone().lerp(cameraTarget, cameraFollow);
    camera.position.copy(resolveCameraCollision(position, followedPosition));
    cameraLookTarget.lerp(desiredLookTarget, cameraFollow);
    camera.lookAt(cameraLookTarget);
  }

  updateLocalTankCameraFade();

  if (thrusterMesh) {
    // Keep the group (and light nodes) present so first thrust cannot add
    // lights to the scene and trigger a shader recompilation.
    thrusterMesh.visible = true;
    setThrusterEffectsActive(flightState === 'flying' && flightSpaceHeld);

    if (thrusterBasePosition) thrusterMesh.position.copy(thrusterBasePosition);
    if (thrusterBaseQuaternion) thrusterMesh.quaternion.copy(thrusterBaseQuaternion);
    if (thrusterBaseScale) thrusterMesh.scale.copy(thrusterBaseScale);

    if (thrusterMesh.visible && thrusterBasePosition) {
      thrusterMesh.position.z += Math.sin(clock.elapsedTime * 55) * .1;
    }
  }

  // Hold left mouse for continuous minigun fire. Cannon remains single-shot.
  if (fireHeld && WEAPONS[selectedWeapon].triggerMode === 'automatic') {
    minigunAccumulator += dt;
    startMinigunAudio();
    const fireInterval = 1 / WEAPONS[selectedWeapon].shotsPerSecond;
    while (minigunAccumulator >= fireInterval) {
      fireShot();
      minigunAccumulator -= fireInterval;
    }
  }

  updateShots(dt);
  updateDestructionEffects(dt);
  updateCollisionSparks(dt);
  updateEngineAudio(dt);

  const airborne = flightState === 'flying' || flightState === 'drifting';
  const thrustRecharging = thrustRemaining < THRUST_DURATION && flightState !== 'flying';
  el('flight-boost-meter').hidden = !airborne && !thrustRecharging;
  el('mag-drive-hint').hidden = !airborne;
  el('boost-bar').style.width = `${THREE.MathUtils.clamp(thrustRemaining / THRUST_DURATION, 0, 1) * 100}%`;
  el('boost-time').textContent = `${thrustRemaining.toFixed(1)}s`;
  el('flight-boost-meter').classList.toggle('depleted', thrustRemaining <= 0);
  el('flight-boost-meter').classList.toggle(
    'penalty',
    thrustRemaining <= 0 && thrustRechargeDelayRemaining > 0
  );

  const speedReadout = flightState === 'attached'
    ? Math.hypot(forwardSpeed, strafeSpeed).toFixed(1)
    : ((flightState === 'flying' || flightState === 'drifting') ? flightVelocity.length() : reattachVelocity.length()).toFixed(1);
  el('speed').textContent = speedReadout;
  el('hud-speed-value').textContent = Math.round(Number(speedReadout));
  el('ground-boost').textContent = groundBoosting ? groundBoostRemaining.toFixed(1) + 's' : 'Ready';
  el('flight').textContent = flightState === 'attached'
    ? 'Magnetized'
    : flightState === 'flying'
      ? `Thrust ${thrustRemaining.toFixed(1)}s`
      : flightState === 'drifting'
        ? 'Free drift · Ctrl to attach'
        : 'Magnets engaging';
  el('surface').textContent =
    `${normal.x.toFixed(1)}, ${normal.y.toFixed(1)}, ${normal.z.toFixed(1)}`;
  const yawDegrees = (THREE.MathUtils.radToDeg(Math.atan2(heading.x, -heading.z)) + 360) % 360;
  const pitchDegrees = THREE.MathUtils.radToDeg(aimPitch);
  el('yaw-ruler').style.backgroundPositionX = `${-yawDegrees}px`;
  el('yaw-ruler').style.setProperty('--scale-offset', `${-yawDegrees}px`);
  el('pitch-ruler').style.backgroundPositionY = `${pitchDegrees * 0.65}px`;
  el('pitch-ruler').style.setProperty('--scale-offset', `${pitchDegrees * 0.65}px`);
  el('look-ruler').style.backgroundPositionY = `${-pitchDegrees * 0.65}px`;
  el('look-ruler').style.setProperty('--scale-offset', `${-pitchDegrees * 0.65}px`);
  el('hud-yaw-value').textContent = `${String(Math.round(yawDegrees) % 360).padStart(3, '0')}°`;
  el('hud-pitch-value').textContent = `${Math.round(pitchDegrees)}°`;
  el('hud-look-value').textContent = `${Math.round(pitchDegrees)}°`;

  let travelVelocity;
  if (flightState === 'flying' || flightState === 'drifting') {
    travelVelocity = flightVelocity;
  } else if (flightState === 'attached') {
    const right = new THREE.Vector3().crossVectors(heading, normal).normalize();
    travelVelocity = heading.clone().multiplyScalar(forwardSpeed)
      .addScaledVector(right, strafeSpeed);
  } else {
    travelVelocity = reattachVelocity;
  }
  const airborneSpeedLines = flightState === 'flying' || flightState === 'drifting';
  updateSpeedLines(dt, airborneSpeedLines, travelVelocity);
}

// ============================================================
// INPUT
// ============================================================

function setViewMode(fp) {
  firstPerson = fp;
  tankRoot.visible = !fp;

  document.body.classList.toggle('first-person', fp);

  el('view').textContent =
    fp ? 'First person' : 'Third person';

  showMessage(el('view').textContent);
}

function showMessage(_text, style = 'default') {
  // Keep the shared message node for the two boundary alerts only. Gameplay
  // hints (boost, weapon changes, respawns, and similar events) use HUD state
  // where available and should not create transient toast popups.
  if (style !== 'boundary-warning' && style !== 'boundary-death') return;
  const message = el('message');
  message.textContent = _text;
  message.dataset.style = style;
  message.style.display = 'block';
  if (boundaryWarningTimer !== null) clearTimeout(boundaryWarningTimer);
  boundaryWarningTimer = setTimeout(() => {
    message.style.display = 'none';
    boundaryWarningTimer = null;
  }, 3200);
}

renderer.domElement.addEventListener('click', () => {
  if (!gameStarted || localTankHealth <= 0) return;
  engineAudioUnlocked = true;
  startEngineAudio();
  if (!mouseCaptured) {
    renderer.domElement.requestPointerLock();
  }
});

renderer.domElement.addEventListener('wheel', event => {
  if (firstPerson) return;
  event.preventDefault();
  const direction = Math.sign(event.deltaY);
  thirdPersonDistance = THREE.MathUtils.clamp(
    thirdPersonDistance + direction * CAMERA_DISTANCE_STEP,
    CAMERA_MIN_DISTANCE,
    CAMERA_MAX_DISTANCE
  );
}, { passive: false });

function setZoom(active) {
  rightMouseHeld = active;
  camera.fov = active ? CAMERA_ZOOM_FOV : 65;
  camera.updateProjectionMatrix();
}

renderer.domElement.addEventListener('mousedown', event => {
  if (event.button === 2 && mouseCaptured) {
    event.preventDefault();
    setZoom(true);
  }

  if (event.button === 0 && mouseCaptured) {
    if (empDisabledRemaining > 0) return;
    fireHeld = true;
    if (WEAPONS[selectedWeapon].triggerMode === 'single') {
      fireShot();
    } else {
      minigunAccumulator = 1 / WEAPONS[selectedWeapon].shotsPerSecond;
      startMinigunAudio();
      announceWeaponAudio(true);
    }
  }
});

window.addEventListener('mouseup', event => {
  if (event.button === 2) setZoom(false);

  if (event.button === 0) {
    fireHeld = false;
    minigunAccumulator = 0;
    stopMinigunAudio();
    announceWeaponAudio(false);
  }
});

renderer.domElement.addEventListener('contextmenu', event => event.preventDefault());

document.addEventListener('pointerlockchange', () => {

  mouseCaptured =
    document.pointerLockElement === renderer.domElement;

  if (!mouseCaptured) {
    fireHeld = false;
    minigunAccumulator = 0;
    stopMinigunAudio();
    announceWeaponAudio(false);
    setZoom(false);
  }
  showMessage(
    localTankHealth <= 0
      ? 'TANK DESTROYED'
      : mouseCaptured
        ? 'Mouse captured — ESC to release'
        : 'Click to capture mouse'
  );
});

document.addEventListener('mousemove', event => {

  if (!mouseCaptured) return;

  const yaw = -event.movementX * MOUSE_SENSITIVITY;
  const pitch = -event.movementY * MOUSE_SENSITIVITY;

  if (flightState === 'flying' || flightState === 'drifting') {
    // Rotate the full target frame so yaw remains well-defined even when the
    // tank looks straight up or down.
    const targetDirection = flightAimTargetDirection.clone();
    const targetUp = flightAimTargetUp.clone();
    const rolledUp = targetUp.clone().applyAxisAngle(targetDirection, flightRoll);
    const yawRotation = new THREE.Quaternion().setFromAxisAngle(rolledUp, yaw);
    targetDirection.applyQuaternion(yawRotation).normalize();
    targetUp.applyQuaternion(yawRotation).normalize();

    const pitchRight = new THREE.Vector3()
      .crossVectors(targetDirection, rolledUp)
      .normalize()
      .applyQuaternion(yawRotation)
      .normalize();
    const pitchRotation = new THREE.Quaternion().setFromAxisAngle(pitchRight, pitch);
    targetDirection.applyQuaternion(pitchRotation).normalize();
    targetUp.applyQuaternion(pitchRotation).normalize();

    flightAimTargetDirection.copy(targetDirection);
    flightAimTargetUp.copy(targetUp);
  } else if (flightState === 'attached') {
    // Surface mode stays constrained to the current magnetized surface.
    aimDirection.applyAxisAngle(normal, yaw)
      .projectOnPlane(normal).normalize();

    aimPitch = THREE.MathUtils.clamp(
      aimPitch + pitch,
      -MAX_AIM_PITCH,
      MAX_AIM_PITCH
    );
  }
});

window.addEventListener('keydown', event => {
  if (event.code === 'Escape' && gameStarted) {
    event.preventDefault();
    if (pauseMenuOpen) closeGameMenu();
    else openGameMenu();
    return;
  }
  if (!gameStarted || localTankHealth <= 0 || pauseMenuOpen) return;

  if (empDisabledRemaining > 0 && [
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight', 'Space', 'ControlLeft'
  ].includes(event.code)) {
    event.preventDefault();
    return;
  }

  if (event.code === 'Digit1' && !event.repeat) setWeapon(DEFAULT_TANK.primaryWeapon);
  if (event.code === 'Digit2' && !event.repeat) setWeapon(DEFAULT_TANK.secondaryWeapon);
  if (event.code === 'Digit3' && !event.repeat) setWeapon(DEFAULT_TANK.tertiaryWeapon);

  if (event.code === 'Space' && !event.repeat) {
    event.preventDefault();
    if (startFlight()) startThrustAudio();
  }

  if (event.code === 'ControlLeft' && !event.repeat) {
    event.preventDefault();
    beginReattach();
  }

  if (event.code === 'KeyC' && !event.repeat) {
    setViewMode(!firstPerson);
  }

  if (
    (event.code === 'ShiftLeft' || event.code === 'ShiftRight') &&
    !event.repeat &&
    groundBoostRemaining <= 0 && flightState === 'attached'
  ) {

    groundBoostRemaining = GROUND_BOOST_DURATION;
    groundBoostClock = 0;

    forwardSpeed = Math.min(
      GROUND_BOOST_MAX_SPEED,
      forwardSpeed + GROUND_BOOST_IMPULSE
    );
  }

  keys[event.code] = true;

  if (
    (event.code === 'KeyQ' || event.code === 'KeyE') &&
    (flightState === 'flying' || flightState === 'drifting')
  ) {
    event.preventDefault();
  }

  if ([
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'ShiftLeft', 'ShiftRight', 'Space', 'ControlLeft'
  ].includes(event.code)) {
    event.preventDefault();
  }
});

window.addEventListener('keyup', event => {
  keys[event.code] = false;
  if (!gameStarted) return;
  if (event.code === 'Space' && flightState === 'flying') {
    flightSpaceHeld = false;
    flightState = 'drifting';
    if (thrustRemaining > 0) {
      thrustRechargeDelayRemaining = THRUST_RECHARGE_DELAY_AFTER_USE;
    }
    stopThrustAudio();
  }
});

window.addEventListener('blur', () => {

  Object.keys(keys).forEach(key => keys[key] = false);

  groundBoostRemaining = 0;
  groundBoostWobbleYaw = 0;
  groundBoostWobblePitch = 0;
  fireHeld = false;
  stopMinigunAudio();
  announceWeaponAudio(false);
  setZoom(false);
  if (flightState === 'flying') {
    // Losing focus cancels active thrust but leaves the tank drifting.
    flightState = 'drifting';
    flightSpaceHeld = false;
  }
});

// ============================================================
// RESIZE / MAIN LOOP
// ============================================================

window.addEventListener('resize', () => {

  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(innerWidth, innerHeight);

  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
});

function animate() {

  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.04);

  update(dt);
  if (levelAnimationMixer && !gamePaused) levelAnimationMixer.update(dt);
  if (!gamePaused) updateCometFogFlow(dt);

  updateRemoteTanks(dt);
  updatePlayerHealthBars();
  updatePracticeTargets(dt);
  updateBodyCrosshair();
  if (multiplayerPeer && multiplayerSessionId) {
    multiplayerSendAccumulator += dt;
    if (multiplayerSendAccumulator >= 1 / 15 && ballMesh) {
      multiplayerSendAccumulator = 0;
      const pose = localTankPose();
      const sequence = ++multiplayerPoseSequence;
      if (multiplayerHost) {
        multiplayerPoses.set(multiplayerSessionId, { pose, sequence });
        for (const connection of peerConnections.values()) {
          if (connection.open) {
            connection.send({ type: 'pose', sessionId: multiplayerSessionId, pose, sequence });
          }
        }
      } else if (hostConnection?.open) {
        hostConnection.send({ type: 'pose', pose, sequence });
      }
    }
  }

  renderer.render(scene, camera);
}

startupRequested = true;
updateLoadingStatus();
maybeFinishGameStartup();
animate();

