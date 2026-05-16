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
    });

    const prompt = `
Summarise the following meeting transcript clearly and concisely.

Include:
- Key discussion points
- Decisions made
- Action items, if any

Transcript:
${transcript}
`;

    const result = await model.generateContent(prompt);
    const summary = result.response.text();

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Summary generation failed:', error);

    return NextResponse.json(
      { error: 'Failed to generate summary.' },
      { status: 500 },
    );
  }
}
