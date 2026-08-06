import { NextRequest, NextResponse } from 'next/server';

const GROQ_CHAT_COMPLETIONS_URL =
  'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';

export async function POST(req: NextRequest) {
  try {
    const { transcript, knownActionItems } = await req.json();

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json(
        { error: 'Transcript is required and must be a string.' },
        { status: 400 },
      );
    }

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY is missing from .env.local.' },
        { status: 500 },
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const knownItemsJson = JSON.stringify(
      Array.isArray(knownActionItems) ? knownActionItems : [],
    );

    const prompt = `
You are monitoring a live meeting transcript while the meeting is still in progress. Today's date is ${today}.

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

    const groqResponse = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
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

    const newActionItems =
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { newActionItems?: unknown }).newActionItems)
        ? (parsed as { newActionItems: unknown[] }).newActionItems
        : [];

    return NextResponse.json({ newActionItems });
  } catch (error) {
    console.error('Live insight extraction failed:', error);

    return NextResponse.json(
      { error: 'Failed to extract live action items.' },
      { status: 500 },
    );
  }
}
