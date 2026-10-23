import { extractLiveActionItems } from './liveInsights';

const options = {
  transcript: 'Sam: I will send the report by Friday.',
  knownActionItems: [{ task: 'Book a room', owner: null, dueDate: null }],
  apiKey: 'test-groq-key',
  today: new Date('2026-10-22T23:30:00-04:00'),
};

function completion(content: string | null): Response {
  return Response.json({ choices: [{ message: { content } }] });
}

describe('extractLiveActionItems', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('sends meeting context and returns the provider action items', async () => {
    const items = [
      { task: 'Send the report', owner: 'Sam', dueDate: '2026-10-23' },
      { task: 'Arrange a follow-up', owner: null, dueDate: null },
    ];
    const fetchImpl = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(completion(JSON.stringify({ newActionItems: items })));

    await expect(
      extractLiveActionItems({ ...options, fetchImpl }),
    ).resolves.toEqual(items);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-groq-key',
        },
      }),
    );
    const requestBody = JSON.parse(fetchImpl.mock.calls[0][1]?.body as string);
    expect(requestBody).toEqual({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: expect.any(String) }],
      response_format: { type: 'json_object' },
    });
    const prompt = requestBody.messages[0].content;
    expect(prompt).toContain("Today's date is 2026-10-23");
    expect(prompt).toContain(options.transcript);
    expect(prompt).toContain(JSON.stringify(options.knownActionItems));
  });

  test('uses global fetch and the current date when overrides are omitted', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-24T12:00:00Z'));
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(completion('{"newActionItems":[]}'));

    await expect(
      extractLiveActionItems({
        transcript: 'No follow-up needed.',
        knownActionItems: [],
        apiKey: 'test-key',
      }),
    ).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(requestBody.messages[0].content).toContain(
      "Today's date is 2026-10-24",
    );
  });

  test('rejects a missing API key before making a request', async () => {
    const fetchImpl = jest.fn<
      ReturnType<typeof fetch>,
      Parameters<typeof fetch>
    >();

    await expect(
      extractLiveActionItems({ ...options, apiKey: '', fetchImpl }),
    ).rejects.toThrow('GROQ_API_KEY is missing from .env.local.');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('includes the status and provider error body when a request fails', async () => {
    const fetchImpl = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(new Response('Rate limit exceeded', { status: 429 }));

    await expect(
      extractLiveActionItems({ ...options, fetchImpl }),
    ).rejects.toThrow('Groq request failed (429): Rate limit exceeded');
  });

  test('propagates network failures so callers can handle them', async () => {
    const error = new Error('Connection lost');
    const fetchImpl = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockRejectedValue(error);

    await expect(
      extractLiveActionItems({ ...options, fetchImpl }),
    ).rejects.toBe(error);
  });

  test('propagates invalid provider response JSON', async () => {
    const fetchImpl = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(new Response('Service temporarily unavailable'));

    await expect(
      extractLiveActionItems({ ...options, fetchImpl }),
    ).rejects.toMatchObject({ name: 'SyntaxError' });
  });

  test.each([
    ['malformed JSON', 'Here are your action items'],
    ['an empty string', ''],
    ['null', 'null'],
    ['a primitive', '42'],
    ['an array', '[]'],
    ['a missing action items field', '{}'],
    ['a null action items field', '{"newActionItems":null}'],
    [
      'an object action items field',
      '{"newActionItems":{"task":"Send report"}}',
    ],
  ])(
    'returns no items when the generated content is %s',
    async (_name, content) => {
      const fetchImpl = jest
        .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
        .mockResolvedValue(completion(content));

      await expect(
        extractLiveActionItems({ ...options, fetchImpl }),
      ).resolves.toEqual([]);
    },
  );

  test.each([
    ['missing choices', {}],
    ['empty choices', { choices: [] }],
    ['missing message', { choices: [{}] }],
    ['missing content', { choices: [{ message: {} }] }],
    ['null content', { choices: [{ message: { content: null } }] }],
  ])('returns no items for a response with %s', async (_name, body) => {
    const fetchImpl = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(Response.json(body));

    await expect(
      extractLiveActionItems({ ...options, fetchImpl }),
    ).resolves.toEqual([]);
  });
});
