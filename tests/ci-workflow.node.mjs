import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('lychee excludes profile links that reject automated link checks', async () => {
  const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

  assert.match(
    workflow,
    /--exclude https:\/\/app\.joinhandshake\.com\/profiles\/pranavvdhawann/,
    'Handshake returns 403 to lychee and should be excluded like other CI-blocking social profiles'
  );
});
