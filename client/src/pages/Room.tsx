import { useEffect, useRef, useState } from 'react';
import { CardPackDropdown } from '../components/CardPackDropdown.tsx';
import { useRoom } from '../useRoom.ts';
import type { Outcome } from '../voting.ts';

// The votes are first drawn face down, then flipped, so the flip animates.
const FLIP_DELAY_MS = 100;

// True once `flag` has stayed true for `delay` ms; false again as soon as `flag` is.
function useDelayedFlag(flag: boolean, delay: number): boolean {
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    if (!flag) return;
    const timer = setTimeout(() => {
      setDelayed(true);
    }, delay);
    return () => {
      clearTimeout(timer);
      setDelayed(false);
    };
  }, [flag, delay]);
  return flag && delayed;
}

/** A planning poker room: the deck to vote from and the votes on the table. */
export function Room({
  roomUrl,
  onOutcomeChange,
}: {
  roomUrl: string;
  /** Reports how the vote went, so the page can take on its colour */
  onOutcomeChange: (outcome: Outcome) => void;
}) {
  const room = useRoom(roomUrl);
  const { summary, voter, myVote } = room;
  const chosenCards = useRef<HTMLDivElement>(null);
  const flipped = useDelayedFlag(summary.finished, FLIP_DELAY_MS);

  useEffect(() => {
    onOutcomeChange(summary.outcome);
  }, [summary.outcome, onOutcomeChange]);
  useEffect(
    () => () => {
      onOutcomeChange('unfinished');
    },
    [onOutcomeChange],
  );

  const deckDisabled = summary.finished || !voter;

  return (
    <div>
      <p className="roomNumber">Room: {roomUrl}</p>

      <section className="cardPanel">
        <div className="row cardPanel-meta">
          <div className="span2 subheading">
            <span>
              {voter
                ? 'Choose your estimate...'
                : 'You have chosen not to vote.'}
            </span>
          </div>
          <div className="span2 pullright">
            {room.admin && room.cardPack && (
              <CardPackDropdown
                cardPack={room.cardPack}
                onSelect={room.setCardPack}
              />
            )}
          </div>
        </div>

        <div className={deckDisabled ? 'cards card--disabled' : 'cards'}>
          {room.cards.map((card) => (
            <div
              key={card}
              className={card === myVote ? 'card card--selected' : 'card'}
              onClick={() => {
                if (room.vote(card)) {
                  chosenCards.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                  });
                }
              }}
            >
              {card}
            </div>
          ))}
        </div>
      </section>

      <section className="votePanel">
        <div className="switch">
          <input
            type="checkbox"
            checked={voter}
            disabled={summary.revealDisabled}
            onChange={(event) => {
              room.toggleVoter(event.target.checked);
            }}
          />
          <label
            className="btn"
            data-on="You are a voter"
            data-off="You are not a voter"
          >
            I am voting
          </label>
        </div>

        {!voter ? (
          <p>&nbsp;</p>
        ) : myVote == null ? (
          <p>You haven&apos;t estimated yet</p>
        ) : (
          <p>
            Your current estimate: <b>{myVote}</b>
          </p>
        )}

        <div
          ref={chosenCards}
          id="chosenCards"
          className={flipped ? 'cards flipped-stagger' : 'cards'}
        >
          {summary.votes.map((vote) => (
            <div
              key={vote.sessionId}
              className={
                vote.sessionId === room.sessionId
                  ? 'card card--2-sided vote card--selected'
                  : 'card card--2-sided vote'
              }
              onClick={() => {
                room.unvote(vote.sessionId);
              }}
            >
              <div className="card--side-1">x</div>
              <div className="card--side-2">{vote.visibleVote}</div>
            </div>
          ))}
          {Array.from({ length: summary.placeholderCount }, (_, i) => (
            <div key={i} className="card card--placeholder">
              &nbsp;
            </div>
          ))}

          {summary.showAverage && (
            <div className="voting-average">
              Average:{' '}
              <b>
                {summary.average} (StdDev = {summary.standardDeviation})
              </b>
            </div>
          )}
        </div>

        {room.admin && (
          <div className="row">
            <button
              type="button"
              className="span2 btn"
              title="Start a new vote"
              onClick={room.resetVote}
            >
              <i className="icon icon-refresh"></i> Reset
            </button>{' '}
            <button
              type="button"
              className="span2 btn"
              title="Force a reveal of all cards if there are some stragglers"
              disabled={summary.revealDisabled}
              onClick={room.forceReveal}
            >
              <i className="icon icon-exclamation-sign"></i> Reveal
            </button>{' '}
            <button
              type="button"
              className="span2 btn"
              title="Sort votes in order of cards in deck"
              disabled={summary.sortDisabled}
              onClick={room.sortVotes}
            >
              <i className="icon">
                <span className="icon-sort"></span>
              </i>{' '}
              Sort votes
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
