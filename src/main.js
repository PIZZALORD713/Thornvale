/**
 * fRiENDSiES Rapier - Main Entry Point
 * 
 * Greybox demo with:
 * - Rapier physics
 * - Character controller (KCC capsule)
 * - Third-person camera
 * - Dynamic physics toys
 * - Moving/rotating platforms
 */

import * as THREE from 'three';
import { PhysicsWorld } from './core/PhysicsWorld.js';
import { InputManager } from './core/InputManager.js';
import { CharacterMotor } from './physics/CharacterMotor.js';
import { PlatformCarrier } from './physics/PlatformCarrier.js';
import { CameraRig } from './controllers/CameraRig.js';
import { PlayerController } from './controllers/PlayerController.js';
import { VisualRig } from './visuals/VisualRig.js';
import { randFloat } from './utils/math.js';

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
let platformCarrier;

// Scene objects
let dynamicBodies = [];
let platforms = [];

// UI elements
const ui = {
  status: null,
  lockOverlay: null,
  debugPanel: null,
  fps: null,
  pos: null,
  vel: null,
  grounded: null,
  platform: null,
};

// FPS counter
let frameCount = 0;
let lastFpsUpdate = 0;
let currentFps = 0;

// ============================================================
// INITIALIZATION
// ============================================================
async function init() {
  // Get UI elements
  ui.status = document.getElementById('status');
  ui.lockOverlay = document.getElementById('lockOverlay');
  ui.debugPanel = document.getElementById('debug');
  ui.fps = document.getElementById('fps');
  ui.pos = document.getElementById('pos');
  ui.vel = document.getElementById('vel');
  ui.grounded = document.getElementById('grounded');
  ui.platform = document.getElementById('platform');
  
  setStatus('Initializing Three.js...');
  
  // --- Three.js Setup ---
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);
  
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
  
  // --- Lights ---
  setupLights();
  
  // --- Rapier Physics ---
  setStatus('Loading Rapier physics...');
  
  physicsWorld = new PhysicsWorld();
  await physicsWorld.init();
  
  setStatus('Creating world...');
  
  // Ground
  physicsWorld.createGround(50, scene);
  
  // Platform carrier
  platformCarrier = new PlatformCarrier(physicsWorld);
  
  // --- Platforms ---
  createPlatforms();
  
  // --- Physics Toys ---
  createPhysicsToys();
  
  // --- Input ---
  inputManager = new InputManager();
  inputManager.init(renderer.domElement);
  
  inputManager.onLockChange = (locked) => {
    ui.lockOverlay.classList.toggle('hidden', locked);
  };
  
  // --- Character Motor ---
  characterMotor = new CharacterMotor(physicsWorld);
  characterMotor.init(new THREE.Vector3(0, 2, 0), scene);
  
  // --- Visual Rig (debug capsule for now) ---
  visualRig = new VisualRig();
  visualRig.addToScene(scene);
  
  // Create placeholder visual (simple capsule mesh)
  const capsuleVisual = createCapsuleMesh(0.35, 0.55);
  visualRig.setVisual(capsuleVisual);
  
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
  playerController.platformCarrier = platformCarrier;
  
  // --- UI Setup ---
  setupUI();
  
  // --- Pointer Lock Click ---
  ui.lockOverlay.addEventListener('click', () => {
    inputManager.requestLock();
  });
  
  renderer.domElement.addEventListener('click', () => {
    if (!inputManager.isLocked) {
      inputManager.requestLock();
    }
  });
  
  // --- Resize ---
  window.addEventListener('resize', onResize);
  
  setStatus('Ready! Click to play');
  
  // Start loop
  animate();
}

// ============================================================
// SCENE SETUP
// ============================================================
function setupLights() {
  // Ambient
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);
  
  // Hemisphere
  const hemi = new THREE.HemisphereLight(0x87CEEB, 0x8B7355, 0.5);
  scene.add(hemi);
  
  // Directional (sun)
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(10, 20, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 50;
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  scene.add(sun);
}

function createPlatforms() {
  // --- Moving Platform (oscillates on X axis) ---
  const movingPlatform = physicsWorld.createKinematicPlatform(
    { x: 8, y: 0.5, z: 0 },
    { x: 4, y: 0.5, z: 4 },
    scene
  );
  movingPlatform.type = 'moving';
  movingPlatform.startX = 8;
  movingPlatform.endX = -8;
  movingPlatform.speed = 0.3; // Fraction of period
  movingPlatform.time = 0;
  platforms.push(movingPlatform);
  
  // Register with platform carrier
  platformCarrier.registerPlatform(movingPlatform.collider, movingPlatform.body);
  
  // --- Rotating Platform ---
  const rotatingPlatform = physicsWorld.createKinematicPlatform(
    { x: 0, y: 0.5, z: -10 },
    { x: 6, y: 0.5, z: 6 },
    scene
  );
  rotatingPlatform.type = 'rotating';
  rotatingPlatform.angularSpeed = 0.5; // radians per second
  rotatingPlatform.currentAngle = 0;
  platforms.push(rotatingPlatform);
  
  // Register with platform carrier
  platformCarrier.registerPlatform(rotatingPlatform.collider, rotatingPlatform.body);
  
  // --- Static elevated platform ---
  const staticPlatform = physicsWorld.createKinematicPlatform(
    { x: -10, y: 2, z: 5 },
    { x: 5, y: 0.3, z: 5 },
    scene
  );
  staticPlatform.type = 'static';
  platforms.push(staticPlatform);
}

function createPhysicsToys() {
  // Spawn some boxes
  for (let i = 0; i < 5; i++) {
    const pos = {
      x: randFloat(-5, 5),
      y: randFloat(1, 3),
      z: randFloat(-5, 5),
    };
    const size = {
      x: randFloat(0.5, 1.2),
      y: randFloat(0.5, 1.2),
      z: randFloat(0.5, 1.2),
    };
    const box = physicsWorld.createDynamicBox(pos, size, scene);
    dynamicBodies.push(box);
  }
  
  // Spawn some spheres
  for (let i = 0; i < 3; i++) {
    const pos = {
      x: randFloat(-5, 5),
      y: randFloat(2, 4),
      z: randFloat(-5, 5),
    };
    const radius = randFloat(0.3, 0.7);
    const sphere = physicsWorld.createDynamicSphere(pos, radius, scene);
    dynamicBodies.push(sphere);
  }
}

function createCapsuleMesh(radius, halfHeight) {
  const group = new THREE.Group();
  
  // Material
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3498db,
    roughness: 0.4,
    metalness: 0.1,
  });
  
  // Cylinder body
  const cylGeo = new THREE.CylinderGeometry(radius, radius, halfHeight * 2, 16);
  const cylinder = new THREE.Mesh(cylGeo, mat);
  cylinder.castShadow = true;
  group.add(cylinder);
  
  // Top sphere
  const topGeo = new THREE.SphereGeometry(radius, 16, 16);
  const topSphere = new THREE.Mesh(topGeo, mat);
  topSphere.position.y = halfHeight;
  topSphere.castShadow = true;
  group.add(topSphere);
  
  // Bottom sphere
  const botGeo = new THREE.SphereGeometry(radius, 16, 16);
  const botSphere = new THREE.Mesh(botGeo, mat);
  botSphere.position.y = -halfHeight;
  botSphere.castShadow = true;
  group.add(botSphere);
  
  return group;
}

// ============================================================
// UI SETUP
// ============================================================
function setupUI() {
  // Camera sliders
  const distanceSlider = document.getElementById('cameraDistance');
  const pivotSlider = document.getElementById('pivotHeight');
  const shoulderSlider = document.getElementById('shoulderOffset');
  
  const distanceVal = document.getElementById('distanceVal');
  const pivotVal = document.getElementById('pivotHeightVal');
  const shoulderVal = document.getElementById('shoulderVal');
  
  if (distanceSlider) {
    distanceSlider.value = cameraRig.distance;
    distanceSlider.addEventListener('input', (e) => {
      cameraRig.distance = parseFloat(e.target.value);
      distanceVal.textContent = cameraRig.distance.toFixed(1);
    });
  }
  
  if (pivotSlider) {
    pivotSlider.value = cameraRig.pivotHeight;
    pivotSlider.addEventListener('input', (e) => {
      cameraRig.pivotHeight = parseFloat(e.target.value);
      pivotVal.textContent = cameraRig.pivotHeight.toFixed(1);
    });
  }
  
  if (shoulderSlider) {
    shoulderSlider.value = cameraRig.shoulderOffset;
    shoulderSlider.addEventListener('input', (e) => {
      cameraRig.shoulderOffset = parseFloat(e.target.value);
      shoulderVal.textContent = cameraRig.shoulderOffset.toFixed(1);
    });
  }
  
  // Spawn buttons
  document.getElementById('spawnBoxBtn')?.addEventListener('click', () => {
    const pos = characterMotor.getPosition();
    pos.y += 3;
    pos.x += randFloat(-2, 2);
    pos.z += randFloat(-2, 2);
    const box = physicsWorld.createDynamicBox(
      { x: pos.x, y: pos.y, z: pos.z },
      { x: 1, y: 1, z: 1 },
      scene
    );
    dynamicBodies.push(box);
  });
  
  document.getElementById('spawnSphereBtn')?.addEventListener('click', () => {
    const pos = characterMotor.getPosition();
    pos.y += 3;
    pos.x += randFloat(-2, 2);
    pos.z += randFloat(-2, 2);
    const sphere = physicsWorld.createDynamicSphere(
      { x: pos.x, y: pos.y, z: pos.z },
      0.5,
      scene
    );
    dynamicBodies.push(sphere);
  });
  
  document.getElementById('resetBtn')?.addEventListener('click', () => {
    playerController.teleport(new THREE.Vector3(0, 2, 0));
  });
  
  // Debug toggle
  document.getElementById('debugToggle')?.addEventListener('change', (e) => {
    const show = e.target.checked;
    physicsWorld.setDebugEnabled(show);
    characterMotor.setDebugVisible(show);
    if (ui.debugPanel) {
      ui.debugPanel.style.display = show ? 'block' : 'none';
    }
  });
}

function setStatus(text) {
  if (ui.status) {
    ui.status.textContent = text;
  }
}

// ============================================================
// UPDATE LOOP
// ============================================================
function animate() {
  requestAnimationFrame(animate);
  
  const dt = Math.min(clock.getDelta(), 0.1); // Cap delta
  
  // --- Update Platforms ---
  updatePlatforms(dt);
  
  // --- Physics Step ---
  physicsWorld.step(dt);
  
  // --- Platform Carrier ---
  platformCarrier.update(dt);
  
  // --- Player Controller ---
  if (playerController) {
    playerController.update(dt);
    playerController.lateUpdate(dt, scene);
  }
  
  // --- Update Dynamic Bodies ---
  updateDynamicBodies();
  
  // --- Debug Render ---
  physicsWorld.updateDebugRender(scene);
  
  // --- FPS Counter ---
  updateFPS(dt);
  
  // --- Update Debug UI ---
  updateDebugUI();
  
  // --- Render ---
  renderer.render(scene, camera);
}

function updatePlatforms(dt) {
  for (const platform of platforms) {
    if (platform.type === 'moving') {
      // Oscillate on X axis
      platform.time += dt * platform.speed;
      const t = (Math.sin(platform.time * Math.PI * 2) + 1) / 2;
      const x = platform.startX + (platform.endX - platform.startX) * t;
      
      const currentPos = platform.body.translation();
      platform.body.setNextKinematicTranslation({
        x: x,
        y: currentPos.y,
        z: currentPos.z,
      });
      
      if (platform.mesh) {
        platform.mesh.position.x = x;
      }
    } else if (platform.type === 'rotating') {
      // Rotate around Y axis
      platform.currentAngle += platform.angularSpeed * dt;
      
      const quat = new THREE.Quaternion();
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), platform.currentAngle);
      
      platform.body.setNextKinematicRotation({
        x: quat.x,
        y: quat.y,
        z: quat.z,
        w: quat.w,
      });
      
      if (platform.mesh) {
        platform.mesh.rotation.y = platform.currentAngle;
      }
    }
  }
}

function updateDynamicBodies() {
  for (const obj of dynamicBodies) {
    if (obj.body && obj.mesh) {
      const pos = obj.body.translation();
      const rot = obj.body.rotation();
      
      obj.mesh.position.set(pos.x, pos.y, pos.z);
      obj.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
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

function updateDebugUI() {
  if (!playerController) return;
  
  const info = playerController.getDebugInfo();
  
  if (ui.fps) ui.fps.textContent = currentFps;
  if (ui.pos) ui.pos.textContent = info.position;
  if (ui.vel) ui.vel.textContent = info.velocity;
  if (ui.grounded) ui.grounded.textContent = info.grounded ? 'YES' : 'NO';
  if (ui.platform) ui.platform.textContent = info.platform;
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
  const status = document.getElementById('status');
  if (status) {
    status.textContent = 'Failed to initialize: ' + err.message;
    status.style.color = '#f44336';
  }
});
