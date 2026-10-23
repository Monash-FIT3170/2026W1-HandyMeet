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
      .fn<typeof fetch>()
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
});
