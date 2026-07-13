function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export const CORE_HOOK_V03 = deepFreeze({
  id: 'core-hook-v03',
  title: 'A Courtesy Before Dusk',
  storageKey: 'thornvale.core-hook-v03',

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

  events: {
    letterSeen: 'arrival-letter-seen',
    stewardMet: 'steward-lumen-met',
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
      bell: { x: 3, y: 0.5, z: -2 },
    },
    steward: {
      welcome: { x: 1.6, y: 0, z: 9.4, facing: Math.PI },
      routine: { x: -0.2, y: 0, z: 4.8, facing: Math.PI * 0.82 },
      correction: { x: 0.25, y: 0, z: 3.45, facing: -Math.PI / 2 },
      complyEnding: { x: -0.25, y: 0, z: 4.9, facing: Math.PI },
      alterEnding: { x: 0.15, y: 0, z: 3.55, facing: -Math.PI / 2 },
    },
  },

  timing: {
    anomalyMinimumDelay: 1.5,
    anomalyMaximumDelay: 7.5,
    anomalyDistanceFromBell: 4.25,
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
    },
    signLedger: {
      id: 'sign-ledger',
      label: 'The first courtesy',
      text: 'Enter your name in the Community Ledger.',
      title: 'The first courtesy',
      detail: 'Enter your name in the Community Ledger.',
    },
    ringBell: {
      id: 'ring-bell-at-dusk',
      label: 'The second courtesy',
      text: 'When the lanterns bloom, ring the town bell once.',
      title: 'The second courtesy',
      detail: 'When the lanterns bloom, ring the town bell once.',
    },
    leaveBell: {
      id: 'leave-bell',
      label: 'Let Thornvale settle',
      text: 'Walk beyond the plaza while your cottage learns your name.',
      title: 'Let Thornvale settle',
      detail: 'Walk beyond the plaza while your cottage learns your name.',
    },
    inspectLedger: {
      id: 'inspect-ledger',
      label: 'The bell rang twice',
      text: 'Check the Community Ledger.',
      title: 'The bell rang twice',
      detail: 'Check the Community Ledger.',
    },
    hearCorrection: {
      id: 'hear-correction',
      label: 'A neighborly correction',
      text: 'Ask Steward Lumen why the Ledger remembers differently.',
      title: 'A neighborly correction',
      detail: 'Ask Steward Lumen why the Ledger remembers differently.',
    },
    complyComplete: {
      id: 'comply-complete',
      label: 'Home, as recorded',
      text: 'The cottage path is open. Thornvale remembers you as Home.',
      title: 'Home, as recorded',
      detail: 'The cottage path is open. Thornvale remembers you as Home.',
    },
    alterComplete: {
      id: 'alter-complete',
      label: 'A path the town forgot',
      text: 'A thorn-hidden trail has opened behind the Ledger.',
      title: 'A path the town forgot',
      detail: 'A thorn-hidden trail has opened behind the Ledger.',
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
      body: [
        'Oh, there you are. We kept your place warm.',
        "I’m Lumen, Thornvale’s steward. Nothing complicated is expected of a new neighbor.",
        'Write your name in the Community Ledger. When the lanterns bloom, ring the bell once. Then your cottage will know you.',
        'Only once, and only at dusk. Routines keep everyone from worrying.',
      ],
    },
    ledgerAccepted: {
      id: 'lumen-ledger-accepted',
      speaker: 'Steward Lumen',
      portraitTokenId: 8914,
      portrait: '8914',
      body: [
        'Lovely. The valley already writes you neatly.',
        'The lanterns are waking. One ring, please.',
      ],
    },
    firstBell: {
      id: 'lumen-first-bell',
      speaker: 'Steward Lumen',
      portraitTokenId: 8914,
      portrait: '8914',
      body: [
        'Perfectly on time.',
        'Your cottage path is open. Take a little walk while Thornvale settles.',
      ],
    },
    correction: {
      id: 'lumen-correction',
      speaker: 'Steward Lumen',
      portraitTokenId: 8914,
      portrait: '8914',
      tone: 'gentle',
      body: [
        "There you are. I was afraid you’d be embarrassed.",
        'The Ledger says you rang early. It has never needed to lie.',
        'New neighbors sometimes remember alone. Thornvale remembers together.',
        'Confirm the correction, and we can put this little worry behind us.',
      ],
    },
    complyResponse: {
      id: 'lumen-comply-response',
      speaker: 'Steward Lumen',
      portraitTokenId: 8914,
      portrait: '8914',
      body: [
        'There. You needn’t carry the lonely version anymore.',
        'Welcome home, neighbor.',
      ],
    },
    alterResponse: {
      id: 'lumen-alter-response',
      speaker: 'Steward Lumen',
      portraitTokenId: 8914,
      portrait: '8914',
      body: [
        'Of course. We never force a neighbor to agree.',
        'We only practice until remembering feels less frightening.',
      ],
    },
  },

  records: {
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
    },
  },

  choice: {
    id: 'ledger_record',
    title: 'Which account will you leave in the Ledger?',
    detail: 'The ink will dry when you leave this page.',
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
        body: 'The cottage path opens in a wash of honeyed light. In the Ledger, your name quietly becomes Home.',
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
    anomaly: 'Somewhere behind you, the bell rings again.',
    reset: 'The letter is sealed again. Thornvale is waiting.',
  },
});

export default CORE_HOOK_V03;
