import { useState } from 'react';
import { Link, Navigate, Route, Routes, useParams } from 'react-router';
import { useNotifications } from './notifications.tsx';
import { Lobby } from './pages/Lobby.tsx';
import { Room } from './pages/Room.tsx';
import { useConnectionState } from './socket.ts';
import type { Outcome } from './voting.ts';

const OUTCOME_COLORS: Record<Outcome, string | null> = {
  unanimous: 'green',
  'not-unanimous': 'yellow',
  problem: 'red',
  unfinished: null,
};

// Keyed by room, so moving between rooms starts each one from scratch
function RoomRoute({
  onOutcomeChange,
}: {
  onOutcomeChange: (outcome: Outcome) => void;
}) {
  const { roomId = '' } = useParams();
  return (
    <Room key={roomId} roomUrl={roomId} onOutcomeChange={onOutcomeChange} />
  );
}

/** The page layout around the lobby and room routes. */
export function App() {
  const [outcome, setOutcome] = useState<Outcome>('unfinished');
  const { status, pending } = useConnectionState();
  const { message, error } = useNotifications();
  const color = OUTCOME_COLORS[outcome];

  return (
    <div className={color ? `body bg body--${color}` : 'body bg'}>
      <div className="container">
        <header className="header">
          <Link to="/" title="Back to the Lobby">
            <span
              className={
                color ? `header__logo header__logo--${color}` : 'header__logo'
              }
            ></span>
            <h1 className="header__text">Hatjitsu</h1>
          </Link>
          <div className="bg-mount"></div>
        </header>

        <div className="alert">
          {pending > 0 && <div className="activity">Activity&hellip;</div>}
          {status && <div className="socketMessage">{status}</div>}
          {error && <div className="appError">{error}</div>}
          {message && <div className="message">{message}</div>}
        </div>

        <div className="content">
          <Routes>
            <Route path="/" element={<Lobby />} />
            <Route
              path="/:roomId"
              element={<RoomRoute onOutcomeChange={setOutcome} />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        <footer className="footer">
          <p>
            &copy;{' '}
            <a
              href="http://www.ubxd.com"
              title="Ruby on Rails, node, and iOS development in Cape Town"
            >
              UBXD
            </a>{' '}
            2012 - 2013; Built by{' '}
            <a href="http://brea.kfa.st" title="nodejs developer in Cape Town">
              @Jörg
            </a>{' '}
            &amp;{' '}
            <a
              href="mailto:richard.archer@ubxd.com"
              title="Software developer in Cape Town"
            >
              @Rïch
            </a>
            .{' '}
            <strong>
              <a
                href="https://twitter.com/hatjitsu"
                title="Feedback to us via Twitter"
              >
                Feedback?
              </a>
            </strong>
          </p>
        </footer>
      </div>
    </div>
  );
}
