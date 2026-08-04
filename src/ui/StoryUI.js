import {
  MAX_PLAYER_NAME_LENGTH,
  normalizePlayerName,
} from '../game/GameSession.js';

const REQUIRED_IDS = [
  'storyObjective',
  'storyObjectiveLabel',
  'storyObjectiveText',
  'storyLayer',
  'storyCard',
  'storyPortrait',
  'storyPortraitText',
  'storyEyebrow',
  'storyTitle',
  'storyBody',
  'storyDetail',
  'storySignaturePanel',
  'storySignatureInput',
  'storySignatureError',
  'storySignatureDisplay',
  'storySignatureText',
  'storyChoices',
  'storyAction',
  'storyActionLabel',
  'storyKeyHint',
];

function asOptions(value, fallbackKey = 'body') {
  if (value && typeof value === 'object' && !Array.isArray(value)) return { ...value };
  return value === undefined || value === null ? {} : { [fallbackKey]: String(value) };
}

function asText(value) {
  if (Array.isArray(value)) return value.map((entry) => String(entry ?? '')).join('\n\n');
  return String(value ?? '');
}

function asDialogueBeatText(beat) {
  if (beat && typeof beat === 'object' && !Array.isArray(beat)) {
    return asText(beat.text ?? beat.body ?? beat.message ?? '');
  }
  return asText(beat);
}

function normalizeObjectCue(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const label = typeof value.label === 'string' ? value.label.trim() : '';
  const src = typeof value.src === 'string' ? value.src.trim() : '';
  return id && label && src ? { id, label, src } : null;
}

function dialogueBeatCue(beat) {
  if (!beat || typeof beat !== 'object' || Array.isArray(beat)) return null;
  return normalizeObjectCue(beat.cue);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function datasetKey(value, fallback = 'known') {
  const key = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return key || fallback;
}

export function normalizeStoryPortrait(value, speaker = '') {
  const raw = asText(value).trim();
  if (/steward\s+lumen/i.test(asText(speaker)) || /^#?8914$/i.test(raw)) return 'L';
  if (raw) return raw;
  const initial = asText(speaker).trim().match(/[A-Za-z]/)?.[0];
  return initial?.toUpperCase() || 'T';
}

/**
 * Accessible story presentation for the Core Hook Proof.
 *
 * Modal methods return promises, allowing authored beats to read naturally:
 *
 *   await story.say({ speaker: 'Steward 8914', text: 'Welcome, neighbor.' });
 *   const answer = await story.choose({ choices: [...] });
 *
 * The class deliberately owns presentation only. Callers pause the controller,
 * release pointer lock, and advance game state through `onBlockingChange` and
 * the resolved promise values.
 */
export class StoryUI {
  constructor({ onBlockingChange = null, documentRef = globalThis.document } = {}) {
    this.document = documentRef || null;
    this.onBlockingChange = onBlockingChange;
    this.elements = {};
    this.initialized = false;

    this._blocking = false;
    this._kind = null;
    this._pendingResolve = null;
    this._actionCallback = null;
    this._actionValue = 'continue';
    this._actionBusy = false;
    this._choiceButtons = [];
    this._previousFocus = null;
    this._inertStates = new Map();
    this._townStanding = null;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onActionClick = this._onActionClick.bind(this);
    this._onSignatureInput = this._onSignatureInput.bind(this);
    this._onObjectiveCueError = this._onObjectiveCueError.bind(this);
    this._onBeatCueError = this._onBeatCueError.bind(this);
    this._onPointerLockSettled = this._onPointerLockSettled.bind(this);
    this._onFocusOut = this._onFocusOut.bind(this);
  }

  init() {
    if (this.initialized) return this;
    if (!this.document) throw new Error('[StoryUI] A document is required.');

    for (const id of REQUIRED_IDS) {
      const element = this.document.getElementById(id);
      if (!element) throw new Error(`[StoryUI] Missing required #${id} element.`);
      this.elements[id] = element;
    }

    this.elements.kindness = this.document.getElementById('kindnessCounter');
    this.elements.kindnessLabel = this.document.querySelector('#kindnessCounter .kindness-label');
    this.elements.kindnessValue = this.document.querySelector('#kindnessCounter .kindness-value');
    this.elements.objectiveAnnouncement = this.document.getElementById('storyObjectiveAnnouncement');
    this.elements.storyObjectiveCueImage = this.document.getElementById('storyObjectiveCueImage');
    this.elements.storyBeatCue = this.document.getElementById('storyBeatCue');
    this.elements.storyBeatCueImage = this.document.getElementById('storyBeatCueImage');
    this.elements.storyBeatCueLabel = this.document.getElementById('storyBeatCueLabel');

    this.elements.storyLayer.inert = true;
    this.elements.storyLayer.setAttribute('aria-hidden', 'true');
    this.elements.storyObjective.setAttribute('aria-hidden', 'true');
    this.elements.storyAction.addEventListener('click', this._onActionClick);
    this.elements.storySignatureInput.addEventListener('input', this._onSignatureInput);
    this.elements.storyObjectiveCueImage?.addEventListener('error', this._onObjectiveCueError);
    this.elements.storyBeatCueImage?.addEventListener('error', this._onBeatCueError);
    this.document.addEventListener('keydown', this._onKeyDown, true);
    this.document.addEventListener('pointerlockchange', this._onPointerLockSettled, true);
    this.document.addEventListener('pointerlockerror', this._onPointerLockSettled, true);
    this.document.addEventListener('focusout', this._onFocusOut, true);

    this._clearObjectiveCue();
    this._clearBeatCue();

    this.initialized = true;
    return this;
  }

  setObjective(textOrOptions, options = {}) {
    this._ensureInit();
    const config = typeof textOrOptions === 'object' && textOrOptions !== null
      ? { ...textOrOptions }
      : { ...options, text: textOrOptions };
    const text = asText(config.text ?? config.objective).trim();
    if (!text) return this.clearObjective();

    this.elements.storyObjectiveLabel.textContent = asText(
      config.label ?? config.eyebrow ?? 'A little next step',
    );
    this.elements.storyObjectiveText.textContent = text;
    this._setObjectiveCue(config.cue);
    this.elements.storyObjective.setAttribute('aria-label', `${this.elements.storyObjectiveLabel.textContent}: ${text}`);
    this.elements.storyObjective.setAttribute('aria-hidden', 'false');
    this.elements.storyObjective.classList.add('is-visible');
    this._restartAnimation(this.elements.storyObjective, 'is-updating');
    if (this.elements.objectiveAnnouncement) {
      this.elements.objectiveAnnouncement.textContent = '';
      globalThis.setTimeout?.(() => {
        if (this.elements.objectiveAnnouncement) {
          this.elements.objectiveAnnouncement.textContent = `${this.elements.storyObjectiveLabel.textContent}: ${text}`;
        }
      }, 0);
    }
    return this;
  }

  clearObjective() {
    this._ensureInit();
    this.elements.storyObjective.classList.remove('is-visible', 'is-updating');
    this.elements.storyObjective.setAttribute('aria-hidden', 'true');
    this._clearObjectiveCue();
    if (this.elements.objectiveAnnouncement) this.elements.objectiveAnnouncement.textContent = '';
    return this;
  }

  showLetter(value = {}) {
    const config = asOptions(value);
    return this._present({
      kind: 'letter',
      tone: config.tone ?? 'warm',
      portrait: config.portrait ?? 'I',
      eyebrow: config.eyebrow ?? 'A letter in your handwriting',
      title: config.title ?? 'Before the lanterns bloom',
      body: config.body ?? config.text ?? config.message ?? '',
      detail: config.detail ?? config.note ?? 'You do not remember writing it.',
      actionLabel: config.actionLabel ?? config.continueLabel ?? 'Fold the letter',
      actionValue: config.actionValue ?? 'continue',
      keyHint: config.keyHint ?? 'Continue with',
      key: config.key ?? 'Enter',
    });
  }

  say(speakerOrOptions = {}, text, options = {}) {
    let config;
    if (speakerOrOptions && typeof speakerOrOptions === 'object' && !Array.isArray(speakerOrOptions)) {
      config = { ...speakerOrOptions };
    } else {
      config = { ...options, speaker: speakerOrOptions, text };
    }

    const speaker = asText(config.speaker ?? config.title ?? 'Steward Lumen');
    const fallbackBeat = config.body ?? config.text ?? config.message ?? '';
    const beats = Array.isArray(config.beats) && config.beats.length > 0
      ? config.beats.slice()
      : [fallbackBeat];
    const finalActionLabel = config.actionLabel ?? config.continueLabel ?? 'Continue';
    const nextActionLabel = config.nextLabel ?? 'Next';
    const finalKeyHint = config.keyHint ?? 'Continue with';
    const nextKeyHint = config.nextKeyHint ?? `${asText(nextActionLabel).trim() || 'Next'} with`;
    const actionKey = config.key ?? 'Enter';
    const onBeatChange = typeof config.onBeatChange === 'function' ? config.onBeatChange : null;
    let beatIndex = 0;

    const notifyBeatChange = () => {
      if (!onBeatChange) return;
      try {
        onBeatChange(beats[beatIndex], beatIndex, { total: beats.length });
      } catch (error) {
        console.error('[StoryUI] onBeatChange callback failed.', error);
      }
    };

    const promise = this._present({
      kind: 'dialogue',
      tone: config.tone ?? 'steward',
      portrait: normalizeStoryPortrait(config.portrait ?? config.token, speaker),
      eyebrow: config.eyebrow ?? 'A neighbor speaks',
      title: speaker,
      body: asDialogueBeatText(beats[beatIndex]),
      cue: dialogueBeatCue(beats[beatIndex]),
      detail: config.detail ?? config.note,
      actionLabel: beats.length > 1 ? nextActionLabel : finalActionLabel,
      actionValue: config.actionValue ?? 'continue',
      keyHint: beats.length > 1 ? nextKeyHint : finalKeyHint,
      key: actionKey,
    });

    this._actionCallback = () => {
      if (beatIndex >= beats.length - 1) {
        this._finish(this._actionValue);
        return;
      }

      beatIndex += 1;
      this.elements.storyBody.textContent = asDialogueBeatText(beats[beatIndex]);
      this._setBeatCue(dialogueBeatCue(beats[beatIndex]));
      this.elements.storyActionLabel.textContent = beatIndex === beats.length - 1
        ? asText(finalActionLabel)
        : asText(nextActionLabel);
      this._setKeyHint(
        beatIndex === beats.length - 1 ? finalKeyHint : nextKeyHint,
        actionKey,
      );
      notifyBeatChange();
    };

    notifyBeatChange();
    return promise;
  }

  showRecord(value = {}) {
    const config = asOptions(value);
    const promise = this._present({
      kind: 'record',
      tone: config.tone ?? 'ledger',
      portrait: config.portrait ?? 'L',
      eyebrow: config.eyebrow ?? 'The Community Ledger',
      title: config.title ?? 'Today’s record',
      body: config.entry ?? config.body ?? config.text ?? config.record ?? '',
      detail: config.detail ?? config.note ?? 'The ink is already dry.',
      actionLabel: config.actionLabel ?? config.continueLabel ?? 'Close the ledger',
      actionValue: config.actionValue ?? 'continue',
      keyHint: config.keyHint ?? 'Continue with',
      key: config.key ?? 'Enter',
    });

    const signature = asText(config.signature).trim();
    if (signature) {
      this.elements.storySignatureDisplay.hidden = false;
      this.elements.storySignatureDisplay.dataset.altered = String(Boolean(config.altered));
      this.elements.storySignatureDisplay.querySelector('.story-signature-caption').textContent = asText(
        config.signatureLabel ?? 'Signed in your hand',
      );
      this.elements.storySignatureText.textContent = signature;
    }
    return promise;
  }

  signRecord(value = {}) {
    const config = asOptions(value);
    const promise = this._present({
      kind: 'signature',
      tone: config.tone ?? 'ledger',
      portrait: config.portrait ?? 'L',
      eyebrow: config.eyebrow ?? 'The Community Ledger',
      title: config.title ?? 'New arrivals',
      body: config.entry ?? config.body ?? config.text ?? '',
      detail: config.detail ?? config.annotation,
      actionLabel: config.actionLabel ?? 'Sign the ledger',
      actionValue: 'sign',
      keyHint: config.keyHint ?? 'Sign with',
      key: config.key ?? 'Enter',
    });

    const input = this.elements.storySignatureInput;
    input.maxLength = MAX_PLAYER_NAME_LENGTH;
    input.value = normalizePlayerName(config.initialValue ?? '');
    input.placeholder = asText(config.placeholder ?? 'Your name');
    input.setAttribute('aria-label', asText(config.inputLabel ?? 'Sign your name on the line'));
    this.elements.storySignaturePanel.hidden = false;
    this.elements.storySignaturePanel.querySelector('.story-signature-label').textContent = asText(
      config.inputLabel ?? 'Sign your name on the line',
    );
    this._onSignatureInput();

    this._actionCallback = () => {
      const playerName = normalizePlayerName(input.value);
      if (!playerName) {
        input.setAttribute('aria-invalid', 'true');
        this.elements.storySignaturePanel.classList.add('has-error');
        this.elements.storySignatureError.textContent = 'Write your name before signing the ledger.';
        input.focus({ preventScroll: true });
        return;
      }

      input.value = playerName;
      this._finish(playerName);
    };

    this._focusInitialControl();
    return promise;
  }

  choose(value = {}, options = {}) {
    const config = Array.isArray(value)
      ? { ...options, choices: value }
      : asOptions(value);
    const choices = Array.isArray(config.choices) ? config.choices.slice(0, 3) : [];
    if (choices.length < 2 || choices.length > 3) {
      return Promise.reject(new Error('[StoryUI] choose() requires two or three choices.'));
    }

    const promise = this._present({
      kind: 'choice',
      tone: config.tone ?? 'decision',
      portrait: normalizeStoryPortrait(config.portrait ?? config.token ?? 'L', 'Steward Lumen'),
      eyebrow: config.eyebrow ?? 'The town is listening',
      title: config.title ?? config.speaker ?? 'What will you remember?',
      body: config.body ?? config.text ?? config.message ?? '',
      detail: config.detail ?? config.note,
      actionLabel: null,
      keyHint: config.keyHint ?? 'Choose with',
      key: config.key ?? choices.map((_choice, index) => index + 1).join(' / '),
    });

    this._renderChoices(choices);
    this.elements.storyAction.hidden = true;
    this.elements.storyChoices.hidden = false;
    this._focusInitialControl();
    return promise;
  }

  showEnding(value = {}) {
    const config = asOptions(value);
    const onReset = typeof config.onReset === 'function' ? config.onReset : null;
    const tone = config.tone === 'alter' || config.ending === 'escape' ? 'alter' : 'comply';

    const promise = this._present({
      kind: 'ending',
      tone,
      portrait: config.portrait ?? 'T',
      eyebrow: config.eyebrow ?? (tone === 'alter' ? 'For tonight' : 'The town remembers'),
      title: config.title ?? (tone === 'alter' ? 'Your memory is yours' : 'Welcome home'),
      body: config.body ?? config.text ?? config.message ?? '',
      detail: config.detail ?? config.quote ?? config.note,
      actionLabel: config.actionLabel ?? config.resetLabel ?? 'Try the other memory',
      actionValue: 'reset',
      keyHint: config.keyHint ?? 'Begin again with',
      key: config.key ?? 'Enter',
    });

    this._actionCallback = async () => {
      if (this._actionBusy) return;
      this._actionBusy = true;
      this.elements.storyAction.disabled = true;
      const previousLabel = this.elements.storyActionLabel.textContent;
      this.elements.storyActionLabel.textContent = config.busyLabel ?? 'Turning back time…';

      try {
        await onReset?.();
        this._finish('reset');
      } catch (error) {
        console.error('[StoryUI] Reset callback failed.', error);
        this.elements.storyActionLabel.textContent = previousLabel;
        this.elements.storyAction.disabled = false;
        this._actionBusy = false;
      }
    };

    return promise;
  }

  setTownStanding(value, { animate = true } = {}) {
    this._ensureInit();
    const counter = this.elements.kindness;
    if (!counter) return this;

    const config = typeof value === 'string'
      ? { key: datasetKey(value), label: value }
      : value;
    const standingLabel = asText(config?.label ?? config?.standingLabel).trim();
    if (!standingLabel) {
      this._townStanding = null;
      counter.classList.add('hidden');
      counter.setAttribute('aria-hidden', 'true');
      return this;
    }

    const standingKey = datasetKey(config?.key ?? config?.standingKey ?? standingLabel);
    const tier = ['home', 'in-good-standing'].includes(standingKey)
      ? 'warm'
      : ['being-worried-over', 'differently'].includes(standingKey)
        ? 'watched'
        : 'known';
    this._townStanding = { key: standingKey, label: standingLabel };
    if (this.elements.kindnessLabel) {
      this.elements.kindnessLabel.textContent = 'THORNVALE REMEMBERS';
    }
    if (this.elements.kindnessValue) this.elements.kindnessValue.textContent = standingLabel;
    counter.dataset.tier = tier;
    counter.dataset.standing = standingKey;
    counter.setAttribute('aria-label', `Thornvale remembers: ${standingLabel}`);
    counter.setAttribute('aria-hidden', 'false');
    counter.classList.remove('hidden');
    if (animate) this._restartAnimation(counter, 'is-changing');
    return this;
  }

  /**
   * Compatibility adapter for the authoritative internal score. The number is
   * intentionally never rendered or announced; presentation state supplies a
   * more legible, diegetic remembrance phrase whenever it is available.
   */
  setNeighborliness(value, { animate = true } = {}) {
    this._ensureInit();
    const counter = this.elements.kindness;
    if (!counter) return this;

    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return this.setTownStanding(null, { animate: false });
    }

    if (this._townStanding) {
      if (animate) this._restartAnimation(counter, 'is-changing');
      return this;
    }

    const score = Math.round(clamp(value, 0, 100));
    const standing = score >= 70
      ? { key: 'in-good-standing', label: 'In good standing' }
      : score <= 35
        ? { key: 'being-worried-over', label: 'Being worried over' }
        : { key: 'kindly-met', label: 'Kindly met' };
    return this.setTownStanding(standing, { animate });
  }

  isBlocking() {
    return this._blocking;
  }

  dispose() {
    if (!this.initialized) return;

    this.document.removeEventListener('keydown', this._onKeyDown, true);
    this.document.removeEventListener('pointerlockchange', this._onPointerLockSettled, true);
    this.document.removeEventListener('pointerlockerror', this._onPointerLockSettled, true);
    this.document.removeEventListener('focusout', this._onFocusOut, true);
    this.elements.storyAction.removeEventListener('click', this._onActionClick);
    this.elements.storySignatureInput.removeEventListener('input', this._onSignatureInput);
    this.elements.storyObjectiveCueImage?.removeEventListener('error', this._onObjectiveCueError);
    this.elements.storyBeatCueImage?.removeEventListener('error', this._onBeatCueError);
    this._resolvePending(null);
    this._hideModal();
    this.clearObjective();
    this._choiceButtons.length = 0;
    this._actionCallback = null;
    this.initialized = false;
  }

  _present(config) {
    this._ensureInit();
    this._resolvePending(null);
    this._kind = config.kind;
    this._actionCallback = null;
    this._actionValue = config.actionValue ?? 'continue';
    this._actionBusy = false;
    this._choiceButtons.length = 0;

    const card = this.elements.storyCard;
    card.dataset.kind = config.kind;
    card.dataset.tone = config.tone ?? 'neutral';
    this.elements.storyPortraitText.textContent = asText(config.portrait ?? 'T');
    this.elements.storyEyebrow.textContent = asText(config.eyebrow);
    this.elements.storyTitle.textContent = asText(config.title);
    this.elements.storyBody.textContent = asText(config.body);
    this._setBeatCue(config.kind === 'dialogue' ? config.cue : null);
    this._resetSignaturePresentation();

    const detail = asText(config.detail).trim();
    this.elements.storyDetail.textContent = detail;
    this.elements.storyDetail.hidden = !detail;
    this.elements.storyChoices.replaceChildren();
    this.elements.storyChoices.hidden = true;
    this.elements.storyAction.hidden = !config.actionLabel;
    this.elements.storyAction.disabled = false;
    this.elements.storyActionLabel.textContent = asText(config.actionLabel ?? 'Continue');
    this._setKeyHint(config.keyHint ?? 'Continue with', config.key ?? 'Enter');

    if (!this._blocking) {
      const active = this.document.activeElement;
      this._previousFocus = active && !this.elements.storyLayer.contains(active) ? active : null;
      this._setBlocking(true);
      // Mark the modal as authoritative before inerting the currently focused
      // welcome/game surface. Its resulting focusout must be contained.
      this._setBackgroundInert(true);
    }

    this.elements.storyLayer.inert = false;
    this.elements.storyLayer.setAttribute('aria-hidden', 'false');
    this.elements.storyLayer.classList.add('is-visible');

    const promise = new Promise((resolve) => {
      this._pendingResolve = resolve;
    });

    this._focusInitialControl();
    return promise;
  }

  _renderChoices(choices) {
    const fragment = this.document.createDocumentFragment();
    this._choiceButtons.length = 0;
    this.elements.storyChoices.dataset.count = String(choices.length);

    choices.forEach((choice, index) => {
      const normalized = typeof choice === 'string'
        ? { id: choice, label: choice }
        : { ...choice };
      const id = normalized.id ?? normalized.value ?? String(index + 1);

      const button = this.document.createElement('button');
      button.type = 'button';
      button.className = 'story-choice';
      button.dataset.choiceId = String(id);
      const choiceLabel = asText(normalized.label ?? normalized.title ?? id);

      const key = this.document.createElement('span');
      key.className = 'story-choice-key';
      key.setAttribute('aria-hidden', 'true');
      key.textContent = String(index + 1);

      const copy = this.document.createElement('span');
      copy.className = 'story-choice-copy';

      const label = this.document.createElement('strong');
      label.className = 'story-choice-label';
      label.textContent = choiceLabel;
      copy.append(label);

      const descriptionText = asText(normalized.description ?? normalized.detail).trim();
      button.setAttribute(
        'aria-label',
        `${index + 1}. ${choiceLabel}${descriptionText ? `. ${descriptionText}` : ''}`,
      );
      if (descriptionText) {
        const description = this.document.createElement('span');
        description.className = 'story-choice-description';
        description.textContent = descriptionText;
        copy.append(description);
      }

      const arrow = this.document.createElement('span');
      arrow.className = 'story-choice-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '→';

      button.append(key, copy, arrow);
      button.addEventListener('click', () => this._finish(id), { once: true });
      fragment.append(button);
      this._choiceButtons.push(button);
    });

    this.elements.storyChoices.replaceChildren(fragment);
  }

  _onActionClick() {
    if (!this._blocking || this.elements.storyAction.disabled) return;
    if (this._actionCallback) {
      void this._actionCallback();
      return;
    }
    this._finish(this._actionValue);
  }

  _onSignatureInput() {
    const input = this.elements.storySignatureInput;
    const hasInk = Boolean(normalizePlayerName(input.value));
    this.elements.storySignaturePanel.classList.toggle('has-ink', hasInk);
    if (hasInk) {
      input.setAttribute('aria-invalid', 'false');
      this.elements.storySignaturePanel.classList.remove('has-error');
      this.elements.storySignatureError.textContent = '';
    }
  }

  _onPointerLockSettled() {
    // A completed or denied pointer-lock request may move focus back to the
    // canvas or document after the modal's first focus frame. Reassert focus
    // from the lifecycle event so the visible dialog remains the keyboard owner.
    if (this._blocking) this._focusInitialControl();
  }

  _onFocusOut(event) {
    if (!this._blocking) return;
    const next = event?.relatedTarget;
    if (next && this.elements.storyLayer.contains(next)) return;

    // Pointer-lock settlement can move focus to BODY after its own lifecycle
    // event has fired. Reassert on the following frame so the modal remains the
    // keyboard owner without relying on an arbitrary timeout.
    this._focusInitialControl();
  }

  _onKeyDown(event) {
    if (!this._blocking || event.defaultPrevented) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const target = event.target;
    const tagName = target?.tagName;

    if (event.key === 'Tab') {
      this._trapFocus(event);
      return;
    }

    if (target === this.elements.storySignatureInput && event.key === 'Enter') {
      event.preventDefault();
      this.elements.storyAction.click();
      return;
    }

    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return;

    if (!this.elements.storyChoices.hidden && (event.code === 'Digit1' || event.code === 'Numpad1')) {
      event.preventDefault();
      this._choiceButtons[0]?.click();
      return;
    }
    if (!this.elements.storyChoices.hidden && (event.code === 'Digit2' || event.code === 'Numpad2')) {
      event.preventDefault();
      this._choiceButtons[1]?.click();
      return;
    }
    if (!this.elements.storyChoices.hidden && (event.code === 'Digit3' || event.code === 'Numpad3')) {
      event.preventDefault();
      this._choiceButtons[2]?.click();
      return;
    }

    if ((event.key === 'Enter' || event.key === ' ') && !target?.closest?.('button')) {
      event.preventDefault();
      // An irreversible choice must be deliberate: use a numbered option, or Tab to a
      // choice and activate that focused button. Enter-mashing cannot silently
      // select the first (comply) option.
      if (this.elements.storyChoices.hidden && !this.elements.storyAction.hidden) {
        this.elements.storyAction.click();
      }
    }
  }

  _trapFocus(event) {
    const focusable = this._getFocusable();
    if (focusable.length === 0) {
      event.preventDefault();
      this.elements.storyCard.focus({ preventScroll: true });
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = this.document.activeElement;

    if (event.shiftKey && (active === first || !this.elements.storyCard.contains(active))) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && (active === last || !this.elements.storyCard.contains(active))) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  _getFocusable() {
    return Array.from(this.elements.storyCard.querySelectorAll(
      'button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden]), textarea:not([disabled]):not([hidden]), select:not([disabled]):not([hidden])',
    ))
      .filter((element) => element.offsetParent !== null);
  }

  _focusInitialControl() {
    const focusTarget = (retriesRemaining) => {
      if (!this._blocking) return;
      const target = !this.elements.storySignaturePanel.hidden
        ? this.elements.storySignatureInput
        : (!this.elements.storyChoices.hidden
            ? this.elements.storyCard
            : (!this.elements.storyAction.hidden ? this.elements.storyAction : this.elements.storyCard));
      target?.focus?.({ preventScroll: true });
      if (
        target
        && this.document.activeElement !== target
        && retriesRemaining > 0
      ) {
        // Chromium may reject focus throughout the pointer-lock settlement
        // frame. Retry on at most two subsequent frames until the modal owns
        // focus; this is bounded and keyed to the invariant, not a time delay.
        globalThis.requestAnimationFrame?.(() => focusTarget(retriesRemaining - 1));
      }
    };

    globalThis.requestAnimationFrame?.(() => focusTarget(2));
  }

  _resetSignaturePresentation() {
    this.elements.storySignaturePanel.hidden = true;
    this.elements.storySignaturePanel.classList.remove('has-ink', 'has-error');
    this.elements.storySignatureInput.value = '';
    this.elements.storySignatureInput.setAttribute('aria-invalid', 'false');
    this.elements.storySignatureError.textContent = '';
    this.elements.storySignatureDisplay.hidden = true;
    this.elements.storySignatureDisplay.removeAttribute('data-altered');
    this.elements.storySignatureText.textContent = '';
  }

  _setObjectiveCue(value) {
    const cue = normalizeObjectCue(value);
    this._clearObjectiveCue();
    if (!cue) return;

    const image = this.elements.storyObjectiveCueImage;
    if (!image) return;
    image.dataset.cueId = cue.id;
    image.setAttribute('src', cue.src);
    image.hidden = false;
    image.parentElement?.classList.add('has-object-cue');
  }

  _clearObjectiveCue() {
    const image = this.elements.storyObjectiveCueImage;
    if (!image) return;
    image.hidden = true;
    image.removeAttribute('src');
    delete image.dataset.cueId;
    image.parentElement?.classList.remove('has-object-cue');
  }

  _setBeatCue(value) {
    const cue = normalizeObjectCue(value);
    this._clearBeatCue();
    if (!cue) return;

    const chip = this.elements.storyBeatCue;
    const image = this.elements.storyBeatCueImage;
    const label = this.elements.storyBeatCueLabel;
    if (!chip || !image || !label) return;
    chip.dataset.cueId = cue.id;
    image.dataset.cueId = cue.id;
    image.setAttribute('src', cue.src);
    label.textContent = cue.label;
    image.hidden = false;
    chip.hidden = false;
  }

  _clearBeatCue() {
    const chip = this.elements.storyBeatCue;
    const image = this.elements.storyBeatCueImage;
    if (!chip || !image) return;
    chip.hidden = true;
    image.hidden = true;
    image.removeAttribute('src');
    delete chip.dataset.cueId;
    delete image.dataset.cueId;
    if (this.elements.storyBeatCueLabel) this.elements.storyBeatCueLabel.textContent = '';
  }

  _onObjectiveCueError() {
    this._clearObjectiveCue();
  }

  _onBeatCueError() {
    this._clearBeatCue();
  }

  _finish(value) {
    if (!this._blocking) return;
    const resolve = this._pendingResolve;
    this._pendingResolve = null;
    this._hideModal();
    resolve?.(value);
  }

  _hideModal() {
    this.elements.storyLayer?.classList.remove('is-visible');
    this.elements.storyLayer?.setAttribute('aria-hidden', 'true');
    if (this.elements.storyLayer) this.elements.storyLayer.inert = true;
    this._setBackgroundInert(false);
    this._setBlocking(false);
    this._actionCallback = null;
    this._actionBusy = false;
    this._kind = null;
    this._clearBeatCue();
    this._restoreFocus();
  }

  _resolvePending(value) {
    const resolve = this._pendingResolve;
    this._pendingResolve = null;
    resolve?.(value);
  }

  _setBlocking(blocking) {
    const next = Boolean(blocking);
    if (next === this._blocking) return;
    this._blocking = next;
    this.document.documentElement.toggleAttribute('data-story-blocking', next);

    if (typeof this.onBlockingChange === 'function') {
      try {
        this.onBlockingChange(next, { kind: this._kind, ui: this });
      } catch (error) {
        console.error('[StoryUI] onBlockingChange callback failed.', error);
      }
    }

    try {
      this.document.dispatchEvent(new CustomEvent('thornvale:story-blocking', {
        detail: { blocking: next, kind: this._kind },
      }));
    } catch {
      // CustomEvent is optional in minimal test DOMs.
    }
  }

  _setBackgroundInert(inert) {
    const targets = [
      this.document.getElementById('app'),
      this.document.querySelector('.hud-layer'),
      this.document.getElementById('lockOverlay'),
    ].filter(Boolean);

    if (inert) {
      if (this._inertStates.size > 0) return;
      for (const element of targets) {
        this._inertStates.set(element, Boolean(element.inert));
        element.inert = true;
      }
      return;
    }

    for (const [element, previous] of this._inertStates) {
      element.inert = previous;
    }
    this._inertStates.clear();
  }

  _restoreFocus() {
    const target = this._previousFocus;
    this._previousFocus = null;
    if (!target?.isConnected || typeof target.focus !== 'function') return;
    try {
      // Restore before resolving the modal promise so a caller that immediately
      // opens the next beat captures the real gameplay focus, not the old card.
      target.focus({ preventScroll: true });
    } catch {
      target.focus();
    }
  }

  _setKeyHint(prefix, key) {
    const hint = this.elements.storyKeyHint;
    const keycap = this.document.createElement('kbd');
    keycap.textContent = asText(key);
    hint.replaceChildren(this.document.createTextNode(`${asText(prefix)} `), keycap);
  }

  _restartAnimation(element, className) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
  }

  _ensureInit() {
    if (!this.initialized) this.init();
  }
}

export default StoryUI;
