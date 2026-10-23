import type { CardPack, RoomJson } from '../../server/protocol.ts';

/** Display names of the card packs, in the order the deck menu lists them. */
export const CARD_PACK_LABELS: Record<CardPack, string> = {
  goat: 'Mountain Goat',
  fib: 'Fibonacci',
  seq: 'Sequential',
  play: 'Playing Cards',
  tshirt: 'T-Shirt',
};

/** The cards in each pack, in deck order. */
export const CARDS: Record<CardPack, readonly string[]> = {
  goat: ['0', '½', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'],
  fib: ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?'],
  seq: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '?'],
  play: ['A♠', '2', '3', '5', '8', '♔'],
  tshirt: ['XL', 'L', 'M', 'S', 'XS', '?'],
};

/** Shown on the face of a vote until everyone has voted. */
export const HIDDEN_VOTE = 'oi!';

/** How a finished vote went; drives the colour of the logo and the page. */
export type Outcome = 'unanimous' | 'not-unanimous' | 'problem' | 'unfinished';

/** A vote laid out on the table. */
interface TableVote {
  sessionId: string;
  vote: string;
  /** The vote, or {@link HIDDEN_VOTE} while voting is still open */
  visibleVote: string;
}

/** Everything the room shows about the current round of voting. */
export interface VoteSummary {
  votes: TableVote[];
  /** Empty seats on the table for voters who have not voted yet */
  placeholderCount: number;
  /** Everyone has voted, or the admin forced a reveal */
  finished: boolean;
  outcome: Outcome;
  average: number;
  /** Standard deviation, formatted to two decimals */
  standardDeviation: string;
  showAverage: boolean;
  revealDisabled: boolean;
  sortDisabled: boolean;
}

/** The numeric value of a card, or undefined for cards without one (`?`, `☕`, T-shirt sizes). */
export function cardValue(card: string): number | undefined {
  if (/^[0-9]+$/.test(card)) return parseFloat(card);
  if (card === '½') return 0.5;
  if (card === 'A♠') return 1;
  if (card === '♔') return 13;
  return undefined;
}

/** Arithmetic mean; NaN for no values. */
export function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/** Population standard deviation around `mean`. */
export function standardDeviation(
  values: readonly number[],
  mean: number,
): number {
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

/** Works out what the table shows for a room's current votes. */
export function summarizeVotes(
  room: Pick<
    RoomJson,
    'connections' | 'cardPack' | 'forcedReveal' | 'alreadySorted'
  >,
): VoteSummary {
  const voterCount = room.connections.filter((c) => c.voter).length;
  const cast = room.connections.flatMap(({ sessionId, vote }) =>
    vote ? [{ sessionId, vote }] : [],
  );
  const finished = room.forcedReveal || cast.length === voterCount;
  // Hide the votes until everyone has voted, so nobody is swayed by the others.
  const hidden = !room.forcedReveal && cast.length < voterCount;

  let votes = cast.map((v) => ({
    ...v,
    visibleVote: hidden ? HIDDEN_VOTE : v.vote,
  }));
  if (finished && room.alreadySorted) {
    const deck = CARDS[room.cardPack];
    votes = votes.toSorted(
      (a, b) => deck.indexOf(a.vote) - deck.indexOf(b.vote),
    );
  }

  const placeholderCount = Math.max(voterCount - cast.length, 0);
  const values = cast
    .map((v) => cardValue(v.vote))
    .filter((value) => value !== undefined);
  const mean = average(values);
  const revealDisabled = !(
    !room.forcedReveal &&
    (cast.length < voterCount || voterCount === 0)
  );

  return {
    votes,
    placeholderCount,
    finished,
    outcome: finished ? outcomeOf(cast, voterCount) : 'unfinished',
    average: mean,
    standardDeviation: standardDeviation(values, mean).toFixed(2),
    showAverage: placeholderCount === 0 && values.length > 0,
    revealDisabled,
    sortDisabled: !revealDisabled || room.alreadySorted,
  };
}

function outcomeOf(
  votes: ReadonlyArray<{ vote: string }>,
  voterCount: number,
): Outcome {
  if (votes.length === 0) return 'unfinished';
  const distinct = new Set(votes.map((v) => v.vote)).size;
  if (distinct === 1) return 'unanimous';
  // Nobody agrees, or (in a bigger room) only two people do.
  if (distinct === voterCount) return 'problem';
  if (voterCount > 3 && distinct === voterCount - 1) return 'problem';
  return 'not-unanimous';
}
