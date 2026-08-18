import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from './route';

const ROUTE_URL = 'http://localhost/api/live-insights';

function postRequest(body: unknown): NextRequest {
  return new NextRequest(ROUTE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function groqSuccess(newActionItems: unknown[]): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ newActionItems }) } }],
    }),
    { status: 200 },
  );
}

async function withApiKey<T>(
  value: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const original = process.env.GROQ_API_KEY;
  if (value === undefined) {
    delete process.env.GROQ_API_KEY;
  } else {
    process.env.GROQ_API_KEY = value;
  }
  try {
    return await fn();
  } finally {
    if (original === undefined) {
      delete process.env.GROQ_API_KEY;
    } else {
      process.env.GROQ_API_KEY = original;
    }
  }
}

test('returns 500 when GROQ_API_KEY is not configured', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('fetch should not be called');
  });

  const response = await withApiKey(undefined, () =>
    POST(postRequest({ transcript: 'We will ship on Friday.' })),
  );

  assert.equal(response.status, 500);
  const body = await response.json();
  assert.match(body.error, /GROQ_API_KEY/);
});

test('returns the parsed action items on a successful Groq response', async (t) => {
  const expectedItems = [
    { task: 'Send the report', owner: 'Sam', dueDate: '2026-08-21' },
  ];
  t.mock.method(globalThis, 'fetch', async () => groqSuccess(expectedItems));

  const response = await withApiKey('test-key', () =>
    POST(
      postRequest({
        transcript: "I'll send the report by Friday.",
        knownActionItems: [],
      }),
    ),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.newActionItems, expectedItems);
});

test('sends the transcript and known items to Groq in the prompt', async (t) => {
  let capturedBody: { messages: Array<{ content: string }> } | undefined;
  t.mock.method(
    globalThis,
    'fetch',
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return groqSuccess([]);
    },
  );

  await withApiKey('test-key', () =>
    POST(
      postRequest({
        transcript: 'New transcript line.',
        knownActionItems: [
          { task: 'Existing task', owner: null, dueDate: null },
        ],
      }),
    ),
  );

  const prompt = capturedBody?.messages[0]?.content ?? '';
  assert.match(prompt, /New transcript line\./);
  assert.match(prompt, /Existing task/);
});
