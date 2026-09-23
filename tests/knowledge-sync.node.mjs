import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KNOWLEDGE } from '../netlify/functions/lib/knowledge.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Every role/project the page advertises must also live in the chat knowledge
// base, so the "Ask Pranav" bot never gives stale or incomplete answers.
const requiredFacts = [
  'Siva Info',
  'American Chemical Society',
  'Stock Screen',
  'Singularity',
  'PII',
  'Multimodal'
];

test('knowledge base stays in sync with the page content', () => {
  for (const fact of requiredFacts) {
    assert.ok(html.includes(fact), `index.html no longer mentions "${fact}" — update this guard`);
    assert.ok(KNOWLEDGE.includes(fact), `knowledge base is missing "${fact}"`);
  }
});

test('knowledge base contains the verified career and education facts', () => {
  const verifiedFacts = [
    'Independent Contractor - AI',
    'AI Workplace Engineer Intern',
    'Lumina Datamatics | Chennai, India',
    'graduated May 2024',
    'GPA 8.51/10.0',
    'published research paper and technical report',
    // Stock Screen is shut down; the bot must not present it as live.
    'Stock Screen is archived'
  ];

  for (const fact of verifiedFacts) {
    assert.ok(KNOWLEDGE.includes(fact), `knowledge base is missing verified fact: ${fact}`);
  }
});

// The list above is hand-maintained, so it can only catch a role being *removed*
// from the page — a newly added one slips through silently. Derive the roles the
// page currently advertises as "Current" instead: those are exactly the facts the
// bot must not be stale on, and a new one enrols itself in this guard.
function currentRolesOnPage(pageHtml) {
  return pageHtml
    .split('class="timeline-item"')
    .slice(1)
    .filter((item) => item.includes('current-badge'))
    .map((item) => {
      const role = item.match(/<h3>([^<]+)<\/h3>/);
      const org = item.match(/<h4>([^<]+)<\/h4>/);
      return {
        role: role ? role[1].trim() : null,
        // "American Chemical Society | Washington, DC" -> "American Chemical Society"
        org: org ? org[1].split('|')[0].trim() : null,
      };
    });
}

test('every role the page badges as Current is in the chat knowledge base', () => {
  const current = currentRolesOnPage(html);
  assert.ok(current.length > 0, 'no Current-badged timeline items found — has the markup changed?');

  for (const { role, org } of current) {
    assert.ok(org, `a Current timeline item has no <h4> organisation: ${JSON.stringify({ role, org })}`);
    assert.ok(
      KNOWLEDGE.includes(org),
      `index.html advertises "${role} at ${org}" as a current role but the knowledge base never mentions "${org}" — the Ask Pranav bot will give a stale answer about what Pranav does now`
    );
  }
});
