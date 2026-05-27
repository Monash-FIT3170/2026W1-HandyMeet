export const ReactionTopic = 'reaction';

export enum Reaction {
  RaiseHand = 'raiseHand',
  ThumbsDown = 'thumbsDown',
  ThumbsUp = 'thumbsUp',
  Hello = 'hello',
  Tired = 'tired',
  Ok = 'ok',
  ThankYou = 'thankYou',
}

export const REACTION_MAP: Record<Reaction, { emoji: string; label: string }> =
  {
    [Reaction.RaiseHand]: { emoji: '✋', label: 'Raised their hand' },
    [Reaction.ThumbsUp]: { emoji: '👍', label: 'Agrees' },
    [Reaction.ThumbsDown]: { emoji: '👎', label: 'Disagrees' },
    [Reaction.Hello]: { emoji: '👋', label: 'Says hello' },
    [Reaction.Tired]: { emoji: '😴', label: 'Is tired' },
    [Reaction.Ok]: { emoji: '👌', label: 'Is OK' },
    [Reaction.ThankYou]: { emoji: '🙏', label: 'Says thank you' },
  };
