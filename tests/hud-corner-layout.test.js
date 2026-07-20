import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const INDEX_URL = new URL('../index.html', import.meta.url);

test('top-left HUD panels share one flow rail without fixed desktop overlap', async () => {
  const html = await readFile(INDEX_URL, 'utf8');
  const hudStart = html.indexOf('<div id="hud">');
  const dayBadgeStart = html.indexOf('<div id="dayNightBadge"', hudStart);

  assert.ok(hudStart >= 0, 'left HUD rail must exist');
  assert.ok(dayBadgeStart > hudStart, 'time badge must follow the left HUD rail');

  const leftRail = html.slice(hudStart, dayBadgeStart);
  const statusIndex = leftRail.indexOf('class="status-toast"');
  const objectiveIndex = leftRail.indexOf('id="storyObjective"');
  const standingIndex = leftRail.indexOf('id="kindnessCounter"');

  assert.ok(statusIndex >= 0, 'status toast must belong to the left HUD rail');
  assert.ok(objectiveIndex > statusIndex, 'objective must follow status in the left HUD rail');
  assert.ok(standingIndex > objectiveIndex, 'standing must follow the objective in the left HUD rail');

  assert.match(
    html,
    /#hud\s*\{[^}]*display:\s*flex;[^}]*gap:\s*10px;/s,
    'left HUD rail must own panel separation',
  );
  assert.match(
    html,
    /@media\s*\(min-width:\s*621px\)\s*\{[\s\S]*?#storyObjective\s*\{[^}]*position:\s*relative;[^}]*top:\s*auto;[^}]*left:\s*auto;/,
    'desktop objective must participate in HUD flow',
  );
  assert.match(
    html,
    /@keyframes\s+storyObjectivePop\s*\{[^}]*translate3d\(0,\s*0,\s*0\)/s,
    'objective update animation must preserve its flow position',
  );
});
