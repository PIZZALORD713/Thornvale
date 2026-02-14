/**
 * Thornvale - Main Entry Point
 *
 * MVP slice:
 * - Third-person controller + camera
 * - Day/Night toggle
 * - Interactables with prompts
 * - Greybox town + collisions
 */

import {
  Scene, PerspectiveCamera, WebGLRenderer, Clock, Group,
  CylinderGeometry, SphereGeometry, MeshStandardMaterial, Mesh,
  PCFSoftShadowMap, ACESFilmicToneMapping,
} from 'three';
import { PhysicsWorld } from './core/PhysicsWorld.js';
import { InputManager } from './core/InputManager.js';
import { CharacterMotor } from './physics/CharacterMotor.js';
import { CameraRig } from './controllers/CameraRig.js';
import { PlayerController } from './controllers/PlayerController.js';
import { VisualRig } from './visuals/VisualRig.js';
import { CharacterLoader } from './visuals/CharacterLoader.js';
import { HUD } from './ui/HUD.js';
import { DayNightSystem } from './game/DayNightSystem.js';
import { InteractableSystem } from './game/InteractableSystem.js';
import { buildTown } from './game/TownBuilder.js';

// ============================================================
// GLOBALS
// ============================================================
let scene, camera, renderer;
let clock;
let physicsWorld;
let inputManager;
let characterMotor;
let cameraRig;
let visualRig;
let playerController;
let hud;
let dayNightSystem;
let interactableSystem;
let characterLoader;
let debugEnabled = false;
const VISUAL_OFFSET_STORAGE_KEY = 'thornvale.visualOffsetY';
const VISUAL_OFFSET_STEP = 0.002;

const gameState = {
  kindnessCount: 0,
};

// FPS counter
let frameCount = 0;
let lastFpsUpdate = 0;
let currentFps = 0;

// ============================================================
// INITIALIZATION
// ============================================================
async function init() {
  hud = new HUD().init();
  hud.setStatus('Initializing Thornvale...');

  // --- Three.js Setup ---
  scene = new Scene();

  camera = new PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 5, 10);

  renderer = new WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const app = document.getElementById('app');
  app.appendChild(renderer.domElement);

  clock = new Clock();

  // --- Lighting ---
  dayNightSystem = new DayNightSystem(scene);
  dayNightSystem.init();
  hud.setDayNight('DAY');

  // --- Rapier Physics ---
  hud.setStatus('Loading Rapier physics...');
  physicsWorld = new PhysicsWorld();
  await physicsWorld.init();

  hud.setStatus('Building Thornvale...');

  // Ground
  physicsWorld.createGround(50, scene);

  // Greybox town
  const { interactables, spawnPoint } = await buildTown(physicsWorld, scene);

  // --- Input ---
  inputManager = new InputManager();
  inputManager.init(renderer.domElement);

  inputManager.onLockChange = (locked) => {
    hud.elements.lockOverlay?.classList.toggle('hidden', locked);
  };

  // --- Character Motor ---
  characterMotor = new CharacterMotor(physicsWorld);
  characterMotor.init(spawnPoint, scene);
  characterMotor.setDebugVisible(false);

  // --- Visual Rig (debug capsule for now) ---
  visualRig = new VisualRig();
  visualRig.addToScene(scene);
  const defaultVisualOffsetY = -characterMotor.controllerSkin;
  const storedOffset = Number.parseFloat(localStorage.getItem(VISUAL_OFFSET_STORAGE_KEY));
  const visualOffsetY = Number.isFinite(storedOffset) ? storedOffset : defaultVisualOffsetY;
  visualRig.setVisualOffsetY(visualOffsetY);

  characterLoader = new CharacterLoader().init();
  hud.setStatus('Loading Friendsies metadata...');
  const metadataLoaded = await characterLoader.loadMetadata();

  let characterVisual = null;
  if (metadataLoaded) {
    hud.setStatus('Loading Friendsies character...');
    characterVisual = await characterLoader.loadCharacter(1);
  }

  if (characterVisual) {
    visualRig.setVisual(characterVisual, {
      autoAlign: true,
      capsuleHalfHeight: characterMotor.halfHeight,
      capsuleRadius: characterMotor.radius,
      clearance: 0.015,
    });
  } else {
    const capsuleVisual = createCapsuleMesh(0.35, 0.55);
    visualRig.setVisual(capsuleVisual);
    hud.setStatus('Using placeholder character.');
  }

  // --- Camera Rig ---
  cameraRig = new CameraRig(camera);
  cameraRig.setTarget(characterMotor.getPosition());
  cameraRig.resetPosition();

  // Cache collision objects once so CameraRig doesn't traverse scene every frame
  cacheCollisionObjects();

  // --- Player Controller ---
  playerController = new PlayerController(
    inputManager,
    characterMotor,
    cameraRig,
    visualRig
  );

  // --- Interactables ---
  interactableSystem = new InteractableSystem(hud);
  for (const interactable of interactables) {
    if (interactable.id === 'ledger') {
      interactable.onInteract = () => {
        gameState.kindnessCount += 1;
        if (dayNightSystem.isNight) {
          hud.showKindness(gameState.kindnessCount);
        }
        return 'Kindness recorded.';
      };
    }

    if (interactable.id === 'bell') {
      interactable.onInteract = () => 'The town heard you.';
    }

    interactableSystem.register(interactable);
  }

  // --- Pointer Lock Click ---
  hud.elements.lockOverlay?.addEventListener('click', () => {
    inputManager.requestLock();
  });

  renderer.domElement.addEventListener('click', () => {
    if (!inputManager.isLocked) {
      inputManager.requestLock();
    }
  });

  // --- Resize ---
  window.addEventListener('resize', onResize);

  hud.setStatus('Ready! Click to play');

  // Start loop
  animate();
}

/**
 * Collect all visible meshes and cache them for camera collision.
 * Call again if scene geometry changes significantly.
 */
function cacheCollisionObjects() {
  const meshes = [];
  scene.traverse((obj) => {
    if (obj.isMesh &&
        obj.visible &&
        !obj.name.includes('debug') &&
        !obj.name.includes('particle') &&
        obj.geometry) {
      meshes.push(obj);
    }
  });
  cameraRig.setCollisionObjects(meshes);
}

function createCapsuleMesh(radius, halfHeight) {
  const group = new Group();

  const mat = new MeshStandardMaterial({
    color: 0x4b88ff,
    roughness: 0.4,
    metalness: 0.1,
  });

  const cylGeo = new CylinderGeometry(radius, radius, halfHeight * 2, 16);
  const cylinder = new Mesh(cylGeo, mat);
  cylinder.castShadow = true;
  group.add(cylinder);

  const topGeo = new SphereGeometry(radius, 16, 16);
  const topSphere = new Mesh(topGeo, mat);
  topSphere.position.y = halfHeight;
  topSphere.castShadow = true;
  group.add(topSphere);

  const botGeo = new SphereGeometry(radius, 16, 16);
  const botSphere = new Mesh(botGeo, mat);
  botSphere.position.y = -halfHeight;
  botSphere.castShadow = true;
  group.add(botSphere);

  return group;
}

// ============================================================
// UPDATE LOOP
// ============================================================
function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.1);

  handleGlobalInput();

  // --- Physics Step ---
  physicsWorld.step(dt);
  physicsWorld.syncKinematicVisuals();

  // --- Player Controller ---
  if (playerController) {
    playerController.update(dt);
    playerController.lateUpdate(dt, scene);
  }

  // --- Interactables ---
  if (interactableSystem) {
    interactableSystem.update(characterMotor.getPosition(), inputManager);
  }

  // --- Debug Render ---
  physicsWorld.updateDebugRender(scene);

  // --- FPS Counter ---
  updateFPS(dt);

  // --- Update Debug UI ---
  if (playerController) {
    hud.updateFPS(currentFps);
    hud.updateDebug(playerController.getDebugInfo());
  }

  // --- Render ---
  renderer.render(scene, camera);
}

function handleGlobalInput() {
  if (inputManager.consumeKeyPress('KeyN')) {
    const mode = dayNightSystem.toggle();
    hud.setDayNight(mode);
    if (dayNightSystem.isNight && gameState.kindnessCount > 0) {
      hud.showKindness(gameState.kindnessCount);
    } else {
      hud.hideKindness();
    }
    hud.setStatus(mode === 'NIGHT' ? 'Night settles over Thornvale.' : 'Daylight returns to Thornvale.');
  }

  if (inputManager.consumeKeyPress('Backquote')) {
    debugEnabled = !debugEnabled;
    physicsWorld.setDebugEnabled(debugEnabled);
    characterMotor.setDebugVisible(debugEnabled);
    hud.setDebugVisible(debugEnabled);
    hud.setStatus(debugEnabled ? 'Debug view enabled.' : 'Debug view disabled.');
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
  frameCount++;
  lastFpsUpdate += dt;

  if (lastFpsUpdate >= 0.5) {
    currentFps = Math.round(frameCount / lastFpsUpdate);
    frameCount = 0;
    lastFpsUpdate = 0;
  }
}

// ============================================================
// RESIZE
// ============================================================
function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
}

// ============================================================
// BOOT
// ============================================================
init().catch((err) => {
  console.error('Failed to initialize:', err);
  const status = document.getElementById('statusLine');
  if (status) {
    status.textContent = 'Failed to initialize: ' + err.message;
    status.style.color = '#f44336';
  }
});
