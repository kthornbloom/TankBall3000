import { LEVELS, DEFAULT_LEVEL_ID } from './data/levels.js';
import { TANKS, DEFAULT_TANK_ID } from './data/tanks.js';
import { WEAPONS } from './data/weapons.js';

const byId = id => document.getElementById(id);
const landingImages = [...document.querySelectorAll('.landing-image')];
const landingGlitch = document.querySelector('.landing-glitch');
if (landingImages.length > 1 && landingGlitch) {
  let landingImageIndex = 0;
  window.setInterval(() => {
    landingImages[landingImageIndex].classList.remove('is-active');
    landingImageIndex = (landingImageIndex + 1) % landingImages.length;
    landingImages[landingImageIndex].classList.add('is-active');
    landingGlitch.src = landingImages[landingImageIndex].src;
    landingGlitch.classList.remove('glitching');
    void landingGlitch.offsetWidth;
    landingGlitch.classList.add('glitching');
    window.setTimeout(() => landingGlitch.classList.remove('glitching'), 520);
  }, 5200);
}
let mode = null;
let selectedLevelId = null;
const levelIds = Object.keys(LEVELS);
let levelIndex = Math.max(0, levelIds.indexOf('cube'));
let tankIds = Object.entries(TANKS)
  .sort(([, a], [, b]) => String(a.id).localeCompare(String(b.id), undefined, {
    numeric: true,
    sensitivity: 'base'
  }))
  .map(([key]) => key);
let tankIndex = Math.max(0, tankIds.indexOf(DEFAULT_TANK_ID));
let tankPreview = null;

function showScreen(screenId, animate = true) {
  const next = byId(screenId);
  const current = [byId('start-screen'), byId('level-screen'), byId('tank-screen')].find(screen => !screen.hidden);
  if (!next || current === next) return Promise.resolve();
  if (!animate || !current) {
  byId('start-screen').hidden = screenId !== 'start-screen';
  byId('level-screen').hidden = screenId !== 'level-screen';
  byId('tank-screen').hidden = screenId !== 'tank-screen';
    return Promise.resolve();
  }
  const wipe = byId('screen-wipe');
  wipe.className = 'wipe-in';
  window.setTimeout(() => {
    byId('start-screen').hidden = screenId !== 'start-screen';
    byId('level-screen').hidden = screenId !== 'level-screen';
    byId('tank-screen').hidden = screenId !== 'tank-screen';
    wipe.className = 'wipe-out';
    window.setTimeout(() => { wipe.className = ''; }, 460);
  }, 460);
  return Promise.resolve();
}

function showLevels(nextMode) {
  mode = nextMode;
  renderLevel();
  showScreen('level-screen');
}

function renderLevels() {
  renderLevel();
}

function renderLevel() {
  const level = LEVELS[levelIds[levelIndex]] || LEVELS[DEFAULT_LEVEL_ID];
  if (!level) return;
  byId('level-name').textContent = level.name;
  const isFreeplay = mode === 'freeplay';
  byId('level-mode-type').textContent = isFreeplay ? 'SINGLE PLAYER' : 'MULTIPLAYER';
  byId('level-mode-note').textContent = mode === 'host'
    ? 'You’re Hosting'
    : mode === 'join' ? 'Joining a Match' : 'Free Play';
  const adjectives = byId('level-adjectives');
  adjectives.replaceChildren();
  for (const adjective of (level.adjectives || '').split(',').map(item => item.trim()).filter(Boolean)) {
    const tag = document.createElement('span');
    tag.textContent = adjective.toUpperCase();
    adjectives.append(tag);
  }
  const art = byId('level-art');
  art.onerror = () => {
    art.hidden = true;
    byId('level-screen').classList.remove('has-art');
  };
  if (level.thumbnailImage) {
    art.src = level.thumbnailImage;
    art.hidden = false;
    byId('level-screen').classList.add('has-art');
  } else {
    art.removeAttribute('src');
    art.hidden = true;
    byId('level-screen').classList.remove('has-art');
  }
  byId('level-position').textContent = `${String(levelIndex + 1).padStart(2, '0')} / ${String(levelIds.length).padStart(2, '0')}`;
}

function changeLevel(offset) {
  levelIndex = (levelIndex + offset + levelIds.length) % levelIds.length;
  renderLevel();
}

function selectLevel() {
  selectedLevelId = levelIds[levelIndex] || DEFAULT_LEVEL_ID;
  showTankPicker();
}

function renderTankDetails() {
  const tankKey = tankIds[tankIndex] || DEFAULT_TANK_ID;
  const tank = TANKS[tankKey] || TANKS[DEFAULT_TANK_ID] || Object.values(TANKS)[0];
  if (!tank) return;
  const previous = renderTankDetails.previousTank;
  byId('tank-name').textContent = tank.name;
  byId('tank-description').textContent = tank.description;
  byId('tank-position').textContent = `${tankIndex + 1} / ${tankIds.length}`;
  const stats = [
    ['TURRET HEALTH', tank.turretHealth, 150], ['BALL HEALTH', tank.ballHealth, 150],
    ['BOOST POWER', tank.boostStrength, 14], ['BOOST TIME', tank.boostTime, 2],
    ['THRUST POWER', tank.thrustStrength, 20], ['THRUST TIME', tank.thrustTime, 5]
  ];
  const dl = byId('tank-stats');
  dl.replaceChildren();
  for (const [name, value, max] of stats) {
    const row = document.createElement('div'); row.className = 'vehicle-stat';
    const label = document.createElement('div'); label.className = 'vehicle-stat-label'; label.textContent = name;
    const amount = document.createElement('span'); amount.textContent = `${value}${name.includes('TIME') ? 's' : ''}`; label.append(amount);
    const track = document.createElement('div'); track.className = 'vehicle-stat-track';
    const fill = document.createElement('div'); fill.className = 'vehicle-stat-fill';
    fill.style.setProperty('--stat-fill', `${Math.max(0, Math.min(100, value / max * 100))}%`);
    const previousValue = previous ? previous[({ 'TURRET HEALTH':'turretHealth','BALL HEALTH':'ballHealth','BOOST POWER':'boostStrength','BOOST TIME':'boostTime','THRUST POWER':'thrustStrength','THRUST TIME':'thrustTime' })[name]] : undefined;
    if (Number.isFinite(previousValue) && previousValue !== value) {
      fill.classList.add(value > previousValue ? 'stat-increase' : 'stat-decrease');
      window.setTimeout(() => fill.classList.remove('stat-increase', 'stat-decrease'), 720);
    }
    track.append(fill); row.append(label, track); dl.append(row);
  }
  renderTankDetails.previousTank = tank;
  byId('vehicle-primary').textContent = WEAPONS[tank.primaryWeapon]?.name || tank.primaryWeapon;
  byId('vehicle-secondary').textContent = WEAPONS[tank.secondaryWeapon]?.name || tank.secondaryWeapon;
  byId('vehicle-special').textContent = WEAPONS[tank.tertiaryWeapon]?.name || tank.tertiaryWeapon;
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
  renderTankDetails();
  showScreen('tank-screen');
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
  document.querySelector('.landing-actions').hidden = true;
  byId('join-form').hidden = false;
  byId('room-code').focus();
});
byId('back-to-menu').addEventListener('click', () => {
  byId('join-form').hidden = true;
  document.querySelector('.landing-actions').hidden = false;
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
    document.querySelector('.landing-actions').hidden = true;
  } else showScreen('start-screen');
});
byId('level-previous').addEventListener('click', () => changeLevel(-1));
byId('level-next').addEventListener('click', () => changeLevel(1));
byId('level-select').addEventListener('click', selectLevel);
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !document.fullscreenElement) {
    if (!byId('tank-screen').hidden) { showScreen('level-screen'); event.preventDefault(); return; }
    if (!byId('level-screen').hidden) {
      if (mode === 'join') showScreen('start-screen').then(() => { byId('join-form').hidden = false; document.querySelector('.landing-actions').hidden = true; });
      else showScreen('start-screen');
      event.preventDefault(); return;
    }
    if (!byId('start-screen').hidden && !byId('join-form').hidden) { byId('back-to-menu').click(); event.preventDefault(); return; }
  }
  if (byId('level-screen').hidden) return;
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    changeLevel(-1);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    changeLevel(1);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    selectLevel();
  }
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
  const freeplay = mode === 'freeplay';
  byId('loading-mode-type').textContent = freeplay ? 'SINGLE PLAYER' : 'MULTIPLAYER';
  byId('loading-mode-note').textContent = mode === 'host' ? 'You’re Hosting' : mode === 'join' ? 'Joining a Match' : 'Free Play';
  byId('loading-level-art').src = LEVELS[selectedLevelId || DEFAULT_LEVEL_ID]?.thumbnailImage || '';
  byId('game-loading').style.setProperty('--loading-progress', '8%');
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

window.updateGameLoading = (progress, status) => {
  const amount = Math.max(0, Math.min(100, Number(progress) || 0));
  byId('game-loading').style.setProperty('--loading-progress', `${amount}%`);
  if (status) byId('game-loading-status').textContent = status;
};

renderLevels();
