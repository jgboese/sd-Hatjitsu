import { describe, expect, test } from 'vitest';
import type { CardPack, Connection } from '../../server/protocol.ts';
import {
  average,
  cardValue,
  HIDDEN_VOTE,
  standardDeviation,
  summarizeVotes,
} from './voting.ts';

// Builds a room from `sessionId: vote` pairs; a null vote is a voter who has not voted yet
function room(
  votes: Record<string, string | null>,
  options: {
    cardPack?: CardPack;
    forcedReveal?: boolean;
    alreadySorted?: boolean;
    nonVoters?: string[];
  } = {},
) {
  const connections: Connection[] = [
    ...Object.entries(votes).map(([sessionId, vote]) => ({
      sessionId,
      socketId: `socket-${sessionId}`,
      vote,
      voter: true,
    })),
    ...(options.nonVoters ?? []).map((sessionId) => ({
      sessionId,
      socketId: `socket-${sessionId}`,
      vote: null,
      voter: false,
    })),
  ];
  return {
    connections,
    cardPack: options.cardPack ?? 'goat',
    forcedReveal: options.forcedReveal ?? false,
    alreadySorted: options.alreadySorted ?? false,
  };
}

describe('cardValue', () => {
  test('reads numbers and the special cards', () => {
    expect(cardValue('13')).toBe(13);
    expect(cardValue('½')).toBe(0.5);
    expect(cardValue('A♠')).toBe(1);
    expect(cardValue('♔')).toBe(13);
  });

  test('has no value for cards without a number', () => {
    expect(cardValue('?')).toBeUndefined();
    expect(cardValue('☕')).toBeUndefined();
    expect(cardValue('XL')).toBeUndefined();
  });
});

describe('average and standardDeviation', () => {
  test('use the population standard deviation', () => {
    const values = [5, 8];
    const mean = average(values);

    expect(mean).toBe(6.5);
    expect(standardDeviation(values, mean)).toBe(1.5);
  });
});

describe('summarizeVotes', () => {
  test('hides the votes and leaves a seat per missing vote until everyone has voted', () => {
    const summary = summarizeVotes(room({ alice: '5', bob: null }));

    expect(summary.votes).toEqual([
      { sessionId: 'alice', vote: '5', visibleVote: HIDDEN_VOTE },
    ]);
    expect(summary).toMatchObject({
      placeholderCount: 1,
      finished: false,
      outcome: 'unfinished',
      showAverage: false,
      revealDisabled: false,
      sortDisabled: true,
    });
  });

  test('reveals the votes with their average once everyone has voted', () => {
    const summary = summarizeVotes(room({ alice: '5', bob: '8' }));

    expect(summary.votes.map((v) => v.visibleVote)).toEqual(['5', '8']);
    expect(summary).toMatchObject({
      placeholderCount: 0,
      finished: true,
      average: 6.5,
      standardDeviation: '1.50',
      showAverage: true,
      revealDisabled: true,
      sortDisabled: false,
    });
  });

  test('a forced reveal shows the votes cast so far, without an average', () => {
    const summary = summarizeVotes(
      room({ alice: '5', bob: null }, { forcedReveal: true }),
    );

    expect(summary.votes.map((v) => v.visibleVote)).toEqual(['5']);
    expect(summary).toMatchObject({
      finished: true,
      placeholderCount: 1,
      showAverage: false,
      revealDisabled: true,
    });
  });

  test('participants who do not vote are not waited for', () => {
    const summary = summarizeVotes(
      room({ alice: '5' }, { nonVoters: ['bob'] }),
    );

    expect(summary).toMatchObject({ finished: true, placeholderCount: 0 });
  });

  test('cards without a number are left out of the average', () => {
    const summary = summarizeVotes(room({ alice: '3', bob: '?' }));

    expect(summary).toMatchObject({ average: 3, showAverage: true });
  });

  test('no average when no card has a number', () => {
    const summary = summarizeVotes(room({ alice: '?', bob: '☕' }));

    expect(summary.showAverage).toBe(false);
  });

  test('sorted votes follow the order of the deck', () => {
    const summary = summarizeVotes(
      room({ alice: '13', bob: '½', carol: '3' }, { alreadySorted: true }),
    );

    expect(summary.votes.map((v) => v.vote)).toEqual(['½', '3', '13']);
    expect(summary.sortDisabled).toBe(true);
  });

  test('votes are not sorted before they are revealed', () => {
    const summary = summarizeVotes(
      room({ alice: '13', bob: '3', carol: null }, { alreadySorted: true }),
    );

    expect(summary.votes.map((v) => v.vote)).toEqual(['13', '3']);
  });

  describe('outcome', () => {
    test('everyone agreeing is unanimous', () => {
      expect(summarizeVotes(room({ a: '5', b: '5', c: '5' })).outcome).toBe(
        'unanimous',
      );
    });

    test('nobody agreeing is a problem', () => {
      expect(summarizeVotes(room({ a: '3', b: '5', c: '8' })).outcome).toBe(
        'problem',
      );
    });

    test('in a small room, a split vote is not unanimous', () => {
      expect(summarizeVotes(room({ a: '5', b: '5', c: '8' })).outcome).toBe(
        'not-unanimous',
      );
    });

    test('with more than three voters, only two agreeing is a problem', () => {
      const votes = { a: '1', b: '1', c: '3', d: '5' };

      expect(summarizeVotes(room(votes)).outcome).toBe('problem');
    });

    test('with more than three voters, a clear majority is not unanimous', () => {
      const votes = { a: '1', b: '1', c: '1', d: '5' };

      expect(summarizeVotes(room(votes)).outcome).toBe('not-unanimous');
    });

    test('a room without votes has no outcome', () => {
      expect(summarizeVotes(room({}, { nonVoters: ['alice'] })).outcome).toBe(
        'unfinished',
      );
    });
  });
});
