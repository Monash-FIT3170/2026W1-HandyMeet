import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json();

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json(
        { error: 'Transcript is required and must be a string.' },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is missing from .env.local.' },
        { status: 500 },
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: 'gemini-3-flash-preview',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const prompt = `
You are monitoring a live meeting transcript while the meeting is still in progress.

From the transcript so far, extract only concrete action items: tasks, follow-ups, or commitments that someone has explicitly stated or clearly agreed to do.

Rules:
- Return ONLY a JSON array, with no other text.
- Each element must be an object: { "task": string, "owner": string | null }.
- "owner" is the person assigned to or who volunteered for the task, if stated; otherwise null.
- Do not include general discussion points, decisions, or opinions that are not actionable tasks.
- Do not include duplicate or near-duplicate items.
- If there are no action items yet, return [].

Transcript so far:
${transcript}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let actionItems: unknown;
    try {
      actionItems = JSON.parse(text);
    } catch {
      actionItems = [];
    }

    if (!Array.isArray(actionItems)) {
      actionItems = [];
    }

    return NextResponse.json({ actionItems });
  } catch (error) {
    console.error('Live insight extraction failed:', error);

    return NextResponse.json(
      { error: 'Failed to extract live action items.' },
      { status: 500 },
    );
  }
}
