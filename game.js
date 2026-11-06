import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
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
const CAMERA_ZOOM_FOV = 42;
const CAMERA_FADE_RADIUS = 4.5;
const CAMERA_FADE_STRENGTH = 0.92;

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

const DRIVE_COLLISION_THRESHOLD = 3.5;
const COLLISION_COOLDOWN = 0.3;
const COLLISION_SPARK_COUNT = 16;

const MAX_PLAYER_HEALTH = DEFAULT_TANK.turretHealth + DEFAULT_TANK.ballHealth;
const TARGET_STARTING_HEALTH = 100;

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
scene.background = new THREE.Color(0x101722);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(
  65, innerWidth / innerHeight, 0.05, 1500
);

// 2. Load HDRI Environment Map using modern imports
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

new RGBELoader().load(DEFAULT_LEVEL.hdriMap, texture => {
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

let ballMesh = null;
let bodyGroup = null;
let gunGroup = null;
let muzzleMarker = null;
let tankModelTemplate = null;
const remoteTanks = new Map();
const playerHealthBars = new Map();
let multiplayerPeer = null;
let multiplayerSessionId = null;
let multiplayerHost = false;
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
let ballRadius = 1;

let forwardSpeed = 0;
let strafeSpeed = 0;

let aimPitch = 0;
let flightAimTargetPitch = 0;
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
let weaponCooldown = 0;
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

const cannonAudio = new Audio(CANNON_AUDIO_URL);
cannonAudio.preload = 'auto';
cannonAudio.volume = 0.8;
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

const materialDefaults = new Map();
const cameraFadeMaterials = new Map();
const fadedMaterials = new Set();
const collisionSparks = [];
let lastCollisionTime = -Infinity;
let engineAudioUnlocked = false;

const el = id => document.getElementById(id);
el('weapon').textContent = `${WEAPONS[DEFAULT_TANK.primaryWeapon].name} [1]`;

// ============================================================
// ASSET LOADING
// ============================================================

function installLocalizedCameraFade(material) {
  // The fade is evaluated per-fragment in world space. The material can stay
  // one mesh/material; only pixels near the camera's obstruction point fade.
  const state = {
    center: new THREE.Vector3(),
    radius: CAMERA_FADE_RADIUS,
    strength: 0,
    uniforms: null
  };

  cameraFadeMaterials.set(material, state);

  const previousCompile = material.onBeforeCompile;
  const previousCacheKey = material.customProgramCacheKey
    ? material.customProgramCacheKey.bind(material)
    : () => '';

  material.onBeforeCompile = shader => {
    if (previousCompile) previousCompile.call(material, shader);

    shader.uniforms.uCameraFadeCenter = { value: state.center };
    shader.uniforms.uCameraFadeRadius = { value: state.radius };
    shader.uniforms.uCameraFadeStrength = { value: state.strength };
    state.uniforms = shader.uniforms;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vCameraFadeWorldPosition;'
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvec4 cameraFadeWorldPosition = modelMatrix * vec4(transformed, 1.0);\nvCameraFadeWorldPosition = cameraFadeWorldPosition.xyz;'
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vCameraFadeWorldPosition;\nuniform vec3 uCameraFadeCenter;\nuniform float uCameraFadeRadius;\nuniform float uCameraFadeStrength;'
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\nfloat cameraFadeDistance = distance(vCameraFadeWorldPosition, uCameraFadeCenter);\nfloat cameraFadeMask = 1.0 - smoothstep(uCameraFadeRadius * 0.45, uCameraFadeRadius, cameraFadeDistance);\ndiffuseColor.a *= 1.0 - cameraFadeMask * uCameraFadeStrength;'
    );
  };

  material.customProgramCacheKey = () =>
    previousCacheKey() + '|localized-camera-fade-v1';
}

function setCameraFade(material, center, strength) {
  const state = cameraFadeMaterials.get(material);
  if (!state) return;

  state.center.copy(center);
  state.strength = strength;
  state.radius = CAMERA_FADE_RADIUS;

  if (state.uniforms) {
    state.uniforms.uCameraFadeCenter.value = state.center;
    state.uniforms.uCameraFadeRadius.value = state.radius;
    state.uniforms.uCameraFadeStrength.value = state.strength;
  }
}

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

      if (!materialDefaults.has(mat)) {
        materialDefaults.set(mat, {
          opacity: mat.opacity,
          transparent: mat.transparent,
          depthWrite: mat.depthWrite
        });
        installLocalizedCameraFade(mat);
      }
    });

    meshes.push(obj);
  });

  return meshes;
}

function registerTargets(root) {
  targets.length = 0;

  root.traverse(obj => {
    if (!obj.name || !obj.name.toLowerCase().startsWith('target')) return;

    const meshes = [];
    obj.traverse(child => {
      if (child.isMesh) meshes.push(child);
    });
    if (!meshes.length) return;

    const record = {
      name: obj.name,
      root: obj,
      meshes,
      health: TARGET_STARTING_HEALTH,
      maxHealth: TARGET_STARTING_HEALTH,
      destroyed: false
    };

    meshes.forEach(mesh => {
      mesh.userData.targetRecord = record;
      // Clone materials so damage tinting never changes unrelated level pieces.
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map(mat => mat ? mat.clone() : mat);
        mesh.material.forEach(mat => {
          if (!mat) return;
          materialDefaults.set(mat, {
            opacity: mat.opacity,
            transparent: mat.transparent,
            depthWrite: mat.depthWrite
          });
          installLocalizedCameraFade(mat);
        });
      } else if (mesh.material) {
        mesh.material = mesh.material.clone();
        materialDefaults.set(mesh.material, {
          opacity: mesh.material.opacity,
          transparent: mesh.material.transparent,
          depthWrite: mesh.material.depthWrite
        });
        installLocalizedCameraFade(mesh.material);
      }
    });

    targets.push(record);
  });

  updateTargetHud();
  console.info(`Registered ${targets.length} target(s). Name level objects with target prefix.`);
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
      mesh.visible = false;
      const index = levelMeshes.indexOf(mesh);
      if (index >= 0) levelMeshes.splice(index, 1);
    });
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
  if (mode) setNetworkStatus(mode === 'freeplay' ? 'Free play' : mode === 'host' ? 'Starting host…' : 'Joining match…');
  showMessage('Click to capture mouse');
}

function openGameMenu() {
  if (!gameStarted || pauseMenuOpen) return;
  pauseMenuOpen = true;
  gamePaused = startupMode === 'freeplay';
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
  scene.updateMatrixWorld(true);

  // Compile the visible scene and the first-use thruster-light variant while
  // the loading overlay is still up, avoiding a hitch when thrust begins.
  const previousThrusterVisibility = thrusterMesh?.visible;
  if (thrusterMesh) thrusterMesh.visible = true;
  try {
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
    renderer.render(scene, camera);
  } catch (error) {
    console.warn('Graphics warm-up did not complete:', error);
  } finally {
    if (thrusterMesh) thrusterMesh.visible = previousThrusterVisibility ?? false;
  }

  startGame(startupMode);
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
  configureImportedLights(gltf.scene);
  levelMeshes = collectMeshes(gltf.scene);
  levelSpawnMarkers = [];
  gltf.scene.traverse(object => {
    if (object.name && object.name.toLowerCase().startsWith('start')) {
      levelSpawnMarkers.push(object);
    }
  });
  console.info(`Found ${levelSpawnMarkers.length} start marker(s).`);
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
  levelMeshes = [cube];
  levelSpawnMarkers = [];
  registerTargets(cube);
  levelReady = true;
  updateLoadingStatus();
  maybeFinishGameStartup();
});

loader.load(TANK_URL, gltf => {

  const model = gltf.scene;
  tankModelTemplate = model;
  model.scale.setScalar(MODEL_SCALE);
  tankRoot.add(model);
  tankRoot.visible = !firstPerson;
  configureImportedLights(model);

  model.traverse(obj => {
    if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
    }
    if (obj.name === 'Ball') ballMesh = obj;
    if (obj.name === 'Body') bodyGroup = obj;
    if (obj.name === 'Gun') gunGroup = obj;
    if (obj.name === 'Muzzle') muzzleMarker = obj;
    if (obj.name && obj.name.toLowerCase() === 'magnets') {
      magnetsElement = obj;
      magnetsElement.visible = magnetsActive;
    }

    if (obj.name && obj.name.toLowerCase() === 'thruster') {
      thrusterMesh = obj;
      thrusterBaseQuaternion = obj.quaternion.clone();
      thrusterBasePosition = obj.position.clone();
      thrusterBaseScale = obj.scale.clone();
      obj.visible = false;
      console.log('Thruster found:', obj.name);
    }
    
  });
  if (!ballMesh) console.warn('Missing Ball mesh');
  if (!bodyGroup) console.warn('Missing Body group');
  if (!gunGroup) console.warn('Missing Gun group');
  if (!magnetsElement) console.warn('Missing magnets element');

  if (ballMesh) {
    const bounds = new THREE.Box3().setFromObject(ballMesh);
    const size = bounds.getSize(V());
    ballRadius = Math.max(size.x, size.y, size.z) / 2;
  }

  for (const [sessionId, remote] of remoteTanks) {
    if (!remote.root.children.length) attachRemoteModel(remote);
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

function getFlightUp() {
  return flightAimUp.clone().applyAxisAngle(flightAimDirection, flightRoll).normalize();
}

function wrapAngleNear(angle, reference) {
  while (angle - reference > Math.PI) angle -= Math.PI * 2;
  while (angle - reference < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function setFlightAimTargetFromDirection(direction) {
  const vertical = THREE.MathUtils.clamp(direction.dot(normal), -1, 1);
  const tangent = direction.clone().projectOnPlane(normal);
  const tangentLength = tangent.length();

  if (tangentLength < 0.0001) {
    const polePitch = vertical >= 0 ? Math.PI / 2 : -Math.PI / 2;
    flightAimTargetPitch = wrapAngleNear(polePitch, flightAimTargetPitch);
    return;
  }

  tangent.divideScalar(tangentLength);
  const principalPitch = Math.atan2(vertical, tangentLength);
  const alternatePitch = principalPitch >= 0
    ? Math.PI - principalPitch
    : -Math.PI - principalPitch;
  const principalNear = wrapAngleNear(principalPitch, flightAimTargetPitch);
  const alternateNear = wrapAngleNear(alternatePitch, flightAimTargetPitch);

  if (Math.abs(principalNear - flightAimTargetPitch) <= Math.abs(alternateNear - flightAimTargetPitch)) {
    flightAimTargetDirection.copy(tangent);
    flightAimTargetPitch = principalNear;
  } else {
    flightAimTargetDirection.copy(tangent).negate();
    flightAimTargetPitch = alternateNear;
  }
}

function updateFlightAim(dt) {
  const rollInput = (keys.KeyE ? 1 : 0) - (keys.KeyQ ? 1 : 0);
  flightRoll += rollInput * FLIGHT_ROLL_RATE * dt;
  while (flightRoll > Math.PI) flightRoll -= Math.PI * 2;
  while (flightRoll < -Math.PI) flightRoll += Math.PI * 2;

  const response = 1 - Math.exp(-FLIGHT_AIM_RESPONSE * dt);
  const yawDifference = Math.atan2(
    normal.dot(new THREE.Vector3().crossVectors(aimDirection, flightAimTargetDirection)),
    THREE.MathUtils.clamp(aimDirection.dot(flightAimTargetDirection), -1, 1)
  );
  aimDirection.applyAxisAngle(normal, yawDifference * response)
    .projectOnPlane(normal).normalize();

  const pitchDifference = Math.atan2(
    Math.sin(flightAimTargetPitch - aimPitch),
    Math.cos(flightAimTargetPitch - aimPitch)
  );
  aimPitch += pitchDifference * response;
  updateFlightAimFromSurfaceAngles();
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
    bodyGroup.rotation.order = 'YXZ';
    const visualAim = getAimDirection();
    const airborneAim = flightState === 'flying' || flightState === 'drifting';
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

    const pitch = airborneAim
      ? aimPitch
      : Math.asin(THREE.MathUtils.clamp(visualAim.dot(normal), -1, 1));

    bodyGroup.rotation.y =
      MODEL_FORWARD_NEGATIVE_Z ? yaw : -yaw;

    bodyGroup.rotation.x =
      (MODEL_FORWARD_NEGATIVE_Z ? pitch : -pitch) + (airborneAim ? 0 : bodyPitchLean);

    bodyGroup.rotation.z = airborneAim ? 0 : bodySideLean;
  }
}

// Remote tanks are visual replicas. Each player still simulates movement locally;
// the room host relays poses between peers over WebRTC.
function attachRemoteModel(remote) {
  if (!tankModelTemplate || remote.root.children.length) return;
  const model = tankModelTemplate.clone(true);
  remote.body = null;
  model.traverse(object => {
    if (object.name === 'Body') remote.body = object;
    if (object.name && object.name.toLowerCase() === 'magnets') {
      remote.magnets = object;
      object.visible = remote.magnetsActive;
    }
  });
  remote.root.add(model);
}

function ensureRemoteTank(sessionId) {
  if (sessionId === multiplayerSessionId) return null;
  let remote = remoteTanks.get(sessionId);
  if (!remote) {
    const root = new THREE.Group();
    scene.add(root);
    remote = {
      root,
      body: null,
      magnets: null,
      magnetsActive: true,
      targetPosition: new THREE.Vector3(),
      targetRotation: new THREE.Quaternion(),
      targetBodyRotation: null,
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
    remote.hasPose = true;
  }
  remote.health = 0;
  playerHealth.set(message.sessionId, 0);
  if (remote.hasPose) createTankDestruction(message.sessionId, remote.root);
}

function updateRemoteTanks(dt) {
  for (const remote of remoteTanks.values()) {
    if (!remote.hasPose || remote.health <= 0) continue;
    const blend = 1 - Math.exp(-14 * dt);
    remote.root.position.lerp(remote.targetPosition, blend);
    remote.root.quaternion.slerp(remote.targetRotation, blend);
    if (remote.body && remote.targetBodyRotation) {
      remote.body.rotation.order = 'YXZ';
      remote.body.rotation.x += (remote.targetBodyRotation[0] - remote.body.rotation.x) * blend;
      remote.body.rotation.y += (remote.targetBodyRotation[1] - remote.body.rotation.y) * blend;
      remote.body.rotation.z += (remote.targetBodyRotation[2] - remote.body.rotation.z) * blend;
    }
  }
}

function getPlayerHealthBar(sessionId) {
  let bar = playerHealthBars.get(sessionId);
  if (bar) return bar;

  const element = document.createElement('div');
  element.className = 'player-health-bar';
  const label = document.createElement('span');
  label.className = 'player-health-label';
  label.textContent = sessionId === '__local__' ? 'YOU' : sessionId.slice(-5).toUpperCase();
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

function updatePeerCount() {
  const count = multiplayerHost ? peerConnections.size + 1 : null;
  if (count !== null) {
    setNetworkStatus(`Hosting · ${count}/4 players · code ${multiplayerSessionId}`);
    for (const connection of peerConnections.values()) {
      if (connection.open) connection.send({ type: 'room-count', count });
    }
  }
}

function removeRemoteTank(sessionId) {
  clearTankDestruction(sessionId);
  const remote = remoteTanks.get(sessionId);
  if (remote) scene.remove(remote.root);
  remoteTanks.delete(sessionId);
  multiplayerPoses.delete(sessionId);
  playerHealth.delete(sessionId);
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

function createTankDestruction(sessionId, root) {
  if (tankDestructions.has(sessionId)) return;
  root.updateWorldMatrix(true, true);
  const fragments = [];
  root.traverse(object => {
    if (!object.isMesh || !object.visible) return;
    const worldPosition = new THREE.Vector3();
    const worldRotation = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    object.matrixWorld.decompose(worldPosition, worldRotation, worldScale);
    const materials = (Array.isArray(object.material) ? object.material : [object.material]).map(material => {
      const fragmentMaterial = material.clone();
      fragmentMaterial.transparent = true;
      fragmentMaterial.depthWrite = false;
      return { material: fragmentMaterial, opacity: material.opacity };
    });
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
  if (!fragments.length) return;
  root.visible = false;
  tankDestructions.set(sessionId, { root, fragments });
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
  destruction.root.visible = true;
  tankDestructions.delete(sessionId);
}

function updateDestructionEffects(dt) {
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
  showMessage('TANK DESTROYED');
  if (localRespawnTimeout !== null) clearTimeout(localRespawnTimeout);
  localRespawnTimeout = setTimeout(() => {
    localRespawnTimeout = null;
    respawnLocalPlayer();
  }, 5000);
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

  if (message.type === 'weapon-shot') {
    if (message.sessionId !== multiplayerSessionId && message.weapon === 'cannon') playOneShot(cannonAudio);
    return;
  }

  if (message.type === 'tank-destroyed') {
    showRemoteTankDestruction(message);
    return;
  }

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
    setNetworkStatus(`Connected · ${message.count}/4 players`);
  } else if (message.type === 'player-left' && typeof message.sessionId === 'string') {
    removeRemoteTank(message.sessionId);
  } else if (message.type === 'room-full') {
    setNetworkStatus('That host is full (4/4 players)');
    connection.close();
    multiplayerPeer?.destroy();
    multiplayerPeer = null;
    multiplayerSessionId = null;
    el('join-game').disabled = false;
  } else if (message.type === 'respawn' && multiplayerHost) {
    updateTankHealth(connection.peer, MAX_PLAYER_HEALTH);
    broadcastToPeers({ type: 'tank-health', sessionId: connection.peer, health: MAX_PLAYER_HEALTH });
  } else if (message.type === 'hello' && multiplayerHost) {
    for (const [sessionId, health] of playerHealth) {
      connection.send({ type: 'tank-health', sessionId, health });
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
  if (incoming && peerConnections.size >= 3) {
    connection.on('open', () => {
      connection.send({ type: 'room-full' });
      connection.close();
    });
    return;
  }

  if (incoming) peerConnections.set(connection.peer, connection);
  connection.on('data', message => handlePeerMessage(connection, message));
  connection.on('open', () => {
    peerConnections.set(connection.peer, connection);
    if (multiplayerHost) {
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
      updatePeerCount();
    } else {
      hostConnection = connection;
      connection.send({ type: 'hello' });
      setNetworkStatus('Connected to host · syncing tanks…');
    }
  });
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
      setNetworkStatus('Host disconnected');
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
      playerHealth.set(id, localTankHealth);
      el('host-room-code').textContent = id;
      el('multiplayer-panel').hidden = false;
      multiplayerPoses.set(id, { pose: localTankPose(), sequence: 0 });
      setNetworkStatus(`Hosting · 1/4 players · code ${id}`);
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
  el('join-game').disabled = true;
  setNetworkStatus('Connecting to host…');
  try {
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
      el('join-game').disabled = false;
    });
  } catch (error) {
    console.error('Could not join PeerJS room:', error);
    setNetworkStatus('Could not load the free WebRTC connection service');
    el('join-game').disabled = false;
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

function clearCameraOcclusion() {
  for (const mat of fadedMaterials) {
    const original = materialDefaults.get(mat);
    if (original) {
      mat.transparent = original.transparent;
      mat.depthWrite = original.depthWrite;
      mat.needsUpdate = true;
    }
    setCameraFade(mat, new THREE.Vector3(), 0);
    fadedMaterials.delete(mat);
  }
}

function updateCameraOcclusion() {
  if (!levelMeshes.length) return;

  const target = position.clone().addScaledVector(normal, 0.7);
  const direction = camera.position.clone().sub(target);
  const distance = direction.length();
  if (distance < 0.001) return;

  raycaster.set(target, direction.normalize());
  raycaster.far = distance - 0.35;

  const hits = raycaster.intersectObjects(levelMeshes, true);
  const obstructionPoint = hits.length ? hits[0].point : null;

  // Restore materials that are no longer between the tank and camera.
  for (const mat of fadedMaterials) {
    if (hits.length) {
      const hitMats = Array.isArray(hits[0].object.material)
        ? hits[0].object.material : [hits[0].object.material];
      if (hitMats.includes(mat)) continue;
    }

    const original = materialDefaults.get(mat);
    if (original) {
      mat.transparent = original.transparent;
      mat.depthWrite = original.depthWrite;
      mat.needsUpdate = true;
    }
    setCameraFade(mat, new THREE.Vector3(), 0);
    fadedMaterials.delete(mat);
  }

  if (!hits.length || !obstructionPoint) return;

  const hitMaterials = Array.isArray(hits[0].object.material)
    ? hits[0].object.material : [hits[0].object.material];

  for (const mat of hitMaterials) {
    if (!mat || !cameraFadeMaterials.has(mat)) continue;

    setCameraFade(mat, obstructionPoint, CAMERA_FADE_STRENGTH);

    if (!mat.transparent || mat.depthWrite) {
      mat.transparent = true;
      mat.depthWrite = false;
      mat.needsUpdate = true;
    }
    fadedMaterials.add(mat);
  }
}

// ============================================================
// WEAPONS / PROJECTILES / TARGET DAMAGE
// ============================================================

function setWeapon(weapon) {
  const definition = WEAPONS[weapon];
  if (!definition) return;
  selectedWeapon = weapon;
  const slot = weapon === DEFAULT_TANK.primaryWeapon ? 1 : 2;
  el('weapon').textContent = `${definition.name} [${slot}]`;
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

  const source = muzzleMarker || gunGroup;
  if (!source) {
    return position.clone()
      .addScaledVector(normal, ballRadius * 1.8)
      .addScaledVector(heading, ballRadius * 0.8);
  }

  source.updateWorldMatrix(true, true);

  const origin = new THREE.Vector3();
  source.getWorldPosition(origin);

  const forward = new THREE.Vector3(0, 0, MODEL_FORWARD_NEGATIVE_Z ? -1 : 1)
    .transformDirection(source.matrixWorld)
    .normalize();

  if (muzzleMarker) {
    return origin.addScaledVector(forward, 0.08);
  }

  const box = new THREE.Box3().setFromObject(gunGroup);
  if (box.isEmpty()) {
    return origin.addScaledVector(forward, 0.12);
  }

  const { min, max } = box;
  let muzzlePoint = origin.clone();
  let alongBarrel = -Infinity;

  for (const x of [min.x, max.x]) {
    for (const y of [min.y, max.y]) {
      for (const z of [min.z, max.z]) {
        const corner = new THREE.Vector3(x, y, z);
        const dist = corner.clone().sub(origin).dot(forward);
        if (dist > alongBarrel) {
          alongBarrel = dist;
          muzzlePoint.copy(corner);
        }
      }
    }
  }

  return muzzlePoint.addScaledVector(forward, 0.12);
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
  if (!levelMeshes.length || flightState === 'reattaching' || localTankHealth <= 0) return;
  const weaponDefinition = WEAPONS[selectedWeapon];
  if (weaponDefinition.triggerMode === 'single' && weaponCooldown > 0) return;

  const { muzzle, direction } = getShotMuzzleAndDirection();
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
    weaponCooldown = 1 / weaponDefinition.shotsPerSecond;
    playOneShot(cannonAudio);
  }
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
  const radius = isCannon ? 0.22 : 0.075;
  const color = isCannon ? 0xffa33a : 0xffe7a0;
  const projectileMesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, isCannon ? 12 : 7, isCannon ? 8 : 5),
    new THREE.MeshBasicMaterial({ color, toneMapped: false })
  );
  projectileMesh.position.copy(muzzle);
  scene.add(projectileMesh);

  const trailMaterial = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: isCannon ? 0.85 : 0.75,
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

function acceptRemoteShot(sessionId, message) {
  const shot = message.shot;
  if (!shot || typeof shot.shotId !== 'string' || !shot.shotId.startsWith(`${sessionId}:`)) return;
  if (projectiles.some(projectile => projectile.shotId === shot.shotId)) return;
  shot.ownerId = sessionId;
  const projectile = createProjectile(shot, true);
  if (!projectile) return;
  broadcastToPeers({ type: 'projectile-start', shot }, sessionId);
}

function finishRemoteProjectile(message) {
  const shotIndex = projectiles.findIndex(projectile => projectile.kind === 'projectile' && projectile.shotId === message.shotId);
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
  if (Array.isArray(message.point) && message.point.every(Number.isFinite)) {
    const isCannon = message.weapon === 'cannon';
    spawnImpact(new THREE.Vector3().fromArray(message.point), isCannon ? 0xff7628 : 0xffd27a, isCannon ? 0.55 : 0.2);
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

function spawnImpact(point, color = 0xff8b35, size = 0.32) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(size, 10, 7),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
  );
  mesh.position.copy(point);
  scene.add(mesh);
  projectiles.push({ kind: 'effect', mesh, life: 0.28, maxLife: 0.28 });
}

function removeProjectile(projectile) {
  scene.remove(projectile.mesh);
  projectile.mesh.geometry.dispose();
  projectile.mesh.material.dispose();
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
      shot.mesh.material.opacity = Math.max(0, shot.life / shot.maxLife);
      shot.mesh.scale.multiplyScalar(1 + dt * 1.8);
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
        const worldHit = hits.length ? hits[0] : null;

        if (tankHit && (!worldHit || tankHit.distance < worldHit.distance)) {
          const health = Math.max(0, (playerHealth.get(tankHit.targetId) ?? MAX_PLAYER_HEALTH) - shot.damage);
          updateTankHealth(tankHit.targetId, health);
          if (multiplayerHost) broadcastToPeers({ type: 'tank-health', sessionId: tankHit.targetId, health });
          if (health <= 0) broadcastTankDestroyed(tankHit.targetId);
          spawnImpact(tankHit.point, 0xff4a35, shot.weapon === 'cannon' ? 0.65 : 0.24);
          if (shot.networked && multiplayerHost) {
            const targetPose = tankHit.targetId === multiplayerSessionId
              ? localTankPose()
              : multiplayerPoses.get(tankHit.targetId)?.pose || null;
            broadcastToPeers({
              type: 'projectile-end', shotId: shot.shotId, weapon: shot.weapon,
              targetId: tankHit.targetId, health, targetPose, point: tankHit.point.toArray()
            });
          }
          removeProjectile(shot);
          projectiles.splice(i, 1);
          continue;
        }

        if (worldHit) {
          const hit = worldHit;
          const isCannon = shot.weapon === 'cannon';
          if (shot.ownerId === multiplayerSessionId || !multiplayerHost) damageTarget(hit.object, shot.damage);
          spawnImpact(
            hit.point,
            isCannon ? 0xff7628 : 0xffd27a,
            isCannon ? 0.55 : 0.2
          );

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

          if (shot.networked && multiplayerHost) broadcastToPeers({ type: 'projectile-end', shotId: shot.shotId, weapon: shot.weapon, point: hit.point.toArray() });

          removeProjectile(shot);
          projectiles.splice(i, 1);
          continue;
        }
      }

      shot.mesh.position.copy(shot.position);
      shot.trail.geometry.setFromPoints([shot.start, shot.position]);
      shot.trail.material.opacity = shot.weapon === 'cannon' ? 0.65 : 0.42;
    }

    if (shot.life <= 0) {
      if (shot.kind === 'projectile' && shot.networked && shot.authoritative && multiplayerHost) {
        broadcastToPeers({ type: 'projectile-end', shotId: shot.shotId, weapon: shot.weapon });
      }
      removeProjectile(shot);
      projectiles.splice(i, 1);
    }
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
  if (!levelMeshes.length) return false;

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
    flightAimTargetDirection.copy(aimDirection);
    flightAimTargetPitch = aimPitch;
    updateFlightAimFromSurfaceAngles();

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
  if (!levelMeshes.length || !ballMesh) return;

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
  weaponCooldown = Math.max(0, weaponCooldown - dt);

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

    const drive = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);

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
      } else if (!collided) {
        // Allow a brief support gap over seams, but fall once the tank has
        // clearly left the platform. Keep the ground movement basis stable
        // during this grace interval.
        unsupportedSurfaceTime += dt;
        if (unsupportedSurfaceTime >= 0.12) {
          flightVelocity.copy(movement);
          aimDirection.copy(movement).projectOnPlane(normal).normalize();
          if (aimDirection.lengthSq() < 0.001) aimDirection.copy(heading);
          aimPitch = 0;
          flightAimTargetDirection.copy(aimDirection);
          flightAimTargetPitch = 0;
          updateFlightAimFromSurfaceAngles();
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
  resolveTankContacts();

  // CAMERA: the camera tracks the current aiming vector in every movement mode.
  const viewDirection = getAimDirection();
  const airborneLook = flightState === 'flying' || flightState === 'drifting';
  if (airborneLook) camera.up.copy(getFlightUp());
  else if (flightState === 'reattaching') camera.up.lerp(normal, 1 - Math.exp(-18 * dt));

  if (firstPerson) {
    if (!airborneLook) camera.up.lerp(normal, 1 - Math.exp(-16 * dt));
    clearCameraOcclusion();
    const fpPosition = position.clone().addScaledVector(normal, ballRadius * 1.65);
    camera.position.lerp(fpPosition, 1 - Math.exp(-16 * dt));
    const fpLookTarget = camera.position.clone().addScaledVector(viewDirection, 20);
    cameraLookTarget.lerp(fpLookTarget, 1 - Math.exp(-16 * dt));
    camera.lookAt(cameraLookTarget);
  } else if (airborneLook) {
    // Lock the third-person camera to the turret's aim frame. Position and
    // viewing direction rotate together, with a little follow-through.
    const desiredCamera = position.clone()
      .addScaledVector(viewDirection, -thirdPersonDistance)
      .addScaledVector(getFlightUp(), CAMERA_HEIGHT * thirdPersonDistance / CAMERA_DISTANCE);
    const desiredLookTarget = position.clone().addScaledVector(viewDirection, 20);
    const cameraFollow = 1 - Math.exp(-FLIGHT_CAMERA_RESPONSE * dt);
    camera.position.lerp(desiredCamera, cameraFollow);
    cameraLookTarget.lerp(desiredLookTarget, cameraFollow);
    updateCameraOcclusion();
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
    const desiredCamera = position.clone()
      .addScaledVector(viewDirection, -thirdPersonDistance)
      .addScaledVector(driveCameraUp, CAMERA_HEIGHT * thirdPersonDistance / CAMERA_DISTANCE);
    const desiredLookTarget = position.clone().addScaledVector(viewDirection, 20);
    camera.position.lerp(desiredCamera, cameraFollow);
    cameraLookTarget.lerp(desiredLookTarget, cameraFollow);
    updateCameraOcclusion();
    camera.lookAt(cameraLookTarget);
  }

  if (thrusterMesh) {
    // Only show the GLB thruster while Space is actively applying thrust.
    thrusterMesh.visible = flightState === 'flying' && flightSpaceHeld;

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

  el('speed').textContent = flightState === 'attached'
    ? Math.hypot(forwardSpeed, strafeSpeed).toFixed(1)
    : ((flightState === 'flying' || flightState === 'drifting') ? flightVelocity.length() : reattachVelocity.length()).toFixed(1);
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

function showMessage(_text) {
  // Toast messages are temporarily disabled; persistent HUD hints remain.
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
    // Aim in the currently rolled camera frame, so Q/E roll also rotates the
    // mouse's yaw and pitch axes around the tank's ball.
    const rolledUp = getFlightUp();
    const pitchRight = new THREE.Vector3()
      .crossVectors(flightAimDirection, rolledUp)
      .normalize()
      .applyAxisAngle(rolledUp, yaw);
    const targetDirection = flightAimTargetDirection.clone()
      .multiplyScalar(Math.cos(flightAimTargetPitch))
      .addScaledVector(normal, Math.sin(flightAimTargetPitch))
      .normalize();
    targetDirection.applyAxisAngle(rolledUp, yaw)
      .applyAxisAngle(pitchRight, pitch)
      .normalize();
    setFlightAimTargetFromDirection(targetDirection);
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

  if (event.code === 'Digit1' && !event.repeat) setWeapon(DEFAULT_TANK.primaryWeapon);
  if (event.code === 'Digit2' && !event.repeat) setWeapon(DEFAULT_TANK.secondaryWeapon);

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

  updateRemoteTanks(dt);
  updatePlayerHealthBars();
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

