const APPLE_MOBILE_USER_AGENT = /iPhone|iPad|iPod/i;

export function isAppleMobilePlatform({
  userAgent = '',
  platform = '',
  maxTouchPoints = 0,
} = {}) {
  if (APPLE_MOBILE_USER_AGENT.test(String(userAgent))) return true;
  return String(platform) === 'MacIntel' && Number(maxTouchPoints) > 1;
}

export function resolveInstalledDisplayMode({
  standaloneMedia = false,
  fullscreenMedia = false,
  navigatorStandalone = false,
} = {}) {
  return standaloneMedia || fullscreenMedia || navigatorStandalone
    ? 'standalone'
    : 'browser';
}

export function shouldShowAppleAppModeHint({
  controlMode = 'desktop',
  displayMode = 'browser',
  appleMobile = false,
} = {}) {
  return controlMode === 'touch' && displayMode === 'browser' && appleMobile;
}

export function shouldShowAppleRotationNotice({
  appModeHintEligible = false,
  worldEntered = false,
  storyBlocking = false,
  alreadyShown = false,
} = {}) {
  return appModeHintEligible && worldEntered && !storyBlocking && !alreadyShown;
}
