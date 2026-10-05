/** El prompt del atajo que genera la web debe ser idéntico al del sidebar (GAS). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeHarness } from './gas-harness.mjs';

test('prompt del atajo: web (shortcut-prompt.ts) === sidebar (promptIphone_)', async () => {
  const h = makeHarness();
  const exec = 'https://script.google.com/macros/s/AKfycbTEST/exec';
  const gas = h.api.promptIphone_(exec, 'tok-123');
  const { buildShortcutPrompt } = await import('../apps/web/src/lib/shortcut-prompt.ts');
  assert.equal(buildShortcutPrompt({ execUrl: exec, token: 'tok-123' }), gas);
});
