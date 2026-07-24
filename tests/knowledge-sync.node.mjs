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
  'Weather Dashboard',
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
    'AI Independent Contractor',
    'AI Workplace Engineer Intern',
    'Lumina Datamatics | Chennai, India',
    'graduated May 2024',
    'GPA 8.51/10.0',
    'published research paper and technical report'
  ];

  for (const fact of verifiedFacts) {
    assert.ok(KNOWLEDGE.includes(fact), `knowledge base is missing verified fact: ${fact}`);
  }
});
