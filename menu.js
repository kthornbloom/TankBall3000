import { LEVELS, DEFAULT_LEVEL_ID } from './data/levels.js';
import { TANKS, DEFAULT_TANK_ID } from './data/tanks.js';
import { WEAPONS } from './data/weapons.js';

const byId = id => document.getElementById(id);
let mode = null;
let selectedLevelId = null;
let tankIds = Object.entries(TANKS)
  .sort(([, a], [, b]) => String(a.id).localeCompare(String(b.id), undefined, {
    numeric: true,
    sensitivity: 'base'
  }))
  .map(([key]) => key);
let tankIndex = Math.max(0, tankIds.indexOf(DEFAULT_TANK_ID));
let tankPreview = null;

function showScreen(screenId) {
  byId('start-screen').hidden = screenId !== 'start-screen';
  byId('level-screen').hidden = screenId !== 'level-screen';
  byId('tank-screen').hidden = screenId !== 'tank-screen';
}

function showLevels(nextMode) {
  mode = nextMode;
  byId('level-mode-label').textContent = nextMode === 'freeplay'
    ? 'Free play · choose an arena'
    : nextMode === 'host' ? 'Host an online match · choose an arena' : 'Join an online match · choose an arena';
  showScreen('level-screen');
}

function renderLevels() {
  const list = byId('level-options');
  list.replaceChildren();
  for (const level of Object.values(LEVELS)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'level-option';
    button.innerHTML = `<span>${level.name}</span><small>${level.description}</small>`;
    button.addEventListener('click', () => {
      selectedLevelId = level.id;
      showTankPicker();
    });
    list.append(button);
  }
}

function renderTankDetails() {
  const tankKey = tankIds[tankIndex] || DEFAULT_TANK_ID;
  const tank = TANKS[tankKey] || TANKS[DEFAULT_TANK_ID] || Object.values(TANKS)[0];
  if (!tank) return;
  byId('tank-name').textContent = tank.name;
  byId('tank-description').textContent = tank.description;
  byId('tank-position').textContent = `${tankIndex + 1} / ${tankIds.length}`;
  const stats = [
    ['Turret health', tank.turretHealth],
    ['Ball health', tank.ballHealth],
    ['Primary weapon', WEAPONS[tank.primaryWeapon]?.name || tank.primaryWeapon],
    ['Secondary weapon', WEAPONS[tank.secondaryWeapon]?.name || tank.secondaryWeapon],
    ['Boost strength', tank.boostStrength],
    ['Boost time', `${tank.boostTime}s`],
    ['Thrust strength', tank.thrustStrength],
    ['Thrust time', `${tank.thrustTime}s`]
  ];
  const dl = byId('tank-stats');
  dl.replaceChildren();
  for (const [label, value] of stats) {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value;
    dl.append(dt, dd);
  }
  byId('tank-loading-status').textContent = '';
  setPreviewLoader('loading');
  tankPreview?.setTank(tank.model);
}

function setPreviewLoader(state) {
  const overlay = byId('tank-preview-loading');
  overlay.hidden = state === 'ready';
  overlay.classList.toggle('error', state === 'error');
  byId('tank-preview-loading-label').textContent = state === 'error'
    ? 'PREVIEW UNAVAILABLE'
    : 'LOADING TANK';
}

async function showTankPicker() {
  showScreen('tank-screen');
  renderTankDetails();
  try {
    if (!tankPreview) {
      const { createTankPreview } = await import('./tank-preview.js');
      tankPreview = createTankPreview(byId('tank-preview'), setPreviewLoader);
      renderTankDetails();
    }
  } catch (error) {
    console.error('Could not initialize tank preview:', error);
    byId('tank-loading-status').textContent = 'Tank preview could not load. You can still start the game.';
    setPreviewLoader('error');
  }
}

byId('menu-join').addEventListener('click', () => {
  byId('menu-options').hidden = true;
  byId('join-form').hidden = false;
  byId('room-code').focus();
});
byId('back-to-menu').addEventListener('click', () => {
  byId('join-form').hidden = true;
  byId('menu-options').hidden = false;
});
byId('continue-join').addEventListener('click', () => {
  const code = byId('room-code').value.trim().toUpperCase();
  if (!code) { byId('room-code').focus(); return; }
  showLevels('join');
});
byId('room-code').addEventListener('keydown', event => {
  if (event.key === 'Enter') byId('continue-join').click();
});
byId('menu-host').addEventListener('click', () => showLevels('host'));
byId('menu-freeplay').addEventListener('click', () => showLevels('freeplay'));
byId('level-back').addEventListener('click', () => {
  if (mode === 'join') {
    showScreen('start-screen');
    byId('join-form').hidden = false;
    byId('menu-options').hidden = true;
  } else showScreen('start-screen');
});
byId('tank-back').addEventListener('click', () => showScreen('level-screen'));
byId('tank-previous').addEventListener('click', () => {
  tankIndex = (tankIndex - 1 + tankIds.length) % tankIds.length;
  renderTankDetails();
});
byId('tank-next').addEventListener('click', () => {
  tankIndex = (tankIndex + 1) % tankIds.length;
  renderTankDetails();
});
byId('confirm-tank').addEventListener('click', async () => {
  const button = byId('confirm-tank');
  button.disabled = true;
  button.textContent = 'LOADING GAME…';
  byId('game-loading-status').textContent = 'Loading arena, tank, and graphics…';
  byId('game-loading').hidden = false;
  window.tankGameSelection = {
    mode,
    roomCode: byId('room-code').value.trim().toUpperCase(),
    levelId: selectedLevelId || DEFAULT_LEVEL_ID,
    tankId: tankIds[tankIndex]
  };
  try {
    await import('./game.js');
    tankPreview?.dispose();
  } catch (error) {
    console.error('Could not start game:', error);
    byId('game-loading').hidden = true;
    byId('tank-loading-status').textContent = 'The game could not load. Check the console for details.';
    button.disabled = false;
    button.textContent = 'START GAME';
  }
});

renderLevels();
