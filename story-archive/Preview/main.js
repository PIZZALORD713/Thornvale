import {
  ACESFilmicToneMapping,
  Box3,
  Clock,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';

import { getCuratedFriendsiesEntry } from '../../src/content/friendsies-cast.js';
import { CharacterLoader } from '../../src/visuals/CharacterLoader.js';
import { FriendsiesAnimator } from '../../src/visuals/FriendsiesAnimator.js';
import { loadFriendsiesAnimationPack } from '../../src/visuals/loadFriendsiesAnimationPack.js';
import { VisualRig } from '../../src/visuals/VisualRig.js';
import {
  EDITABLE_CHARACTER_FIELDS,
  readEditableCharacterFields,
  updateEditableCharacterFields,
} from '../runtime/character-card-editor.js';
import {
  CHARACTER_CARD_MODES,
  loadCharacterCards,
  resolveCharacterCard,
  validateCardAgainstCuratedEntry,
} from '../runtime/character-card.js';
import { resizePreviewRenderer } from '../runtime/preview-rendering.js';
import {
  SAFE_PREVIEW_ACTIONS,
  filterSafePreviewClips,
  getSafePreviewAction,
  validateInvocationAction,
} from '../runtime/preview-actions.js';
import {
  applyCharacterTraitInspection,
  createTraitInspectionDetail,
} from '../runtime/trait-inspection.js';

const CARD_PATHS = Object.freeze([
  new URL('../Characters/Friend 6602.md', import.meta.url).href,
]);
const PLAYER_HEIGHT = 0.9;
const STAGE_RADIUS = 1.9;
const WALK_SPEED = 0.95;
const SPRINT_SPEED = 1.65;
const JUMP_SPEED = 4.7;
const GRAVITY = 12;
const EMOTE_ACTIONS = Object.freeze([
  'joy',
  'dance',
  'day-one.plant-seed',
  'day-one.water-seed',
]);

const dom = {
  canvas: document.querySelector('#stage'),
  stageWrap: document.querySelector('#stage-wrap'),
  status: document.querySelector('#status'),
  previewTitle: document.querySelector('#preview-title'),
  modeBadge: document.querySelector('#mode-badge'),
  controlsCopy: document.querySelector('#controls-copy'),
  actionStrip: document.querySelector('#action-strip'),
  actionTemplate: document.querySelector('#action-template'),
  cardLabel: document.querySelector('#card-label'),
  cardId: document.querySelector('#card-id'),
  cardRole: document.querySelector('#card-role'),
  cardIdentity: document.querySelector('#card-identity'),
  cardRig: document.querySelector('#card-rig'),
  cardPack: document.querySelector('#card-pack'),
  traitList: document.querySelector('#trait-list'),
  traitTemplate: document.querySelector('#trait-template'),
  showFullCharacter: document.querySelector('#show-full-character'),
  traitDetail: document.querySelector('#trait-detail'),
  traitDetailTitle: document.querySelector('#trait-detail-title'),
  traitDetailValue: document.querySelector('#trait-detail-value'),
  traitDetailFormat: document.querySelector('#trait-detail-format'),
  traitDetailBinding: document.querySelector('#trait-detail-binding'),
  traitDetailAsset: document.querySelector('#trait-detail-asset'),
  traitDetailProvenance: document.querySelector('#trait-detail-provenance'),
  identityCard: document.querySelector('.identity-card'),
  chooseCardFile: document.querySelector('#choose-card-file'),
  saveCardFile: document.querySelector('#save-card-file'),
  editorFile: document.querySelector('#editor-file'),
  editorStatus: document.querySelector('#editor-status'),
  editorFields: document.querySelector('#editor-fields'),
  editorFieldTemplate: document.querySelector('#editor-field-template'),
  touchControls: document.querySelector('#touch-controls'),
  touchStick: document.querySelector('#touch-stick'),
  touchStickKnob: document.querySelector('#touch-stick-knob'),
  touchJump: document.querySelector('#touch-jump'),
  touchAction: document.querySelector('#touch-action'),
};

function setStatus(message, state = null) {
  dom.status.textContent = message;
  if (state) document.documentElement.dataset.previewState = state;
}

function parseInvocationFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') || 'play';
  if (!CHARACTER_CARD_MODES.includes(mode)) {
    throw new Error(`Unknown character mode: ${mode}`);
  }
  const invocation = {
    id: params.get('id') || 'friend:6602',
    mode,
  };
  if (params.has('action')) invocation.action = params.get('action');
  return validateInvocationAction(invocation);
}

function populateCard(card) {
  document.title = `${card.label} · ThornVale Story Archive`;
  document.documentElement.dataset.cardId = card.card_id;
  dom.cardLabel.textContent = card.label;
  dom.cardId.textContent = card.card_id;
  dom.cardRole.textContent = card.story_role;
  dom.cardIdentity.textContent = card.story_identity;
  dom.cardRig.textContent = card.rig;
  dom.cardPack.textContent = card.action_packs.join(', ');

  const traits = [
    ['Backpiece', card.trait_backpiece],
    ['Body', card.trait_body],
    ['Face', card.trait_face],
    ['Hand', card.trait_hand],
    ['Head', card.trait_head],
    ['Shoe', card.trait_shoe],
    ['Sprout', card.trait_sprout],
  ];
  dom.traitList.replaceChildren(...traits.map(([label, value]) => {
    const item = dom.traitTemplate.content.firstElementChild.cloneNode(true);
    const button = item.querySelector('.trait-button');
    button.disabled = true;
    button.querySelector('.trait-label').textContent = label;
    button.querySelector('.trait-value').textContent = value;
    return item;
  }));
}

function setEditorStatus(message, state = null) {
  dom.editorStatus.textContent = message;
  if (state) dom.editorStatus.dataset.state = state;
  else delete dom.editorStatus.dataset.state;
}

function normalizeEditorFields(fields) {
  return Object.freeze(Object.fromEntries(
    EDITABLE_CHARACTER_FIELDS.map((field) => [
      field.id,
      String(fields[field.id] ?? '').replaceAll('\r\n', '\n'),
    ]),
  ));
}

function setupCharacterCardEditor(card) {
  const session = {
    handle: null,
    baseSource: null,
    baseFields: null,
  };
  const fieldControls = new Map();

  dom.editorFields.replaceChildren(...EDITABLE_CHARACTER_FIELDS.map((field) => {
    const control = dom.editorFieldTemplate.content.firstElementChild.cloneNode(true);
    const textarea = control.querySelector('textarea');
    control.querySelector('.editor-field-heading').textContent = field.heading;
    control.querySelector('.editor-field-description').textContent = field.description;
    textarea.name = field.id;
    textarea.placeholder = 'Choose the local Obsidian card to edit this field.';
    fieldControls.set(field.id, textarea);
    return control;
  }));

  const directSaveSupported = (
    window.isSecureContext
    && typeof window.showOpenFilePicker === 'function'
  );
  if (!directSaveSupported) {
    dom.chooseCardFile.disabled = true;
    setEditorStatus(
      'Direct local-file editing is unavailable here. Open this link in desktop Chrome or Edge over HTTPS.',
      'warning',
    );
    return;
  }

  dom.chooseCardFile.addEventListener('click', async () => {
    try {
      const [handle] = await window.showOpenFilePicker({
        id: 'thornvale-story-archive-card',
        multiple: false,
        types: [{
          description: 'Obsidian Markdown character card',
          accept: {
            'text/markdown': ['.md'],
            'text/plain': ['.md'],
          },
        }],
      });
      if (!handle) return;
      const file = await handle.getFile();
      const source = await file.text();
      const fields = normalizeEditorFields(readEditableCharacterFields(source, {
        expectedCardId: card.card_id,
      }));

      session.handle = handle;
      session.baseSource = source;
      session.baseFields = fields;
      for (const field of EDITABLE_CHARACTER_FIELDS) {
        const control = fieldControls.get(field.id);
        control.value = fields[field.id];
        control.disabled = false;
      }
      dom.editorFile.textContent = file.name;
      dom.saveCardFile.disabled = false;
      setEditorStatus('Local card loaded. Review your draft, then press Save selected file.', 'ready');
    } catch (error) {
      if (error?.name === 'AbortError') {
        setEditorStatus('No file selected.');
        return;
      }
      setEditorStatus(error?.message || 'The selected file could not be opened.', 'error');
    }
  });

  dom.saveCardFile.addEventListener('click', async () => {
    if (!session.handle || !session.baseSource || !session.baseFields) return;
    dom.saveCardFile.disabled = true;
    setEditorStatus('Checking for newer Obsidian edits…');

    try {
      const latestFile = await session.handle.getFile();
      const latestSource = await latestFile.text();
      const updates = {};
      for (const field of EDITABLE_CHARACTER_FIELDS) {
        const value = fieldControls.get(field.id).value;
        if (value !== session.baseFields[field.id]) updates[field.id] = value;
      }
      if (Object.keys(updates).length === 0) {
        setEditorStatus('No character-detail changes to save.', 'ready');
        return;
      }

      const updatedSource = updateEditableCharacterFields(session.baseSource, updates, {
        expectedCardId: card.card_id,
        latestSource,
      });
      if (updatedSource === latestSource) {
        const latestFields = normalizeEditorFields(readEditableCharacterFields(latestSource, {
          expectedCardId: card.card_id,
        }));
        session.baseSource = latestSource;
        session.baseFields = latestFields;
        for (const field of EDITABLE_CHARACTER_FIELDS) {
          fieldControls.get(field.id).value = latestFields[field.id];
        }
        setEditorStatus('The local file already contains this character-detail update.', 'ready');
        return;
      }
      const writer = await session.handle.createWritable({ mode: 'exclusive' });
      try {
        await writer.write(updatedSource);
        await writer.close();
      } catch (error) {
        try {
          await writer.abort?.();
        } catch {
          // Preserve the original writer failure; abort is only cleanup.
        }
        throw error;
      }

      const verifiedSource = await (await session.handle.getFile()).text();
      if (verifiedSource !== updatedSource) {
        throw new Error('The browser could not verify the saved Markdown. Reopen the file before editing.');
      }
      const verifiedFields = normalizeEditorFields(readEditableCharacterFields(verifiedSource, {
        expectedCardId: card.card_id,
      }));
      session.baseSource = verifiedSource;
      session.baseFields = verifiedFields;
      for (const field of EDITABLE_CHARACTER_FIELDS) {
        fieldControls.get(field.id).value = verifiedFields[field.id];
      }
      setEditorStatus('Saved and verified in the selected Obsidian Markdown file.', 'ready');
    } catch (error) {
      setEditorStatus(error?.message || 'The local card could not be saved.', 'error');
    } finally {
      dom.saveCardFile.disabled = !session.handle;
    }
  });
}

function showTraitDetail(detail) {
  dom.traitDetail.hidden = false;
  dom.traitDetailTitle.textContent = detail.label;
  dom.traitDetailValue.textContent = detail.value;
  dom.traitDetailFormat.textContent = detail.format;
  dom.traitDetailBinding.textContent = detail.binding;
  dom.traitDetailAsset.textContent = detail.assetUrl;
  dom.traitDetailProvenance.textContent = detail.provenancePath;
}

function renderTraitInspector(assets, stage) {
  const details = assets.map((asset) => createTraitInspectionDetail(asset, {
    provenancePath: '/friendsies/6602/PROVENANCE.md',
  }));
  const buttons = details.map((detail) => {
    const item = dom.traitTemplate.content.firstElementChild.cloneNode(true);
    const button = item.querySelector('.trait-button');
    button.dataset.traitType = detail.traitType;
    button.querySelector('.trait-label').textContent = detail.label;
    button.querySelector('.trait-value').textContent = detail.value;
    button.addEventListener('click', () => {
      stage.setTraitInspection(detail.traitType);
      showTraitDetail(detail);
      dom.showFullCharacter.setAttribute('aria-pressed', 'false');
      dom.traitList.querySelectorAll('.trait-button').forEach((candidate) => {
        candidate.setAttribute(
          'aria-pressed',
          String(candidate.dataset.traitType === detail.traitType),
        );
      });
      setStatus(`${detail.label}: ${detail.value} · isolated 3D preview`, 'ready');
    });
    return item;
  });
  dom.traitList.replaceChildren(...buttons);
  dom.showFullCharacter.addEventListener('click', () => {
    stage.setTraitInspection(null);
    dom.traitDetail.hidden = true;
    dom.showFullCharacter.setAttribute('aria-pressed', 'true');
    dom.traitList.querySelectorAll('.trait-button').forEach((button) => {
      button.setAttribute('aria-pressed', 'false');
    });
    setStatus('Full Friend 6602 assembly · preview only', 'ready');
  });
}

async function verifyAssets(assets) {
  const failures = [];
  await Promise.all(assets.map(async (asset) => {
    try {
      const response = await fetch(asset.url, { method: 'HEAD', cache: 'no-cache' });
      if (!response.ok) failures.push(`${asset.traitType} (${response.status})`);
    } catch {
      failures.push(`${asset.traitType} (network)`);
    }
  }));
  if (failures.length > 0) {
    throw new Error(`Friend 6602 is incomplete; missing required parts: ${failures.join(', ')}`);
  }
}

function makeStageSet(scene) {
  const floor = new Mesh(
    new PlaneGeometry(36, 36),
    new MeshStandardMaterial({
      color: 0x78937b,
      roughness: 1,
      metalness: 0,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  floor.receiveShadow = true;
  scene.add(floor);
}

class PreviewInput {
  constructor({ canvas, enabled, onJump, onAction }) {
    this.canvas = canvas;
    this.enabled = enabled;
    this.onJump = onJump;
    this.onAction = onAction;
    this.keys = new Set();
    this.stick = new Vector2();
    this.lookPointer = null;
    this.lookLast = new Vector2();
    this.stickPointer = null;
    this.sprint = false;
    this.onLook = null;

    this._keyDown = (event) => {
      if (!this.enabled || event.repeat) return;
      const targetName = String(event.target?.tagName || '');
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(targetName)) return;
      if (event.code === 'Space') {
        event.preventDefault();
        this.onJump();
        return;
      }
      if (event.code === 'KeyE') {
        event.preventDefault();
        this.onAction();
        return;
      }
      const shortcut = SAFE_PREVIEW_ACTIONS.find((entry) => (
        event.key === entry.shortcut
      ));
      if (shortcut) {
        event.preventDefault();
        window.ThornvaleStoryArchive?.performAction(shortcut.id);
        return;
      }
      if ([
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
      ].includes(event.code)) {
        event.preventDefault();
      }
      this.keys.add(event.code);
      this.sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    };
    this._keyUp = (event) => {
      this.keys.delete(event.code);
      this.sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    };
    this._blur = () => {
      this.keys.clear();
      this.sprint = false;
      this.resetStick();
    };
    this._lookDown = (event) => {
      if (!this.enabled || event.target !== this.canvas) return;
      this.lookPointer = event.pointerId;
      this.lookLast.set(event.clientX, event.clientY);
      this.canvas.setPointerCapture?.(event.pointerId);
    };
    this._lookMove = (event) => {
      if (!this.enabled || event.pointerId !== this.lookPointer) return;
      const dx = event.clientX - this.lookLast.x;
      const dy = event.clientY - this.lookLast.y;
      this.lookLast.set(event.clientX, event.clientY);
      this.onLook?.(dx, dy);
    };
    this._lookUp = (event) => {
      if (event.pointerId === this.lookPointer) this.lookPointer = null;
    };
    this._stickDown = (event) => {
      if (!this.enabled || this.stickPointer !== null) return;
      this.stickPointer = event.pointerId;
      dom.touchStick.setPointerCapture?.(event.pointerId);
      this.updateStick(event);
    };
    this._stickMove = (event) => {
      if (event.pointerId === this.stickPointer) this.updateStick(event);
    };
    this._stickUp = (event) => {
      if (event.pointerId === this.stickPointer) {
        this.stickPointer = null;
        this.resetStick();
      }
    };

    document.addEventListener('keydown', this._keyDown);
    document.addEventListener('keyup', this._keyUp);
    window.addEventListener('blur', this._blur);
    canvas.addEventListener('pointerdown', this._lookDown);
    canvas.addEventListener('pointermove', this._lookMove);
    canvas.addEventListener('pointerup', this._lookUp);
    canvas.addEventListener('pointercancel', this._lookUp);
    dom.touchStick.addEventListener('pointerdown', this._stickDown);
    dom.touchStick.addEventListener('pointermove', this._stickMove);
    dom.touchStick.addEventListener('pointerup', this._stickUp);
    dom.touchStick.addEventListener('pointercancel', this._stickUp);
    dom.touchJump.addEventListener('click', onJump);
    dom.touchAction.addEventListener('click', onAction);
  }

  get movement() {
    if (!this.enabled) return new Vector2();
    const keyboardX = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight'))
      - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    const keyboardY = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp'))
      - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    const movement = new Vector2(keyboardX + this.stick.x, keyboardY + this.stick.y);
    return movement.lengthSq() > 1 ? movement.normalize() : movement;
  }

  updateStick(event) {
    const rect = dom.touchStick.getBoundingClientRect();
    const x = event.clientX - (rect.left + rect.width / 2);
    const y = event.clientY - (rect.top + rect.height / 2);
    const radius = rect.width * 0.34;
    const vector = new Vector2(x / radius, -y / radius);
    if (vector.lengthSq() > 1) vector.normalize();
    this.stick.copy(vector);
    dom.touchStickKnob.style.transform = `translate(${vector.x * radius}px, ${-vector.y * radius}px)`;
  }

  resetStick() {
    this.stick.set(0, 0);
    dom.touchStickKnob.style.transform = 'translate(0, 0)';
  }

  dispose() {
    document.removeEventListener('keydown', this._keyDown);
    document.removeEventListener('keyup', this._keyUp);
    window.removeEventListener('blur', this._blur);
    this.canvas.removeEventListener('pointerdown', this._lookDown);
    this.canvas.removeEventListener('pointermove', this._lookMove);
    this.canvas.removeEventListener('pointerup', this._lookUp);
    this.canvas.removeEventListener('pointercancel', this._lookUp);
    dom.touchStick.removeEventListener('pointerdown', this._stickDown);
    dom.touchStick.removeEventListener('pointermove', this._stickMove);
    dom.touchStick.removeEventListener('pointerup', this._stickUp);
    dom.touchStick.removeEventListener('pointercancel', this._stickUp);
    dom.touchJump.removeEventListener('click', this.onJump);
    dom.touchAction.removeEventListener('click', this.onAction);
  }
}

class PreviewStage {
  constructor({ canvas, character, clips, mode, initialAction = null }) {
    this.canvas = canvas;
    this.character = character;
    this.mode = mode;
    this.scene = new Scene();
    this.scene.background = new Color(0x86a08c);
    this.scene.fog = new Fog(0x86a08c, 8, 18);
    this.camera = new PerspectiveCamera(38, 1, 0.1, 40);
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.shadowMap.enabled = true;
    this.clock = new Clock();
    this.position = new Vector3(0, PLAYER_HEIGHT, 0);
    this.facingYaw = Math.PI;
    this.orbitYaw = 0;
    this.orbitPitch = 0.08;
    this.cameraDistance = 5.4;
    this.jumpHeight = 0;
    this.jumpVelocity = 0;
    this.grounded = true;
    this.justJumped = false;
    this.justLanded = false;
    this.demoWalkRemaining = 0;
    this.activeAction = 'idle';
    this.selectedTraitType = null;
    this.lastResize = null;
    this.emoteIndex = 0;
    this.disposed = false;

    this.scene.add(new HemisphereLight(0xfff1cb, 0x274238, 2.2));
    const key = new DirectionalLight(0xffe4a9, 3.5);
    key.position.set(3.5, 7, 4.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key);
    const rim = new DirectionalLight(0xbad9c7, 1.4);
    rim.position.set(-4, 3, -3);
    this.scene.add(rim);
    makeStageSet(this.scene);

    this.rig = new VisualRig();
    this.rig.group.name = 'story_archive_preview_rig';
    this.rig.addToScene(this.scene);
    this.rig.setVisual(character, {
      autoAlign: true,
      capsuleHalfHeight: 0.55,
      capsuleRadius: 0.35,
      clearance: 0.018,
    });
    character.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });

    this.animator = new FriendsiesAnimator(character, {
      clips,
      roles: {
        idle: 'Idle Float',
        walk: 'walk-low-arms',
        jump: 'friendsies-jump-ascent',
        fall: 'friendsies-fall',
        land: 'friendsies-land',
        joy: 'Joy-Jumper',
        dance: 'Dance_Rumba',
      },
      onMissingClip: (name) => setStatus(`Action unavailable: ${name}`),
    });

    this.input = new PreviewInput({
      canvas,
      enabled: mode === 'play',
      onJump: () => this.performAction('jump'),
      onAction: () => this.performNextAction(),
    });
    this.input.onLook = (dx, dy) => {
      this.orbitYaw -= dx * 0.006;
      this.orbitPitch = MathUtils.clamp(this.orbitPitch + dy * 0.003, -0.16, 0.34);
    };

    this._resize = () => this.resize();
    this._frame = () => this.frame();
    window.addEventListener('resize', this._resize);
    new ResizeObserver(this._resize).observe(dom.stageWrap);
    this.resize();
    this.frame();
    if (initialAction) queueMicrotask(() => this.performAction(initialAction));
  }

  performNextAction() {
    const id = EMOTE_ACTIONS[this.emoteIndex % EMOTE_ACTIONS.length];
    this.emoteIndex += 1;
    this.performAction(id);
  }

  performAction(id) {
    const action = getSafePreviewAction(id);
    if (!action) {
      setStatus(`Unknown or unavailable Friend 6602 action: ${String(id)}`, 'error');
      return false;
    }

    this.demoWalkRemaining = 0;
    let played = true;
    if (action.id === 'idle') {
      this.animator.cancelOneShot(null, { returnTo: 'idle' });
      this.animator.setMoving(false);
    } else if (action.id === 'walk') {
      this.animator.cancelOneShot(null, { returnTo: 'walk' });
      this.demoWalkRemaining = 2.4;
      this.animator.setLocomotionSpeed(WALK_SPEED);
      this.animator.setMoving(true);
    } else if (action.id === 'jump') {
      if (!this.grounded) return false;
      this.jumpVelocity = JUMP_SPEED;
      this.grounded = false;
      this.justJumped = true;
    } else {
      if (
        action.kind === 'story-one-shot'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        setStatus(`${action.label}: reduced-motion presentation cue`);
        this.setActiveAction(action.id);
        window.setTimeout(() => this.setActiveAction('idle'), 900);
        return true;
      }
      const clip = this.animator.getClip(action.clipName);
      const sourceDuration = Number(clip?.duration);
      const timeScale = action.duration && sourceDuration > 0
        ? sourceDuration / action.duration
        : 1;
      played = this.animator.playOneShot(action.clipName, {
        returnTo: 'idle',
        timeScale,
        fadeDuration: 0.12,
      });
    }

    if (played) {
      this.setActiveAction(action.id);
      setStatus(`${action.label} · preview only`);
    }
    return played;
  }

  setActiveAction(id) {
    this.activeAction = id;
    document.documentElement.dataset.activeAction = id;
    dom.actionStrip.querySelectorAll('[data-action-id]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.actionId === id));
    });
  }

  setTraitInspection(traitType) {
    const result = applyCharacterTraitInspection(this.character, traitType);
    this.selectedTraitType = result.selectedTraitType;
    document.documentElement.dataset.selectedTrait = result.selectedTraitType || 'full';
    return result;
  }

  resize() {
    this.lastResize = resizePreviewRenderer({
      renderer: this.renderer,
      camera: this.camera,
      width: dom.stageWrap.clientWidth,
      height: dom.stageWrap.clientHeight,
      devicePixelRatio: window.devicePixelRatio,
    });
  }

  getInspectionFraming() {
    if (!this.selectedTraitType) return null;
    const bounds = new Box3().makeEmpty();
    this.character.traverse((object) => {
      if ((object?.isMesh || object?.isSkinnedMesh) && object.visible) {
        bounds.expandByObject(object, true);
      }
    });
    if (bounds.isEmpty()) return null;

    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const verticalFov = MathUtils.degToRad(this.camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * this.camera.aspect);
    const verticalDistance = size.y / (2 * Math.tan(verticalFov / 2));
    const horizontalDistance = Math.max(size.x, size.z) / (2 * Math.tan(horizontalFov / 2));
    return {
      target: center,
      distance: MathUtils.clamp(
        Math.max(verticalDistance, horizontalDistance) * 1.45,
        1.15,
        5.4,
      ),
    };
  }

  frame() {
    if (this.disposed) return;
    requestAnimationFrame(this._frame);
    const dt = Math.min(this.clock.getDelta() || 0.016, 0.075);
    const movement = this.input.movement;
    const movingByInput = movement.lengthSq() > 0.001;
    const movingByDemo = this.demoWalkRemaining > 0;
    const moving = movingByInput || movingByDemo;
    const speed = this.input.sprint ? SPRINT_SPEED : WALK_SPEED;
    const move = new Vector3();

    if (movingByInput) {
      const forward = new Vector3(-Math.sin(this.orbitYaw), 0, -Math.cos(this.orbitYaw));
      const right = new Vector3(Math.cos(this.orbitYaw), 0, -Math.sin(this.orbitYaw));
      move.addScaledVector(forward, movement.y).addScaledVector(right, movement.x).normalize();
    } else if (movingByDemo) {
      this.demoWalkRemaining = Math.max(0, this.demoWalkRemaining - dt);
      move.set(Math.sin(this.facingYaw), 0, Math.cos(this.facingYaw));
      const projected = this.position.clone().addScaledVector(move, speed * dt);
      if (Math.hypot(projected.x, projected.z) > STAGE_RADIUS * 0.78) {
        this.facingYaw += Math.PI;
        move.multiplyScalar(-1);
      }
    }

    if (moving) {
      this.position.addScaledVector(move, speed * dt);
      const radius = Math.hypot(this.position.x, this.position.z);
      if (radius > STAGE_RADIUS * 0.82) {
        const scale = (STAGE_RADIUS * 0.82) / radius;
        this.position.x *= scale;
        this.position.z *= scale;
      }
      this.facingYaw = Math.atan2(move.x, move.z);
    }

    if (!this.grounded) {
      this.jumpVelocity -= GRAVITY * dt;
      this.jumpHeight += this.jumpVelocity * dt;
      if (this.jumpHeight <= 0 && this.jumpVelocity < 0) {
        this.jumpHeight = 0;
        this.jumpVelocity = 0;
        this.grounded = true;
        this.justLanded = true;
      }
    }

    const phase = this.grounded
      ? (this.justLanded ? 'landing' : 'grounded')
      : (this.jumpVelocity >= 0 ? 'rising' : 'falling');
    const horizontalSpeed = moving ? speed : 0;
    this.animator.updateLocomotion({
      phase,
      grounded: this.grounded,
      justJumped: this.justJumped,
      justLanded: this.justLanded,
      horizontalSpeed,
      velocityY: this.jumpVelocity,
      landingSpeed: this.justLanded ? JUMP_SPEED : 0,
      gravity: GRAVITY,
    }, dt);
    this.justJumped = false;
    this.justLanded = false;

    const rigPosition = this.position.clone();
    rigPosition.y = PLAYER_HEIGHT + this.jumpHeight;
    this.rig.update(dt, rigPosition, moving ? this.facingYaw : null);
    this.animator.update(dt);
    if (this.grounded && !this.animator.isPlayingOneShot) {
      this.rig.stabilizeGrounding(dt, 0, {
        clearance: 0.018,
        measuredBottomY: this.animator.getFootSoleY(),
      });
    }

    if (
      !this.animator.isPlayingOneShot
      && !moving
      && this.grounded
      && this.activeAction !== 'idle'
    ) {
      this.setActiveAction('idle');
      setStatus('Idle · preview only');
    } else if (!this.grounded && this.activeAction !== 'jump') {
      this.setActiveAction('jump');
    } else if (moving && this.activeAction !== 'walk' && !this.animator.isPlayingOneShot) {
      this.setActiveAction('walk');
    } else if (!moving && this.grounded && this.activeAction === 'walk') {
      this.setActiveAction('idle');
    }

    const inspectionFraming = this.getInspectionFraming();
    const target = inspectionFraming?.target || this.position.clone();
    if (!inspectionFraming) target.y = 1.05 + this.jumpHeight * 0.25;
    const cameraDistance = inspectionFraming?.distance || this.cameraDistance;
    const horizontalDistance = cameraDistance * Math.cos(this.orbitPitch);
    this.camera.position.set(
      target.x + Math.sin(this.orbitYaw) * horizontalDistance,
      target.y + (inspectionFraming ? 0 : 1.05) + Math.sin(this.orbitPitch) * cameraDistance,
      target.z + Math.cos(this.orbitYaw) * horizontalDistance,
    );
    this.camera.lookAt(target);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    window.removeEventListener('resize', this._resize);
    this.input.dispose();
    this.animator.dispose();
    this.rig.dispose();
    this.renderer.dispose();
  }

  getDiagnostics() {
    const bounds = new Box3().setFromObject(this.rig.group, true);
    const cameraDirection = new Vector3();
    this.camera.getWorldDirection(cameraDirection);
    return Object.freeze({
      renderCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      pixelRatio: this.renderer.getPixelRatio(),
      drawingBuffer: Object.freeze([
        this.renderer.domElement.width,
        this.renderer.domElement.height,
      ]),
      characterVisible: Boolean(this.rig.visual?.visible),
      selectedTraitType: this.selectedTraitType,
      rigPosition: Object.freeze(this.rig.group.position.toArray()),
      cameraPosition: Object.freeze(this.camera.position.toArray()),
      cameraDirection: Object.freeze(cameraDirection.toArray()),
      visualBounds: Object.freeze({
        min: Object.freeze(bounds.min.toArray()),
        max: Object.freeze(bounds.max.toArray()),
      }),
    });
  }
}

function renderActionButtons(enabled, performAction) {
  dom.actionStrip.replaceChildren(...SAFE_PREVIEW_ACTIONS.map((action) => {
    const button = dom.actionTemplate.content.firstElementChild.cloneNode(true);
    button.dataset.actionId = action.id;
    button.disabled = !enabled;
    button.setAttribute('aria-pressed', 'false');
    button.querySelector('.action-label').textContent = action.label;
    button.querySelector('.action-shortcut').textContent = action.shortcut;
    button.addEventListener('click', () => performAction(action.id));
    return button;
  }));
}

async function boot() {
  try {
    const invocation = parseInvocationFromLocation();
    document.documentElement.dataset.previewMode = invocation.mode;
    dom.modeBadge.textContent = `${invocation.mode} mode`;
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) {
      const label = document.createElement('strong');
      label.textContent = 'Touch pilot:';
      dom.controlsCopy.replaceChildren(
        label,
        document.createTextNode(' left pad move · drag to look · Jump · Action cycles safe motions'),
      );
    }

    const cards = await loadCharacterCards(CARD_PATHS);
    const { card } = resolveCharacterCard(cards, invocation);
    populateCard(card);
    setupCharacterCardEditor(card);

    if (invocation.mode === 'card') {
      dom.stageWrap.hidden = true;
      dom.actionStrip.hidden = true;
      dom.showFullCharacter.disabled = true;
      dom.controlsCopy.textContent = 'Card mode · metadata only';
      setStatus('Character card verified', 'ready');
      return;
    }

    setStatus('Verifying seven curated character parts…');
    const castEntry = getCuratedFriendsiesEntry(card.token_id);
    const assets = validateCardAgainstCuratedEntry(card, castEntry);
    await verifyAssets(assets);

    setStatus('Assembling Friend 6602…');
    const loader = new CharacterLoader().init();
    const [character, loadedClips] = await Promise.all([
      loader.loadCharacter(card.token_id, { instanceId: 'preview' }),
      loadFriendsiesAnimationPack(),
    ]);
    if (!character || Number(character.userData?.friendsies?.tokenId) !== card.token_id) {
      throw new Error('Friend 6602 assembly failed; no fallback character was substituted.');
    }

    const safeClips = filterSafePreviewClips(loadedClips);
    const stage = new PreviewStage({
      canvas: dom.canvas,
      character,
      clips: safeClips,
      mode: invocation.mode,
      initialAction: invocation.action || null,
    });
    renderTraitInspector(assets, stage);
    renderActionButtons(invocation.mode === 'play', (id) => stage.performAction(id));
    if (invocation.mode !== 'play') {
      dom.touchControls.hidden = true;
      dom.controlsCopy.textContent = 'Preview mode · idle rendering only';
    }

    window.ThornvaleStoryArchive = Object.freeze({
      card: Object.freeze({ ...card }),
      mode: invocation.mode,
      safeActionIds: Object.freeze(SAFE_PREVIEW_ACTIONS.map((action) => action.id)),
      performAction: (id) => (
        invocation.mode === 'play' ? stage.performAction(id) : false
      ),
      selectTrait: (traitType) => stage.setTraitInspection(traitType),
      getState: () => Object.freeze({
        cardId: card.card_id,
        mode: invocation.mode,
        activeAction: stage.activeAction,
        selectedTraitType: stage.selectedTraitType,
        position: Object.freeze(stage.position.toArray()),
        writesAuthoritativeState: false,
        diagnostics: stage.getDiagnostics(),
      }),
    });

    stage.setActiveAction('idle');
    setStatus(
      invocation.mode === 'play'
        ? 'Ready · keyboard and touch input pilot'
        : 'Ready · idle preview',
      'ready',
    );
    dom.canvas.focus({ preventScroll: true });
  } catch (error) {
    console.error('[StoryArchivePreview]', error);
    document.title = 'Character preview unavailable · ThornVale Story Archive';
    dom.previewTitle.textContent = 'Character preview unavailable';
    dom.canvas.setAttribute('aria-label', 'Unavailable character preview');
    dom.actionStrip.setAttribute('aria-label', 'Unavailable character actions');
    dom.controlsCopy.textContent = 'No controls are available for an unresolved character card.';
    dom.modeBadge.textContent = 'error';
    dom.touchControls.hidden = true;
    dom.identityCard.hidden = true;
    renderActionButtons(false, () => false);
    setStatus(error?.message || 'Character preview failed.', 'error');
    document.documentElement.dataset.previewError = error?.code || 'preview-failed';
  }
}

boot();
