/**
 * Thornvale Kawaii 2.0
 *
 * A presentation-first cozy village slice with:
 * - a deterministic local chibi avatar and optional Friendsies model
 * - animated procedural town art
 * - cinematic day/night transitions
 * - petals, fireflies, sparkles, bloom, color finishing, and cozy sound
 */

import {
  ACESFilmicToneMapping,
  Clock,
  Color,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PointLight,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { PhysicsWorld } from './core/PhysicsWorld.js';
import { InputManager } from './core/InputManager.js';
import { CharacterMotor } from './physics/CharacterMotor.js';
import { CameraRig } from './controllers/CameraRig.js';
import { PlayerController } from './controllers/PlayerController.js';
import { VisualRig } from './visuals/VisualRig.js';
import { CharacterLoader } from './visuals/CharacterLoader.js';
import { createKawaiiAvatar } from './visuals/KawaiiAvatar.js';
import { KawaiiSky } from './visuals/KawaiiSky.js';
import { PostProcessing } from './visuals/PostProcessing.js';
import { KawaiiVFX } from './visuals/KawaiiVFX.js';
import { PlayerAnimator } from './visuals/PlayerAnimator.js';
import { CozySoundscape } from './audio/CozySoundscape.js';
import { HUD } from './ui/HUD.js';
import { DayNightSystem } from './game/DayNightSystem.js';
import { InteractableSystem } from './game/InteractableSystem.js';
import { buildTown } from './game/TownBuilder.js';

let scene;
let camera;
let renderer;
let clock;
let physicsWorld;
let inputManager;
let characterMotor;
let cameraRig;
let visualRig;
let playerController;
let playerAnimator;
let hud;
let dayNightSystem;
let interactableSystem;
let characterLoader;
let worldAnimator;
let sky;
let postProcessing;
let vfx;
let soundscape;
let animationStarted = false;
let appReady = false;
let debugEnabled = false;
let footstepTimer = 0;
let playerGlow;

const playerGlowDay = new Color(0xffc9dc);
const playerGlowNight = new Color(0xa9c4ff);

const VISUAL_OFFSET_STORAGE_KEY = 'thornvale2.visualOffsetY';
const VISUAL_OFFSET_STEP = 0.002;
const params = new URLSearchParams(window.location.search);
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
const visualQuality = params.get('quality') || (reducedMotion ? 'medium' : 'high');

const gameState = {
  kindnessCount: 0,
  weather: reducedMotion ? 'clear' : 'mixed',
};

let frameCount = 0;
let lastFpsUpdate = 0;
let currentFps = 0;

function setLoading(progress, message) {
  hud?.setStatus?.(message);
  hud?.setLoadingProgress?.(progress, message);
}

async function init() {
  hud = new HUD().init();
  setLoading(0.06, 'Waking the valley…');

  scene = new Scene();
  camera = new PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.08, 180);
  camera.position.set(0, 4.8, 9);

  renderer = new WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, reducedMotion ? 1.25 : 1.8));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;

  document.getElementById('app')?.appendChild(renderer.domElement);
  clock = new Clock();

  dayNightSystem = new DayNightSystem(scene).init();
  sky = new KawaiiSky(scene).init();
  hud.setDayNight('DAY');

  postProcessing = new PostProcessing(renderer, scene, camera, {
    quality: ['low', 'medium', 'high'].includes(visualQuality) ? visualQuality : 'high',
    enabled: params.get('post') !== 'off',
    bloomStrength: reducedMotion ? 0.22 : 0.34,
    bloomRadius: 0.48,
    bloomThreshold: 0.82,
    saturation: 1.15,
    contrast: 1.08,
    brightness: -0.01,
    warmth: 0.045,
    vignette: 0.18,
  }).init();

  vfx = new KawaiiVFX(scene, {
    weather: gameState.weather,
    fireflyCount: reducedMotion ? 14 : 44,
    petalCount: reducedMotion ? 20 : 72,
    sparkleCount: reducedMotion ? 10 : 32,
    pixelRatio: renderer.getPixelRatio(),
  }).init();
  soundscape = new CozySoundscape({ volume: 0.3, ambienceVolume: 0.2 });
  soundscape.attachUnlock(document);

  startAnimationLoop();
  setLoading(0.18, 'Gathering stardust…');

  physicsWorld = new PhysicsWorld();
  await physicsWorld.init();
  setLoading(0.35, 'Growing clover paths…');

  // Collision-only ground. TownBuilder supplies the authored visual terrain.
  physicsWorld.createGround(55, null);

  const town = await buildTown(physicsWorld, scene);
  const interactables = town.interactables || [];
  const spawnPoint = town.spawnPoint || new Vector3(0, 2, 14);
  worldAnimator = town.worldAnimator || (town.updateWorld
    ? { update: town.updateWorld }
    : null);

  setLoading(0.56, 'Inviting the fireflies…');

  inputManager = new InputManager();
  inputManager.init(renderer.domElement);
  inputManager.onLockChange = (locked) => {
    hud.elements.lockOverlay?.classList.toggle('hidden', locked);
    hud.setPlaying?.(locked);
  };

  characterMotor = new CharacterMotor(physicsWorld);
  characterMotor.init(spawnPoint, scene);
  characterMotor.setDebugVisible(false);

  visualRig = new VisualRig();
  visualRig.addToScene(scene);
  const storedOffset = Number.parseFloat(localStorage.getItem(VISUAL_OFFSET_STORAGE_KEY));
  if (Number.isFinite(storedOffset)) visualRig.setVisualOffsetY(storedOffset);

  visualRig.setVisual(createKawaiiAvatar(), {
    autoAlign: true,
    capsuleHalfHeight: characterMotor.halfHeight,
    capsuleRadius: characterMotor.radius,
    clearance: 0.025,
  });

  // A soft character key keeps fRiENDSiES readable beneath roofs and at night.
  playerGlow = new PointLight(playerGlowDay, 0.24, 9, 2);
  playerGlow.name = 'friendsiesKeyLight';
  playerGlow.castShadow = false;
  playerGlow.userData.cameraCollision = false;
  scene.add(playerGlow);

  cameraRig = new CameraRig(camera);
  cameraRig.distance = 6.6;
  cameraRig.minDistance = 1.45;
  cameraRig.maxDistance = 11;
  cameraRig.collisionOffset = 0.62;
  cameraRig.pivotHeight = 1.35;
  cameraRig.lookAtHeight = 0.95;
  cameraRig.shoulderOffset = 0.28;
  cameraRig.positionSharpness = 7.5;
  cameraRig.rotationSharpness = 10;
  // Start by looking through the welcome gate toward the village plaza.
  cameraRig.yaw = Math.PI;
  cameraRig.setTarget(characterMotor.getPosition());
  cameraRig.resetPosition();

  playerController = new PlayerController(inputManager, characterMotor, cameraRig, visualRig);
  playerAnimator = new PlayerAnimator(visualRig, {
    maxSpeed: characterMotor.maxSpeed || 6,
    motionScale: reducedMotion ? 0.35 : 1,
    reducedMotion,
  });

  cacheCollisionObjects();
  registerInteractions(interactables);
  bindPointerLock();
  window.addEventListener('resize', onResize);
  window.addEventListener('beforeunload', dispose, { once: true });

  appReady = true;
  setLoading(1, 'The valley is ready ✦');
  hud.setReady?.();
  hud.setStatus('Ready — click to wander ✦');

  // fRiENDSiES is the canonical cast. The local chibi remains visible only
  // while remote character pieces stream in, or as a resilient offline fallback.
  if (params.get('avatar') !== 'local') void loadFriendsiesAvatar();

  window.thornvale = {
    scene,
    camera,
    renderer,
    dayNightSystem,
    vfx,
    visualRig,
    characterMotor,
    playerController,
    worldAnimator,
    hud,
  };
}

function registerInteractions(interactables) {
  interactableSystem = new InteractableSystem(hud);

  for (const interactable of interactables) {
    if (interactable.id === 'ledger') {
      interactable.onInteract = () => {
        gameState.kindnessCount += 1;
        hud.showKindness(gameState.kindnessCount);
        celebrateInteraction(interactable.position, 'kindness');
        return gameState.kindnessCount === 1
          ? 'The ledger blooms at your touch. Kindness remembered ♡'
          : `The valley remembers ${gameState.kindnessCount} little kindnesses.`;
      };
    } else if (interactable.id === 'bell') {
      interactable.onInteract = () => {
        celebrateInteraction(interactable.position, 'bell');
        worldAnimator?.ringBell?.();
        return 'The wish-bell sings across the valley ✦';
      };
    } else {
      const original = interactable.onInteract;
      interactable.onInteract = () => {
        celebrateInteraction(interactable.position, 'magic');
        return original?.() || 'A little magic stirs nearby.';
      };
    }

    interactableSystem.register(interactable);
  }
}

function celebrateInteraction(position, kind) {
  const effectPosition = new Vector3(position.x, position.y + 1.05, position.z);
  vfx?.interactionBurst(effectPosition, kind);
  postProcessing?.pulse(kind === 'bell' ? 0.5 : 0.28);
  playerAnimator?.triggerEmote(kind === 'kindness' ? 'happy' : kind);
  soundscape?.playInteraction(kind);
  hud?.celebrate?.(kind);
}

function bindPointerLock() {
  const enterWorld = async () => {
    soundscape?.start();
    hud?.beginAdventure?.();
    const locked = await inputManager?.requestLock?.();
    if (!locked) {
      // Embedded browsers can deny pointer lock. Keep keyboard play and the
      // cinematic scene available instead of trapping the player in the card.
      hud.elements.lockOverlay?.classList.add('hidden');
      hud.setPlaying?.(true);
    }
  };

  hud.elements.lockOverlay?.addEventListener('click', enterWorld);
  renderer.domElement.addEventListener('click', () => {
    if (!inputManager.isLocked) enterWorld();
  });
}

async function loadFriendsiesAvatar() {
  characterLoader = new CharacterLoader().init();
  const requestedToken = Number.parseInt(params.get('friend') || params.get('token') || '1', 10);
  const tokenId = Number.isFinite(requestedToken) && requestedToken > 0 ? requestedToken : 1;
  hud.setStatus(`fRiENDSiES #${tokenId} is getting ready…`);
  const metadataLoaded = await characterLoader.loadMetadata({ timeout: 6000 });
  if (!metadataLoaded) {
    hud.setStatus('fRiENDSiES is offline — your local valley buddy stepped in ♡');
    return;
  }

  const characterVisual = await characterLoader.loadCharacter(tokenId);
  if (!characterVisual) {
    hud.setStatus('That fRiENDSiES look is resting — your local buddy stepped in ♡');
    return;
  }

  visualRig.setVisual(characterVisual, {
    autoAlign: true,
    capsuleHalfHeight: characterMotor.halfHeight,
    capsuleRadius: characterMotor.radius,
    clearance: 0.02,
  });
  playerAnimator.captureBasePose();
  hud.setStatus(`fRiENDSiES #${tokenId} joined the adventure ✦`);
  postProcessing?.pulse(0.45);
}

function startAnimationLoop() {
  if (animationStarted) return;
  animationStarted = true;
  requestAnimationFrame(animate);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock?.getDelta?.() || 0.016, 0.075);

  dayNightSystem?.update(dt);
  sky?.update(dt, dayNightSystem?.mix || 0);

  if (inputManager) handleGlobalInput();

  physicsWorld?.step(dt);
  physicsWorld?.syncKinematicVisuals();

  if (playerController) {
    // A very slow showcase orbit keeps the title screen alive.
    if (!inputManager.isLocked && appReady && !reducedMotion) {
      cameraRig.yaw += dt * 0.055;
    }

    playerController.update(dt);
    playerAnimator?.update(dt, {
      velocity: characterMotor.getVelocity(),
      isGrounded: characterMotor.isGrounded,
    });
    playerController.lateUpdate(dt, scene);
    const playerPosition = characterMotor.getPosition();
    playerGlow?.position.set(playerPosition.x, playerPosition.y + 2.25, playerPosition.z + 1.15);
    if (playerGlow) {
      playerGlow.color.copy(playerGlowDay).lerp(playerGlowNight, dayNightSystem?.mix || 0);
      playerGlow.intensity = 0.24 + (dayNightSystem?.mix || 0) * 0.78;
    }
  }

  if (interactableSystem && characterMotor) {
    interactableSystem.update(characterMotor.getPosition(), inputManager);
  }

  worldAnimator?.update?.(dt, dayNightSystem?.isNight ?? false);

  if (vfx) {
    vfx.update(dt, {
      playerPosition: characterMotor?.getPosition?.(),
      isNight: dayNightSystem?.isNight ?? false,
      weather: gameState.weather,
    });
  }

  updateAudio(dt);
  physicsWorld?.updateDebugRender(scene);
  updateFPS(dt);

  if (playerController) {
    hud.updateFPS(currentFps);
    hud.updateDebug(playerController.getDebugInfo());
  }

  postProcessing?.setDayNight(dayNightSystem?.isNight ?? false);
  if (postProcessing) postProcessing.render(dt);
  else renderer?.render(scene, camera);
}

function updateAudio(dt) {
  const velocity = characterMotor?.getVelocity?.();
  const speed = velocity ? Math.hypot(velocity.x, velocity.z) : 0;
  footstepTimer -= dt;

  soundscape?.update(dt, {
    isNight: dayNightSystem?.isNight ?? false,
    weather: gameState.weather,
    playerSpeed: speed,
  });

  if (soundscape?.isStarted && characterMotor?.isGrounded && speed > 1.25 && footstepTimer <= 0) {
    soundscape.playFootstep(Math.min(1, speed / 6));
    footstepTimer = Math.max(0.19, 0.44 - speed * 0.035);
  }
}

function handleGlobalInput() {
  if (inputManager.consumeKeyPress('KeyN')) {
    const mode = dayNightSystem.toggle();
    const night = mode === 'NIGHT';
    hud.setDayNight(mode);
    postProcessing?.setDayNight(night);
    soundscape?.setDayNight(night);
    postProcessing?.pulse(0.32);

    const position = characterMotor?.getPosition?.();
    if (position) vfx?.interactionBurst(new Vector3(position.x, position.y + 1.5, position.z), 'magic');

    if (night && gameState.kindnessCount > 0) hud.showKindness(gameState.kindnessCount);
    else if (!night) hud.hideKindness();

    hud.setStatus(night
      ? 'Moonpetals wake as twilight settles…'
      : 'Golden morning spills across the clover…');
    hud.celebrate?.(night ? 'night' : 'day');
  }

  if (inputManager.consumeKeyPress('Backquote')) {
    debugEnabled = !debugEnabled;
    physicsWorld?.setDebugEnabled(debugEnabled);
    characterMotor?.setDebugVisible(debugEnabled);
    hud.setDebugVisible(debugEnabled);
    hud.setStatus(debugEnabled ? 'Developer petals revealed.' : 'Back to the magic.');
  }

  if (debugEnabled && visualRig) {
    if (inputManager.consumeKeyPress('BracketLeft')) {
      const nextOffset = visualRig.getVisualOffsetY() - VISUAL_OFFSET_STEP;
      visualRig.setVisualOffsetY(nextOffset);
      localStorage.setItem(VISUAL_OFFSET_STORAGE_KEY, nextOffset.toFixed(3));
    }
    if (inputManager.consumeKeyPress('BracketRight')) {
      const nextOffset = visualRig.getVisualOffsetY() + VISUAL_OFFSET_STEP;
      visualRig.setVisualOffsetY(nextOffset);
      localStorage.setItem(VISUAL_OFFSET_STORAGE_KEY, nextOffset.toFixed(3));
    }
  }
}

function updateFPS(dt) {
  frameCount += 1;
  lastFpsUpdate += dt;
  if (lastFpsUpdate < 0.5) return;
  currentFps = Math.round(frameCount / lastFpsUpdate);
  frameCount = 0;
  lastFpsUpdate = 0;
}

function cacheCollisionObjects() {
  const meshes = [];
  scene.traverse((object) => {
    if (!object.isMesh || !object.visible || !object.geometry) return;
    if (isCameraDecoration(object)) return;
    meshes.push(object);
  });
  cameraRig.setCollisionObjects(meshes);
}

function isCameraDecoration(object) {
  let current = object;
  while (current) {
    if (current.userData?.cameraCollision === false) return true;
    if (/sky|particle|cloud|petal|flower|grass|foliage|water|sparkle|celestial|avatar|visualrig/i.test(current.name || '')) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  postProcessing?.resize(width, height);
  vfx?.setPixelRatio(renderer.getPixelRatio());
}

function dispose() {
  postProcessing?.dispose();
  vfx?.dispose();
  playerAnimator?.dispose();
  sky?.dispose();
  void soundscape?.dispose();
}

init().catch((error) => {
  console.error('Failed to initialize Thornvale Kawaii 2.0:', error);
  setLoading(1, 'The valley tripped over a mushroom. Please refresh.');
  hud?.setError?.(error?.message || 'Unknown initialization error');
});
