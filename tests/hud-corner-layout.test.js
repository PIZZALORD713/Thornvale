import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const INDEX_URL = new URL('../index.html', import.meta.url);

function escapePattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function declarationsFor(html, selector, property) {
  const selectorPattern = escapePattern(selector);
  const propertyPattern = escapePattern(property);
  const values = [];
  for (const match of html.matchAll(new RegExp(`${selectorPattern}\\s*\\{([^}]*)\\}`, 'g'))) {
    for (const declaration of match[1].matchAll(new RegExp(`${propertyPattern}\\s*:\\s*([0-9.]+)px`, 'g'))) {
      values.push(Number(declaration[1]));
    }
  }
  return values;
}

function assertPixelFloor(html, selector, property, minimum) {
  const values = declarationsFor(html, selector, property);
  assert.ok(values.length > 0, `${selector} must declare ${property} in pixels`);
  assert.ok(
    values.every((value) => value >= minimum),
    `${selector} ${property} must stay at or above ${minimum}px; received ${values.join(', ')}`,
  );
}

test('corner HUD surfaces share normal-flow rails instead of independent fixed offsets', async () => {
  const html = await readFile(INDEX_URL, 'utf8');
  const leftStart = html.indexOf('<div id="hud">');
  const rightStart = html.indexOf('<div id="rightHudRail"');
  const promptStart = html.indexOf('<div id="interactionPrompt"', rightStart);

  assert.ok(leftStart >= 0, 'left HUD rail must exist');
  assert.ok(rightStart > leftStart, 'right HUD rail must follow the left rail');
  assert.ok(promptStart > rightStart, 'right HUD rail must close before interaction UI');

  const leftRail = html.slice(leftStart, rightStart);
  const statusIndex = leftRail.indexOf('class="status-toast"');
  const objectiveIndex = leftRail.indexOf('id="storyObjective"');
  const standingIndex = leftRail.indexOf('id="kindnessCounter"');
  assert.ok(statusIndex >= 0, 'status toast must belong to the left rail');
  assert.ok(objectiveIndex > statusIndex, 'objective must follow status in the left rail');
  assert.ok(standingIndex > objectiveIndex, 'standing must follow the objective in the left rail');

  const rightRail = html.slice(rightStart, promptStart);
  assert.ok(rightRail.indexOf('id="dayNightBadge"') >= 0, 'time badge must belong to right rail');
  assert.ok(
    rightRail.indexOf('id="survivalStatus"') > rightRail.indexOf('id="dayNightBadge"'),
    'survival status must stack after the time badge',
  );

  assert.match(
    html,
    /#rightHudRail\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*gap:\s*10px;/s,
  );
  assert.match(
    html,
    /@media\s*\(min-width:\s*621px\)\s*\{[\s\S]*?#storyObjective\s*\{[^}]*position:\s*relative;[^}]*top:\s*auto;[^}]*left:\s*auto;/,
  );
});

test('corner HUD typography keeps readable pixel fallbacks at every breakpoint', async () => {
  const html = await readFile(INDEX_URL, 'utf8');

  assertPixelFloor(html, '#dayNightBadge', 'min-height', 52);
  assertPixelFloor(html, '.phase-overline', 'font-size', 9);
  assertPixelFloor(html, '.phase-label', 'font-size', 13);
  assertPixelFloor(html, '.survival-heading', 'font-size', 10);
  assertPixelFloor(html, '.survival-meter-name', 'font-size', 11);
  assertPixelFloor(html, '.survival-meter-label', 'font-size', 11);
  assertPixelFloor(html, '.survival-essential', 'font-size', 10);
  assertPixelFloor(html, '.survival-essential strong', 'font-size', 12);
});
