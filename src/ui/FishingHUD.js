const STYLE_ID = 'thornvale-fishing-hud-style';
const RELEASE_CUE_TENSION = 0.58;
const DANGER_TENSION = 0.68;

export const FISHING_GUIDE_STEPS = Object.freeze([
  Object.freeze({ id: 'wait', label: 'Ignore small nibble' }),
  Object.freeze({ id: 'hook', label: 'Hook deep plunge' }),
  Object.freeze({ id: 'reel', label: 'Reel, ease before red' }),
  Object.freeze({ id: 'land', label: 'Land at shore' }),
]);

function resolveGuideSteps(controlMode) {
  const action = controlMode === 'touch' ? 'ACTION' : 'E';
  const inputs = ['WAIT', `TAP ${action}`, `HOLD / RELEASE ${action}`, `TAP ${action}`];
  return FISHING_GUIDE_STEPS.map((step, index) => Object.freeze({
    ...step,
    input: inputs[index],
  }));
}

function escapeGuidance(reason, action) {
  switch (reason) {
    case 'false-nibble-hook':
      return {
        instruction: 'Too soon — that was the small nibble',
        detail: 'Wait through the first movement. Tap only on the later deep plunge.',
      };
    case 'early-hook':
      return {
        instruction: 'Too soon — wait for the deep plunge',
        detail: 'Keep your hands still until the screen says HOOK.',
      };
    case 'missed-bite':
      return {
        instruction: 'Too late — the true bite passed',
        detail: `Tap ${action} while HOOK is on screen.`,
      };
    case 'line-broke':
      return {
        instruction: 'The line broke under tension',
        detail: `Release ${action} before the tension meter reaches red, then hold again.`,
      };
    case 'missed-landing':
      return {
        instruction: 'Almost — the fish reached shore',
        detail: `Give ${action} one final tap when LAND appears.`,
      };
    default:
      return {
        instruction: 'The fish slipped away',
        detail: 'Cast again and follow the four highlighted steps.',
      };
  }
}

/** Translate transient fishing state into one unambiguous teaching cue. */
export function projectFishingGuidance(state = {}, { controlMode = 'desktop' } = {}) {
  const action = controlMode === 'touch' ? 'ACTION' : 'E';
  const phase = String(state.phase || 'idle');
  const tension = Math.min(1, Math.max(0, Number(state.tension) || 0));
  const danger = phase === 'struggle' && tension >= DANGER_TENSION;
  const shouldRelease = phase === 'struggle' && tension >= RELEASE_CUE_TENSION;
  const base = {
    stepIndex: 0,
    instruction: 'WAIT — watch the bobber',
    detail: 'The small nibble is a decoy. Do not press until the later deep plunge.',
    tone: 'wait',
    danger,
    showTension: phase === 'struggle',
    showProgress: phase === 'struggle' || phase === 'landing' || phase === 'landed',
    actionLabel: 'Wait',
    steps: resolveGuideSteps(controlMode),
  };

  switch (phase) {
    case 'cast':
      return base;
    case 'waiting-nibble':
      return {
        ...base,
        instruction: 'WAIT — the small nibble comes first',
        detail: 'Do not press yet. The real bite is a deeper plunge after the water stills.',
      };
    case 'false-nibble':
      return {
        ...base,
        instruction: 'SMALL NIBBLE — keep waiting',
        detail: 'That movement is a decoy. Do not press.',
      };
    case 'waiting-bite':
      return {
        ...base,
        instruction: 'READY — the true bite is next',
        detail: `Tap ${action} only when the bobber plunges and HOOK appears.`,
        actionLabel: 'Ready',
      };
    case 'bite':
      return {
        ...base,
        stepIndex: 1,
        instruction: `TAP ${action} — HOOK!`,
        detail: 'This deep plunge is the true bite.',
        tone: 'action',
        actionLabel: 'Tap to hook',
      };
    case 'struggle':
      if (shouldRelease) {
        return {
          ...base,
          stepIndex: 2,
          instruction: `RELEASE ${action} — ease the line`,
          detail: 'Let the tension fall below the warm zone, then hold again.',
          tone: danger ? 'danger' : 'action',
          actionLabel: 'Release line',
        };
      }
      return {
        ...base,
        stepIndex: 2,
        instruction: `HOLD ${action} — reel toward shore`,
        detail: state.pulling
          ? 'The fish is pulling. Use a short hold and release before tension reaches red.'
          : 'Hold to gain ground. Release whenever line tension climbs into the warm zone.',
        tone: 'action',
        actionLabel: 'Hold to reel',
      };
    case 'landing':
      return {
        ...base,
        stepIndex: 3,
        instruction: `TAP ${action} — LAND IT!`,
        detail: 'The fish is at shore. One final tap completes the catch.',
        tone: 'action',
        actionLabel: 'Tap to land',
      };
    case 'landed':
      return {
        ...base,
        stepIndex: 3,
        instruction: 'CAUGHT — pond dace',
        detail: 'The fish is safely in your inventory.',
        tone: 'success',
        actionLabel: 'Caught',
      };
    case 'escaped': {
      const escaped = escapeGuidance(state.outcome?.reason, action);
      return {
        ...base,
        stepIndex: null,
        ...escaped,
        tone: 'retry',
        actionLabel: 'Cast again',
      };
    }
    default:
      return {
        ...base,
        instruction: 'Cast into the quiet pond',
        detail: 'The four-step guide will stay visible through the catch.',
        actionLabel: 'Cast line',
      };
  }
}

function ensureStyles(documentRef) {
  if (documentRef.getElementById(STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .fishing-minigame {
      position: fixed;
      left: 50%;
      bottom: max(7rem, env(safe-area-inset-bottom));
      z-index: 24;
      width: min(39rem, calc(100vw - 2rem));
      transform: translateX(-50%);
      padding: .9rem 1rem 1rem;
      border: 1px solid rgba(255, 238, 202, .68);
      border-radius: 1rem;
      color: #fff7e8;
      background: linear-gradient(180deg, rgba(34, 61, 65, .96), rgba(23, 42, 47, .96));
      box-shadow: 0 .8rem 2.5rem rgba(12, 28, 31, .4);
      font: 600 .9rem/1.35 system-ui, sans-serif;
      pointer-events: none;
    }
    .fishing-minigame[hidden], .fishing-minigame__meters[hidden], .fishing-minigame__meter[hidden] { display: none; }
    .fishing-minigame__eyebrow { opacity: .72; font-size: .68rem; letter-spacing: .14em; text-transform: uppercase; }
    .fishing-minigame__prompt { margin-top: .18rem; font-size: 1.08rem; letter-spacing: .01em; }
    .fishing-minigame__detail { min-height: 1.2em; margin-top: .12rem; color: rgba(255, 247, 232, .78); font-size: .78rem; }
    .fishing-minigame__guide { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .42rem; margin: .68rem 0 0; padding: 0; list-style: none; }
    .fishing-minigame__step { min-width: 0; padding: .42rem .5rem; border: 1px solid rgba(255,255,255,.15); border-radius: .6rem; background: rgba(255,255,255,.04); opacity: .58; }
    .fishing-minigame__step.is-current { border-color: rgba(255, 213, 129, .82); background: rgba(255, 207, 112, .12); box-shadow: inset 0 0 0 1px rgba(255, 218, 148, .12); opacity: 1; }
    .fishing-minigame__step-input { display: block; color: #ffdf9d; font-size: .66rem; letter-spacing: .07em; white-space: nowrap; }
    .fishing-minigame__step-label { display: block; margin-top: .08rem; overflow: hidden; font-size: .68rem; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
    .fishing-minigame__meters { display: grid; grid-template-columns: 1fr 1fr; gap: .6rem; margin-top: .62rem; }
    .fishing-minigame__label { display: block; margin-bottom: .2rem; opacity: .78; font-size: .67rem; letter-spacing: .08em; text-transform: uppercase; }
    .fishing-minigame__track { height: .48rem; overflow: hidden; border-radius: 1rem; background: rgba(255,255,255,.14); }
    .fishing-minigame__fill { height: 100%; width: 0; border-radius: inherit; transition: width 80ms linear; }
    .fishing-minigame__fill--tension { background: linear-gradient(90deg, #8cd3c8, #ffd170 68%, #ee7c6e); }
    .fishing-minigame__fill--progress { background: linear-gradient(90deg, #92c8ef, #a7dda6); }
    .fishing-minigame[data-tone="action"] .fishing-minigame__prompt { color: #ffe09e; }
    .fishing-minigame[data-tone="danger"] .fishing-minigame__prompt,
    .fishing-minigame[data-tone="retry"] .fishing-minigame__prompt { color: #ffb5a8; }
    .fishing-minigame[data-tone="success"] .fishing-minigame__prompt { color: #bce7ae; }
    .fishing-minigame[data-danger="true"] .fishing-minigame__fill--tension { background: #f17769; box-shadow: 0 0 .65rem rgba(241, 119, 105, .8); }
    @media (max-width: 680px) {
      .fishing-minigame { bottom: max(6.8rem, env(safe-area-inset-bottom)); width: min(29rem, calc(100vw - 1rem)); padding: .72rem .78rem .8rem; }
      .fishing-minigame__guide { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .fishing-minigame__step-label { white-space: normal; }
    }
    @media (prefers-reduced-motion: reduce) {
      .fishing-minigame__fill { transition: none; }
    }
  `;
  documentRef.head.append(style);
}

export class FishingHUD {
  constructor({ documentRef = globalThis.document, controlMode = 'desktop' } = {}) {
    this.document = documentRef;
    this.controlMode = controlMode === 'touch' ? 'touch' : 'desktop';
    this.root = null;
    this.prompt = null;
    this.detail = null;
    this.steps = [];
    this.meters = null;
    this.tensionMeter = null;
    this.progressMeter = null;
    this.tension = null;
    this.progress = null;
    this.actionLabel = 'Cast line';
    this.hideTimer = null;
  }

  init() {
    if (!this.document || this.root) return this;
    ensureStyles(this.document);
    const guideSteps = resolveGuideSteps(this.controlMode);
    const root = this.document.createElement('section');
    root.className = 'fishing-minigame';
    root.hidden = true;
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    root.setAttribute('aria-atomic', 'true');
    root.innerHTML = `
      <div class="fishing-minigame__eyebrow">How to fish · follow the highlighted step</div>
      <div class="fishing-minigame__prompt"></div>
      <div class="fishing-minigame__detail"></div>
      <ol class="fishing-minigame__guide">
        ${guideSteps.map((step) => `<li class="fishing-minigame__step"><span class="fishing-minigame__step-input">${step.input}</span><span class="fishing-minigame__step-label">${step.label}</span></li>`).join('')}
      </ol>
      <div class="fishing-minigame__meters" hidden>
        <div class="fishing-minigame__meter fishing-minigame__meter--tension"><span class="fishing-minigame__label">Line tension · release before red</span><div class="fishing-minigame__track"><div class="fishing-minigame__fill fishing-minigame__fill--tension"></div></div></div>
        <div class="fishing-minigame__meter fishing-minigame__meter--progress"><span class="fishing-minigame__label">Fish to shore</span><div class="fishing-minigame__track"><div class="fishing-minigame__fill fishing-minigame__fill--progress"></div></div></div>
      </div>`;
    this.document.body.append(root);
    this.root = root;
    this.prompt = root.querySelector('.fishing-minigame__prompt');
    this.detail = root.querySelector('.fishing-minigame__detail');
    this.steps = [...root.querySelectorAll('.fishing-minigame__step')];
    this.meters = root.querySelector('.fishing-minigame__meters');
    this.tensionMeter = root.querySelector('.fishing-minigame__meter--tension');
    this.progressMeter = root.querySelector('.fishing-minigame__meter--progress');
    this.tension = root.querySelector('.fishing-minigame__fill--tension');
    this.progress = root.querySelector('.fishing-minigame__fill--progress');
    return this;
  }

  setState(state) {
    if (!this.root || !state) return;
    clearTimeout(this.hideTimer);
    const guidance = projectFishingGuidance(state, { controlMode: this.controlMode });
    this.actionLabel = guidance.actionLabel;
    this.root.dataset.phase = state.phase;
    this.root.dataset.tone = guidance.tone;
    this.root.dataset.danger = String(guidance.danger);
    this.prompt.textContent = guidance.instruction;
    this.detail.textContent = guidance.detail;
    this.steps.forEach((step, index) => {
      const current = index === guidance.stepIndex;
      step.classList.toggle('is-current', current);
      if (current) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
    this.tension.style.width = `${Math.round((state.tension || 0) * 100)}%`;
    this.progress.style.width = `${Math.round((state.landingProgress || 0) * 100)}%`;
    this.tensionMeter.hidden = !guidance.showTension;
    this.progressMeter.hidden = !guidance.showProgress;
    this.meters.hidden = !guidance.showTension && !guidance.showProgress;
    this.root.hidden = false;
    if (!state.active) {
      this.hideTimer = setTimeout(() => {
        if (this.root) this.root.hidden = true;
      }, 3200);
    }
  }

  dispose() {
    clearTimeout(this.hideTimer);
    this.root?.remove();
    this.root = null;
  }
}
