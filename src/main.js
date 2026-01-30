/**
 * Thornvale - Main Entry Point
 * 
 * MVP slice:
 * - Third-person controller + camera
 * - Day/Night toggle
 * - Interactables with prompts
 * - Greybox town + collisions
 */

import * as THREE from 'three';
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
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 5, 10);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const app = document.getElementById('app');
  app.appendChild(renderer.domElement);

  clock = new THREE.Clock();

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

function createCapsuleMesh(radius, halfHeight) {
  const group = new THREE.Group();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x4b88ff,
    roughness: 0.4,
    metalness: 0.1,
  });

  const cylGeo = new THREE.CylinderGeometry(radius, radius, halfHeight * 2, 16);
  const cylinder = new THREE.Mesh(cylGeo, mat);
  cylinder.castShadow = true;
  group.add(cylinder);

  const topGeo = new THREE.SphereGeometry(radius, 16, 16);
  const topSphere = new THREE.Mesh(topGeo, mat);
  topSphere.position.y = halfHeight;
  topSphere.castShadow = true;
  group.add(topSphere);

  const botGeo = new THREE.SphereGeometry(radius, 16, 16);
  const botSphere = new THREE.Mesh(botGeo, mat);
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
