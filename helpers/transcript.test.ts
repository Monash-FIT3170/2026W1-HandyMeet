import { cleanTranscriptLines } from './transcript';

describe('cleanTranscriptLines', () => {
  test('drops blank and whitespace-only lines', () => {
    const result = cleanTranscriptLines([
      'Alice: hello.',
      '   ',
      '',
      'Alice: how are you?',
    ]);

    expect(result).toEqual(['Alice: hello.', 'Alice: how are you?']);
  });

  test('collapses consecutive exact duplicate lines', () => {
    const result = cleanTranscriptLines([
      'Alice: send the report.',
      'Alice: send the report.',
      'Alice: send the report.',
    ]);

    expect(result).toEqual(['Alice: send the report.']);
  });

  test('keeps only the latest version of a line that keeps getting longer', () => {
    const result = cleanTranscriptLines([
      "Alice: I'll send",
      "Alice: I'll send the",
      "Alice: I'll send the report by Friday.",
    ]);

    expect(result).toEqual(["Alice: I'll send the report by Friday."]);
  });

  test('keeps a corrected line separate if it does not just add to the end', () => {
    const result = cleanTranscriptLines([
      "Alice: I'll send the report.",
      "Alice: I'll send the budget report.",
    ]);

    expect(result).toEqual([
      "Alice: I'll send the report.",
      "Alice: I'll send the budget report.",
    ]);
  });

  test('preserves alternating lines from two speakers taking turns', () => {
    const result = cleanTranscriptLines([
      'Alice: I can take the report.',
      'Bob: sounds good.',
      'Alice: due Friday.',
    ]);

    expect(result).toEqual([
      'Alice: I can take the report.',
      'Bob: sounds good.',
      'Alice: due Friday.',
    ]);
  });
});
