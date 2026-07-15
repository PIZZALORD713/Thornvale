import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  isAppleMobilePlatform,
  resolveInstalledDisplayMode,
  shouldShowAppleAppModeHint,
  shouldShowAppleRotationNotice,
} from '../src/config/display-mode.js';

test('Apple mobile detection covers iPhone and touch-capable iPad desktop identity', () => {
  assert.equal(isAppleMobilePlatform({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)',
    platform: 'iPhone',
    maxTouchPoints: 5,
  }), true);
  assert.equal(isAppleMobilePlatform({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',
    platform: 'MacIntel',
    maxTouchPoints: 5,
  }), true);
  assert.equal(isAppleMobilePlatform({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',
    platform: 'MacIntel',
    maxTouchPoints: 0,
  }), false);
});

test('installed display mode recognizes manifest and legacy iOS app launches', () => {
  assert.equal(resolveInstalledDisplayMode(), 'browser');
  assert.equal(resolveInstalledDisplayMode({ standaloneMedia: true }), 'standalone');
  assert.equal(resolveInstalledDisplayMode({ fullscreenMedia: true }), 'standalone');
  assert.equal(resolveInstalledDisplayMode({ navigatorStandalone: true }), 'standalone');
});

test('Home Screen guidance appears only for Apple touch play in a browser tab', () => {
  assert.equal(shouldShowAppleAppModeHint({
    controlMode: 'touch',
    displayMode: 'browser',
    appleMobile: true,
  }), true);
  assert.equal(shouldShowAppleAppModeHint({
    controlMode: 'touch',
    displayMode: 'standalone',
    appleMobile: true,
  }), false);
  assert.equal(shouldShowAppleAppModeHint({
    controlMode: 'desktop',
    displayMode: 'browser',
    appleMobile: true,
  }), false);
  assert.equal(shouldShowAppleAppModeHint({
    controlMode: 'touch',
    displayMode: 'browser',
    appleMobile: false,
  }), false);
});

test('rotation guidance waits for active unblocked play and appears once', () => {
  const eligible = {
    appModeHintEligible: true,
    worldEntered: true,
    storyBlocking: false,
    alreadyShown: false,
  };
  assert.equal(shouldShowAppleRotationNotice(eligible), true);
  assert.equal(shouldShowAppleRotationNotice({ ...eligible, worldEntered: false }), false);
  assert.equal(shouldShowAppleRotationNotice({ ...eligible, storyBlocking: true }), false);
  assert.equal(shouldShowAppleRotationNotice({ ...eligible, alreadyShown: true }), false);
  assert.equal(shouldShowAppleRotationNotice({ ...eligible, appModeHintEligible: false }), false);
});

test('document and manifest expose the iPhone Home Screen app contract', async () => {
  const [html, manifestSource] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'),
  ]);
  const manifest = JSON.parse(manifestSource);

  assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest" \/>/);
  assert.match(html, /apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /apple-mobile-web-app-status-bar-style" content="black-translucent"/);
  assert.match(html, /id="mobileAppModeHint"/);
  assert.match(html, /id="mobileDisplayNotice"/);
  assert.match(html, /id="mobileDisplayNoticeDismiss"/);
  assert.match(html, /Share[^<]*.*Add to Home Screen/s);
  assert.equal(manifest.id, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.start_url, '/?controls=auto');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'any');
});
