import { STORY_ACTIONS_V1 } from './story-actions-v1.js';
import { KEY_OBJECT_CUES_V1 } from './key-object-cues-v1.js';
import { TOWN_LAYOUT } from '../config/town.js';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export const CORE_HOOK_V03 = deepFreeze({
  id: 'core-hook-v03',
  title: 'A Courtesy Before Dusk',
  storageKey: 'thornvale.game-session-v1',

  ids: {
    steward: 'steward-8914',
    ledger: 'ledger',
    bell: 'bell',
    rule: 'bell-once-at-dusk',
    choice: 'ledger_record',
  },

  steward: {
    tokenId: 8914,
    name: 'Steward Lumen',
  },

  gestures: STORY_ACTIONS_V1.lumen,

  events: {
    letterSeen: 'arrival-letter-seen',
    stewardMet: 'steward-lumen-met',
    firstAfternoonComplete: 'first-afternoon-complete',
    ledgerSigned: 'community-ledger-signed',
    firstBellRung: 'dusk-bell-rung',
    anomalyBellRang: 'night-bell-rang-itself',
    falseRecordSeen: 'false-ledger-record-seen',
    correctionHeard: 'steward-correction-heard',
    choiceMade: 'ledger-record-choice-made',
    endingSeen: 'core-hook-ending-seen',
  },

  anchors: {
    interactables: {
      ledger: { x: -2, y: 0.8, z: 3 },
      bell: {
        x: TOWN_LAYOUT.landmarks.bell.x,
        y: TOWN_LAYOUT.landmarks.bell.y,
        z: TOWN_LAYOUT.landmarks.bell.z,
      },
    },
    steward: {
      welcome: { x: 1.6, y: 0, z: 9.4, facing: Math.PI },
      routine: { x: -0.2, y: 0, z: 4.8, facing: Math.PI * 0.82 },
      correction: { x: 0.25, y: 0, z: 3.45, facing: -Math.PI / 2 },
      complyEnding: { x: -0.25, y: 0, z: 4.9, facing: Math.PI },
      alterEnding: { x: 0.15, y: 0, z: 3.55, facing: -Math.PI / 2 },
    },
    player: {
      // A restored save between Bell rings resumes on the hill approach, not
      // at the front gate beside Lumen, preserving the authored return walk.
      firstBellReturn: { x: 3, y: 3.3, z: -33.4 },
    },
    camera: {
      secondBell: {
        position: { x: 10.2, y: 7.4, z: -28.8 },
        lookAt: { x: 3, y: 4.6, z: -36.5 },
      },
    },
  },

  timing: {
    anomalyMinimumDelay: 2.5,
    anomalyDistanceFromBell: 18,
    anomalyDistanceToSteward: 13,
    bellRevealFlyIn: 0.85,
    bellRevealHold: 1.05,
    bellRevealFlyOut: 0.85,
    routeArrivalRadius: 1.35,
  },

  neighborliness: {
    welcome: { amount: 5, reason: 'Received the welcome graciously' },
    ledger: { amount: 10, reason: 'Entered the Community Ledger' },
    bell: { amount: 10, reason: 'Kept the dusk routine' },
    comply: { amount: 15, reason: 'Confirmed the town record' },
    alter: { amount: -20, reason: 'Corrected the town record' },
  },

  prompts: {
    meetSteward: 'Speak with Steward Lumen',
    signLedger: 'Enter your name in the Community Ledger',
    reviewLedger: 'Review today’s Ledger entries',
    ringBell: 'Ring once, now that the lanterns are blooming',
    inspectLedger: 'Read the new correction in the Ledger',
    hearCorrection: 'Ask Steward Lumen about the correction',
  },

  objectives: {
    meetSteward: {
      id: 'meet-steward',
      label: 'A place kept warm',
      text: 'Meet the steward who kept the gate open for you.',
      title: 'A place kept warm',
      detail: 'Meet the steward who kept the gate open for you.',
      target: { kind: 'interactable', id: 'steward-8914' },
    },
    signLedger: {
      id: 'sign-ledger',
      label: 'A town courtesy',
      text: 'Enter your name in the Community Ledger.',
      title: 'A town courtesy',
      detail: 'Enter your name in the Community Ledger.',
      cue: KEY_OBJECT_CUES_V1.ledger,
      target: { kind: 'interactable', id: 'ledger' },
    },
    firstAfternoon: {
      id: 'settle-first-afternoon',
      label: 'Your first afternoon',
      text: 'Make the provisional forest-edge camp livable before dusk.',
      title: 'Your first afternoon',
      detail: 'Make the provisional forest-edge camp livable before dusk.',
      cue: KEY_OBJECT_CUES_V1.camp,
      target: {
        kind: 'anchor',
        id: 'day-one-camp-recovery',
        position: TOWN_LAYOUT.dayOne.campRecovery,
      },
    },
    ringBell: {
      id: 'ring-bell-at-dusk',
      label: 'The second courtesy',
      text: 'Follow the warm pavers uphill and ring the town bell once.',
      title: 'The second courtesy',
      detail: 'When the lanterns bloom, follow the warm pavers uphill and ring once.',
      cue: KEY_OBJECT_CUES_V1.bell,
      target: { kind: 'interactable', id: 'bell' },
    },
    returnToLumen: {
      id: 'return-to-lumen',
      label: 'Report the courtesy',
      text: 'Return to Steward Lumen in the plaza and tell him the Bell was rung.',
      title: 'Report the courtesy',
      detail: 'Return to Steward Lumen in the plaza and tell him the Bell was rung.',
      target: { kind: 'interactable', id: 'steward-8914' },
    },
    inspectLedger: {
      id: 'inspect-ledger',
      label: 'The bell rang twice',
      text: 'Check the Community Ledger.',
      title: 'The bell rang twice',
      detail: 'Check the Community Ledger.',
      cue: KEY_OBJECT_CUES_V1.ledger,
      target: { kind: 'interactable', id: 'ledger' },
    },
    hearCorrection: {
      id: 'hear-correction',
      label: 'A neighborly correction',
      text: 'Ask Steward Lumen why the Ledger remembers differently.',
      title: 'A neighborly correction',
      detail: 'Ask Steward Lumen why the Ledger remembers differently.',
      cue: KEY_OBJECT_CUES_V1.ledger,
      target: { kind: 'interactable', id: 'steward-8914' },
    },
    complyComplete: {
      id: 'comply-complete',
      label: 'Home, as recorded',
      text: 'Your forest-edge plot is recognized. Thornvale remembers you as Home.',
      title: 'Home, as recorded',
      detail: 'Your forest-edge plot is recognized. Thornvale remembers you as Home.',
      target: { kind: 'route-destination', route: 'comply', arrivalRadius: 1.35 },
    },
    alterComplete: {
      id: 'alter-complete',
      label: 'A path the town forgot',
      text: 'A thorn-hidden trail has opened behind the Ledger.',
      title: 'A path the town forgot',
      detail: 'A thorn-hidden trail has opened behind the Ledger.',
      target: { kind: 'route-destination', route: 'alter', arrivalRadius: 1.35 },
    },
  },

  letter: {
    id: 'arrival-letter',
    eyebrow: 'A LETTER IN YOUR HANDWRITING',
    title: 'For when I arrive',
    body: [
      'Dear me,',
      'When Thornvale asks for kindness, be kind.',
      'When the bell rings twice, do not let them write the first ring for you.',
      'You will want to stay. That is how it begins.',
      '—Me',
    ],
    detail: 'You do not remember writing it.',
    actionLabel: 'Fold the letter',
  },

  dialogue: {
    welcome: {
      id: 'lumen-welcome',
      speaker: 'Steward Lumen',
      portraitTokenId: 8914,
      portrait: '8914',
      beats: [
        {
          id: 'lumen-welcome.arrival',
          text: 'Oh, there you are. We kept your place warm.',
          gesture: STORY_ACTIONS_V1.lumen.happyHandGesture,
        },
        {
          id: 'lumen-welcome.introduction',
          text: "I’m Lumen, Thornvale’s steward. Nothing complicated is expected of a new neighbor.",
        },
        {
          id: 'lumen-welcome.plot',
          text: 'There is a provisional plot along the west clover path, where the meadow meets the old forest. We left a camp cot and seed bed for you.',
          cue: KEY_OBJECT_CUES_V1.camp,
        },
        {
          id: 'lumen-welcome.ledger-invitation',
          text: 'Before you settle in, enter your name in the Community Ledger.',
          cue: KEY_OBJECT_CUES_V1.ledger,
        },
        {
          id: 'lumen-welcome.ledger-purpose',
          text: 'It keeps a little account of every task, so no neighbor has to remember alone.',
        },
        {
          id: 'lumen-welcome.afternoon',
          text: 'Then gather what you need, make yourself a meal, tend the seed bed, and settle the shelter.',
        },
        {
          id: 'lumen-welcome.bell-courtesy',
          text: 'When the lanterns bloom, follow the warm pavers to the hill, ring the bell once, and return to me.',
          cue: KEY_OBJECT_CUES_V1.bell,
        },
        {
          id: 'lumen-welcome.rule',
          text: 'Only once, and only at dusk. Routines keep everyone from worrying.',
        },
      ],
    },
    ledgerAccepted: {
      id: 'lumen-ledger-accepted',
      speaker: 'Steward Lumen',
      portraitTokenId: 8914,
      portrait: '8914',
      beats: [
        {
          id: 'lumen-ledger-accepted.shared-day',
          text: 'Lovely. Now the town can keep the day with you.',
          gesture: STORY_ACTIONS_V1.lumen.acknowledging,
          cue: KEY_OBJECT_CUES_V1.ledger,
        },
        {
          id: 'lumen-ledger-accepted.account',
          text: 'Wood gathered, supper made, seed tended, shelter mended—the Ledger will note each kindness as it happens.',
        },
        {
          id: 'lumen-ledger-accepted.west-path',
          text: 'Follow the west clover path to your plot. We will see how quickly it begins to feel like yours.',
          cue: KEY_OBJECT_CUES_V1.camp,
        },
      ],
    },
    firstBell: {
      id: 'lumen-first-bell',
      speaker: 'A ribbon tied to the Bell',
      beats: [
        {
          id: 'lumen-first-bell.on-time',
          text: 'Perfectly on time.',
          cue: KEY_OBJECT_CUES_V1.bell,
        },
        {
          id: 'lumen-first-bell.return',
          text: 'Your afternoon is entered under your name. Return to Steward Lumen while Thornvale settles.',
        },
      ],
    },
    correction: {
      id: 'lumen-correction',
      speaker: 'Steward Lumen',
      portraitTokenId: 8914,
      portrait: '8914',
      tone: 'gentle',
      beats: [
        {
          id: 'lumen-correction.concern',
          text: "There you are. I was afraid you’d be embarrassed.",
          gesture: STORY_ACTIONS_V1.lumen.relievedSigh,
        },
        {
          id: 'lumen-correction.ledger-certainty',
          text: 'The Ledger says you rang early. It has never needed to lie.',
          cue: KEY_OBJECT_CUES_V1.ledger,
        },
        {
          id: 'lumen-correction.communal-memory',
          text: 'New neighbors sometimes remember alone. Thornvale remembers together.',
          gesture: STORY_ACTIONS_V1.lumen.thoughtfulHeadShake,
        },
        {
          id: 'lumen-correction.courteous-demand',
          text: 'Confirm the correction, and we can put this little worry behind us.',
        },
      ],
    },
    complyResponse: {
      id: 'lumen-comply-response',
      speaker: 'Steward Lumen',
      portraitTokenId: 8914,
      portrait: '8914',
      beats: [
        {
          id: 'lumen-comply-response.release',
          text: 'There. You needn’t carry the lonely version anymore.',
        },
        {
          id: 'lumen-comply-response.welcome-home',
          text: 'Welcome home, neighbor.',
        },
      ],
    },
    alterResponse: {
      id: 'lumen-alter-response',
      speaker: 'Steward Lumen',
      portraitTokenId: 8914,
      portrait: '8914',
      beats: [
        {
          id: 'lumen-alter-response.permission',
          text: 'Of course. We never force a neighbor to agree.',
        },
        {
          id: 'lumen-alter-response.practice',
          text: 'We only practice until remembering feels less frightening.',
        },
      ],
    },
  },

  records: {
    dayOneFallback: {
      id: 'day-one-neighborly-account',
      title: 'COMMUNITY LEDGER · TODAY’S ACCOUNT',
      entry: 'The afternoon is still being written.',
      signature: 'Neighbor on file',
      signatureLabel: 'Account kept under',
      detail: 'The ink keeps pace without a clerk nearby.',
      actionLabel: 'Close the Ledger',
      altered: false,
      cue: KEY_OBJECT_CUES_V1.ledger,
    },
    signature: {
      id: 'arrival-signature',
      title: 'COMMUNITY LEDGER · NEW ARRIVALS',
      entry: 'I arrived willingly, and Thornvale kept a place for me.',
      inputLabel: 'Sign your name on the line',
      placeholder: 'Your name',
      annotation: 'Witnessed with warmth by Steward Lumen.',
      body: 'I arrived willingly, and Thornvale kept a place for me.',
      detail: 'Witnessed with warmth by Steward Lumen.',
      actionLabel: 'Sign the ledger',
      altered: false,
      cue: KEY_OBJECT_CUES_V1.ledger,
    },
    falseCorrection: {
      id: 'false-correction',
      title: 'COMMUNITY LEDGER · CORRECTIONS',
      entry: 'I rang before dusk. I am sorry for confusing everyone.',
      signature: 'Signature on file',
      signatureLabel: 'Written in your hand',
      annotation: 'Witnessed and forgiven by Steward Lumen.',
      body: 'I rang before dusk. I am sorry for confusing everyone.',
      detail: 'Witnessed and forgiven by Steward Lumen. The ink is already dry.',
      altered: true,
      cue: KEY_OBJECT_CUES_V1.ledger,
    },
  },

  choice: {
    id: 'ledger_record',
    title: 'Which account will you leave in the Ledger?',
    detail: 'The ink will dry when you leave this page.',
    cue: KEY_OBJECT_CUES_V1.ledger,
    choices: [
      {
        id: 'comply',
        label: 'Confirm the town’s record',
        detail: 'Accept the apology written in your hand.',
      },
      {
        id: 'alter',
        label: 'Write what happened',
        detail: 'Cross it out: the second bell rang itself.',
      },
    ],
  },

  outcomes: {
    comply: {
      choice: 'comply',
      ending: 'assimilate',
      route: 'cottage',
      stewardReaction: 'welcome-home',
      stewardAnchor: 'complyEnding',
      relationship: 'warm',
      response: 'complyResponse',
      objective: 'complyComplete',
      endingCard: {
        id: 'assimilate',
        ending: 'assimilate',
        tone: 'comply',
        eyebrow: 'HOME, AS RECORDED',
        title: 'Every window welcomes you at once.',
        body: 'The forest-edge plot glows in honeyed light. In the Ledger, your name quietly becomes Home.',
        finalLine: 'Thornvale remembers you correctly.',
        detail: 'Thornvale remembers you correctly.',
      },
    },
    alter: {
      choice: 'alter',
      ending: 'escape',
      route: 'thorn-path',
      stewardReaction: 'corrective-stillness',
      stewardAnchor: 'alterEnding',
      relationship: 'corrective',
      response: 'alterResponse',
      objective: 'alterComplete',
      endingCard: {
        id: 'escape',
        ending: 'escape',
        tone: 'alter',
        eyebrow: 'A PATH THE TOWN FORGOT',
        title: 'The warm way closes. A path no one named opens.',
        body: 'Behind the Ledger, thorns uncurl from a narrow trail. Every cottage window turns away from it.',
        finalLine: 'That’s all right. We can practice again tomorrow.',
        detail: 'That’s all right. We can practice again tomorrow.',
      },
    },
  },

  status: {
    anomaly: 'From the hill behind you, the Bell rings again.',
    reset: 'The letter is sealed again. Thornvale is waiting.',
  },
});

export default CORE_HOOK_V03;
