import { NextRequest, NextResponse } from 'next/server';
import { extractLiveActionItems } from '@/helpers/liveInsights';

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

    const knownItems = Array.isArray(knownActionItems) ? knownActionItems : [];
    const newActionItems = await extractLiveActionItems({
      transcript,
      knownActionItems: knownItems,
      apiKey,
    });

    return NextResponse.json({ newActionItems });
  } catch (error) {
    console.error('Live insight extraction failed:', error);

    return NextResponse.json(
      { error: 'Failed to extract live action items.' },
      { status: 500 },
    );
  }
}
