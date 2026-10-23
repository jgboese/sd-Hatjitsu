import { useEffect, useEffectEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import type {
  CardPack,
  Connection,
  ErrorResponse,
  OkResponse,
  RoomJson,
  ServerToClientEvents,
} from '../../server/protocol.ts';
import { getSessionId, isAdmin, markAdmin } from './cookies.ts';
import { useNotifications } from './notifications.tsx';
import { request, socket } from './socket.ts';
import { CARDS, summarizeVotes, type VoteSummary } from './voting.ts';

// Server broadcasts that mean "the room changed, fetch it again"
const ROOM_UPDATE_EVENTS = [
  'room joined',
  'room left',
  'card pack set',
  'voter status changed',
  'voted',
  'unvoted',
  'vote reset',
  'reveal',
] as const satisfies ReadonlyArray<keyof ServerToClientEvents>;

// Until the room has loaded: nothing on the table and the admin buttons disabled
const LOADING: VoteSummary = {
  votes: [],
  placeholderCount: 0,
  finished: false,
  outcome: 'unfinished',
  average: NaN,
  standardDeviation: '',
  showAverage: false,
  revealDisabled: true,
  sortDisabled: true,
};

/** A room as one participant sees it, and the actions they can take in it. */
export interface RoomState {
  /** null until the room has loaded */
  cardPack: CardPack | null;
  cards: readonly string[];
  sessionId: string | null;
  admin: boolean;
  voter: boolean;
  myVote: string | null;
  summary: VoteSummary;
  /** Votes with `card`; false when voting is closed to this participant */
  vote: (card: string) => boolean;
  /** Takes back the vote on the table that belongs to `sessionId`, if it is ours */
  unvote: (sessionId: string) => void;
  toggleVoter: (voter: boolean) => void;
  setCardPack: (cardPack: CardPack) => void;
  resetVote: () => void;
  forceReveal: () => void;
  sortVotes: () => void;
}

/**
 * Joins the room and keeps it in sync with the server: every broadcast refetches the room, and
 * every (re)connect joins again under the session id kept in a cookie. Our own actions update
 * the local copy straight away instead of waiting for the server's broadcast.
 */
export function useRoom(roomUrl: string): RoomState {
  const navigate = useNavigate();
  const { showMessage, showError } = useNotifications();
  const [room, setRoom] = useState<RoomJson | null>(null);
  const [sessionId, setSessionId] = useState(getSessionId);
  const [admin, setAdmin] = useState(() => isAdmin(roomUrl));

  const receive = useEffectEvent(
    (
      response: RoomJson | ErrorResponse,
      joined?: { sessionId: string | null },
    ) => {
      if ('error' in response) {
        showError(response.error);
        // There is no room to stay in: back to the lobby, as the server's redirect does
        if (joined) void navigate('/', { replace: true });
        return;
      }
      if (response.createAdmin) {
        markAdmin(roomUrl);
        setAdmin(true);
      }
      if (joined) setSessionId(joined.sessionId);
      setRoom(response);
    },
  );
  const announceCardPack = useEffectEvent(() => {
    showMessage('Card pack changed...');
  });

  useEffect(() => {
    const refresh = async () => {
      receive(await request('room info', { roomUrl }));
    };
    const join = async () => {
      const id = getSessionId();
      receive(await request('join room', { roomUrl, sessionId: id }), {
        sessionId: id,
      });
    };
    const onRoomChanged = () => void refresh();
    const onCardPackSet = () => {
      announceCardPack();
    };
    const onConnect = () => void join();

    for (const event of ROOM_UPDATE_EVENTS) socket.on(event, onRoomChanged);
    socket.on('card pack set', onCardPackSet);
    socket.on('connect', onConnect);
    // Before the first connect there is no session id yet; onConnect joins then.
    if (socket.connected) void join();

    return () => {
      for (const event of ROOM_UPDATE_EVENTS) socket.off(event, onRoomChanged);
      socket.off('card pack set', onCardPackSet);
      socket.off('connect', onConnect);
    };
  }, [roomUrl]);

  const me = room?.connections.find((c) => c.sessionId === sessionId);
  const voter = me?.voter ?? true;
  const myVote = me?.vote ?? null;
  const summary = room ? summarizeVotes(room) : LOADING;

  const reportError = (response: OkResponse | ErrorResponse) => {
    if ('error' in response) showError(response.error);
  };
  const updateRoom = (change: (current: RoomJson) => RoomJson) => {
    setRoom((current) => current && change(current));
  };
  const updateMe = (change: Partial<Connection>) => {
    updateRoom((current) => ({
      ...current,
      connections: current.connections.map((c) =>
        c.sessionId === sessionId ? { ...c, ...change } : c,
      ),
    }));
  };

  const resetVote = () => {
    void request('reset vote', { roomUrl }).then(reportError);
  };

  return {
    cardPack: room?.cardPack ?? null,
    cards: room ? CARDS[room.cardPack] : [],
    sessionId,
    admin,
    voter,
    myVote,
    summary,
    vote: (card) => {
      if (card === myVote || summary.finished || !voter) return false;
      updateMe({ vote: card });
      void request('vote', { roomUrl, vote: card, sessionId }).then(
        reportError,
      );
      return true;
    },
    unvote: (voteSessionId) => {
      if (voteSessionId !== sessionId || summary.finished) return;
      updateMe({ vote: null });
      void request('unvote', { roomUrl, sessionId }).then(reportError);
    },
    toggleVoter: (isVoter) => {
      updateMe({ voter: isVoter, ...(isVoter ? {} : { vote: null }) });
      void request('toggle voter', { roomUrl, voter: isVoter, sessionId }).then(
        reportError,
      );
    },
    setCardPack: (cardPack) => {
      updateRoom((current) => ({ ...current, cardPack }));
      resetVote();
      void request('set card pack', { roomUrl, cardPack }).then(reportError);
    },
    resetVote,
    forceReveal: () => {
      updateRoom((current) => ({
        ...current,
        forcedReveal: true,
        alreadySorted: false,
      }));
      void request('force reveal', { roomUrl }).then(reportError);
    },
    sortVotes: () => {
      updateRoom((current) => ({ ...current, alreadySorted: true }));
      void request('sort votes', { roomUrl }).then(reportError);
    },
  };
}
