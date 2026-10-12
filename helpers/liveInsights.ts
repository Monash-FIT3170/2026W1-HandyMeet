const GROQ_CHAT_COMPLETIONS_URL =
  'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';

export type LiveInsightActionItemFields = {
  task: string;
  owner: string | null;
  dueDate: string | null;
};

export type LiveInsightActionItemStatus =
  | 'suggested'
  | 'accepted'
  | 'dismissed';

export type LiveInsightActionItem = LiveInsightActionItemFields & {
  id: string;
  status: LiveInsightActionItemStatus;
  assigneeId: string | null;
};

type ExtractLiveActionItemsOptions = {
  transcript: string;
  knownActionItems: unknown[];
  apiKey: string;
  fetchImpl?: typeof fetch;
  today?: Date;
};

export async function extractLiveActionItems({
  transcript,
  knownActionItems,
  apiKey,
  fetchImpl = fetch,
  today = new Date(),
}: ExtractLiveActionItemsOptions): Promise<LiveInsightActionItemFields[]> {
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is missing from .env.local.');
  }

  const todayString = today.toISOString().slice(0, 10);
  const knownItemsJson = JSON.stringify(knownActionItems);

  const prompt = `
You are monitoring a live meeting transcript while the meeting is still in progress. Today's date is ${todayString}.

Action items already found so far (do not repeat these):
${knownItemsJson}

New transcript since the last check:
${transcript}

From the new transcript only, extract any concrete action items not already listed above: tasks, follow-ups, or commitments that someone has explicitly stated or clearly agreed to do.

Rules:
- Respond with ONLY a JSON object of the form { "newActionItems": [...] }, no other text.
- Each element of "newActionItems" must be an object: { "task": string, "owner": string | null, "dueDate": string | null }.
- "owner" is the person assigned to or who volunteered for the task, if stated; otherwise null.
- "dueDate" is the task's due date as YYYY-MM-DD, if a specific date or day (e.g. "by Friday", "next Monday") is stated, resolved relative to today's date; otherwise null.
- Do not include general discussion points, decisions, or opinions that are not actionable tasks.
- Do not repeat an item already listed above, even if phrased differently.
- If there are no new action items, "newActionItems" should be [].
`;

  const groqResponse = await fetchImpl(GROQ_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });

  if (!groqResponse.ok) {
    const errorText = await groqResponse.text();
    throw new Error(
      `Groq request failed (${groqResponse.status}): ${errorText}`,
    );
  }

  const data = await groqResponse.json();
  const text = data.choices?.[0]?.message?.content ?? '';

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {};
  }

  return parsed &&
    typeof parsed === 'object' &&
    Array.isArray((parsed as { newActionItems?: unknown }).newActionItems)
    ? (parsed as { newActionItems: LiveInsightActionItemFields[] })
        .newActionItems
    : [];
}
