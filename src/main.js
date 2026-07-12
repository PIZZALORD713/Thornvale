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
import { CameraRig } from './game/camera/CameraRig.js';
import { configureCameraRig } from './config/camera.js';
import { PlayerController } from './controllers/PlayerController.js';
import { VisualRig } from './visuals/VisualRig.js';
import { CharacterLoader } from './visuals/CharacterLoader.js';
import { FriendsiesAnimator } from './visuals/FriendsiesAnimator.js';
import { createKawaiiAvatar } from './visuals/KawaiiAvatar.js';
import { loadFriendsiesAnimationPack } from './visuals/loadFriendsiesAnimationPack.js';
import { StewardActor } from './visuals/StewardActor.js';
import { StoryWorld } from './visuals/StoryWorld.js';
import { KawaiiSky } from './visuals/KawaiiSky.js';
import { PostProcessing } from './visuals/PostProcessing.js';
import { KawaiiVFX } from './visuals/KawaiiVFX.js';
import { PlayerAnimator } from './visuals/PlayerAnimator.js';
import { CozySoundscape } from './audio/CozySoundscape.js';
import { HUD } from './ui/HUD.js';
import { StoryUI } from './ui/StoryUI.js';
import { DayNightSystem } from './game/DayNightSystem.js';
import { GameSession } from './game/GameSession.js';
import { CoreHookDirector } from './game/CoreHookDirector.js';
import { InteractableSystem } from './game/InteractableSystem.js';
import { buildTown } from './game/TownBuilder.js';
import { CORE_HOOK_V03 } from './content/core-hook-v03.js';

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
let playerFriendsiesAnimator;
let hud;
let storyUI;
let gameSession;
let coreHookDirector;
let storyWorld;
let stewardActor;
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
let storyStarted = false;
let storyBlocking = false;
let storyBlockDepth = 0;
let stewardCastReady = false;
let animationClips = [];
let townLandmarks = {};
let playerSpawnPoint;
let cameraOcclusionTarget = null;

const playerGlowDay = new Color(0xffc9dc);
const playerGlowNight = new Color(0xa9c4ff);

const VISUAL_OFFSET_STORAGE_KEY = 'thornvale2.visualOffsetY';
const VISUAL_OFFSET_STEP = 0.002;
const params = new URLSearchParams(window.location.search);
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
const visualQuality = params.get('quality') || (reducedMotion ? 'medium' : 'high');
const storyEnabled = params.get('story') !== 'off';

const gameState = {
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
  storyUI = new StoryUI({ onBlockingChange: handleStoryBlocking }).init();
  setLoading(0.06, 'Waking the valley…');

  scene = new Scene();
  storyWorld = new StoryWorld(scene, { reducedMotion }).init();
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
  townLandmarks = town.landmarks || {};
  const spawnPoint = town.spawnPoint || new Vector3(0, 2, 14);
  playerSpawnPoint = spawnPoint.clone();
  worldAnimator = town.worldAnimator || (town.updateWorld
    ? { update: town.updateWorld }
    : null);

  setLoading(0.56, 'Inviting the fireflies…');

  inputManager = new InputManager();
  inputManager.init(renderer.domElement);
  inputManager.onLockChange = (locked) => {
    if (locked && storyBlocking) {
      inputManager.exitLock();
      return;
    }
    if (storyBlocking) hud.elements.lockOverlay?.classList.add('hidden');
    else hud.elements.lockOverlay?.classList.toggle('hidden', locked);
    if (locked && hud.elements.resumeLook) hud.elements.resumeLook.hidden = true;
    hud.setPlaying?.(locked);
  };

  characterMotor = new CharacterMotor(physicsWorld);
  characterMotor.init(spawnPoint, scene);
  characterMotor.setDebugVisible(false);

  visualRig = new VisualRig();
  visualRig.addToScene(scene);
  const storedOffset = Number.parseFloat(localStorage.getItem(VISUAL_OFFSET_STORAGE_KEY));
  if (params.get('visualOffset') === 'stored' && Number.isFinite(storedOffset)) {
    visualRig.setVisualOffsetY(storedOffset);
  }

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
  configureCameraRig(cameraRig);
  // Start by looking through the welcome gate toward the village plaza.
  cameraRig.setTarget(characterMotor.getPosition());
  cameraRig.resetPosition();

  playerController = new PlayerController(inputManager, characterMotor, cameraRig, visualRig);
  playerAnimator = new PlayerAnimator(visualRig, {
    maxSpeed: characterMotor.maxSpeed || 6,
    motionScale: reducedMotion ? 0.35 : 1,
    reducedMotion,
  });

  const stewardAnchor = CORE_HOOK_V03.anchors.steward.welcome;
  const stewardFallback = createKawaiiAvatar();
  stewardFallback.name = 'StewardFallback';
  stewardActor = new StewardActor(scene, stewardFallback, {
    tokenId: CORE_HOOK_V03.steward.tokenId,
    position: stewardAnchorToArray(stewardAnchor),
    facingYaw: stewardAnchor.facing,
  });

  if (storyEnabled) {
    gameSession = new GameSession({ storageKey: CORE_HOOK_V03.storageKey });
    if (params.get('story') === 'reset' || params.get('reset') === '1') gameSession.reset();

    const stewardInteractable = {
      id: CORE_HOOK_V03.ids.steward,
      position: stewardActor.position,
      radius: 2.35,
    };

    coreHookDirector = new CoreHookDirector({
      storyUI,
      session: gameSession,
      content: CORE_HOOK_V03,
      dayNightSystem,
      hud,
      worldAnimator,
      soundscape,
      vfx,
      postProcessing,
      stewardActor,
      moveSteward,
      ringAnomalyBell,
      setRoute: applyStoryRoute,
      getRouteDestination: (choice) => storyWorld?.getDestination(choice),
      resetPlayer: resetPlayerToArrival,
      setStoryBlocking: handleStoryBlocking,
      onError: (error) => {
        console.error('[CoreHookDirector]', error);
        hud.setStatus('A page slipped out of the story. Please try that courtesy again.');
      },
    });
    coreHookDirector.init({ interactables, stewardInteractable });
    registerStoryInteractions([...interactables, stewardInteractable]);
  } else {
    stewardCastReady = true;
    stewardActor.setVisible(false);
    registerLegacyInteractions(interactables);
  }

  cacheCollisionObjects();
  bindPointerLock();
  window.addEventListener('resize', onResize);
  window.addEventListener('beforeunload', dispose, { once: true });

  appReady = true;
  setLoading(1, 'The valley is ready ✦');
  hud.setReady?.();
  hud.setStatus('Ready — click to wander ✦');

  // fRiENDSiES is the canonical cast. Local chibis remain visible only while
  // the player and Steward #8914 stream in, or as resilient offline fallbacks.
  void loadFriendsiesCast();

  window.thornvale = {
    scene,
    camera,
    renderer,
    dayNightSystem,
    vfx,
    visualRig,
    characterMotor,
    playerController,
    stewardActor,
    storyUI,
    gameSession,
    coreHookDirector,
    storyWorld,
    worldAnimator,
    hud,
  };
}

function registerStoryInteractions(interactables) {
  interactableSystem = new InteractableSystem(hud);

  for (const interactable of interactables) {
    interactable.enabled = () => (
      (interactable.id !== CORE_HOOK_V03.ids.steward || stewardCastReady)
      && (coreHookDirector?.isInteractableEnabled(interactable.id) ?? false)
    );
    interactable.prompt = () => coreHookDirector?.promptFor(interactable.id) || 'Listen closely';
    interactable.onInteract = () => coreHookDirector?.interact(interactable.id);
    interactableSystem.register(interactable);
  }
}

function registerLegacyInteractions(interactables) {
  interactableSystem = new InteractableSystem(hud);

  for (const interactable of interactables) {
    if (interactable.id === 'ledger') {
      interactable.onInteract = () => {
        celebrateInteraction(interactable.position, 'kindness');
        return 'The ledger blooms at your touch. Kindness remembered ♡';
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

function stewardAnchorToArray(anchor = {}) {
  return [
    Number(anchor.x) || 0,
    (Number(anchor.y) || 0) + 0.9,
    Number(anchor.z) || 0,
  ];
}

function moveSteward(anchor, options = {}) {
  if (!stewardActor || !anchor) return null;
  const target = stewardAnchorToArray(anchor);
  if (options.immediate) stewardActor.teleport(target, anchor.facing ?? stewardActor.facingYaw);
  else stewardActor.moveTo(target, { duration: options.duration });
  return stewardActor;
}

function resetPlayerToArrival() {
  if (!playerController || !playerSpawnPoint) return;
  playerController.teleport(playerSpawnPoint);
  configureCameraRig(cameraRig);
  cameraRig.resetPosition();
}

function ringAnomalyBell() {
  worldAnimator?.ringBell?.();
  soundscape?.playChime?.('bell', { gain: 0.68, detune: -450 });
  const bell = CORE_HOOK_V03.anchors.interactables.bell;
  const position = new Vector3(bell.x, bell.y + 1.25, bell.z);
  vfx?.interactionBurst(position, 'magic');
  postProcessing?.pulse(0.72);
  storyWorld?.setLedgerMood('false');
}

function applyStoryRoute(choice) {
  storyWorld?.setRoute(choice);
  storyWorld?.setLedgerMood(choice || 'normal');
  if (!choice) return;

  const destination = storyWorld?.getDestination(choice);
  if (destination) vfx?.interactionBurst(destination.clone().add(new Vector3(0, 0.8, 0)), 'magic');
}

function handleStoryBlocking(blocking) {
  const wasBlocking = storyBlocking;
  if (blocking) storyBlockDepth += 1;
  else storyBlockDepth = Math.max(0, storyBlockDepth - 1);
  storyBlocking = storyBlockDepth > 0;
  inputManager?.setGameplayEnabled?.(!storyBlocking);
  if (storyBlocking) {
    hud?.elements?.lockOverlay?.classList.add('hidden');
    if (hud?.elements?.resumeLook) hud.elements.resumeLook.hidden = true;
    if (document.pointerLockElement) inputManager?.exitLock?.();
  } else if (wasBlocking && storyStarted && !inputManager?.isLocked) {
    // StoryUI closes inside the click/key gesture, so this request can restore
    // mouse look without making the player discover an extra canvas click.
    void inputManager?.requestLock?.().then((locked) => {
      if (locked || storyBlocking || inputManager?.isLocked) return;
      hud?.setStatus?.('Click the valley to resume looking around.');
      hud?.elements?.lockOverlay?.classList.add('hidden');
      if (hud?.elements?.resumeLook) hud.elements.resumeLook.hidden = false;
    });
  }
}

function bindPointerLock() {
  const enterWorld = async () => {
    if (hud?.elements?.resumeLook) hud.elements.resumeLook.hidden = true;
    soundscape?.start();
    hud?.beginAdventure?.();
    const locked = await inputManager?.requestLock?.();
    if (!locked) {
      // Embedded browsers can deny pointer lock. Keep keyboard play and the
      // cinematic scene available instead of trapping the player in the card.
      hud.elements.lockOverlay?.classList.add('hidden');
      hud.setPlaying?.(true);
    }

    if (storyEnabled && coreHookDirector && !storyStarted) {
      storyStarted = true;
      try {
        await coreHookDirector.start();
      } catch (error) {
        storyStarted = false;
        console.error('[CoreHookDirector] first run failed to start', error);
        hud?.setStatus?.('The first page would not open. Click the valley to try again.');
      }
    }
  };

  hud.elements.lockOverlay?.addEventListener('click', enterWorld);
  hud.elements.resumeLook?.addEventListener('click', enterWorld);
  renderer.domElement.addEventListener('click', () => {
    if (!inputManager.isLocked) enterWorld();
  });
}

async function loadFriendsiesCast() {
  characterLoader = new CharacterLoader().init();
  const requestedToken = Number.parseInt(params.get('friend') || params.get('token') || '1', 10);
  const tokenId = Number.isFinite(requestedToken) && requestedToken > 0 ? requestedToken : 1;
  const useLocalPlayer = params.get('avatar') === 'local';
  if (!storyBlocking) {
    hud.setStatus(storyEnabled
      ? `Steward Lumen and fRiENDSiES #${tokenId} are getting ready…`
      : `fRiENDSiES #${tokenId} is getting ready…`);
  }

  if (window.thornvale) window.thornvale.characterLoader = characterLoader;

  const animationPackPromise = loadFriendsiesAnimationPack()
    .catch((error) => {
      console.warn('[FriendsiesAnimator] Authored animation pack unavailable:', error);
      return [];
    })
    .then((clips) => {
      animationClips = clips;
      stewardActor?.addClips(animationClips);
      playerFriendsiesAnimator?.addClips(animationClips, {
        walk: 'walk-low-arms',
        jump: 'friendsies-jump-ascent',
        fall: 'friendsies-fall',
        land: 'friendsies-land',
        joy: 'Joy-Jumper',
        dance: 'Dance_Rumba',
      });
      if (window.thornvale) window.thornvale.animationClips = animationClips;
      return clips;
    });

  // Lumen's slim local manifest loads independently of the full collection,
  // so #8914 and his authored reactions are ready before the first greeting.
  const stewardVisualPromise = storyEnabled
    ? characterLoader
      .loadCharacter(CORE_HOOK_V03.steward.tokenId, { instanceId: 'steward' })
      .then((visual) => {
        if (visual) stewardActor?.setVisual(visual);
        return visual;
      })
      .catch((error) => {
        console.warn('[CharacterLoader] Bundled Steward #8914 failed to load:', error);
        return null;
      })
    : Promise.resolve(null);
  const stewardPromise = storyEnabled
    ? Promise.all([stewardVisualPromise, animationPackPromise])
      .then(([visual]) => visual)
      .finally(() => {
        stewardCastReady = true;
      })
    : Promise.resolve(null);

  const bundledPlayerPromise = !useLocalPlayer && characterLoader.hasBundledCharacter(tokenId)
    ? characterLoader
      .loadCharacter(tokenId, { instanceId: 'player' })
      .then((visual) => {
        if (visual) applyPlayerFriendsiesVisual(visual);
        return visual;
      })
      .catch((error) => {
        console.warn(`[CharacterLoader] Bundled player #${tokenId} failed to load:`, error);
        return null;
      })
    : Promise.resolve(null);

  const needsRemoteMetadata = !useLocalPlayer && !characterLoader.hasBundledCharacter(tokenId);

  const [metadataLoaded, clips] = await Promise.all([
    needsRemoteMetadata
      ? characterLoader.loadMetadata({ timeout: 6000 })
      : Promise.resolve(false),
    animationPackPromise,
  ]);

  animationClips = clips;

  let playerVisual = await bundledPlayerPromise;
  if (!playerVisual && !useLocalPlayer && metadataLoaded) {
    playerVisual = await characterLoader.loadCharacter(tokenId, { instanceId: 'player' });
    if (playerVisual) applyPlayerFriendsiesVisual(playerVisual);
  }
  const stewardVisual = await stewardPromise;

  if (!stewardVisual && storyEnabled) {
    console.warn('[CharacterLoader] Steward #8914 fell back to the local steward visual.');
  }

  if (window.thornvale) {
    window.thornvale.characterLoader = characterLoader;
    window.thornvale.animationClips = animationClips;
    window.thornvale.playerFriendsiesAnimator = playerFriendsiesAnimator;
  }

  if (!storyBlocking) {
    if (playerVisual && stewardVisual) {
      hud.setStatus(`fRiENDSiES #${tokenId} and Steward Lumen #8914 joined the adventure ✦`);
    } else if (stewardVisual) {
      hud.setStatus(metadataLoaded || useLocalPlayer
        ? 'Steward Lumen #8914 is ready to welcome you ✦'
        : 'Steward Lumen #8914 is ready; your local valley buddy stepped in ♡');
    } else if (playerVisual) {
      hud.setStatus(`fRiENDSiES #${tokenId} joined; the local steward is helping today ♡`);
    } else {
      hud.setStatus('The local valley cast stepped in while fRiENDSiES rests ♡');
    }
  }
}

function applyPlayerFriendsiesVisual(playerVisual) {
  if (!playerVisual || visualRig.visual === playerVisual) return;
  playerFriendsiesAnimator?.dispose();
  visualRig.setVisual(playerVisual, {
    autoAlign: true,
    capsuleHalfHeight: characterMotor.halfHeight,
    capsuleRadius: characterMotor.radius,
    clearance: 0.018,
  });
  playerFriendsiesAnimator = new FriendsiesAnimator(playerVisual, {
    clips: animationClips,
    roles: {
      idle: 'Idle Float',
      walk: 'walk-low-arms',
      jump: 'friendsies-jump-ascent',
      fall: 'friendsies-fall',
      land: 'friendsies-land',
      joy: 'Joy-Jumper',
      dance: 'Dance_Rumba',
    },
  });
  // Skeletal motion now carries the walk cycle; keep the procedural layer as
  // a small, tactile squash-and-sway accent instead of doubling the stride.
  playerAnimator.setMotionScale(reducedMotion ? 0.18 : 0.42);
  playerAnimator.captureBasePose();
  postProcessing?.pulse(0.45);

  if (window.thornvale) {
    window.thornvale.playerFriendsiesAnimator = playerFriendsiesAnimator;
  }
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
    const velocity = characterMotor.getVelocity();
    const locomotionState = playerController.getLocomotionState();
    playerAnimator?.update(dt, locomotionState, velocity);
    const horizontalSpeed = locomotionState.horizontalSpeed;
    playerFriendsiesAnimator?.updateLocomotion(locomotionState, dt);
    playerFriendsiesAnimator?.update(dt);
    if (
      playerFriendsiesAnimator
      && locomotionState.grounded
      && locomotionState.phase === 'grounded'
      && playerFriendsiesAnimator.locomotionState === 'idle'
      && !playerFriendsiesAnimator.isPlayingOneShot
    ) {
      const measuredBottomY = playerFriendsiesAnimator.getFootSoleY();
      visualRig.stabilizeGrounding(dt, characterMotor.getCapsuleBottomY(), {
        clearance: 0.028,
        measuredBottomY,
        deadZone: 0.004,
        maxOffset: 0.055,
        maxSpeed: 0.08,
        sharpness: 6,
      });
    }
    playerController.lateUpdate(dt, scene);
    updateCameraOcclusion();
    const playerPosition = characterMotor.getPosition();
    playerGlow?.position.set(playerPosition.x, playerPosition.y + 2.25, playerPosition.z + 1.15);
    if (playerGlow) {
      playerGlow.color.copy(playerGlowDay).lerp(playerGlowNight, dayNightSystem?.mix || 0);
      playerGlow.intensity = 0.24 + (dayNightSystem?.mix || 0) * 0.78;
    }
  }

  coreHookDirector?.update(dt, characterMotor?.getPosition?.());
  storyWorld?.update(dt);

  if (interactableSystem && characterMotor) {
    interactableSystem.update(characterMotor.getPosition(), inputManager);
  }

  const twilightActive = (dayNightSystem?.mix || 0) >= 0.42;
  worldAnimator?.update?.(dt, twilightActive);

  if (vfx) {
    vfx.update(dt, {
      playerPosition: characterMotor?.getPosition?.(),
      isNight: twilightActive,
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

  soundscape?.update(dt, {
    isNight: dayNightSystem?.isNight ?? false,
    weather: gameState.weather,
    playerSpeed: speed,
  });

  if (playerFriendsiesAnimator?.consumeFootstep) {
    let contactCount = 0;
    while (playerFriendsiesAnimator.consumeFootstep()) contactCount += 1;

    if (soundscape?.isStarted && characterMotor?.isGrounded) {
      const intensity = Math.min(1, speed / (characterMotor.sprintSpeed || 5.6));
      for (let contact = 0; contact < contactCount; contact += 1) {
        soundscape.playFootstep(intensity);
      }
    }
    footstepTimer = 0;
    return;
  }

  // Procedural/local fallback avatars have no skeletal contact markers.
  footstepTimer -= dt;
  if (soundscape?.isStarted && characterMotor?.isGrounded && speed > 1.25 && footstepTimer <= 0) {
    soundscape.playFootstep(Math.min(1, speed / 6));
    const cadenceRatio = speed / (characterMotor.walkSpeed || 4.2);
    footstepTimer = Math.max(0.28, (2 / 3) / cadenceRatio);
  }
}

function handleGlobalInput() {
  const requestedTimeToggle = inputManager.consumeKeyPress('KeyN');
  if (requestedTimeToggle && (!storyEnabled || debugEnabled)) {
    const mode = dayNightSystem.toggle();
    const night = mode === 'NIGHT';
    hud.setDayNight(mode);
    postProcessing?.setDayNight(night);
    soundscape?.setDayNight(night);
    postProcessing?.pulse(0.32);

    const position = characterMotor?.getPosition?.();
    if (position) vfx?.interactionBurst(new Vector3(position.x, position.y + 1.5, position.z), 'magic');

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

function updateCameraOcclusion() {
  const shouldHide = cameraRig?.shouldHideTarget?.() ?? false;
  visualRig?.setCameraOccluded?.(shouldHide);
  const nextTarget = shouldHide
    ? cameraRig?.getCollisionObject?.()?.cameraOcclusionTarget || null
    : null;
  if (nextTarget === cameraOcclusionTarget) return;

  if (cameraOcclusionTarget) {
    cameraOcclusionTarget.visible = cameraOcclusionTarget.userData
      ?.cameraAuthoredVisibility ?? true;
  }
  cameraOcclusionTarget = nextTarget;
  if (cameraOcclusionTarget) {
    if (cameraOcclusionTarget.userData.cameraAuthoredVisibility === undefined) {
      cameraOcclusionTarget.userData.cameraAuthoredVisibility = cameraOcclusionTarget.visible;
    }
    cameraOcclusionTarget.visible = false;
  }
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
  if (cameraOcclusionTarget) {
    cameraOcclusionTarget.visible = cameraOcclusionTarget.userData
      ?.cameraAuthoredVisibility ?? true;
    cameraOcclusionTarget = null;
  }
  coreHookDirector?.dispose();
  storyUI?.dispose();
  storyWorld?.dispose();
  playerFriendsiesAnimator?.dispose();
  stewardActor?.dispose();
  visualRig?.removeFromScene?.(scene);
  visualRig?.dispose();
  characterLoader?.clearAll();
  inputManager?.dispose();
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
