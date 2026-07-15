/**
 * Thornvale Kawaii 2.0
 *
 * A presentation-first cozy village slice with:
 * - a locally bundled fRiENDSiES player and steward with code-native recovery
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
import { resolvePlayerFriendsiesSelection } from './config/player-character.js';
import { PlayerController } from './controllers/PlayerController.js';
import { VisualRig } from './visuals/VisualRig.js';
import { CharacterLoader } from './visuals/CharacterLoader.js';
import { FriendsiesAnimator } from './visuals/FriendsiesAnimator.js';
import { createKawaiiAvatar } from './visuals/KawaiiAvatar.js';
import { loadFriendsiesAnimationPack } from './visuals/loadFriendsiesAnimationPack.js';
import { StewardActor } from './visuals/StewardActor.js';
import { StoryWorld } from './visuals/StoryWorld.js';
import {
  applyStoryPresentationDatasets,
  projectStoryPresentation,
} from './visuals/AestheticPresentation.js';
import { KawaiiSky } from './visuals/KawaiiSky.js';
import { EnvironmentLighting } from './visuals/EnvironmentLighting.js';
import { PostProcessing } from './visuals/PostProcessing.js';
import { KawaiiVFX } from './visuals/KawaiiVFX.js';
import { PlayerAnimator } from './visuals/PlayerAnimator.js';
import { CozySoundscape } from './audio/CozySoundscape.js';
import { HUD } from './ui/HUD.js';
import { StoryUI } from './ui/StoryUI.js';
import { DayNightSystem } from './game/DayNightSystem.js';
import { GameSession } from './game/GameSession.js';
import { CoreHookDirector } from './game/CoreHookDirector.js';
import { DayOneDirector } from './game/DayOneDirector.js';
import { DayOneActionController } from './game/DayOneActionController.js';
import { InteractableSystem } from './game/InteractableSystem.js';
import { buildTown } from './game/TownBuilder.js';
import { CORE_HOOK_V03 } from './content/core-hook-v03.js';
import { DAY_ONE_V01 } from './content/day-one-v01.js';
import { DayOneActionPresenter } from './visuals/DayOneActionPresenter.js';
import { disposeTownPresentation } from './app/disposeTownPresentation.js';
import { recoverMissingCharacterVisuals } from './app/recoverMissingCharacterVisuals.js';
import {
  DEFAULT_PLAYER_FRIENDSIES_TOKEN_ID,
  PLAYER_FRIENDSIES_FALLBACK_TOKEN_IDS,
} from './content/friendsies-cast.js';

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
let dayOneDirector;
let dayOneActionController;
let dayOneActionPresenter;
let dayOneActionUnsubscribe;
let dayOneWorld;
let storyWorld;
let stewardActor;
let dayNightSystem;
let interactableSystem;
let characterLoader;
let worldAnimator;
let ambientLife;
let breathingGrass;
let traitEchoes;
let traitEchoUnsubscribe;
let sky;
let environmentLighting;
let postProcessing;
let vfx;
let soundscape;
let animationStarted = false;
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
let playerFriendsiesSelection = null;

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

  environmentLighting = new EnvironmentLighting(scene, renderer).init();
  dayNightSystem = new DayNightSystem(scene).init();
  sky = new KawaiiSky(scene).init();
  hud.setDayNight('DAY');

  postProcessing = new PostProcessing(renderer, scene, camera, {
    quality: ['low', 'medium', 'high'].includes(visualQuality) ? visualQuality : 'high',
    enabled: params.get('post') !== 'off',
    bloomStrength: reducedMotion ? 0.18 : 0.28,
    bloomRadius: 0.44,
    bloomThreshold: 0.86,
    saturation: 1.02,
    contrast: 1.035,
    brightness: 0,
    warmth: 0.025,
    vignette: 0.14,
  }).init();

  vfx = new KawaiiVFX(scene, {
    weather: gameState.weather,
    fireflyCount: reducedMotion ? 10 : 30,
    petalCount: reducedMotion ? 8 : 28,
    sparkleCount: reducedMotion ? 4 : 12,
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

  const town = await buildTown(physicsWorld, scene, {
    reducedMotion,
    quality: visualQuality,
  });
  const assetVariant = town.assetVariant || 'pilot';
  const traitEchoVariant = town.traitEchoVariant || 'v1';
  document.documentElement.dataset.assetVariant = assetVariant;
  document.documentElement.dataset.traitEchoVariant = traitEchoVariant;
  const interactables = town.interactables || [];
  townLandmarks = town.landmarks || {};
  traitEchoes = town.traitEchoes || null;
  ambientLife = town.ambientLife || null;
  breathingGrass = town.breathingGrass || null;
  dayOneWorld = town.dayOneWorld || null;
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
  dayOneActionController = new DayOneActionController({ control: playerController });
  dayOneActionPresenter = new DayOneActionPresenter({
    getAnimator: () => playerFriendsiesAnimator,
    reducedMotion,
    onFallbackCue: (event) => dayOneWorld?.handleAction?.(event),
    onCommitCue: (event) => {
      if (event.commitResult?.applied === false) return;
      const target = event.context?.targetPosition;
      if (!target) return;
      celebrateInteraction(
        target,
        event.action?.feedbackKind || event.context?.feedbackKind || 'kindness',
      );
    },
  });
  dayOneActionUnsubscribe = dayOneActionController.subscribe((event) => {
    dayOneActionPresenter?.handle?.(event);
  });

  const stewardAnchor = CORE_HOOK_V03.anchors.steward.welcome;
  stewardActor = new StewardActor(scene, null, {
    tokenId: CORE_HOOK_V03.steward.tokenId,
    position: stewardAnchorToArray(stewardAnchor),
    facingYaw: stewardAnchor.facing,
  });

  if (storyEnabled) {
    gameSession = new GameSession({ storageKey: CORE_HOOK_V03.storageKey });
    if (params.get('story') === 'reset' || params.get('reset') === '1') gameSession.reset();
    dayOneDirector = new DayOneDirector({
      session: gameSession,
      content: DAY_ONE_V01,
      actionController: dayOneActionController,
      onPassOut: recoverPlayerAfterPassOut,
    });

    projectSessionState(gameSession.snapshot(), { animate: false });
    traitEchoUnsubscribe = gameSession.subscribe((snapshot) => {
      projectSessionState(snapshot);
    });

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
      isDayOneComplete: () => dayOneDirector?.isComplete() ?? false,
      getDayOneObjective: () => dayOneDirector?.currentObjective() || null,
      getDayOneLedgerRecord: () => dayOneDirector?.ledgerRecordFor() || null,
      getStewardPosition: () => stewardActor?.position || null,
      setStoryBlocking: handleStoryBlocking,
      onError: (error) => {
        console.error('[CoreHookDirector]', error);
        hud.setStatus('A page slipped out of the story. Please try that courtesy again.');
      },
    });
    coreHookDirector.init({ interactables, stewardInteractable });
    registerStoryInteractions([...interactables, stewardInteractable]);
  } else {
    applyAestheticPresentationState(null, { animate: false });
    stewardCastReady = true;
    stewardActor.setVisible(false);
    registerLegacyInteractions(interactables);
  }

  cacheCollisionObjects();
  bindPointerLock();
  window.addEventListener('resize', onResize);
  window.addEventListener('beforeunload', dispose, { once: true });

  setLoading(1, 'The gate is open.');
  hud.setReady?.();
  hud.setStatus('The gate is open.');

  // Keep fRiENDSiES first: the rigs stay empty while the local cast loads. A
  // code-native safety visual is constructed only after every GLTF option for
  // that role has failed, so decoder failure cannot leave the story invisible.
  void loadFriendsiesCast();

  window.thornvale = {
    scene,
    camera,
    renderer,
    environmentLighting,
    dayNightSystem,
    vfx,
    visualRig,
    characterMotor,
    playerController,
    stewardActor,
    storyUI,
    gameSession,
    coreHookDirector,
    dayOneDirector,
    dayOneActionController,
    dayOneWorld,
    storyWorld,
    worldAnimator,
    assetVariant,
    traitEchoVariant,
    traitEchoes,
    ambientLife,
    breathingGrass,
    playerFriendsiesSelection,
    hud,
  };
}

function projectSessionState(snapshot, options = {}) {
  const presentation = applyAestheticPresentationState(snapshot, options);
  applyDayOnePresentationState(snapshot);
  return presentation;
}

function applyDayOnePresentationState(snapshot) {
  try {
    dayOneWorld?.setState?.(snapshot);
  } catch (error) {
    console.warn('[DayOneWorld] Snapshot projection failed.', error);
  }

  try {
    const survival = dayOneDirector?.stateForHud?.(snapshot) || null;
    hud?.setSurvivalState?.(survival?.active ? survival : null);
    document.documentElement.dataset.dayOne = survival?.complete
      ? 'complete'
      : survival?.active
        ? 'active'
        : 'inactive';
  } catch (error) {
    console.warn('[DayOneDirector] HUD projection failed.', error);
  }
}

function applyAestheticPresentationState(snapshot, { animate = true } = {}) {
  let presentation;
  try {
    presentation = projectStoryPresentation(snapshot);
  } catch (error) {
    // The saved transaction has already succeeded. A projection regression
    // must be observable in diagnostics without escaping the subscriber.
    console.warn('[AestheticPresentation] Snapshot projection failed.', error);
    return null;
  }

  try {
    traitEchoes?.setStoryState?.(snapshot);
  } catch (error) {
    // A decorative state projection must never interrupt a saved story
    // transaction or make an otherwise valid session unplayable.
    console.warn('[FriendsiesTraitEchoes] Story-state projection failed.', error);
  }

  try {
    storyWorld?.setStoryState?.(presentation);
  } catch (error) {
    console.warn('[StoryWorld] Story-state projection failed.', error);
  }

  try {
    storyUI?.setTownStanding?.(presentation.standing, { animate });
  } catch (error) {
    console.warn('[StoryUI] Town-standing projection failed.', error);
  }

  try {
    applyStoryPresentationDatasets(document, presentation);
  } catch (error) {
    console.warn('[AestheticPresentation] DOM dataset projection failed.', error);
  }

  return presentation;
}

function registerStoryInteractions(interactables) {
  interactableSystem = new InteractableSystem(hud);

  for (const interactable of interactables) {
    const isDayOneInteraction = dayOneDirector?.handles?.(interactable.id) ?? false;
    const director = isDayOneInteraction ? dayOneDirector : coreHookDirector;
    interactable.enabled = () => (
      (interactable.id !== CORE_HOOK_V03.ids.steward || stewardCastReady)
      && (director?.isInteractableEnabled(interactable.id) ?? false)
    );
    interactable.prompt = () => director?.promptFor(interactable.id) || 'Listen closely';
    interactable.onInteract = async () => {
      const dayOneBefore = isDayOneInteraction ? gameSession?.dayOne : null;
      const authoredAction = isDayOneInteraction
        ? dayOneDirector?.actionFor?.(interactable.id, gameSession?.snapshot?.())
        : null;
      const result = await director?.interact(interactable.id, {
        targetPosition: interactable.position,
        feedbackKind: dayOneFeedbackKind(interactable.id),
      });
      if (isDayOneInteraction) {
        const dayOneAfter = gameSession?.dayOne;
        const changed = JSON.stringify(dayOneBefore) !== JSON.stringify(dayOneAfter);
        const passedOut = (dayOneAfter?.passedOutCount || 0) > (dayOneBefore?.passedOutCount || 0);
        if (changed && !passedOut && !authoredAction && typeof result === 'string' && result.trim()) {
          celebrateInteraction(interactable.position, dayOneFeedbackKind(interactable.id));
        }
        await coreHookDirector?.refreshObjective?.();
      }
      return result;
    };
    interactableSystem.register(interactable);
  }
}

function dayOneFeedbackKind(id) {
  if (id === DAY_ONE_V01.ids.fishingSpot || id === DAY_ONE_V01.ids.garden) return 'magic';
  return 'kindness';
}

function registerLegacyInteractions(interactables) {
  interactableSystem = new InteractableSystem(hud);

  for (const interactable of interactables) {
    if (interactable.id === 'ledger') {
      interactable.onInteract = () => {
        celebrateInteraction(interactable.position, 'kindness');
        return 'The Ledger warms at your touch. Kindness remembered.';
      };
    } else if (interactable.id === 'bell') {
      interactable.onInteract = () => {
        celebrateInteraction(interactable.position, 'bell');
        worldAnimator?.ringBell?.();
        return 'The Town Bell carries across the valley.';
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

function resetPlayerToArrival(position = null) {
  if (!playerController || !playerSpawnPoint) return;
  const target = position?.isVector3
    ? position.clone()
    : position
      ? new Vector3(position.x, position.y, position.z)
      : playerSpawnPoint;
  playerController.teleport(target);
  configureCameraRig(cameraRig);
  cameraRig.resetPosition();
}

function waitForRecoveryFrame(delay) {
  if (delay > 0) {
    return new Promise((resolve) => window.setTimeout(resolve, delay));
  }
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
  });
}

async function recoverPlayerAfterPassOut({ recoverySite = 'gate' } = {}) {
  const anchor = recoverySite === 'shelter'
    ? DAY_ONE_V01.anchors.campRecovery
    : playerSpawnPoint;
  const cover = hud?.elements?.lockOverlay;
  playerController?.setActionLocked?.(true);
  cover?.classList.add('is-recovering');
  try {
    if (cover) {
      await waitForRecoveryFrame(reducedMotion ? 0 : 240);
    }
    if (playerController && anchor) {
      const recoveryPoint = anchor.isVector3
        ? anchor.clone()
        : new Vector3(anchor.x, anchor.y, anchor.z);
      playerController.teleport(recoveryPoint);
    }
    configureCameraRig(cameraRig);
    cameraRig?.resetPosition?.();
  } finally {
    cover?.classList.remove('is-recovering');
    if (cover) {
      await waitForRecoveryFrame(reducedMotion ? 0 : 560);
    }
    playerController?.setActionLocked?.(false);
  }
  postProcessing?.pulse?.(0.38);
  soundscape?.playInteraction?.('magic');
}

function playAnomalyBellEffects() {
  worldAnimator?.ringBell?.();
  soundscape?.playChime?.('bell', { gain: 0.68, detune: -450 });
  const bell = CORE_HOOK_V03.anchors.interactables.bell;
  const position = new Vector3(bell.x, bell.y + 1.25, bell.z);
  vfx?.interactionBurst(position, 'magic');
  postProcessing?.pulse(reducedMotion ? 0.38 : 0.72);
}

async function ringAnomalyBell({ onReveal } = {}) {
  const shot = CORE_HOOK_V03.anchors.camera?.secondBell;
  const reveal = () => {
    onReveal?.();
    playAnomalyBellEffects();
  };
  if (reducedMotion || !shot || !cameraRig?.playFocusShot) {
    reveal();
    return;
  }

  let revealed = false;
  playerController?.setActionLocked?.(true);
  try {
    await cameraRig.playFocusShot({
      position: shot.position,
      lookAt: shot.lookAt,
      flyIn: CORE_HOOK_V03.timing.bellRevealFlyIn,
      hold: CORE_HOOK_V03.timing.bellRevealHold,
      flyOut: CORE_HOOK_V03.timing.bellRevealFlyOut,
      onReveal: () => {
        revealed = true;
        reveal();
      },
    });
  } catch (error) {
    console.warn('[CameraRig] Second-Bell reveal failed; using direct presentation.', error);
    if (!revealed) reveal();
  } finally {
    playerController?.setActionLocked?.(false);
  }
}

function applyStoryRoute(choice) {
  storyWorld?.setRoute(choice);
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
  playerFriendsiesSelection = resolvePlayerFriendsiesSelection({
    search: window.location.search,
    pathname: window.location.pathname,
  });
  const tokenId = playerFriendsiesSelection.tokenId;
  document.documentElement.dataset.requestedPlayerToken = String(tokenId);
  document.documentElement.dataset.playerTokenSelector = playerFriendsiesSelection.source;
  if (!storyBlocking) {
    hud.setStatus('Someone is coming to meet you…');
  }

  try {
    characterLoader = new CharacterLoader().init();
  } catch (error) {
    console.warn('[CharacterLoader] Model-loader initialization failed:', error);
    stewardCastReady = true;
    const recoveredCast = recoverCharacterCast(null, null);
    reportSafeCastRecovery(recoveredCast);
    if (!storyBlocking) hud.setStatus('A familiar local cast kept the gate open.');
    return;
  }

  if (window.thornvale) {
    window.thornvale.characterLoader = characterLoader;
    window.thornvale.playerFriendsiesSelection = playerFriendsiesSelection;
  }

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

  const attemptedPlayerTokens = new Set();
  const loadPlayerVisual = async (requestedId) => {
    attemptedPlayerTokens.add(requestedId);
    try {
      let visual = null;
      if (characterLoader.hasBundledCharacter(requestedId)) {
        visual = await characterLoader.loadCharacter(requestedId, { instanceId: 'player' });
      } else {
        const entry = await characterLoader.loadTokenMetadata(requestedId);
        if (entry) {
          visual = await characterLoader.loadCharacter(requestedId, { instanceId: 'player' });
        }
      }
      if (visual) applyPlayerFriendsiesVisual(visual);
      return visual;
    } catch (error) {
      console.warn(`[CharacterLoader] Player #${requestedId} failed to load:`, error);
      return null;
    }
  };

  // Lumen's slim local entry loads independently of the full collection. Try
  // both local fRiENDSiES bodies before allowing the code-native safety visual.
  const stewardVisualPromise = storyEnabled
    ? (async () => {
      for (const stewardTokenId of [
        CORE_HOOK_V03.steward.tokenId,
        DEFAULT_PLAYER_FRIENDSIES_TOKEN_ID,
      ]) {
        if (!characterLoader.hasBundledCharacter(stewardTokenId)) continue;
        try {
          const visual = await characterLoader.loadCharacter(stewardTokenId, {
            instanceId: 'steward',
          });
          if (!visual) continue;
          stewardActor?.setVisual(visual);
          document.documentElement.dataset.stewardAvatar = 'friendsies';
          if (stewardTokenId !== CORE_HOOK_V03.steward.tokenId) {
            console.warn('[CharacterLoader] Steward #8914 fell back to fRiENDSiES #6602.');
          }
          return visual;
        } catch (error) {
          console.warn(`[CharacterLoader] Steward #${stewardTokenId} failed to load:`, error);
        }
      }
      return null;
    })()
    : Promise.resolve(null);
  const stewardPromise = storyEnabled
    ? Promise.all([stewardVisualPromise, animationPackPromise])
      .then(([visual]) => visual)
      .finally(() => {
        stewardCastReady = true;
      })
    : Promise.resolve(null);

  // Generator-selected players fetch one ranged catalog entry, then assemble
  // its animation-compatible component assets without downloading all tokens.
  const [selectedPlayerVisual, clips] = await Promise.all([
    loadPlayerVisual(tokenId),
    animationPackPromise,
  ]);

  animationClips = clips;

  let playerVisual = selectedPlayerVisual;
  if (!playerVisual) {
    for (const fallbackTokenId of PLAYER_FRIENDSIES_FALLBACK_TOKEN_IDS) {
      if (attemptedPlayerTokens.has(fallbackTokenId)) continue;
      if (!characterLoader.hasBundledCharacter(fallbackTokenId)) continue;
      playerVisual = await loadPlayerVisual(fallbackTokenId);
      if (playerVisual) break;
    }
  }
  let stewardVisual = await stewardPromise;

  const recoveredCast = recoverCharacterCast(playerVisual, stewardVisual);
  playerVisual = recoveredCast.playerVisual;
  stewardVisual = recoveredCast.stewardVisual;
  reportSafeCastRecovery(recoveredCast);

  if (window.thornvale) {
    window.thornvale.characterLoader = characterLoader;
    window.thornvale.animationClips = animationClips;
    window.thornvale.playerFriendsiesAnimator = playerFriendsiesAnimator;
  }

  if (!storyBlocking) {
    if (playerVisual && stewardVisual) {
      hud.setStatus('Your place is ready.');
    } else if (stewardVisual) {
      hud.setStatus('Steward Lumen is waiting beyond the gate.');
    } else {
      hud.setStatus('Someone kept the gate open for you.');
    }
  }
}

function recoverCharacterCast(playerVisual, stewardVisual) {
  return recoverMissingCharacterVisuals({
    playerVisual,
    stewardVisual,
    storyEnabled,
    createFallback: createThornvaleSafeAvatar,
    installPlayer: applyPlayerSafeVisual,
    installSteward: (visual) => {
      stewardActor?.setVisual(visual);
      document.documentElement.dataset.stewardAvatar = 'thornvale-safe-fallback';
    },
  });
}

function reportSafeCastRecovery(recoveredCast) {
  if (recoveredCast.playerUsedSafeFallback) {
    console.warn('[CharacterLoader] Player fRiENDSiES unavailable; using the code-native safety visual.');
  }
  if (recoveredCast.stewardUsedSafeFallback) {
    console.warn('[CharacterLoader] Steward fRiENDSiES unavailable; using the code-native safety visual.');
  }
}

function createThornvaleSafeAvatar(role) {
  const visual = createKawaiiAvatar();
  visual.name = role === 'steward'
    ? 'StewardSafeFallback'
    : 'PlayerSafeFallback';
  visual.userData.thornvaleSafeFallback = true;
  visual.userData.characterRole = role;
  return visual;
}

function applyPlayerSafeVisual(playerVisual) {
  if (!playerVisual || visualRig.visual === playerVisual) return;
  playerFriendsiesAnimator?.dispose();
  playerFriendsiesAnimator = null;
  visualRig.setVisual(playerVisual, {
    autoAlign: true,
    capsuleHalfHeight: characterMotor.halfHeight,
    capsuleRadius: characterMotor.radius,
    clearance: 0.025,
  });
  playerAnimator.setMotionScale(reducedMotion ? 0.35 : 1);
  playerAnimator.captureBasePose();
  delete document.documentElement.dataset.playerToken;
  document.documentElement.dataset.playerAvatar = 'thornvale-safe-fallback';

  if (window.thornvale) {
    window.thornvale.playerFriendsiesAnimator = null;
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

  const actualTokenId = playerVisual.userData?.friendsies?.tokenId;
  if (Number.isSafeInteger(Number(actualTokenId))) {
    document.documentElement.dataset.playerToken = String(actualTokenId);
  }
  document.documentElement.dataset.playerAvatar = 'friendsies';

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
  environmentLighting?.update(dayNightSystem?.mix || 0);
  sky?.update(dt, dayNightSystem?.mix || 0);

  if (inputManager) handleGlobalInput();

  physicsWorld?.step(dt);
  physicsWorld?.syncKinematicVisuals();

  if (playerController) {
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
  dayOneActionController?.update?.(dt);
  storyWorld?.update(dt);
  dayOneWorld?.update?.(dt);

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
  if (
    cameraRig?.isFocusShotActive?.()
    && inputManager.consumeKeyPress('KeyE')
  ) {
    cameraRig.skipFocusShot();
  }

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

    hud.setStatus(night ? 'Time set to night.' : 'Time set to day.');
    hud.celebrate?.(night ? 'night' : 'day');
  }

  if (inputManager.consumeKeyPress('Backquote')) {
    debugEnabled = !debugEnabled;
    physicsWorld?.setDebugEnabled(debugEnabled);
    characterMotor?.setDebugVisible(debugEnabled);
    hud.setDebugVisible(debugEnabled);
    hud.setStatus(debugEnabled ? 'Debug overlay on.' : 'Debug overlay off.');
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
  cameraRig?.cancelFocusShot?.();
  if (cameraOcclusionTarget) {
    cameraOcclusionTarget.visible = cameraOcclusionTarget.userData
      ?.cameraAuthoredVisibility ?? true;
    cameraOcclusionTarget = null;
  }
  traitEchoUnsubscribe?.();
  traitEchoUnsubscribe = null;
  dayOneActionUnsubscribe?.();
  dayOneActionUnsubscribe = null;
  dayOneActionPresenter?.dispose?.();
  dayOneActionPresenter = null;
  dayOneActionController?.dispose?.();
  dayOneActionController = null;
  coreHookDirector?.dispose();
  dayOneDirector?.dispose();
  dayOneWorld?.dispose();
  ({
    ambientLife,
    traitEchoes,
    breathingGrass,
    worldAnimator,
  } = disposeTownPresentation({
    ambientLife,
    traitEchoes,
    breathingGrass,
    worldAnimator,
  }));
  if (window.thornvale) {
    window.thornvale.ambientLife = ambientLife;
    window.thornvale.traitEchoes = traitEchoes;
    window.thornvale.breathingGrass = breathingGrass;
    window.thornvale.worldAnimator = worldAnimator;
    window.thornvale.dayOneDirector = null;
    window.thornvale.dayOneWorld = null;
    window.thornvale.dayOneActionController = null;
    window.thornvale.environmentLighting = null;
  }
  gameSession?.dispose();
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
  environmentLighting?.dispose();
  environmentLighting = null;
  void soundscape?.dispose();
}

init().catch((error) => {
  console.error('Failed to initialize Thornvale Kawaii 2.0:', error);
  setLoading(1, 'The valley tripped over a mushroom. Please refresh.');
  hud?.setError?.(error?.message || 'Unknown initialization error');
});
