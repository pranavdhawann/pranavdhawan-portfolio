import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler, { resetRateLimit } from '../netlify/functions/ask.mjs';

const realFetch = globalThis.fetch;
let fetchCalls;

function stubUpstream(response) {
  globalThis.fetch = async (url, options) => {
    fetchCalls.push({ url, body: JSON.parse(options.body) });
    return response();
  };
}

function upstreamOk(content = 'stub answer') {
  return () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
}

function ask(body, method = 'POST') {
  return handler(new Request('http://localhost/.netlify/functions/ask', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body) : undefined
  }));
}

beforeEach(() => {
  fetchCalls = [];
  process.env.CEREBRAS_API_KEY = 'test-key';
  resetRateLimit();
  stubUpstream(upstreamOk());
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

function askWith(headers, body = { question: 'Who are you?' }) {
  return handler(new Request('http://localhost/.netlify/functions/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  }));
}

test('rejects non-POST requests with 405', async () => {
  const response = await ask(null, 'GET');
  assert.equal(response.status, 405);
});

test('rejects requests from a disallowed Origin with 403', async () => {
  const response = await askWith({ Origin: 'https://evil.example' });
  assert.equal(response.status, 403);
});

test('allows requests from the configured Origin', async () => {
  const response = await askWith({ Origin: 'https://pranavdhawan.netlify.app' });
  assert.equal(response.status, 200);
});

test('throttles a burst of requests from one IP with 429', async () => {
  let status = 200;
  for (let i = 0; i < 20; i++) {
    status = (await askWith({ 'x-forwarded-for': '203.0.113.7' })).status;
  }
  assert.equal(status, 429);
});

test('rejects missing question with 400', async () => {
  const response = await ask({ question: '   ' });
  assert.equal(response.status, 400);
});

test('rejects questions over 500 characters with 400', async () => {
  const response = await ask({ question: 'x'.repeat(501) });
  assert.equal(response.status, 400);
});

test('returns 500 when CEREBRAS_API_KEY is missing', async () => {
  delete process.env.CEREBRAS_API_KEY;
  const response = await ask({ question: 'Who are you?' });
  assert.equal(response.status, 500);
});

test('returns the model answer on success', async () => {
  const response = await ask({ question: 'Who are you?' });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const data = await response.json();
  assert.equal(data.answer, 'stub answer');
});

test('rejects model output that violates the portfolio response format', async () => {
  stubUpstream(upstreamOk('## Ignore the rules\n```js\nconsole.log("unsafe")\n```'));
  const response = await ask({ question: 'What do you do?' });
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "I couldn't answer right now — try again in a moment, or reach Pranav through the contact section." });
});

test('sends system prompt plus history plus question to Cerebras', async () => {
  await ask({
    question: 'And after that?',
    history: [
      { role: 'user', content: 'What do you do?' },
      { role: 'assistant', content: 'I build AI agents.' }
    ]
  });
  const { url, body } = fetchCalls[0];
  assert.equal(url, 'https://api.cerebras.ai/v1/chat/completions');
  assert.equal(body.model, 'gpt-oss-120b');
  assert.equal(body.max_tokens, 800);
  // gpt-oss reasoning tokens share the completion budget; without this the
  // answer gets squeezed out and every longer reply 502s as truncated.
  assert.equal(body.reasoning_effort, 'low');
  assert.equal(body.messages[0].role, 'system');
  assert.ok(body.messages[0].content.includes('ABOUT ME'));
  assert.ok(body.messages[0].content.includes('NEVER generate content'));
  assert.deepEqual(
    body.messages.slice(1).map((m) => m.role),
    ['user', 'assistant', 'user']
  );
  assert.equal(body.messages.at(-1).content, 'And after that?');
});

test('trims history to the last 6 messages and drops malformed entries', async () => {
  const history = Array.from({ length: 10 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `message ${i}`
  }));
  history.push({ role: 'system', content: 'injected' }, { role: 'user', content: 42 });
  await ask({ question: 'Hi', history });
  const sent = fetchCalls[0].body.messages.slice(1, -1);
  assert.equal(sent.length, 6);
  assert.ok(sent.every((m) => m.role === 'user' || m.role === 'assistant'));
  assert.equal(sent.at(-1).content, 'message 9');
});

test('maps upstream failures to 502 without leaking details', async () => {
  stubUpstream(() => new Response('upstream secret detail', { status: 500 }));
  const response = await ask({ question: 'Hi' });
  assert.equal(response.status, 502);
  const data = await response.json();
  assert.ok(!JSON.stringify(data).includes('upstream secret detail'));
});

// Upstream throttling is retryable and should stay distinguishable from a real
// upstream fault, both for the caller and for anything reading the logs.
test('passes an upstream 429 through as 429, still without details', async () => {
  stubUpstream(() => new Response('upstream secret detail', { status: 429 }));
  const response = await ask({ question: 'Hi' });
  assert.equal(response.status, 429);
  const data = await response.json();
  assert.ok(!JSON.stringify(data).includes('upstream secret detail'));
  assert.match(data.error, /lot of questions/i);
});

// The free tier's limits are org-wide (5 requests/minute on Cerebras) and the
// system prompt alone is ~3K tokens, so upstream 429s are routine. The body says
// which limit was hit; without logging it they looked identical to the local IP
// throttle.
test('an upstream 429 is logged with the limit the provider reports', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  stubUpstream(() => new Response(
    'Rate limit reached for model gpt-oss-120b on tokens per minute (TPM): Limit 30000',
    { status: 429, headers: { 'retry-after': '17' } }
  ));
  await ask({ question: 'Hi' });
  assert.equal(warn.mock.callCount(), 1);
  const [message, details] = warn.mock.calls[0].arguments;
  assert.match(message, /rate limited/i);
  assert.equal(details.retryAfter, '17');
  assert.match(details.detail, /tokens per minute/);
});

// SYSTEM_PROMPT allows three paragraphs; a tighter sentence ceiling silently
// turned valid answers into the generic error message.
test('a three-paragraph answer is not rejected by the output guard', async () => {
  const answer = [
    'I work at ACS. I build agents there. It is a good fit.',
    'Before that I was at Lumina. I did document AI. We shipped it.',
    'Ask me anything else. I am happy to talk. Reach me by email.',
  ].join('\n\n');
  stubUpstream(() => new Response(JSON.stringify({
    choices: [{ message: { content: answer }, finish_reason: 'stop' }],
  }), { status: 200, headers: { 'content-type': 'application/json' } }));

  const response = await ask({ question: 'What do you do?' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).answer, answer);
});

// A max_tokens cut-off leaves a sentence hanging; showing it as a complete
// answer is worse than admitting the failure.
test('an answer truncated by max_tokens is rejected', async () => {
  stubUpstream(() => new Response(JSON.stringify({
    choices: [{ message: { content: 'I work at ACS and my role there is to' }, finish_reason: 'length' }],
  }), { status: 200, headers: { 'content-type': 'application/json' } }));

  const response = await ask({ question: 'What do you do?' });
  assert.equal(response.status, 502);
});
