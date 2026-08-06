export function cleanTranscriptLines(lines: string[]): string[] {
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
}
