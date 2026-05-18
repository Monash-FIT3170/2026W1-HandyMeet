'use client';

import { useMemo, useState } from 'react';

type TranscriptSummaryProps = {
  transcript: string[];
  onClose?: () => void;
};

export default function TranscriptSummary({
  transcript,
  onClose,
}: TranscriptSummaryProps) {
  const [activeTab, setActiveTab] = useState<'transcript' | 'summary'>(
    'transcript',
  );

  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  const cleanTranscriptLines = (lines: string[]) => {
    const cleaned: string[] = [];

    for (const line of lines) {
      const current = line.trim();

      if (!current) continue;

      const previous = cleaned[cleaned.length - 1];

      if (!previous) {
        cleaned.push(current);
        continue;
      }

      // Remove exact duplicate lines
      if (current === previous) continue;

      // Remove partial duplicate lines
      if (current.startsWith(previous)) {
        cleaned[cleaned.length - 1] = current;
        continue;
      }

      cleaned.push(current);
    }

    return cleaned;
  };

  const fullTranscript = useMemo(() => {
    return cleanTranscriptLines(transcript).join('\n');
  }, [transcript]);

  const generateSummary = async () => {
    try {
      console.log('Generating summary for transcript:', fullTranscript);
      setLoading(true);

      const response = await fetch('/api/summarise', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: fullTranscript,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('Summarise API error:', response.status, text);
        setSummary(`Error ${response.status}: ${text || response.statusText}`);
        setActiveTab('summary');
        return;
      }

      const data = await response.json();

      setSummary(data.summary || 'No summary generated.');
      setActiveTab('summary');
    } catch (error) {
      console.error(error);
      setSummary('Failed to generate summary.');
    } finally {
      setLoading(false);
    }
  };

  const downloadTranscript = () => {
    const content = `
FULL TRANSCRIPT

${fullTranscript}

-----------------------------------

AI SUMMARY

${summary}
`;

    const blob = new Blob([content], { type: 'text/plain' });

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'meeting-notes.txt';
    a.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 w-full max-w-3xl rounded-xl shadow-xl overflow-hidden border border-neutral-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
          <h2 className="text-xl font-semibold text-neutral-100">
            Transcript Summary
          </h2>

          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-100"
          >
            Close
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-800">
          <button
            onClick={() => setActiveTab('transcript')}
            className={`flex-1 py-3 font-medium ${
              activeTab === 'transcript'
                ? 'border-b-2 border-emerald-500 text-neutral-100'
                : 'text-neutral-500'
            }`}
          >
            Full Transcript
          </button>

          <button
            onClick={() => setActiveTab('summary')}
            className={`flex-1 py-3 font-medium ${
              activeTab === 'summary'
                ? 'border-b-2 border-emerald-500 text-neutral-100'
                : 'text-neutral-500'
            }`}
          >
            AI Summary
          </button>
        </div>

        {/* Content */}
        <div className="p-6 h-[400px] overflow-y-auto whitespace-pre-wrap text-neutral-100">
          {activeTab === 'transcript' ? (
            <div>{fullTranscript || 'No transcript available.'}</div>
          ) : (
            <div>
              {summary
                ? summary
                : 'No AI summary generated yet. Click the button below.'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between border-t border-neutral-800 px-6 py-4">
          <button
            onClick={generateSummary}
            disabled={loading}
            className="px-4 py-2 rounded bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Summary'}
          </button>

          <button
            onClick={downloadTranscript}
            className="px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-100"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
