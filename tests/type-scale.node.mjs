import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// The sheet once carried 29 distinct font sizes across 76 declarations, picked
// per-rule. They now resolve to one of 13 --fs-* steps. These guards keep it
// that way: a one-off value is easy to add and impossible to spot by eye.

function declaredSteps() {
  const root = css.split(':root {')[1].split('}')[0];
  return [...root.matchAll(/--fs-([\w-]+):\s*([0-9.]+)rem;/g)].map(([, name, value]) => ({
    name: `--fs-${name}`,
    rem: Number(value),
  }));
}

test('every font-size resolves to a type-scale token', () => {
  const offenders = [...css.matchAll(/font-size:\s*([^;]+);/g)]
    .map(([, value]) => value.trim())
    .filter((value) => !value.startsWith('var(--fs-'))
    // The rem root itself cannot be a rem token, and .hero-title .highlight
    // deliberately tracks whatever its parent heading is set to.
    .filter((value) => value !== '16px' && value !== 'inherit');

  assert.deepEqual(offenders, [], `font-size values bypassing the scale: ${offenders.join(', ')}`);
});

test('the type scale is a strictly ascending ladder', () => {
  const steps = declaredSteps();
  assert.ok(steps.length >= 8, `expected a real scale, found ${steps.length} steps`);

  const sizes = steps.map((step) => step.rem);
  const ascending = [...sizes].sort((a, b) => a - b);
  assert.deepEqual(sizes, ascending, 'declare --fs-* steps in ascending order so the ladder reads top to bottom');
  assert.equal(new Set(sizes).size, sizes.length, 'two --fs-* steps share a value — one of them is redundant');

  const base = steps.find((step) => step.name === '--fs-base');
  assert.ok(base, 'the scale needs an --fs-base anchor');
  assert.equal(base.rem, 1, '--fs-base should stay at 1rem so px maths stays obvious');
});

test('every declared step is actually used', () => {
  for (const { name } of declaredSteps()) {
    const uses = css.split(`var(${name})`).length - 1;
    assert.ok(uses > 0, `${name} is declared but never used — drop the step or use it`);
  }
});
