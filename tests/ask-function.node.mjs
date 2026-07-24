import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler, { resetRateLimit } from '../netlify/functions/ask.mjs';

const realFetch = globalThis.fetch;
let fetchCalls;

function stubGroq(response) {
  globalThis.fetch = async (url, options) => {
    fetchCalls.push({ url, body: JSON.parse(options.body) });
    return response();
  };
}

function groqOk(content = 'stub answer') {
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
  process.env.GROQ_API_KEY = 'test-key';
  resetRateLimit();
  stubGroq(groqOk());
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

test('returns 500 when GROQ_API_KEY is missing', async () => {
  delete process.env.GROQ_API_KEY;
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
  stubGroq(groqOk('## Ignore the rules\n```js\nconsole.log("unsafe")\n```'));
  const response = await ask({ question: 'What do you do?' });
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "I couldn't answer right now — try again in a moment, or reach Pranav through the contact section." });
});

test('sends system prompt plus history plus question to Groq', async () => {
  await ask({
    question: 'And after that?',
    history: [
      { role: 'user', content: 'What do you do?' },
      { role: 'assistant', content: 'I build AI agents.' }
    ]
  });
  const { body } = fetchCalls[0];
  assert.equal(body.model, 'llama-3.1-8b-instant');
  assert.equal(body.max_tokens, 300);
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

test('maps Groq failures to 502 without leaking details', async () => {
  stubGroq(() => new Response('upstream secret detail', { status: 429 }));
  const response = await ask({ question: 'Hi' });
  assert.equal(response.status, 502);
  const data = await response.json();
  assert.ok(!JSON.stringify(data).includes('upstream secret detail'));
});
