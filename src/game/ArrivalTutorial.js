import { ARRIVAL_PROLOGUE_V1 } from '../config/arrival-prologue.js';

const TAU = Math.PI * 2;
const EVENTS = [
  'arrival-trusted-memory-seen',
  'arrival-crossroads-reached',
  'arrival-response-chosen',
  'steward-lumen-met',
];

/** Presentation-only observer for Look -> Move -> Hint arrival teaching. */
export class ArrivalTutorial {
  constructor({
    spawn = ARRIVAL_PROLOGUE_V1.anchors.spawn,
    tutorial = ARRIVAL_PROLOGUE_V1.tutorial,
  } = {}) {
    this.spawn = { x: Number(spawn.x) || 0, z: Number(spawn.z) || 0 };
    this.config = tutorial;
    this.yawSeen = 0;
    this.lastYaw = null;
    this.done = [false, false, false];
  }

  update({
    yaw,
    position,
    eventsSeen = [],
    inputActive = true,
    hintSucceeded = false,
    hintReady = true,
    nearInteraction = false,
    controlMode = 'desktop',
  } = {}) {
    const done = this.done;
    const settings = this.config;
    const seen = new Set(eventsSeen);
    const crossroads = seen.has(EVENTS[1]);
    const responseChosen = seen.has(EVENTS[2]);
    const stewardMet = seen.has(EVENTS[3]);
    const memorySeen = seen.has(EVENTS[0]) || crossroads || responseChosen || stewardMet;
    const complete = responseChosen || stewardMet;
    const active = Boolean(inputActive && memorySeen && !complete);
    const moveDistance = position
      ? Math.hypot(
          (Number(position.x) || 0) - this.spawn.x,
          (Number(position.z) || 0) - this.spawn.z,
        )
      : 0;

    if (hintSucceeded) done[2] = true;
    if (crossroads) {
      done[0] = true;
      done[1] = true;
    } else if (active) {
      const nextYaw = Number(yaw);
      if (Number.isFinite(nextYaw)) {
        if (this.lastYaw !== null) {
          let delta = nextYaw - this.lastYaw;
          delta = ((delta + Math.PI) % TAU + TAU) % TAU - Math.PI;
          this.yawSeen += Math.abs(delta);
        }
        this.lastYaw = nextYaw;
      }
      if (moveDistance >= settings.moveDistance) {
        done[0] = true;
        done[1] = true;
      } else if (this.yawSeen + 1e-9 >= settings.lookYawRadians) {
        done[0] = true;
      }
    } else {
      this.lastYaw = null;
    }
    if (done[0] && moveDistance >= settings.moveDistance) done[1] = true;

    let step = null;
    if (!complete && memorySeen) {
      if (crossroads && !done[2]) step = 'hint';
      else if (!done[0]) step = 'look';
      else if (!done[1]) step = 'move';
    }
    const mode = controlMode === 'touch' ? 'touch' : 'desktop';
    const config = settings.cues?.[mode]?.[step];
    const visible = active && !nearInteraction && (step !== 'hint' || hintReady);
    const cue = visible && config
      ? { id: step, key: config.key, text: config.text }
      : null;
    return Object.freeze({
      active,
      complete,
      step,
      cue,
      progress: Object.freeze({ lookYaw: this.yawSeen, moveDistance }),
    });
  }
}

export default ArrivalTutorial;
